import { Button, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { ArrowLeft16Regular, ArrowRight16Regular, ArrowReset20Regular, CheckmarkCircle16Filled, Circle16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/common";
import { emptyManifest } from "../../lib/manifestDefaults";
import type { AgentManifest } from "../../schema/manifest";
import { validateAgent } from "../../schema/validate";
import { BundlePanel } from "./BundlePanel";
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
} from "./sections";

const DRAFT_KEY = "agentctl.builderDraft";

const STEPS = [
  { id: "basics", label: "Basics & ownership", paths: ["/metadata"] },
  { id: "placement", label: "Project & model", paths: ["/spec/foundry", "/spec/model"] },
  { id: "instructions", label: "Instructions & harness", paths: ["/spec/instructions", "/spec/harness"] },
  { id: "tools", label: "Tools", paths: ["/spec/tools"] },
  { id: "knowledge", label: "Knowledge", paths: ["/spec/knowledge"] },
  { id: "identity", label: "Identity & access", paths: ["/spec/identity", "/spec/access"] },
  { id: "guardrails", label: "Guardrails", paths: ["/spec/guardrails"] },
  { id: "ops", label: "Observability & lifecycle", paths: ["/spec/observability", "/spec/lifecycle"] },
  { id: "review", label: "Review & export", paths: [] },
] as const;

const useStyles = makeStyles({
  layout: { display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: "20px", alignItems: "start", "@media (max-width: 900px)": { gridTemplateColumns: "1fr" } },
  steps: { position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: "2px", background: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge, padding: "8px", boxShadow: tokens.shadow2 },
  step: { justifyContent: "flex-start", fontWeight: 400 },
  stepActive: { background: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  nav: { display: "flex", justifyContent: "space-between", marginTop: "16px" },
});

function loadDraft(): AgentManifest {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyManifest(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyManifest();
}

export function BuilderPage() {
  const s = useStyles();
  const [m, setM] = useState<AgentManifest>(loadDraft);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(m));
    } catch {
      /* draft persistence is best-effort */
    }
  }, [m]);

  const update: Update = useCallback((fn) => setM((prev) => {
    const next = structuredClone(prev);
    fn(next);
    return next;
  }), []);

  const issues = useMemo(() => validateAgent(m), [m]);
  const stepHasIssues = (paths: readonly string[]) => issues.some((i) => paths.some((p) => i.path.startsWith(p)));
  const props = { m, update };
  const current = STEPS[step];

  return (
    <>
      <PageHeader
        title="Agent builder"
        subtitle="Define a new agent end to end. The output is a reviewable bundle (manifest, change request, Foundry payload, Terraform) for the GitOps pipeline."
        actions={
          <Button icon={<ArrowReset20Regular />} onClick={() => confirm("Discard this draft?") && (setM(emptyManifest()), setStep(0))}>
            New draft
          </Button>
        }
      />
      <div className={s.layout}>
        <nav className={s.steps} aria-label="Builder steps">
          {STEPS.map((st, i) => {
            const bad = st.paths.length > 0 && stepHasIssues(st.paths);
            return (
              <Button
                key={st.id}
                appearance="subtle"
                className={mergeClasses(s.step, i === step && s.stepActive)}
                icon={st.paths.length === 0 ? undefined : bad ? <Circle16Regular /> : <CheckmarkCircle16Filled style={{ color: tokens.colorPaletteGreenForeground1 }} />}
                onClick={() => setStep(i)}
              >
                {i + 1}. {st.label}
              </Button>
            );
          })}
        </nav>
        <div>
          {current.id === "basics" && <BasicsSection {...props} />}
          {current.id === "placement" && <PlacementSection {...props} />}
          {current.id === "instructions" && <InstructionsSection {...props} />}
          {current.id === "tools" && <ToolsSection {...props} />}
          {current.id === "knowledge" && <KnowledgeSection {...props} />}
          {current.id === "identity" && <IdentitySection {...props} />}
          {current.id === "guardrails" && <GuardrailsSection {...props} />}
          {current.id === "ops" && <OpsSection {...props} />}
          {current.id === "review" && (
            <BundlePanel before={null} after={m} defaultTitle={`Register new agent ${m.metadata.name || "(unnamed)"}`} />
          )}
          <div className={s.nav}>
            <Button icon={<ArrowLeft16Regular />} disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 && (
              <Button appearance="primary" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
