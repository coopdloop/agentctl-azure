import { Button, MessageBar, MessageBarBody, MessageBarTitle, Switch, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useDs } from "../api";
import { SCOPES, consent, type ScopeKey } from "../auth/msal";
import { useSession } from "../auth/session";
import { config, liveCapable } from "../config";
import { DataTable, Mono, PageHeader, QueryState, Section, StatusBadge } from "../components/common";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: "16px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  row: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" },
  code: { background: tokens.colorNeutralBackground3 },
});

const host = (u: string) => u.replace(/^https:\/\//, "");
const via = (svc: "arm" | "graph" | "logAnalytics") => (config.network.proxyServices.includes(svc) ? " (via /proxy)" : "");
const { cloud } = config;
const SOURCES: { source: string; api: string; token: string; permission: string; feeds: string }[] = [
  { source: "Azure Resource Manager", api: host(cloud.arm) + via("arm"), token: "ARM user_impersonation", permission: "Reader on observed subscriptions (or Foundry User per project)", feeds: "Foundry accounts, projects, deployments, RAI policies, RBAC" },
  { source: "Azure Resource Graph", api: `${host(cloud.arm)}/providers/Microsoft.ResourceGraph${via("arm")}`, token: "ARM user_impersonation", permission: "Read on the resources (RBAC-filtered)", feeds: "Multi-subscription discovery of Foundry accounts and projects" },
  { source: "Foundry Agent Service", api: `<account>${cloud.foundryHostSuffixes[0]}/api/projects/<p> (via /proxy)`, token: cloud.foundryAudience, permission: "Foundry User on each project", feeds: "Agent definitions, tools, instructions" },
  { source: "Log Analytics", api: host(cloud.logAnalytics) + via("logAnalytics"), token: "Log Analytics Data.Read", permission: "Log Analytics Reader, or agentctl Telemetry Reader (App* tables)", feeds: "Traces, sign-in logs, Graph activity" },
  { source: "App Insights (workspace-based)", api: "AppDependencies / AppRequests tables", token: "(same as Log Analytics)", permission: "Workspace access (table-level for scoped users)", feeds: "gen_ai spans: runs, tool calls, tokens" },
  { source: "Entra sign-in logs", api: "SigninLogs, AADNonInteractiveUserSignInLogs, AADServicePrincipalSignInLogs, AADManagedIdentitySignInLogs", token: "(Log Analytics)", permission: "Entra diagnostic setting to the workspace (P1/P2)", feeds: "Delegated / OBO / app / MI usage" },
  { source: "Graph activity logs", api: "MicrosoftGraphActivityLogs", token: "(Log Analytics)", permission: "Entra diagnostic setting (Graph activity)", feeds: "What agents call in Graph" },
  { source: "Microsoft Graph", api: `${host(cloud.graph)}/v1.0${via("graph")}`, token: "Application.Read.All, Directory.Read.All, DelegatedPermissionGrant.Read.All", permission: "Admin consent", feeds: "Permission grants, app role assignments, names" },
  { source: "Entra Agent ID", api: `${host(cloud.graph)}/beta …/microsoft.graph.agentIdentity`, token: "AgentIdentity.Read.All (preview)", permission: "Admin consent; falls back to SPs tagged agentctl-agent", feeds: "Agent identities, blueprints, sponsors" },
  { source: "Azure Policy", api: "Microsoft.PolicyInsights/policyStates", token: "ARM", permission: "Reader on observed subscriptions", feeds: "Compliance of AI resources" },
];

export function SettingsPage() {
  const s = useStyles();
  const session = useSession();
  const qc = useQueryClient();
  const health = useDs("health");

  return (
    <div className={s.stack}>
      <PageHeader title="Data sources" subtitle="Where every number in agentctl comes from, and whether each source is reachable with your identity." />
      {!liveCapable && (
        <MessageBar intent="info">
          <MessageBarBody>
            <MessageBarTitle>Running on mock data</MessageBarTitle>
            Set AGENTCTL_TENANT_ID, AGENTCTL_CLIENT_ID and AGENTCTL_SUBSCRIPTION_ID (app/.env.local locally, app settings in App Service) to enable live mode. Terraform outputs these values.
          </MessageBarBody>
        </MessageBar>
      )}
      <Section
        title="Mode"
        actions={
          <Switch
            label={session.mode === "live" ? "Live Azure data" : "Mock data"}
            checked={session.mode === "live"}
            disabled={!liveCapable}
            onChange={(_, d) => {
              session.setMode(d.checked ? "live" : "mock");
              qc.clear();
            }}
          />
        }
      >
        {session.mode === "live" && (
          <div className={s.row}>
            <span>Grant consent per audience:</span>
            {(Object.keys(SCOPES) as ScopeKey[]).map((k) => (
              <Button key={k} size="small" onClick={() => consent(k).then(() => qc.invalidateQueries())}>
                {k}
              </Button>
            ))}
          </div>
        )}
      </Section>
      <Section
        title="Health"
        actions={
          <Button icon={<ArrowClockwise20Regular />} onClick={() => health.refetch()}>
            Re-test
          </Button>
        }
      >
        <QueryState q={health} label="health checks">
          {(rows) => (
            <DataTable
              rows={rows}
              rowKey={(r) => r.source}
              columns={[
                { key: "s", header: "", render: (r) => <StatusBadge level={r.ok ? "good" : "critical"}>{r.ok ? "ok" : "error"}</StatusBadge> },
                { key: "n", header: "Source", render: (r) => r.source },
                { key: "d", header: "Detail", render: (r) => <span style={{ fontSize: 12 }}>{r.detail}</span> },
                { key: "l", header: "Latency", numeric: true, render: (r) => (r.latencyMs != null ? `${r.latencyMs} ms` : "—") },
              ]}
            />
          )}
        </QueryState>
      </Section>
      <Section title="Sources of truth" description="The Azure APIs each view reads from, and what the signed-in user needs.">
        <DataTable
          rows={SOURCES}
          rowKey={(r) => r.source}
          columns={[
            { key: "s", header: "Source", render: (r) => r.source },
            { key: "a", header: "API / tables", render: (r) => <Mono>{r.api}</Mono> },
            { key: "t", header: "Token / scope", render: (r) => <span style={{ fontSize: 12 }}>{r.token}</span> },
            { key: "p", header: "Required access", render: (r) => <span style={{ fontSize: 12 }}>{r.permission}</span> },
            { key: "f", header: "Feeds", render: (r) => <span style={{ fontSize: 12 }}>{r.feeds}</span> },
          ]}
        />
      </Section>
      <div className={s.grid}>
        <Section title="Runtime configuration" description="Served from /config.js (App Service app settings). No secrets.">
          <pre className={`code ${s.code}`}>{JSON.stringify(config, null, 2)}</pre>
        </Section>
        <Section title="Requested scopes">
          <pre className={`code ${s.code}`}>{JSON.stringify(SCOPES, null, 2)}</pre>
        </Section>
      </div>
    </div>
  );
}
