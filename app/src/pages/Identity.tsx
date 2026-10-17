import { Badge, Dropdown, Option, Switch, Tab, TabList, makeStyles, tokens } from "@fluentui/react-components";
import { useMemo, useState } from "react";
import { useDs } from "../api";
import type { AuthFlowObserved } from "../api/types";
import { HBarChart } from "../components/charts";
import { AuthFlowBadge, DataTable, Mono, PageHeader, QueryState, Section, StatTile, StatusBadge, TileGrid, flowLabel } from "../components/common";
import { fmtAgo, fmtInt, shortScope } from "../lib/format";
import { useUi } from "../state/ui";

const useStyles = makeStyles({
  tabs: { marginBottom: "16px" },
  filters: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)", gap: "16px", marginBottom: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  explain: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, lineHeight: "1.6", margin: 0, paddingLeft: "18px" },
});

export function IdentityPage() {
  const s = useStyles();
  const [tab, setTab] = useState("usage");
  return (
    <>
      <PageHeader
        title="Identity & access"
        subtitle="Who is using agents, and with what authority: delegated, on-behalf-of (OBO), app-only, managed identity and Entra Agent ID."
      />
      <TabList className={s.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
        <Tab value="usage">Usage by principal</Tab>
        <Tab value="graph">Graph activity</Tab>
        <Tab value="perms">Permissions</Tab>
        <Tab value="ids">Agent identities</Tab>
        <Tab value="rbac">Azure RBAC</Tab>
      </TabList>
      {tab === "usage" && <UsageTab />}
      {tab === "graph" && <GraphTab />}
      {tab === "perms" && <PermsTab />}
      {tab === "ids" && <IdsTab />}
      {tab === "rbac" && <RbacTab />}
    </>
  );
}

function UsageTab() {
  const s = useStyles();
  const { range } = useUi();
  const q = useDs("identityUsage", range);
  const [agentsOnly, setAgentsOnly] = useState(true);
  const [flow, setFlow] = useState<AuthFlowObserved | "all">("all");

  const rows = useMemo(() => (q.data ?? []).filter((r) => (!agentsOnly || r.isAgent) && (flow === "all" || r.authFlow === flow)), [q.data, agentsOnly, flow]);
  const byFlow = useMemo(() => {
    const m = new Map<AuthFlowObserved, number>();
    for (const r of (q.data ?? []).filter((r) => !agentsOnly || r.isAgent)) m.set(r.authFlow, (m.get(r.authFlow) ?? 0) + r.signIns);
    return [...m.entries()].map(([f, n]) => ({ flow: flowLabel(f), n })).sort((a, b) => b.n - a.n);
  }, [q.data, agentsOnly]);
  const users = new Set(rows.filter((r) => r.principalType === "user").map((r) => r.principalId)).size;

  return (
    <QueryState q={q} label="sign-in logs">
      {() => (
        <>
          <TileGrid>
            <StatTile label="Distinct users" value={fmtInt(users)} hint="human principals" />
            <StatTile label="OBO sign-ins" value={fmtInt(rows.filter((r) => r.authFlow === "obo").reduce((a, r) => a + r.signIns, 0))} hint="agent acting as user" />
            <StatTile label="Autonomous sign-ins" value={fmtInt(rows.filter((r) => ["app", "agent_identity", "managed_identity"].includes(r.authFlow)).reduce((a, r) => a + r.signIns, 0))} hint="no user in the loop" />
            <StatTile
              label="Failures"
              value={fmtInt(rows.reduce((a, r) => a + r.failures, 0))}
              status={rows.some((r) => r.failures) ? "warning" : "good"}
              hint="sign-in failures"
            />
          </TileGrid>
          <div className={s.grid}>
            <Section title="Sign-ins by auth flow">
              <HBarChart data={byFlow} labelKey="flow" valueKey="n" name="Sign-ins" />
            </Section>
            <Section title="How flows are classified">
              <ul className={s.explain}>
                <li><b>Delegated</b>: interactive user sign-in to the agent (SigninLogs).</li>
                <li><b>On-behalf-of</b>: non-interactive user sign-in where the client is the agent or another middle tier that users sign in to, i.e. the agent exchanged the user's token for a downstream API.</li>
                <li><b>Agent identity</b>: a service principal sign-in by an Entra Agent ID identity (or an SP tagged <Mono>agentctl-agent</Mono>).</li>
                <li><b>App-only</b>: client-credentials sign-in by any other service principal.</li>
                <li><b>Managed identity</b>: AADManagedIdentitySignInLogs, e.g. a Foundry project MI.</li>
              </ul>
            </Section>
          </div>
          <Section
            title="Principals"
            actions={
              <div className={s.filters}>
                <Switch label="Agent-related only" checked={agentsOnly} onChange={(_, d) => setAgentsOnly(d.checked)} />
                <Dropdown value={flow === "all" ? "All flows" : flowLabel(flow)} onOptionSelect={(_, d) => setFlow((d.optionValue as AuthFlowObserved) ?? "all")}>
                  <Option value="all">All flows</Option>
                  {(["delegated", "obo", "agent_identity", "app", "managed_identity"] as AuthFlowObserved[]).map((f) => (
                    <Option key={f} value={f}>
                      {flowLabel(f)}
                    </Option>
                  ))}
                </Dropdown>
              </div>
            }
          >
            <DataTable
              rows={rows}
              rowKey={(r) => `${r.principalId}|${r.clientAppId}|${r.resource}|${r.authFlow}`}
              initialSort={{ key: "n", dir: "desc" }}
              columns={[
                { key: "p", header: "Principal", sort: (r) => r.principalName, render: (r) => r.principalName },
                { key: "t", header: "Type", sort: (r) => r.principalType, render: (r) => <span className={s.muted}>{r.principalType.replace("_", " ")}</span> },
                { key: "f", header: "Flow", sort: (r) => r.authFlow, render: (r) => <AuthFlowBadge flow={r.authFlow} /> },
                { key: "c", header: "Client app", sort: (r) => r.clientAppName, render: (r) => r.clientAppName },
                { key: "res", header: "Resource", sort: (r) => r.resource, render: (r) => r.resource },
                { key: "n", header: "Sign-ins", numeric: true, sort: (r) => r.signIns, render: (r) => fmtInt(r.signIns) },
                { key: "x", header: "Failures", numeric: true, sort: (r) => r.failures, render: (r) => (r.failures ? <StatusBadge level="warning">{r.failures}</StatusBadge> : 0) },
                { key: "ca", header: "Cond. access", sort: (r) => r.conditionalAccess ?? "", render: (r) => <span className={s.muted}>{r.conditionalAccess ?? "—"}</span> },
                { key: "l", header: "Last seen", sort: (r) => r.lastSeen, render: (r) => fmtAgo(r.lastSeen) },
              ]}
            />
          </Section>
        </>
      )}
    </QueryState>
  );
}

function GraphTab() {
  const { range } = useUi();
  const q = useDs("graphActivity", range);
  return (
    <Section title="What agents call in Microsoft Graph" description="MicrosoftGraphActivityLogs: every Graph request, with delegated scopes or app roles used">
      <QueryState q={q} label="Graph activity">
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => `${r.appId}|${r.method}|${r.endpoint}|${r.authFlow}`}
            initialSort={{ key: "n", dir: "desc" }}
            columns={[
              { key: "a", header: "App / agent", sort: (r) => r.appName, render: (r) => r.appName },
              { key: "f", header: "Flow", sort: (r) => r.authFlow, render: (r) => <AuthFlowBadge flow={r.authFlow} /> },
              { key: "m", header: "Method", sort: (r) => r.method, render: (r) => <Badge appearance="outline" color={r.method === "GET" ? "informative" : "warning"}>{r.method}</Badge> },
              { key: "e", header: "Endpoint", sort: (r) => r.endpoint, render: (r) => <Mono>{r.endpoint}</Mono> },
              { key: "s", header: "Scopes / roles used", render: (r) => <Mono>{r.scopesOrRoles}</Mono> },
              { key: "n", header: "Calls", numeric: true, sort: (r) => r.calls, render: (r) => fmtInt(r.calls) },
              { key: "x", header: "Errors", numeric: true, sort: (r) => r.errors, render: (r) => fmtInt(r.errors) },
              { key: "l", header: "Last seen", sort: (r) => r.lastSeen, render: (r) => fmtAgo(r.lastSeen) },
            ]}
          />
        )}
      </QueryState>
    </Section>
  );
}

function PermsTab() {
  const q = useDs("permissionGrants");
  const [agentsOnly, setAgentsOnly] = useState(true);
  return (
    <Section
      title="Delegated & application permissions"
      description="oauth2PermissionGrants (delegated / OBO) and appRoleAssignments (app-only) from Microsoft Graph"
      actions={<Switch label="Agents only" checked={agentsOnly} onChange={(_, d) => setAgentsOnly(d.checked)} />}
    >
      <QueryState q={q} label="permissions">
        {(rows) => (
          <DataTable
            rows={rows.filter((g) => !agentsOnly || g.isAgent)}
            rowKey={(g) => g.id}
            initialSort={{ key: "h", dir: "desc" }}
            columns={[
              { key: "c", header: "Client", sort: (g) => g.clientName, render: (g) => g.clientName },
              { key: "k", header: "Kind", sort: (g) => g.kind, render: (g) => <Badge appearance="outline" color={g.kind === "application" ? "warning" : "brand"}>{g.kind === "application" ? "app-only" : "delegated"}</Badge> },
              { key: "r", header: "Resource", sort: (g) => g.resourceName, render: (g) => g.resourceName },
              { key: "p", header: "Permissions", render: (g) => <Mono>{g.permissions.join(" ")}</Mono> },
              { key: "ct", header: "Consent", sort: (g) => g.consentType, render: (g) => (g.consentType === "AllPrincipals" ? "admin (all users)" : g.consentType === "Principal" ? `user: ${g.principalName}` : "app role") },
              { key: "h", header: "Privilege", sort: (g) => Number(g.highPrivilege), render: (g) => (g.highPrivilege ? <StatusBadge level="serious">high</StatusBadge> : "standard") },
            ]}
          />
        )}
      </QueryState>
    </Section>
  );
}

function IdsTab() {
  const q = useDs("agentIdentities");
  return (
    <Section title="Agent identities" description="Entra Agent ID identities and blueprints (falls back to service principals tagged agentctl-agent)">
      <QueryState q={q} label="agent identities">
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(i) => i.id}
            columns={[
              { key: "n", header: "Name", sort: (i) => i.displayName, render: (i) => i.displayName },
              { key: "k", header: "Kind", sort: (i) => i.kind, render: (i) => <Badge appearance="outline">{i.kind.replace(/_/g, " ")}</Badge> },
              { key: "a", header: "App id", render: (i) => <Mono>{i.appId}</Mono> },
              { key: "b", header: "Blueprint", render: (i) => (i.blueprintId ? rows.find((r) => r.id === i.blueprintId || r.appId === i.blueprintId)?.displayName ?? i.blueprintId : "—") },
              { key: "s", header: "Sponsors", render: (i) => (i.sponsors.length ? i.sponsors.join(", ") : i.kind === "agent_identity" ? <StatusBadge level="warning">none</StatusBadge> : "—") },
              { key: "e", header: "Enabled", render: (i) => (i.accountEnabled ? "yes" : <StatusBadge level="warning">disabled</StatusBadge>) },
              { key: "c", header: "Created", sort: (i) => i.createdDateTime, render: (i) => (i.createdDateTime ? new Date(i.createdDateTime).toLocaleDateString() : "—") },
            ]}
          />
        )}
      </QueryState>
    </Section>
  );
}

function RbacTab() {
  const q = useDs("roleAssignments");
  const [agentsOnly, setAgentsOnly] = useState(true);
  return (
    <Section
      title="Azure role assignments held by apps & agents"
      description="Service principal / managed identity role assignments in the subscription"
      actions={<Switch label="Agents only" checked={agentsOnly} onChange={(_, d) => setAgentsOnly(d.checked)} />}
    >
      <QueryState q={q} label="role assignments">
        {(rows) => (
          <DataTable
            rows={rows.filter((r) => !agentsOnly || r.isAgent)}
            rowKey={(r) => r.id}
            columns={[
              { key: "p", header: "Principal", sort: (r) => r.principalName, render: (r) => r.principalName },
              {
                key: "r",
                header: "Role",
                sort: (r) => r.roleName,
                render: (r) => (/^(Owner|Contributor|User Access Administrator)$/.test(r.roleName) ? <StatusBadge level="critical">{r.roleName}</StatusBadge> : r.roleName),
              },
              { key: "s", header: "Scope", sort: (r) => r.scope, render: (r) => <span title={r.scope}>{shortScope(r.scope)}</span> },
              { key: "a", header: "Agent", render: (r) => (r.isAgent ? "yes" : "—") },
            ]}
          />
        )}
      </QueryState>
    </Section>
  );
}
