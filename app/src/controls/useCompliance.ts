import { useMemo } from "react";
import { useDs } from "../api";
import { useSession } from "../auth/session";
import { config } from "../config";
import { CONTROLS } from "./catalog";
import { evaluateControls, type Result } from "./evaluate";
import { MOCK_APPROVED_MCP_HOSTS, MOCK_ATTESTATIONS } from "./mockAttestations";

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

  const optional = [accounts, defender, identities, roles, grants, safety, stats, policy];
  const loading = [agents, deployments, rai, ...optional].some((q) => q.isPending);
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
      attestations: mode === "mock" ? MOCK_ATTESTATIONS : config.controls.attestations,
      approvedMcpHosts: mode === "mock" ? MOCK_APPROVED_MCP_HOSTS : config.controls.approvedMcpHosts,
      subscriptionId: config.azure.subscriptionId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mode, agents.data, deployments.data, rai.data, accounts.data, defender.data, identities.data, roles.data, grants.data, safety.data, stats.data, policy.data]);

  const unavailable = [
    ["Foundry account posture", accounts],
    ["Defender for Cloud", defender],
    ["Entra agent identities", identities],
    ["Azure RBAC", roles],
    ["Graph permission grants", grants],
    ["Trace telemetry", stats],
    ["Azure Policy", policy],
  ]
    .filter(([, q]) => (q as { isError: boolean }).isError)
    .map(([name]) => name as string);

  return { results, loading, error, unavailable, agents: agents.data ?? [], controls: CONTROLS };
}
