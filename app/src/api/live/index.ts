import { config } from "../../config";
import { HARNESS_TOOLS } from "../../lib/harnessLibrary";
import { agentToManifest } from "../../lib/manifestDefaults";
import type {
  Agent,
  AgentIdentity,
  AgentRun,
  AgentStats,
  AuthFlowObserved,
  DataSource,
  GraphActivity,
  IdentityUsage,
  Overview,
  SourceHealth,
  Span,
  TimePoint,
  TimeRange,
} from "../types";
import * as arm from "./arm";
import { listProjectAgents } from "./foundry";
import * as graph from "./graph";
import { settle } from "./http";
import * as Q from "./kql";
import { kql } from "./logAnalytics";

const HARNESS_TOOL_NAMES = new Set(HARNESS_TOOLS.map((t) => t.tool.name));

function memo<T>(fn: () => Promise<T>, ttlMs = 60_000): () => Promise<T> {
  let v: { at: number; p: Promise<T> } | null = null;
  return () => {
    if (!v || Date.now() - v.at > ttlMs) {
      v = { at: Date.now(), p: fn() };
      v.p.catch(() => (v = null));
    }
    return v.p;
  };
}

export class LiveDataSource implements DataSource {
  readonly kind = "live" as const;

  listProjects = memo(async () => {
    const discovered = await arm.listProjects();
    if (!config.azure.foundryProjectEndpoints.length) return discovered;
    const wanted = new Set(config.azure.foundryProjectEndpoints.map((e) => e.replace(/\/$/, "").toLowerCase()));
    return discovered.filter((p) => wanted.has(p.endpoint.replace(/\/$/, "").toLowerCase()));
  });

  listDeployments = memo(() => arm.listDeployments());

  listAgents = memo(async () => {
    const projects = await this.listProjects();
    const perProject = await Promise.all(projects.map((p) => settle(listProjectAgents(p), [] as Agent[], (e) => console.warn(`agents ${p.name}`, e))));
    return perProject.flat();
  });

  async getAgent(project: string, id: string) {
    return (await this.listAgents()).find((a) => a.project === project && a.id === id);
  }

  /** Object ids + app ids of everything we consider an agent principal. */
  private agentPrincipals = memo(async () => {
    const [identities, projects] = await Promise.all([settle(this.agentIdentities(), [] as AgentIdentity[]), this.listProjects()]);
    const projectMis = projects.map((p) => p.principalId).filter(Boolean) as string[];
    const resolved = await settle(graph.resolveObjects(projectMis), new Map());
    const spIds = new Set([...identities.filter((i) => i.kind !== "agent_blueprint").map((i) => i.id), ...projectMis]);
    const appIds = [...identities.map((i) => i.appId), ...[...resolved.values()].map((o) => o.appId).filter(Boolean)] as string[];
    return { spIds, appIds: [...new Set(appIds)] };
  }, 300_000);

  /** Traces carry the agent id (asst_...) and sometimes the name; normalise both to the name. */
  private async agentNamer(): Promise<(key: string) => string> {
    const agents = await settle(this.listAgents(), [] as Agent[]);
    const byKey = new Map<string, string>();
    for (const a of agents) {
      byKey.set(a.id, a.name);
      byKey.set(a.name, a.name);
    }
    return (key) => byKey.get(key) ?? key;
  }

  async agentStats(range: TimeRange): Promise<AgentStats[]> {
    const [rows, name] = await Promise.all([kql<AgentStats>(Q.agentStatsQuery(range), Q.RANGE[range].timespan), this.agentNamer()]);
    // ids and names of the same agent may arrive as separate rows; merge them.
    const merged = new Map<string, AgentStats>();
    for (const r of rows) {
      const key = name(r.agentName);
      const prev = merged.get(key);
      const cur = { ...r, agentName: key, p95LatencyMs: Math.round(Number(r.p95LatencyMs) || 0) };
      merged.set(
        key,
        prev
          ? {
              ...prev,
              runs: prev.runs + cur.runs,
              failedRuns: prev.failedRuns + cur.failedRuns,
              inputTokens: prev.inputTokens + cur.inputTokens,
              outputTokens: prev.outputTokens + cur.outputTokens,
              toolCalls: prev.toolCalls + cur.toolCalls,
              p95LatencyMs: Math.max(prev.p95LatencyMs, cur.p95LatencyMs),
              distinctUsers: Math.max(prev.distinctUsers, cur.distinctUsers),
              lastActivity: [prev.lastActivity ?? "", cur.lastActivity ?? ""].sort().pop(),
            }
          : cur,
      );
    }
    return [...merged.values()];
  }

  async tokenSeries(range: TimeRange): Promise<TimePoint[]> {
    const [rows, name] = await Promise.all([
      kql<{ t: string; agentName: string; tokens: number }>(Q.tokenSeriesQuery(range), Q.RANGE[range].timespan),
      this.agentNamer(),
    ]);
    const byT = new Map<string, TimePoint>();
    for (const r of rows) {
      const p = byT.get(r.t) ?? { t: r.t };
      const n = name(r.agentName);
      p[n] = ((p[n] as number) ?? 0) + r.tokens;
      byT.set(r.t, p);
    }
    return [...byT.values()];
  }

  async overview(range: TimeRange): Promise<Overview> {
    const warn = (what: string) => (e: unknown) => console.warn(`overview: ${what}`, e);
    const [agents, projects, stats, series, usage, tools, policy, deps] = await Promise.all([
      settle(this.listAgents(), [], warn("agents")),
      settle(this.listProjects(), [], warn("projects")),
      settle(this.agentStats(range), [], warn("stats")),
      settle(kql<{ t: string; succeeded: number; failed: number }>(Q.runsSeriesQuery(range), Q.RANGE[range].timespan), [], warn("series")),
      settle(this.identityUsage(range), [], warn("identity")),
      settle(kql<{ tool: string; calls: number }>(Q.topToolsQuery(range), Q.RANGE[range].timespan), [], warn("tools")),
      settle(this.policyStates(), [], warn("policy")),
      settle(this.listDeployments(), [], warn("deployments")),
    ]);
    const mix = new Map<AuthFlowObserved, number>();
    for (const u of usage) if (u.isAgent || u.authFlow === "obo") mix.set(u.authFlow, (mix.get(u.authFlow) ?? 0) + u.signIns);
    const allTools = agents.flatMap((a) => a.tools);
    return {
      agents: agents.length,
      projects: projects.length,
      runs: stats.reduce((s, x) => s + x.runs, 0),
      failedRuns: stats.reduce((s, x) => s + x.failedRuns, 0),
      tokens: stats.reduce((s, x) => s + x.inputTokens + x.outputTokens, 0),
      activeUsers: new Set(usage.filter((u) => u.principalType === "user" && u.isAgent).map((u) => u.principalId)).size,
      injectedTools: allTools.filter((t) => HARNESS_TOOL_NAMES.has(t.name)).length,
      approvalFreeWriteTools: allTools.filter((t) => ["mcp", "azure_function", "openapi"].includes(t.type) && (!t.requireApproval || t.requireApproval === "never")).length,
      nonCompliantResources: new Set(policy.filter((p) => p.complianceState === "NonCompliant").map((p) => p.resourceId)).size,
      unfilteredDeployments: deps.filter((d) => !d.raiPolicyName || /nil|none/i.test(d.raiPolicyName)).length,
      runsSeries: series,
      authFlowMix: [...mix.entries()].map(([flow, count]) => ({ flow, count })),
      topTools: tools,
    };
  }

  async listRuns(range: TimeRange, agentName?: string): Promise<AgentRun[]> {
    const name = await this.agentNamer();
    // Filter on both the name and the id, since traces may carry either.
    const keys = agentName ? [agentName, ...(await settle(this.listAgents(), [] as Agent[])).filter((a) => a.name === agentName).map((a) => a.id)] : undefined;
    const rows = await kql<AgentRun & { flow?: string }>(Q.runsQuery(range, keys), Q.RANGE[range].timespan);
    return rows.map((r) => ({
      ...r,
      agentName: name(r.agentName),
      success: Boolean(r.success),
      authFlow: (r.flow || (r.user ? "delegated" : "app")) as AuthFlowObserved,
    }));
  }

  async getRunSpans(operationId: string): Promise<Span[]> {
    const rows = await kql<Span & { op: string }>(Q.runSpansQuery(operationId));
    return rows.map((r) => ({
      ...r,
      success: Boolean(r.success),
      kind: (Q.RUN_OP_NAMES.includes(r.op)
        ? "invoke_agent"
        : r.op === "chat"
          ? "chat"
          : r.op === "execute_tool" || r.op === "submit_tool_outputs"
            ? "execute_tool"
            : "other") as Span["kind"],
    }));
  }

  async identityUsage(range: TimeRange): Promise<IdentityUsage[]> {
    const { appIds } = await this.agentPrincipals();
    const rows = await kql<IdentityUsage>(Q.identityUsageQuery(range, appIds), Q.RANGE[range].timespan);
    return rows.map((r) => ({ ...r, isAgent: Boolean(r.isAgent) }));
  }

  async graphActivity(range: TimeRange): Promise<GraphActivity[]> {
    const rows = await kql<Omit<GraphActivity, "appName">>(Q.graphActivityQuery(range), Q.RANGE[range].timespan);
    // Resolve app names via the agent principal set + delegated grant names (cheap, cached).
    const grants = await settle(this.permissionGrants(), []);
    const names = new Map(grants.map((g) => [g.clientAppId, g.clientName]));
    return rows.map((r) => ({ ...r, appName: names.get(r.appId) ?? r.appId }));
  }

  permissionGrants = memo(async () => {
    const { spIds } = await this.agentPrincipals();
    return graph.listPermissionGrants(spIds);
  }, 300_000);

  agentIdentities = memo(() => graph.listAgentIdentities(), 300_000);

  async roleAssignments() {
    const [ras, { spIds }] = await Promise.all([arm.listServicePrincipalRoleAssignments(), this.agentPrincipals()]);
    const names = await settle(graph.resolveObjects(ras.map((r) => r.principalId)), new Map());
    return ras.map((r) => ({ ...r, principalName: graph.displayOf(names.get(r.principalId)), isAgent: spIds.has(r.principalId) }));
  }

  raiPolicies = memo(() => arm.listRaiPolicies());
  policyStates = memo(() => arm.listPolicyStates(), 300_000);

  async manifestFor(agent: Agent) {
    const deps = await settle(this.listDeployments(), []);
    return agentToManifest(agent, deps, config.azure.subscriptionId);
  }

  async health(): Promise<SourceHealth[]> {
    const timed = async (source: string, fn: () => Promise<string>): Promise<SourceHealth> => {
      const t0 = performance.now();
      try {
        const detail = await fn();
        return { source, ok: true, detail, latencyMs: Math.round(performance.now() - t0) };
      } catch (e) {
        return { source, ok: false, detail: e instanceof Error ? e.message : String(e), latencyMs: Math.round(performance.now() - t0) };
      }
    };
    return Promise.all([
      timed("Azure Resource Manager", async () => `subscription "${await arm.armPing()}"`),
      timed("Foundry projects (ARM)", async () => `${(await this.listProjects()).length} project(s)`),
      timed("Foundry Agent Service", async () => {
        const p = (await this.listProjects())[0];
        if (!p) return "no projects discovered";
        return `${(await listProjectAgents(p)).length} agent(s) in ${p.name}`;
      }),
      timed("Log Analytics", async () => {
        await kql(Q.PING, "PT1H");
        return `workspace ${config.azure.logAnalyticsWorkspaceId}`;
      }),
      timed("App Insights gen_ai traces", async () => {
        const r = await kql<{ n: number }>(`AppDependencies | where TimeGenerated > ago(7d) | where isnotempty(Properties["gen_ai.operation.name"]) | count | project n = Count`, "P7D");
        return `${r[0]?.n ?? 0} gen_ai spans (7d)`;
      }),
      timed("Entra sign-in logs", async () => {
        const r = await kql<{ n: number }>(`union isfuzzy=true SigninLogs, AADNonInteractiveUserSignInLogs, AADServicePrincipalSignInLogs | where TimeGenerated > ago(1d) | count | project n = Count`, "P1D");
        return `${r[0]?.n ?? 0} sign-ins (24h)`;
      }),
      timed("Graph activity logs", async () => {
        const r = await kql<{ n: number }>(`MicrosoftGraphActivityLogs | where TimeGenerated > ago(1d) | count | project n = Count`, "P1D");
        return `${r[0]?.n ?? 0} requests (24h)`;
      }),
      timed("Microsoft Graph", async () => `signed in as ${await graph.graphPing()}`),
      timed("Entra Agent ID", async () => {
        const ids = await this.agentIdentities();
        const kind = ids[0]?.kind ?? "agent_identity";
        return `${ids.length} identities (${kind === "service_principal_tagged" ? "fallback: tagged SPs" : "Agent ID API"})`;
      }),
      timed("Azure Policy", async () => `${(await this.policyStates()).length} policy states`),
    ]);
  }
}
