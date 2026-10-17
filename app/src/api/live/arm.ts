// Azure Resource Manager: Foundry accounts/projects/deployments/RAI policies, Azure Policy
// compliance and RBAC. Token audience: https://management.azure.com (CORS-enabled).

import { config } from "../../config";
import type { AzureRoleAssignment, FoundryProject, ModelDeployment, PolicyState, RaiPolicy } from "../types";
import { cloudUrl } from "./endpoints";
import { apiFetch, fetchAllPages } from "./http";

const ARM = cloudUrl("arm");
const CS_API = "2025-06-01";
const rgOf = (id: string) => id.split("/")[4] ?? "";
const subOf = (id: string) => id.split("/")[2] ?? "";
const inScope = (id: string) =>
  !config.azure.resourceGroups.length || config.azure.resourceGroups.some((rg) => rg.toLowerCase() === rgOf(id).toLowerCase());

interface ArmAccount {
  id: string;
  name: string;
  kind: string;
  location: string;
  properties: { customSubDomainName?: string; endpoints?: Record<string, string>; allowProjectManagement?: boolean };
}
interface ArmProject {
  id: string;
  name: string;
  location: string;
  identity?: { principalId?: string };
  properties: { endpoints?: Record<string, string>; displayName?: string };
}

let subsCache: Promise<string[]> | null = null;

/** Subscriptions to observe: the configured list, or every enabled subscription the user can read. */
export function listSubscriptions(): Promise<string[]> {
  subsCache ??= config.azure.subscriptionIds.length
    ? Promise.resolve(config.azure.subscriptionIds)
    : fetchAllPages<{ subscriptionId: string; state: string }>("arm", `${ARM}/subscriptions?api-version=2022-12-01`).then((all) =>
        all.filter((s) => s.state === "Enabled").map((s) => s.subscriptionId),
      );
  subsCache.catch(() => (subsCache = null));
  return subsCache;
}

/** Azure Resource Graph: one query across subscriptions (RBAC-filtered by Azure, 1000 rows per page). */
export async function resourceGraph<T>(query: string, maxPages = 20): Promise<T[]> {
  const subs = config.azure.subscriptionIds;
  const out: T[] = [];
  let skipToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const r: { data: T[]; $skipToken?: string } = await apiFetch("arm", `${ARM}/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01`, {
      body: { query, ...(subs.length ? { subscriptions: subs } : {}), options: { $top: 1000, resultFormat: "objectArray", ...(skipToken ? { $skipToken: skipToken } : {}) } },
    });
    out.push(...r.data);
    skipToken = r.$skipToken;
    if (!skipToken) break;
  }
  return out;
}

/** Runs fn per observed subscription; one failing subscription doesn't hide the others. */
async function perSubscription<T>(fn: (subPath: string) => Promise<T[]>): Promise<T[]> {
  const subs = await listSubscriptions();
  const results = await Promise.allSettled(subs.map((id) => fn(`/subscriptions/${id}`)));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (subs.length && failed.length === subs.length) throw failed[0].reason;
  failed.forEach((f) => console.warn("arm: subscription failed", f.reason));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

let accountsCache: Promise<ArmAccount[]> | null = null;

export function listFoundryAccounts(): Promise<ArmAccount[]> {
  accountsCache ??= resourceGraph<ArmAccount>(
    "resources | where type =~ 'microsoft.cognitiveservices/accounts' and kind =~ 'AIServices' | project id, name, kind, location, properties",
  )
    .catch((e) => {
      console.warn("arm: Resource Graph unavailable, listing per subscription", e);
      return perSubscription((sp) => fetchAllPages<ArmAccount>("arm", `${ARM}${sp}/providers/Microsoft.CognitiveServices/accounts?api-version=${CS_API}`)).then(
        (all) => all.filter((a) => a.kind === "AIServices"),
      );
    })
    .then((all) => all.filter((a) => inScope(a.id)));
  accountsCache.catch(() => (accountsCache = null));
  return accountsCache;
}

export interface ProjectWithIdentity extends FoundryProject {
  principalId?: string;
}

function toProject(p: ArmProject, account: { name: string; host: string }): ProjectWithIdentity {
  const projectName = p.name.split("/").pop()!;
  return {
    id: p.id,
    subscriptionId: subOf(p.id),
    account: account.name,
    name: projectName,
    resourceGroup: rgOf(p.id),
    location: p.location,
    endpoint: (p.properties.endpoints?.["AI Foundry API"] ?? `https://${account.host}.services.ai.azure.com/api/projects/${projectName}`).replace(/\/$/, ""),
    principalId: p.identity?.principalId,
  };
}

export async function listProjects(): Promise<ProjectWithIdentity[]> {
  // Resource Graph returns projects even when the user can read only the project (not its account).
  const viaGraph = await resourceGraph<ArmProject>(
    "resources | where type =~ 'microsoft.cognitiveservices/accounts/projects' | project id, name, location, identity, properties",
  ).catch((e) => {
    console.warn("arm: Resource Graph unavailable for projects", e);
    return null;
  });
  if (viaGraph) {
    return viaGraph.filter((p) => inScope(p.id)).map((p) => {
      const account = p.id.split("/")[8];
      return toProject(p, { name: account, host: account });
    });
  }
  const accounts = await listFoundryAccounts();
  const perAccount = await Promise.all(
    accounts.map(async (a) => {
      const projects = await fetchAllPages<ArmProject>("arm", `${ARM}${a.id}/projects?api-version=${CS_API}`).catch(() => []);
      return projects.map((p) => toProject(p, { name: a.name, host: a.properties.customSubDomainName ?? a.name }));
    }),
  );
  return perAccount.flat();
}

export async function listDeployments(): Promise<ModelDeployment[]> {
  const accounts = await listFoundryAccounts();
  const all = await Promise.all(
    accounts.map(async (a) => {
      const deps = await fetchAllPages<{
        id: string;
        name: string;
        sku?: { name: string; capacity: number };
        properties: { model: { name: string; version: string }; raiPolicyName?: string };
      }>("arm", `${ARM}${a.id}/deployments?api-version=${CS_API}`).catch(() => []);
      return deps.map<ModelDeployment>((d) => ({
        id: d.id,
        account: a.name,
        name: d.name,
        model: d.properties.model.name,
        modelVersion: d.properties.model.version,
        sku: d.sku?.name ?? "",
        capacity: d.sku?.capacity ?? 0,
        raiPolicyName: d.properties.raiPolicyName ?? "",
      }));
    }),
  );
  return all.flat();
}

export async function listRaiPolicies(): Promise<RaiPolicy[]> {
  const accounts = await listFoundryAccounts();
  const all = await Promise.all(
    accounts.map(async (a) => {
      const pols = await fetchAllPages<{
        id: string;
        name: string;
        properties: {
          basePolicyName?: string;
          mode?: string;
          contentFilters?: { name: string; enabled: boolean; blocking: boolean; severityThreshold?: string; source: "Prompt" | "Completion" }[];
        };
      }>("arm", `${ARM}${a.id}/raiPolicies?api-version=${CS_API}`).catch(() => []);
      return pols.map<RaiPolicy>((p) => ({
        id: p.id,
        account: a.name,
        name: p.name,
        basePolicyName: p.properties.basePolicyName ?? "",
        mode: p.properties.mode ?? "Default",
        contentFilters: p.properties.contentFilters ?? [],
      }));
    }),
  );
  return all.flat();
}

const POLICY_RESOURCE_TYPES = [
  "Microsoft.CognitiveServices/accounts",
  "Microsoft.CognitiveServices/accounts/projects",
  "Microsoft.MachineLearningServices/workspaces",
  "Microsoft.Search/searchServices",
  "Microsoft.Web/sites",
  "Microsoft.Insights/components",
  "Microsoft.OperationalInsights/workspaces",
  "Microsoft.Storage/storageAccounts",
  "Microsoft.KeyVault/vaults",
];

export async function listPolicyStates(): Promise<PolicyState[]> {
  const filter = POLICY_RESOURCE_TYPES.map((t) => `ResourceType eq '${t}'`).join(" or ");
  type Row = {
    policyAssignmentName: string;
    policyDefinitionName: string;
    policyDefinitionReferenceId?: string;
    resourceId: string;
    resourceType: string;
    complianceState: string;
    timestamp: string;
  };
  const rows = await perSubscription(async (sp) => {
    const r = await apiFetch<{ value: Row[] }>(
      "arm",
      `${ARM}${sp}/providers/Microsoft.PolicyInsights/policyStates/latest/queryResults?api-version=2019-10-01&$top=1000&$filter=${encodeURIComponent(filter)}`,
      { method: "POST" },
    );
    return r.value;
  });
  return rows.map((v) => ({
    policyAssignmentName: v.policyAssignmentName,
    policyDefinitionName: v.policyDefinitionName,
    policyDefinitionDisplayName: v.policyDefinitionReferenceId || v.policyDefinitionName,
    resourceId: v.resourceId,
    resourceType: v.resourceType,
    complianceState: (["Compliant", "NonCompliant"].includes(v.complianceState) ? v.complianceState : "Unknown") as PolicyState["complianceState"],
    timestamp: v.timestamp,
  }));
}

/** Role assignments held by service principals / managed identities (i.e. apps and agents). */
export async function listServicePrincipalRoleAssignments(): Promise<Omit<AzureRoleAssignment, "principalName" | "isAgent">[]> {
  type Assignment = { id: string; properties: { principalId: string; principalType: string; roleDefinitionId: string; scope: string } };
  type Def = { id: string; name: string; properties: { roleName: string } };
  const perSub = await perSubscription(async (sp) => {
    const [assignments, defs] = await Promise.all([
      fetchAllPages<Assignment>("arm", `${ARM}${sp}/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01`),
      fetchAllPages<Def>("arm", `${ARM}${sp}/providers/Microsoft.Authorization/roleDefinitions?api-version=2022-04-01`),
    ]);
    return [{ assignments, defs }];
  });
  const roleNames = new Map(perSub.flatMap((x) => x.defs).map((d) => [d.name.toLowerCase(), d.properties.roleName]));
  const seen = new Set<string>();
  return perSub
    .flatMap((x) => x.assignments)
    .filter((a) => a.properties.principalType === "ServicePrincipal" && !seen.has(a.id) && seen.add(a.id))
    .map((a) => ({
      id: a.id,
      principalId: a.properties.principalId,
      principalType: a.properties.principalType,
      roleName: roleNames.get(a.properties.roleDefinitionId.split("/").pop()!.toLowerCase()) ?? a.properties.roleDefinitionId.split("/").pop()!,
      scope: a.properties.scope,
    }));
}

export async function armPing(): Promise<string> {
  const subs = await listSubscriptions();
  if (!subs.length) throw new Error("no readable subscriptions");
  const first = await apiFetch<{ displayName: string }>("arm", `${ARM}/subscriptions/${subs[0]}?api-version=2022-12-01`);
  return subs.length === 1 ? `subscription "${first.displayName}"` : `${subs.length} subscriptions (incl. "${first.displayName}")`;
}
