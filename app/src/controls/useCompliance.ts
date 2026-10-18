import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDataSource, useDs } from "../api";
import type { Agent, AgentVersionInfo } from "../api/types";
import { useSession } from "../auth/session";
import { config } from "../config";
import { CONTROLS } from "./catalog";
import { evaluateControls, type Result } from "./evaluate";
import { MOCK_APPROVED_MCP_HOSTS, MOCK_ATTESTATIONS } from "./mockAttestations";

export const agentKey = (a: Agent) => `${a.project}/${a.id}`;

/** Version history for every agents-API agent (classic assistants have no versions). */
export function useAgentVersions(agents: Agent[]) {
  const ds = useDataSource();
  const { scope } = useSession();
  const scopeKey = scope.all ? "all" : scope.names.join(",") || "none";
  const versioned = agents.filter((a) => a.api !== "assistants");
  const qs = useQueries({
    queries: versioned.map((a) => ({
      queryKey: [ds.kind, scopeKey, "agentVersions", a.project, a.name],
      queryFn: () => ds.agentVersions(a.project, a.name),
      staleTime: 60_000,
    })),
  });
  const pending = qs.some((q) => q.isPending);
  // Stable dependency: one string summarising which queries have data (array length varies).
  const stamp = versioned.map((a, i) => `${agentKey(a)}:${qs[i]?.dataUpdatedAt ?? 0}`).join("|");
  const map = useMemo(() => {
    const m: Record<string, AgentVersionInfo[]> = {};
    versioned.forEach((a, i) => {
      if (qs[i]?.isSuccess) m[agentKey(a)] = qs[i].data as AgentVersionInfo[];
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  return { versions: map, pending };
}

/**
 * Collects every evidence source and evaluates the controls catalog. Inventory sources are
 * required; the rest degrade to "unknown" when the signed-in user can't read them.
 */
export function useCompliance() {
  const { mode } = useSession();
  const agents = useDs("listAgents");
  const deployments = useDs("listDeployments");
  const rai = useDs("raiPolicies");
  const accounts = useDs("accountPosture");
  const defender = useDs("defenderPosture");
  const identities = useDs("agentIdentities");
  const roles = useDs("roleAssignments");
  const grants = useDs("permissionGrants");
  const safety = useDs("contentSafety", "30d");
  const stats = useDs("agentStats", "30d");
  const policy = useDs("policyStates");
  const projects = useDs("projectPosture");
  const workspaces = useDs("workspacePosture");
  const ca = useDs("conditionalAccess");
  const evals = useDs("evaluationEvidence");
  const { versions, pending: versionsPending } = useAgentVersions(agents.data ?? []);

  const optional = [accounts, defender, identities, roles, grants, safety, stats, policy, projects, workspaces, ca, evals];
  const loading = [agents, deployments, rai, ...optional].some((q) => q.isPending) || versionsPending;
  const error = agents.error ?? null;
  const ok = <T,>(q: { isSuccess: boolean; data?: T }) => (q.isSuccess ? q.data : undefined);

  const results: Result[] = useMemo(() => {
    if (loading || !agents.data) return [];
    return evaluateControls({
      agents: agents.data,
      deployments: deployments.data ?? [],
      rai: rai.data ?? [],
      accounts: ok(accounts),
      defender: ok(defender),
      identities: ok(identities),
      roles: ok(roles),
      grants: ok(grants),
      safety: ok(safety),
      stats: ok(stats),
      policy: ok(policy),
      projects: ok(projects),
      workspaces: ok(workspaces),
      ca: ok(ca),
      evals: ok(evals),
      versions,
      attestations: mode === "mock" ? MOCK_ATTESTATIONS : config.controls.attestations,
      approvedMcpHosts: mode === "mock" ? MOCK_APPROVED_MCP_HOSTS : config.controls.approvedMcpHosts,
      subscriptionId: config.azure.subscriptionId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mode, agents.data, deployments.data, rai.data, accounts.data, defender.data, identities.data, roles.data, grants.data, safety.data, stats.data, policy.data, projects.data, workspaces.data, ca.data, evals.data, versions]);

  const unavailable = [
    ["Foundry account posture", accounts],
    ["Defender for Cloud", defender],
    ["Entra agent identities", identities],
    ["Azure RBAC", roles],
    ["Graph permission grants", grants],
    ["Trace telemetry", stats],
    ["Azure Policy", policy],
    ["Project capability hosts / connections", projects],
    ["Workspace retention", workspaces],
    ["Conditional Access (Policy.Read.All)", ca],
    ["Foundry evaluations / red teaming", evals],
  ]
    .filter(([, q]) => (q as { isError: boolean }).isError)
    .map(([name]) => name as string);

  return { results, loading, error, unavailable, agents: agents.data ?? [], versions, controls: CONTROLS };
}
