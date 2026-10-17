import {
  Badge,
  Button,
  Dropdown,
  MessageBar,
  MessageBarBody,
  Option,
  Tab,
  TabList,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, Wrench16Regular } from "@fluentui/react-icons";
import JSZip from "jszip";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDataSource, useDs } from "../api";
import { useSession } from "../auth/session";
import { buildBundle, downloadBlob } from "../bundle/buildBundle";
import { DataTable, Mono, PageHeader, QueryState, Section, StatTile, StatusBadge, TileGrid } from "../components/common";
import type { Finding } from "../lib/findings";
import { HARNESS_INJECTIONS, HARNESS_TOOLS, MANDATORY_INJECTIONS } from "../lib/harnessLibrary";
import { useFindings } from "../lib/useFindings";
import { RiskBadge } from "../components/common";

const useStyles = makeStyles({
  tabs: { marginBottom: "16px" },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  matrix: { overflowX: "auto" },
  cell: { textAlign: "center" },
  lib: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" },
  libCard: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" },
  row: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" },
});

export function GuardrailsPage() {
  const s = useStyles();
  const [tab, setTab] = useState("findings");
  return (
    <>
      <PageHeader
        title="Guardrails"
        subtitle="Posture findings, content-safety (RAI) policies, Azure Policy compliance and the platform harness library used for injection."
      />
      <TabList className={s.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
        <Tab value="findings">Findings</Tab>
        <Tab value="rai">Content safety</Tab>
        <Tab value="policy">Azure Policy</Tab>
        <Tab value="library">Harness library</Tab>
      </TabList>
      {tab === "findings" && <FindingsTab />}
      {tab === "rai" && <RaiTab />}
      {tab === "policy" && <PolicyTab />}
      {tab === "library" && <LibraryTab />}
    </>
  );
}

function FindingsTab() {
  const nav = useNavigate();
  const ds = useDataSource();
  const { can, user } = useSession();
  const { findings, loading, errors } = useFindings();
  const agents = useDs("listAgents");
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(false);

  const cats = [...new Set(findings.map((f) => f.category))];
  const rows = findings.filter((f) => cat === "all" || f.category === cat);
  const harnessFixes = findings.filter((f) => f.fix === "inject-mandatory" && f.agent);

  /** Admin: one bundle per affected agent, zipped together. */
  async function bulkInjectMandatory() {
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const f of harnessFixes) {
        const agent = agents.data?.find((a) => a.id === f.agent!.id && a.project === f.agent!.project);
        if (!agent) continue;
        const before = await ds.manifestFor(agent);
        const after = structuredClone(before);
        for (const m of MANDATORY_INJECTIONS) if (!after.spec.harness.injections.some((i) => i.id === m.id)) after.spec.harness.injections.push({ ...m });
        const b = await buildBundle({
          before,
          after,
          title: `Inject mandatory harness instructions into ${agent.name}`,
          rationale: "Bulk remediation: platform baseline requires identity disclosure and prompt-injection defense instructions on every agent.",
          requestedBy: user.upn || user.name,
          foundryAgentId: agent.id,
        });
        const dir = zip.folder(`${b.changeRequest.metadata.id}-${agent.name}`)!;
        for (const [p, c] of Object.entries(b.files)) dir.file(p, c);
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), `agentctl-bulk-harness-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setBusy(false);
    }
  }

  const fixLink = (f: Finding) =>
    f.agent && f.fix !== "none" ? `/harness?project=${encodeURIComponent(f.agent.project)}&id=${encodeURIComponent(f.agent.id)}&fix=${f.fix}` : null;

  return (
    <>
      {errors.length > 0 && (
        <MessageBar intent="warning" style={{ marginBottom: 12 }}>
          <MessageBarBody>{errors.length} data source(s) failed; findings may be incomplete. See Data sources.</MessageBarBody>
        </MessageBar>
      )}
      <TileGrid>
        {(["critical", "serious", "warning"] as const).map((sev) => (
          <StatTile key={sev} label={sev} value={findings.filter((f) => f.severity === sev).length} status={sev} hint="open findings" />
        ))}
        <StatTile label="Auto-fixable" value={findings.filter((f) => f.fix !== "none" && f.agent).length} hint="via change request" />
      </TileGrid>
      <Section
        title="Findings"
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Dropdown value={cat === "all" ? "All categories" : cat} onOptionSelect={(_, d) => setCat(d.optionValue ?? "all")}>
              <Option value="all">All categories</Option>
              {cats.map((c) => (
                <Option key={c} value={c}>
                  {c}
                </Option>
              ))}
            </Dropdown>
            <Button
              icon={<ArrowDownload20Regular />}
              disabled={!can("Admin") || !harnessFixes.length || busy}
              title={can("Admin") ? "" : "Requires Admin role"}
              onClick={bulkInjectMandatory}
            >
              {busy ? "Building…" : `Bulk-inject mandatory harness (${harnessFixes.length})`}
            </Button>
          </div>
        }
      >
        {loading ? (
          <Text>Evaluating…</Text>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(f) => f.id}
            columns={[
              { key: "s", header: "Severity", render: (f) => <StatusBadge level={f.severity}>{f.severity}</StatusBadge> },
              { key: "c", header: "Category", render: (f) => f.category },
              {
                key: "t",
                header: "Finding",
                render: (f) => (
                  <div>
                    <div>{f.title}</div>
                    <div style={{ color: tokens.colorNeutralForeground3, fontSize: 12 }}>{f.detail}</div>
                  </div>
                ),
              },
              { key: "r", header: "Resource", render: (f) => f.resource },
              { key: "m", header: "Remediation", render: (f) => <span style={{ fontSize: 12 }}>{f.remediation}</span> },
              {
                key: "x",
                header: "",
                render: (f) => {
                  const link = fixLink(f);
                  return link ? (
                    <Button size="small" icon={<Wrench16Regular />} disabled={!can("Builder")} onClick={() => nav(link)}>
                      Fix
                    </Button>
                  ) : null;
                },
              },
            ]}
          />
        )}
      </Section>
    </>
  );
}

function RaiTab() {
  const s = useStyles();
  const rai = useDs("raiPolicies");
  const deps = useDs("listDeployments");
  const CATS = ["hate", "sexual", "violence", "selfharm"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title="RAI policies" description="Content filters per Foundry account (Microsoft.CognitiveServices/accounts/raiPolicies). Lower threshold = stricter.">
        <QueryState q={rai} label="RAI policies">
          {(pols) => (
            <div className={s.matrix}>
              <DataTable
                rows={pols}
                rowKey={(p) => p.id}
                columns={[
                  { key: "n", header: "Policy", render: (p) => <div><div>{p.name}</div><div className={s.muted}>{p.account}</div></div> },
                  { key: "m", header: "Mode", render: (p) => (p.mode === "Blocking" ? "Blocking" : <StatusBadge level="warning">{p.mode}</StatusBadge>) },
                  ...CATS.map((c) => ({
                    key: c,
                    header: c,
                    render: (p: (typeof pols)[number]) => {
                      const f = p.contentFilters.find((x) => x.name === c && x.source === "Completion") ?? p.contentFilters.find((x) => x.name === c);
                      if (!f || !f.enabled) return <StatusBadge level="critical">off</StatusBadge>;
                      return (
                        <span title={`blocking: ${f.blocking}`}>
                          {f.severityThreshold}
                          {!f.blocking && " (annotate)"}
                        </span>
                      );
                    },
                  })),
                  ...["jailbreak", "indirect_attack", "protected_material_text"].map((c) => ({
                    key: c,
                    header: c.replace(/_/g, " "),
                    render: (p: (typeof pols)[number]) => {
                      const f = p.contentFilters.find((x) => x.name === c);
                      return f?.enabled && f.blocking ? <StatusBadge level="good">on</StatusBadge> : <StatusBadge level="serious">{f?.enabled ? "annotate" : "off"}</StatusBadge>;
                    },
                  })),
                ]}
              />
            </div>
          )}
        </QueryState>
      </Section>
      <Section title="Model deployments" description="Which policy each deployment enforces">
        <QueryState q={deps} label="deployments">
          {(rows) => (
            <DataTable
              rows={rows}
              rowKey={(d) => d.id}
              columns={[
                { key: "a", header: "Account", render: (d) => d.account },
                { key: "n", header: "Deployment", render: (d) => d.name },
                { key: "m", header: "Model", render: (d) => `${d.model} (${d.modelVersion})` },
                { key: "s", header: "SKU", render: (d) => `${d.sku} · ${d.capacity}K TPM` },
                {
                  key: "p",
                  header: "RAI policy",
                  render: (d) => {
                    const pol = rai.data?.find((r) => r.account === d.account && r.name === d.raiPolicyName);
                    const weak = pol && (pol.mode !== "Blocking" || !pol.contentFilters.some((f) => f.name === "jailbreak" && f.enabled && f.blocking));
                    return weak ? <StatusBadge level="serious">{d.raiPolicyName}</StatusBadge> : d.raiPolicyName || <StatusBadge level="critical">none</StatusBadge>;
                  },
                },
              ]}
            />
          )}
        </QueryState>
      </Section>
    </div>
  );
}

function PolicyTab() {
  const q = useDs("policyStates");
  return (
    <Section title="Azure Policy compliance for AI resources" description="Microsoft.PolicyInsights latest policy states for Cognitive Services, Search, Web, Monitor, Storage and Key Vault">
      <QueryState q={q} label="policy states">
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(p) => p.policyDefinitionName + p.resourceId}
            initialSort={{ key: "c", dir: "asc" }}
            columns={[
              {
                key: "c",
                header: "State",
                sort: (p) => p.complianceState,
                render: (p) =>
                  p.complianceState === "Compliant" ? <StatusBadge level="good">compliant</StatusBadge> : p.complianceState === "NonCompliant" ? <StatusBadge level="serious">non-compliant</StatusBadge> : <Badge>unknown</Badge>,
              },
              { key: "d", header: "Policy", sort: (p) => p.policyDefinitionDisplayName, render: (p) => p.policyDefinitionDisplayName },
              { key: "r", header: "Resource", sort: (p) => p.resourceId, render: (p) => <span title={p.resourceId}>{p.resourceId.split("/").pop()}</span> },
              { key: "a", header: "Assignment", sort: (p) => p.policyAssignmentName, render: (p) => <Mono>{p.policyAssignmentName}</Mono> },
            ]}
          />
        )}
      </QueryState>
    </Section>
  );
}

function LibraryTab() {
  const s = useStyles();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title="Harness instructions" description="Platform-owned instruction fragments. Mandatory ones are added to every new agent and their removal is privileged.">
        <div className={s.lib}>
          {HARNESS_INJECTIONS.map((i) => (
            <div key={i.id} className={s.libCard}>
              <div className={s.row}>
                <Text weight="semibold">{i.title}</Text>
                {i.mandatory && <Badge color="danger" appearance="tint">mandatory</Badge>}
                <Badge appearance="outline">{i.position}</Badge>
                <Badge appearance="outline">{i.category}</Badge>
              </div>
              <Mono>{i.id}</Mono>
              <Text size={200}>{i.text}</Text>
              <span className={s.muted}>{i.reason}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Pre-vetted tools" description="Tools the platform can inject into any agent. Risk tier determines required approvers.">
        <div className={s.lib}>
          {HARNESS_TOOLS.map((t) => (
            <div key={t.tool.name} className={s.libCard}>
              <div className={s.row}>
                <Text weight="semibold">{t.title}</Text>
                <RiskBadge tier={t.tool.riskTier} />
                <Badge appearance="outline">{t.tool.type}</Badge>
              </div>
              <Mono>{t.tool.name}</Mono>
              <Text size={200}>{t.summary}</Text>
              <span className={s.muted}>approval: {t.tool.requireApproval}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
