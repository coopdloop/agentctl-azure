import { Badge, Button, Dropdown, MessageBar, MessageBarBody, Option, Tab, TabList, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowReset20Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDataSource, useDs } from "../api";
import type { Agent } from "../api/types";
import { useSession } from "../auth/session";
import { computeChanges } from "../bundle/risk";
import { ErrorBar, PageHeader, RiskBadge, Section } from "../components/common";
import { MANDATORY_INJECTIONS } from "../lib/harnessLibrary";
import { defaultRaiPolicy, maxTier } from "../lib/manifestDefaults";
import type { AgentManifest } from "../schema/manifest";
import type { RiskTier } from "../config";
import { BundlePanel } from "./builder/BundlePanel";
import { Hint } from "./builder/fields";
import {
  BasicsSection,
  GuardrailsSection,
  IdentitySection,
  InstructionsSection,
  KnowledgeSection,
  OpsSection,
  PlacementSection,
  ToolsSection,
  type Update,
} from "./builder/sections";

type Fix = "inject-mandatory" | "require-approval" | "strict-rai" | "review-identity";

const FIX_INFO: Record<Fix, { tab: string; title: string; rationale: string }> = {
  "inject-mandatory": {
    tab: "instructions",
    title: "Inject mandatory harness instructions",
    rationale: "Platform baseline requires identity-disclosure and prompt-injection-defense instructions on every agent (finding: missing mandatory harness).",
  },
  "require-approval": {
    tab: "tools",
    title: "Require human approval on write-capable tools",
    rationale: "Write-capable tools currently execute without human approval (finding: write tool without approval).",
  },
  "strict-rai": {
    tab: "guardrails",
    title: "Apply strict content-safety policy",
    rationale: "The agent's model deployment uses a weak RAI policy (non-blocking mode or jailbreak shield off).",
  },
  "review-identity": {
    tab: "identity",
    title: "Reduce agent identity privileges",
    rationale: "The agent's identity holds high-privilege permissions (finding: identity review).",
  },
};

function applyFix(m: AgentManifest, fix: Fix) {
  if (fix === "inject-mandatory") {
    for (const inj of MANDATORY_INJECTIONS) if (!m.spec.harness.injections.some((i) => i.id === inj.id)) m.spec.harness.injections.push({ ...inj });
  } else if (fix === "require-approval") {
    for (const t of m.spec.tools) if (t.riskTier !== "read" || t.type === "mcp" || t.type === "browser_automation") t.requireApproval = "always";
  } else if (fix === "strict-rai") {
    const strict = defaultRaiPolicy("agentctl-strict");
    for (const k of ["hate", "sexual", "violence", "selfharm"] as const) strict.filters[k].severityThreshold = "Low";
    m.spec.guardrails.raiPolicy = strict;
  }
}

const useStyles = makeStyles({
  picker: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  summary: {
    position: "sticky",
    top: "-24px",
    zIndex: 2,
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "10px 14px",
    margin: "16px 0",
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  tabs: { marginBottom: "16px" },
  spacer: { flex: 1 },
});

export function HarnessPage() {
  const s = useStyles();
  const [params, setParams] = useSearchParams();
  const ds = useDataSource();
  const { user } = useSession();
  const agents = useDs("listAgents");
  const project = params.get("project") ?? "";
  const id = params.get("id") ?? "";
  const fix = params.get("fix") as Fix | null;
  const agent = agents.data?.find((a) => a.project === project && a.id === id);

  const [before, setBefore] = useState<AgentManifest | null>(null);
  const [after, setAfter] = useState<AgentManifest | null>(null);
  const [tab, setTab] = useState("instructions");
  const [loadErr, setLoadErr] = useState<unknown>(null);

  useEffect(() => {
    if (!agent) return;
    let cancelled = false;
    setLoadErr(null);
    ds.manifestFor(agent)
      .then((m) => {
        if (cancelled) return;
        const next = structuredClone(m);
        if (fix && FIX_INFO[fix]) {
          applyFix(next, fix);
          setTab(FIX_INFO[fix].tab);
        }
        setBefore(m);
        setAfter(next);
      })
      .catch((e) => !cancelled && setLoadErr(e));
    return () => {
      cancelled = true;
    };
  }, [agent, ds, fix]);

  const update: Update = useCallback((fn) => setAfter((prev) => {
    if (!prev) return prev;
    const next = structuredClone(prev);
    fn(next);
    return next;
  }), []);

  const changes = useMemo(() => (before && after ? computeChanges(before, after) : []), [before, after]);
  const tier = changes.reduce<RiskTier>((t, c) => maxTier(t, c.riskTier), "read");
  const pick = (a: Agent) => setParams({ project: a.project, id: a.id });
  const props = after ? { m: after, update, base: before, injectedBy: user.upn || user.name } : null;

  return (
    <>
      <PageHeader
        title="Harness injection"
        subtitle="Give an existing agent additional tools (with approval), inject platform instructions, or tighten its guardrails. The result is a change request bundle for the GitOps pipeline."
      />
      <Section title="Target agent">
        <div className={s.picker}>
          <Dropdown
            placeholder="Select an agent"
            value={agent ? `${agent.name} (${agent.account}/${agent.project})` : ""}
            onOptionSelect={(_, d) => {
              const a = agents.data?.find((x) => `${x.project}/${x.id}` === d.optionValue);
              if (a) pick(a);
            }}
            style={{ minWidth: 360 }}
          >
            {(agents.data ?? []).map((a) => (
              <Option key={a.id} value={`${a.project}/${a.id}`} text={`${a.name} (${a.account}/${a.project})`}>
                {a.name} · {a.account}/{a.project}
              </Option>
            ))}
          </Dropdown>
          {fix && FIX_INFO[fix] && <Badge appearance="tint" color="brand">preset: {FIX_INFO[fix].title}</Badge>}
          {agent && before && (
            <Button icon={<ArrowReset20Regular />} onClick={() => setAfter(structuredClone(before))}>
              Reset to deployed
            </Button>
          )}
        </div>
        {!agent && <Hint>Pick an agent, or use “Fix” on a guardrail finding to start from a preset.</Hint>}
      </Section>

      {loadErr != null && <ErrorBar error={loadErr} />}

      {props && before && (
        <>
          <div className={s.summary}>
            <b>{changes.length}</b> change{changes.length === 1 ? "" : "s"}
            {changes.length > 0 && <RiskBadge tier={tier} />}
            <span className={s.spacer} />
            <Button appearance="primary" disabled={!changes.length} onClick={() => setTab("review")}>
              Review & export
            </Button>
          </div>
          {agent?.metadata.environment === "prod" && (
            <MessageBar intent="info" style={{ marginBottom: 12 }}>
              <MessageBarBody>Production agent: changes are applied only after the pipeline's approval gates.</MessageBarBody>
            </MessageBar>
          )}
          <TabList className={s.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
            <Tab value="instructions">Instructions & harness</Tab>
            <Tab value="tools">Tools</Tab>
            <Tab value="identity">Identity & access</Tab>
            <Tab value="guardrails">Guardrails</Tab>
            <Tab value="model">Model & metadata</Tab>
            <Tab value="other">Knowledge & ops</Tab>
            <Tab value="review">Review & export</Tab>
          </TabList>
          {tab === "instructions" && <InstructionsSection {...props} />}
          {tab === "tools" && <ToolsSection {...props} />}
          {tab === "identity" && <IdentitySection {...props} />}
          {tab === "guardrails" && <GuardrailsSection {...props} />}
          {tab === "model" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PlacementSection {...props} />
              <BasicsSection {...props} />
            </div>
          )}
          {tab === "other" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <KnowledgeSection {...props} />
              <OpsSection {...props} />
            </div>
          )}
          {tab === "review" && (
            <BundlePanel
              before={before}
              after={props.m}
              foundryAgentId={agent?.id}
              defaultTitle={fix && FIX_INFO[fix] ? `${FIX_INFO[fix].title}: ${before.metadata.name}` : `Update ${before.metadata.name}`}
              defaultRationale={fix && FIX_INFO[fix] ? FIX_INFO[fix].rationale : ""}
            />
          )}
        </>
      )}
    </>
  );
}
