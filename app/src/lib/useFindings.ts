import { useMemo } from "react";
import { useDs } from "../api";
import { computeFindings } from "./findings";
import { useUi } from "../state/ui";

/** Aggregates the queries findings depend on; partial failures degrade to empty inputs. */
export function useFindings() {
  const agents = useDs("listAgents");
  const deployments = useDs("listDeployments");
  const rai = useDs("raiPolicies");
  const grants = useDs("permissionGrants");
  const roles = useDs("roleAssignments");
  const identities = useDs("agentIdentities");
  const policy = useDs("policyStates");
  const { range } = useUi();
  const safety = useDs("contentSafety", range);
  const all = [agents, deployments, rai, grants, roles, identities, policy, safety];
  const loading = all.some((q) => q.isPending);
  const errors = all.filter((q) => q.isError).map((q) => q.error);
  const findings = useMemo(
    () =>
      loading
        ? []
        : computeFindings({
            agents: agents.data ?? [],
            deployments: deployments.data ?? [],
            rai: rai.data ?? [],
            grants: grants.data ?? [],
            roles: roles.data ?? [],
            identities: identities.data ?? [],
            policy: policy.data ?? [],
            contentSafety: safety.data,
          }),
    [loading, agents.data, deployments.data, rai.data, grants.data, roles.data, identities.data, policy.data, safety.data],
  );
  return { findings, loading, errors };
}
