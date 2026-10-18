// Wraps any DataSource so every result is limited to the user's resolved scope.
// Project scoping is also enforced by Azure RBAC (see auth/scope.ts); this keeps the UI consistent
// and applies agent-level refinements that RBAC cannot express.

import { agentAllowed, projectAllowed, type ResolvedScope } from "../auth/scope";
import type { Agent, AgentRun, AuthFlowObserved, DataSource, Overview, TimeRange } from "./types";

export function scopeDataSource(inner: DataSource, scope: ResolvedScope): DataSource {
  if (scope.all) return inner;

  const visibleAgents = async (): Promise<Agent[]> => (await inner.listAgents()).filter((a) => agentAllowed(scope, a));
  const visibleKeys = async () => {
    const agents = await visibleAgents();
    return {
      agents,
      names: new Set(agents.map((a) => a.name)),
      ids: new Set(agents.flatMap((a) => [a.id, a.agentIdentityId ?? ""]).filter(Boolean)),
      accounts: new Set(agents.map((a) => a.account)),
    };
  };
  const accountsInScope = async () => new Set((await inner.listProjects()).filter((p) => projectAllowed(scope, p.account, p.name)).map((p) => p.account));

  const scoped: DataSource = {
    kind: inner.kind,
    health: () => inner.health(),
    manifestFor: (a) => inner.manifestFor(a),

    async listProjects() {
      return (await inner.listProjects()).filter((p) => projectAllowed(scope, p.account, p.name));
    },
    async listDeployments() {
      const accts = await accountsInScope();
      return (await inner.listDeployments()).filter((d) => accts.has(d.account));
    },
    listAgents: visibleAgents,
    async getAgent(project, id) {
      const a = await inner.getAgent(project, id);
      return a && agentAllowed(scope, a) ? a : undefined;
    },
    async agentStats(range) {
      const { names } = await visibleKeys();
      return (await inner.agentStats(range)).filter((s) => names.has(s.agentName));
    },
    async tokenSeries(range) {
      const { names } = await visibleKeys();
      return (await inner.tokenSeries(range)).map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k === "t" || names.has(k))) as typeof p);
    },
    async listRuns(range, agentName) {
      const { names } = await visibleKeys();
      if (agentName && !names.has(agentName)) return [];
      return (await inner.listRuns(range, agentName)).filter((r) => names.has(r.agentName));
    },
    async getRunSpans(operationId) {
      return inner.getRunSpans(operationId);
    },
    async overview(range: TimeRange): Promise<Overview> {
      // Aggregates can't be filtered after the fact; rebuild the scoped numbers from scoped data.
      const [base, { agents }, stats, runs, projects] = await Promise.all([
        inner.overview(range),
        visibleKeys(),
        scoped.agentStats(range),
        scoped.listRuns(range),
        scoped.listProjects(),
      ]);
      const mix = new Map<AuthFlowObserved, number>();
      runs.forEach((r: AgentRun) => r.authFlow && mix.set(r.authFlow, (mix.get(r.authFlow) ?? 0) + 1));
      const series = new Map<string, { t: string; succeeded: number; failed: number }>();
      for (const p of base.runsSeries) series.set(String(p.t), { t: String(p.t), succeeded: 0, failed: 0 });
      const keys = [...series.keys()].sort();
      for (const r of runs) {
        const k = keys.filter((t) => t <= r.start).pop();
        if (k) series.get(k)![r.success ? "succeeded" : "failed"]++;
      }
      const tools = agents.flatMap((a) => a.tools);
      return {
        ...base,
        agents: agents.length,
        projects: projects.length,
        runs: stats.reduce((s, x) => s + x.runs, 0),
        failedRuns: stats.reduce((s, x) => s + x.failedRuns, 0),
        tokens: stats.reduce((s, x) => s + x.inputTokens + x.outputTokens, 0),
        activeUsers: new Set(runs.map((r) => r.user).filter(Boolean)).size,
        approvalFreeWriteTools: tools.filter((t) => ["mcp", "browser_automation"].includes(t.type) && t.requireApproval === "never").length,
        runsSeries: [...series.values()],
        authFlowMix: [...mix.entries()].map(([flow, count]) => ({ flow, count })),
        topTools: [], // tool names aren't attributable to agents in the aggregate
        nonCompliantResources: base.nonCompliantResources,
        unfilteredDeployments: base.unfilteredDeployments,
      };
    },
    async identityUsage(range) {
      const { names, ids } = await visibleKeys();
      return (await inner.identityUsage(range)).filter((u) => names.has(u.resource) || names.has(u.clientAppName) || names.has(u.principalName) || ids.has(u.principalId));
    },
    async graphActivity(range) {
      const { names, ids } = await visibleKeys();
      return (await inner.graphActivity(range)).filter((g) => names.has(g.appName) || ids.has(g.appId));
    },
    async permissionGrants() {
      const { names, ids } = await visibleKeys();
      return (await inner.permissionGrants()).filter((g) => names.has(g.clientName) || ids.has(g.clientAppId));
    },
    async agentIdentities() {
      const { names, ids } = await visibleKeys();
      return (await inner.agentIdentities()).filter((i) => ids.has(i.id) || [...names].some((n) => i.displayName === n || i.displayName.includes(`-${n}-`)));
    },
    async roleAssignments() {
      const { names, ids } = await visibleKeys();
      return (await inner.roleAssignments()).filter((r) => names.has(r.principalName) || ids.has(r.principalId));
    },
    async raiPolicies() {
      const accts = await accountsInScope();
      return (await inner.raiPolicies()).filter((p) => accts.has(p.account));
    },
    async accountPosture() {
      const accts = await accountsInScope();
      return (await inner.accountPosture()).filter((a) => accts.has(a.name));
    },
    async defenderPosture() {
      const accts = [...(await accountsInScope())].map((a) => `/accounts/${a.toLowerCase()}`);
      const mine = (id: string) => accts.some((a) => id.toLowerCase().includes(a));
      return (await inner.defenderPosture()).map((d) => ({ ...d, alerts: d.alerts.filter((x) => mine(x.resourceId)), recommendations: d.recommendations.filter((x) => mine(x.resourceId)) }));
    },
    async policyStates() {
      const accts = await accountsInScope();
      return (await inner.policyStates()).filter((p) => [...accts].some((a) => p.resourceId.toLowerCase().includes(`/accounts/${a.toLowerCase()}`)));
    },
    async contentSafety(range) {
      const { names } = await visibleKeys();
      const cs = await inner.contentSafety(range);
      return { filters: cs.filters.filter((f) => names.has(f.agentName)), capture: cs.capture.filter((c) => names.has(c.agentName)) };
    },
  };
  return scoped;
}
