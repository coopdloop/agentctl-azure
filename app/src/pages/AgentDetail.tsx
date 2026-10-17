import { Badge, Button, Tab, TabList, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular, BranchRequest20Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDs } from "../api";
import type { Agent, AgentRun, TimeRange } from "../api/types";
import { toYaml } from "../bundle/buildBundle";
import {
  AuthFlowBadge,
  DataTable,
  ErrorBar,
  PageHeader,
  QueryState,
  RiskBadge,
  Section,
  StatTile,
  StatusBadge,
  TileGrid,
} from "../components/common";
import { RunDrawer } from "../components/RunDrawer";
import { useSession } from "../auth/session";
import { fmtAgo, fmtCompact, fmtInt, fmtMs, fmtPct, shortScope } from "../lib/format";
import { TOOL_TYPE_INFO, extractInjections } from "../lib/manifestDefaults";
import { useFindings } from "../lib/useFindings";
import { useUi } from "../state/ui";
import { RunsTable } from "./Activity";
import type { ToolType } from "../schema/manifest";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  prompt: { background: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium, padding: "12px", whiteSpace: "pre-wrap", fontSize: tokens.fontSizeBase200, fontFamily: tokens.fontFamilyMonospace, maxHeight: "480px", overflow: "auto" },
  inj: { borderLeft: `3px solid ${tokens.colorBrandStroke1}`, background: tokens.colorBrandBackground2, padding: "6px 10px", margin: "6px 0", borderRadius: "4px" },
  injHead: { fontSize: tokens.fontSizeBase100, color: tokens.colorBrandForeground1, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" },
  kv: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", fontSize: tokens.fontSizeBase300 },
  muted: { color: tokens.colorNeutralForeground3 },
  tabs: { marginBottom: "16px" },
  actions: { display: "flex", gap: "8px" },
});

export function AgentDetailPage() {
  const s = useStyles();
  const { project = "", id = "" } = useParams();
  const nav = useNavigate();
  const { range } = useUi();
  const { can, canPropose } = useSession();
  const agentQ = useDs("getAgent", project, id);
  const [tab, setTab] = useState("overview");

  return (
    <QueryState q={agentQ} label="agent">
      {(agent) =>
        !agent ? (
          <ErrorBar error={new Error(`Agent ${id} not found in ${project}`)} />
        ) : (
          <>
            <PageHeader
              title={agent.name}
              subtitle={
                <>
                  {agent.description} <span className={s.muted}>· {agent.account}/{agent.project} · {agent.id}</span>
                </>
              }
              actions={
                <div className={s.actions}>
                  <Button icon={<ArrowLeft20Regular />} onClick={() => nav("/agents")}>
                    All agents
                  </Button>
                  <Button
                    appearance="primary"
                    icon={<BranchRequest20Regular />}
                    disabled={!canPropose}
                    onClick={() => nav(`/harness?project=${encodeURIComponent(agent.project)}&id=${encodeURIComponent(agent.id)}`)}
                  >
                    {can("Builder") ? "Propose change" : "Suggest change"}
                  </Button>
                </div>
              }
            />
            <TabList className={s.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
              <Tab value="overview">Overview</Tab>
              <Tab value="activity">Activity</Tab>
              {can("IdentityReader") && <Tab value="identity">Identity & access</Tab>}
              <Tab value="guardrails">Guardrails</Tab>
              <Tab value="manifest">Manifest</Tab>
            </TabList>
            {tab === "overview" && <OverviewTab agent={agent} range={range} />}
            {tab === "activity" && <ActivityTab agentName={agent.name} range={range} />}
            {tab === "identity" && can("IdentityReader") && <IdentityTab agentName={agent.name} range={range} />}
            {tab === "guardrails" && <GuardrailsTab agentId={agent.id} account={agent.account} model={agent.model} />}
            {tab === "manifest" && <ManifestTab agent={agent} />}
          </>
        )
      }
    </QueryState>
  );
}

type AgentT = Agent;

function OverviewTab({ agent, range }: { agent: AgentT; range: TimeRange }) {
  const s = useStyles();
  const stats = useDs("agentStats", range);
  const st = stats.data?.find((x) => x.agentName === agent.name);
  const { ownerText, injections } = useMemo(() => extractInjections(agent.instructions), [agent.instructions]);
  return (
    <>
      <TileGrid>
        <StatTile label={`Runs · ${range}`} value={fmtInt(st?.runs)} hint={`${fmtPct(st?.failedRuns ?? 0, st?.runs ?? 0)} failed`} />
        <StatTile label="Users" value={fmtInt(st?.distinctUsers)} hint="distinct callers" />
        <StatTile label="Tool calls" value={fmtCompact(st?.toolCalls)} />
        <StatTile label="Tokens" value={fmtCompact((st?.inputTokens ?? 0) + (st?.outputTokens ?? 0))} />
        <StatTile label="p95 latency" value={fmtMs(st?.p95LatencyMs)} hint={`last run ${fmtAgo(st?.lastActivity)}`} />
      </TileGrid>
      <div className={s.grid}>
        <Section title="Effective instructions" description="Platform harness injections are highlighted; the rest is owned by the agent team.">
          <div className={s.prompt}>
            {injections.filter((i) => i.position === "prepend").map((i) => (
              <div key={i.id} className={s.inj}>
                <div className={s.injHead}>harness · {i.id}{i.mandatory ? " · mandatory" : ""}</div>
                {i.text}
              </div>
            ))}
            {ownerText}
            {injections.filter((i) => i.position === "append").map((i) => (
              <div key={i.id} className={s.inj}>
                <div className={s.injHead}>harness · {i.id}{i.mandatory ? " · mandatory" : ""}</div>
                {i.text}
              </div>
            ))}
          </div>
        </Section>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="Definition">
            <div className={s.kv}>
              <span className={s.muted}>Foundry API</span>
              <span>{agent.api === "agents" ? `agents · version ${agent.version ?? "?"} (${agent.kind ?? "prompt"})` : agent.api === "assistants" ? "classic assistants" : "—"}</span>
              {agent.agentIdentityId && (
                <>
                  <span className={s.muted}>Agent identity</span>
                  <span style={{ fontFamily: tokens.fontFamilyMonospace, fontSize: 12 }}>{agent.agentIdentityId}</span>
                </>
              )}
              <span className={s.muted}>Model deployment</span>
              <span>{agent.model}</span>
              <span className={s.muted}>Temperature / top_p</span>
              <span>
                {agent.temperature ?? "—"} / {agent.topP ?? "—"}
              </span>
              <span className={s.muted}>Owner</span>
              <span>{agent.owner ?? "—"}</span>
              <span className={s.muted}>Team</span>
              <span>{agent.metadata.team ?? "—"}</span>
              <span className={s.muted}>Classification</span>
              <span>{agent.metadata.dataClassification ?? "—"}</span>
              <span className={s.muted}>Created</span>
              <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
            </div>
          </Section>
          <Section title={`Tools (${agent.tools.length})`}>
            <DataTable
              rows={agent.tools}
              rowKey={(t) => t.type + t.name}
              columns={[
                { key: "n", header: "Tool", render: (t) => t.name },
                { key: "t", header: "Type", render: (t) => TOOL_TYPE_INFO[t.type as ToolType]?.label ?? t.type },
                { key: "r", header: "Base risk", render: (t) => <RiskBadge tier={TOOL_TYPE_INFO[t.type as ToolType]?.baseRisk ?? "write"} /> },
                {
                  key: "a",
                  header: "Approval",
                  render: (t) =>
                    t.requireApproval === "never" && ["mcp", "browser_automation"].includes(t.type) ? (
                      <StatusBadge level="serious">never</StatusBadge>
                    ) : (
                      (t.requireApproval ?? "—")
                    ),
                },
              ]}
            />
          </Section>
        </div>
      </div>
    </>
  );
}

function ActivityTab({ agentName, range }: { agentName: string; range: TimeRange }) {
  const runs = useDs("listRuns", range, agentName);
  const [open, setOpen] = useState<AgentRun | null>(null);
  return (
    <Section title="Recent runs">
      <QueryState q={runs}>{(rows) => <RunsTable runs={rows} onOpen={setOpen} hideAgent />}</QueryState>
      <RunDrawer run={open} onClose={() => setOpen(null)} />
    </Section>
  );
}

function IdentityTab({ agentName, range }: { agentName: string; range: TimeRange }) {
  const usage = useDs("identityUsage", range);
  const grants = useDs("permissionGrants");
  const roles = useDs("roleAssignments");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title="Who uses this agent, and how" description="Entra sign-ins where the agent is the resource (delegated) or the client (OBO / agent identity)">
        <QueryState q={usage}>
          {(rows) => (
            <DataTable
              rows={rows.filter((r) => r.resource === agentName || r.clientAppName === agentName || r.principalName === agentName)}
              rowKey={(r) => `${r.principalId}|${r.clientAppId}|${r.resource}|${r.authFlow}`}
              initialSort={{ key: "n", dir: "desc" }}
              columns={[
                { key: "p", header: "Principal", sort: (r) => r.principalName, render: (r) => r.principalName },
                { key: "f", header: "Flow", sort: (r) => r.authFlow, render: (r) => <AuthFlowBadge flow={r.authFlow} /> },
                { key: "c", header: "Client app", sort: (r) => r.clientAppName, render: (r) => r.clientAppName },
                { key: "res", header: "Resource", sort: (r) => r.resource, render: (r) => r.resource },
                { key: "n", header: "Sign-ins", numeric: true, sort: (r) => r.signIns, render: (r) => fmtInt(r.signIns) },
                { key: "l", header: "Last seen", sort: (r) => r.lastSeen, render: (r) => fmtAgo(r.lastSeen) },
              ]}
            />
          )}
        </QueryState>
      </Section>
      <Section title="Permissions held">
        <QueryState q={grants}>
          {(rows) => (
            <DataTable
              rows={rows.filter((g) => g.clientName === agentName)}
              rowKey={(g) => g.id}
              empty="No Graph/API permissions found for this agent's identity."
              columns={[
                { key: "k", header: "Kind", render: (g) => <Badge appearance="outline">{g.kind}</Badge> },
                { key: "r", header: "Resource", render: (g) => g.resourceName },
                { key: "p", header: "Permissions", render: (g) => g.permissions.join(", ") },
                { key: "c", header: "Consent", render: (g) => g.consentType },
                { key: "h", header: "Privilege", render: (g) => (g.highPrivilege ? <StatusBadge level="serious">high</StatusBadge> : "standard") },
              ]}
            />
          )}
        </QueryState>
      </Section>
      <Section title="Azure RBAC">
        <QueryState q={roles}>
          {(rows) => (
            <DataTable
              rows={rows.filter((r) => r.principalName === agentName)}
              rowKey={(r) => r.id}
              empty="No Azure role assignments for this agent's identity (project managed identity assignments appear on the Identity page)."
              columns={[
                { key: "r", header: "Role", render: (r) => r.roleName },
                { key: "s", header: "Scope", render: (r) => <span title={r.scope}>{shortScope(r.scope)}</span> },
              ]}
            />
          )}
        </QueryState>
      </Section>
    </div>
  );
}

function GuardrailsTab({ agentId, account, model }: { agentId: string; account: string; model: string }) {
  const deps = useDs("listDeployments");
  const rai = useDs("raiPolicies");
  const { findings } = useFindings();
  const dep = deps.data?.find((d) => d.account === account && d.name === model);
  const pol = rai.data?.find((r) => r.account === account && r.name === dep?.raiPolicyName);
  const mine = findings.filter((f) => f.agent?.id === agentId);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title="Findings for this agent">
        <DataTable
          rows={mine}
          rowKey={(f) => f.id}
          empty="No findings."
          columns={[
            { key: "s", header: "Severity", render: (f) => <StatusBadge level={f.severity}>{f.severity}</StatusBadge> },
            { key: "t", header: "Finding", render: (f) => f.title },
            { key: "d", header: "Detail", render: (f) => f.detail },
            { key: "r", header: "Remediation", render: (f) => f.remediation },
          ]}
        />
      </Section>
      <Section title="Content safety on the model deployment" description={dep ? `${dep.name} (${dep.model} ${dep.modelVersion}) → RAI policy ${dep.raiPolicyName || "none"}` : "Deployment not found"}>
        {pol ? (
          <DataTable
            rows={pol.contentFilters}
            rowKey={(f) => f.name + f.source}
            columns={[
              { key: "n", header: "Filter", render: (f) => f.name },
              { key: "s", header: "Applies to", render: (f) => f.source },
              { key: "e", header: "Enabled", render: (f) => (f.enabled ? "yes" : <StatusBadge level="serious">no</StatusBadge>) },
              { key: "b", header: "Blocking", render: (f) => (f.blocking ? "yes" : <StatusBadge level="warning">no</StatusBadge>) },
              { key: "t", header: "Threshold", render: (f) => f.severityThreshold ?? "—" },
            ]}
          />
        ) : (
          <Text>No RAI policy details available.</Text>
        )}
      </Section>
    </div>
  );
}

function ManifestTab({ agent }: { agent: AgentT }) {
  const m = useDs("manifestFor", agent);
  return (
    <Section title="Current state as manifest" description="Reverse-mapped from the deployed Foundry definition. This is the 'before' side of any change request.">
      <QueryState q={m}>{(man) => <pre className="code" style={{ background: tokens.colorNeutralBackground3 }}>{toYaml(man)}</pre>}</QueryState>
    </Section>
  );
}
