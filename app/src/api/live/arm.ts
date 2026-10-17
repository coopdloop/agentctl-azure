// Azure Resource Manager: Foundry accounts/projects/deployments/RAI policies, Azure Policy
// compliance and RBAC. Token audience: https://management.azure.com (CORS-enabled).

import { config } from "../../config";
import type { AzureRoleAssignment, FoundryProject, ModelDeployment, PolicyState, RaiPolicy } from "../types";
import { apiFetch, fetchAllPages } from "./http";

const ARM = "https://management.azure.com";
const CS_API = "2025-06-01";
const sub = () => `/subscriptions/${config.azure.subscriptionId}`;
const rgOf = (id: string) => id.split("/")[4] ?? "";

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

let accountsCache: Promise<ArmAccount[]> | null = null;

export function listFoundryAccounts(): Promise<ArmAccount[]> {
  accountsCache ??= fetchAllPages<ArmAccount>(
    "arm",
    `${ARM}${sub()}/providers/Microsoft.CognitiveServices/accounts?api-version=${CS_API}`,
  ).then((all) =>
    all.filter(
      (a) =>
        a.kind === "AIServices" &&
        (!config.azure.resourceGroups.length || config.azure.resourceGroups.some((rg) => rg.toLowerCase() === rgOf(a.id).toLowerCase())),
    ),
  );
  accountsCache.catch(() => (accountsCache = null));
  return accountsCache;
}

export interface ProjectWithIdentity extends FoundryProject {
  principalId?: string;
}

export async function listProjects(): Promise<ProjectWithIdentity[]> {
  const accounts = await listFoundryAccounts();
  const perAccount = await Promise.all(
    accounts.map(async (a) => {
      const projects = await fetchAllPages<ArmProject>("arm", `${ARM}${a.id}/projects?api-version=${CS_API}`).catch(() => []);
      return projects.map<ProjectWithIdentity>((p) => {
        const projectName = p.name.split("/").pop()!;
        const host = a.properties.customSubDomainName ?? a.name;
        return {
          id: p.id,
          account: a.name,
          name: projectName,
          resourceGroup: rgOf(p.id),
          location: p.location,
          endpoint: p.properties.endpoints?.["AI Foundry API"] ?? `https://${host}.services.ai.azure.com/api/projects/${projectName}`,
          principalId: p.identity?.principalId,
        };
      });
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
  const r = await apiFetch<{
    value: {
      policyAssignmentName: string;
      policyDefinitionName: string;
      policyDefinitionReferenceId?: string;
      resourceId: string;
      resourceType: string;
      complianceState: string;
      timestamp: string;
    }[];
  }>(
    "arm",
    `${ARM}${sub()}/providers/Microsoft.PolicyInsights/policyStates/latest/queryResults?api-version=2019-10-01&$top=1000&$filter=${encodeURIComponent(filter)}`,
    { method: "POST" },
  );
  return r.value.map((v) => ({
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
  const [assignments, defs] = await Promise.all([
    fetchAllPages<{ id: string; properties: { principalId: string; principalType: string; roleDefinitionId: string; scope: string } }>(
      "arm",
      `${ARM}${sub()}/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01`,
    ),
    fetchAllPages<{ id: string; name: string; properties: { roleName: string } }>(
      "arm",
      `${ARM}${sub()}/providers/Microsoft.Authorization/roleDefinitions?api-version=2022-04-01`,
    ),
  ]);
  const roleNames = new Map(defs.map((d) => [d.name.toLowerCase(), d.properties.roleName]));
  return assignments
    .filter((a) => a.properties.principalType === "ServicePrincipal")
    .map((a) => ({
      id: a.id,
      principalId: a.properties.principalId,
      principalType: a.properties.principalType,
      roleName: roleNames.get(a.properties.roleDefinitionId.split("/").pop()!.toLowerCase()) ?? a.properties.roleDefinitionId.split("/").pop()!,
      scope: a.properties.scope,
    }));
}

export async function armPing(): Promise<string> {
  const r = await apiFetch<{ displayName: string }>("arm", `${ARM}${sub()}?api-version=2022-12-01`);
  return r.displayName;
}
