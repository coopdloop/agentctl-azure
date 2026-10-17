// Microsoft Graph: delegated grants (OBO/delegated), app role assignments (app-only),
// Entra Agent ID identities, and name resolution. CORS-enabled.

import type { AgentIdentity, PermissionGrant } from "../types";
import { ApiError, apiFetch, fetchAllPages, settle } from "./http";

import { cloudUrl } from "./endpoints";

const G = `${cloudUrl("graph")}/v1.0`;
const GB = `${cloudUrl("graph")}/beta`;

const HIGH_PRIV = /(\.ReadWrite\.All$|^Directory\.|^RoleManagement\.|^Application\.ReadWrite|^AppRoleAssignment\.ReadWrite|^Mail\.Send$|^Sites\.FullControl|^Files\.ReadWrite\.All|^User\.ReadWrite\.All)/;

export interface DirObject {
  id: string;
  displayName?: string;
  appId?: string;
  userPrincipalName?: string;
  tags?: string[];
  "@odata.type"?: string;
}

const nameCache = new Map<string, DirObject>();

/** Resolves object ids → directory objects (batched, cached). */
export async function resolveObjects(ids: string[]): Promise<Map<string, DirObject>> {
  const missing = [...new Set(ids)].filter((id) => id && !nameCache.has(id));
  for (let i = 0; i < missing.length; i += 1000) {
    const chunk = missing.slice(i, i + 1000);
    const r = await apiFetch<{ value: DirObject[] }>("graph", `${G}/directoryObjects/getByIds`, {
      body: { ids: chunk, types: ["servicePrincipal", "user", "group", "application"] },
    });
    for (const o of r.value) nameCache.set(o.id, o);
  }
  return new Map(ids.map((id) => [id, nameCache.get(id) ?? { id, displayName: id }]));
}

export const displayOf = (o?: DirObject) => o?.displayName ?? o?.userPrincipalName ?? o?.id ?? "unknown";

/**
 * Entra Agent ID (preview): agent identities are a service principal subtype and blueprints an
 * application subtype. Falls back to service principals tagged "agentctl-agent" when the tenant
 * or the consented scopes don't support it yet.
 */
export async function listAgentIdentities(): Promise<AgentIdentity[]> {
  const viaAgentId = await settle(
    (async () => {
      const ids = await fetchAllPages<{
        id: string;
        appId: string | null;
        displayName: string;
        agentIdentityBlueprintId?: string;
        createdDateTime?: string;
        accountEnabled?: boolean;
        sponsors?: { displayName?: string; userPrincipalName?: string }[];
      }>("graphAgentId", `${GB}/servicePrincipals/microsoft.graph.agentIdentity?$top=999`);
      const blueprints = await settle(
        fetchAllPages<{ id: string; appId: string; displayName: string; createdDateTime?: string }>(
          "graphAgentId",
          `${GB}/applications/microsoft.graph.agentIdentityBlueprint?$top=999`,
        ),
        [],
      );
      return [
        ...ids.map<AgentIdentity>((i) => ({
          id: i.id,
          // The list endpoint returns appId: null for agent identities; their appId equals the object id.
          appId: i.appId ?? i.id,
          displayName: i.displayName,
          kind: "agent_identity",
          blueprintId: i.agentIdentityBlueprintId,
          sponsors: (i.sponsors ?? []).map((s) => s.userPrincipalName ?? s.displayName ?? "?"),
          createdDateTime: i.createdDateTime ?? "",
          accountEnabled: i.accountEnabled ?? true,
        })),
        ...blueprints.map<AgentIdentity>((b) => ({
          id: b.id,
          appId: b.appId,
          displayName: b.displayName,
          kind: "agent_blueprint",
          sponsors: [],
          createdDateTime: b.createdDateTime ?? "",
          accountEnabled: true,
        })),
      ];
    })(),
    null as AgentIdentity[] | null,
  );
  if (viaAgentId) return viaAgentId;

  const tagged = await fetchAllPages<{ id: string; appId: string; displayName: string; accountEnabled: boolean; createdDateTime?: string }>(
    "graph",
    `${G}/servicePrincipals?$filter=tags/any(t:t eq 'agentctl-agent')&$select=id,appId,displayName,accountEnabled,createdDateTime&$top=999`,
  ).catch((e) => {
    if (e instanceof ApiError && e.status === 403) return [];
    throw e;
  });
  return tagged.map((s) => ({
    id: s.id,
    appId: s.appId,
    displayName: s.displayName,
    kind: "service_principal_tagged",
    sponsors: [],
    createdDateTime: s.createdDateTime ?? "",
    accountEnabled: s.accountEnabled,
  }));
}

/** Delegated grants (tenant-wide) + application role assignments held by the given agent SPs. */
export async function listPermissionGrants(agentSpIds: Set<string>): Promise<PermissionGrant[]> {
  const grants = await fetchAllPages<{ id: string; clientId: string; resourceId: string; scope: string; consentType: string; principalId?: string }>(
    "graph",
    `${G}/oauth2PermissionGrants?$top=999`,
  );

  const appRoleAssignments = (
    await Promise.all(
      [...agentSpIds].map((id) =>
        settle(
          fetchAllPages<{ id: string; appRoleId: string; principalId: string; resourceId: string; resourceDisplayName: string }>(
            "graph",
            `${G}/servicePrincipals/${id}/appRoleAssignments`,
          ),
          [],
        ),
      ),
    )
  ).flat();

  // resolve app role ids → values on the resource SPs
  const resourceIds = [...new Set(appRoleAssignments.map((a) => a.resourceId))];
  const roleMaps = new Map<string, Map<string, string>>();
  await Promise.all(
    resourceIds.map(async (rid) => {
      const sp = await settle(
        apiFetch<{ appRoles: { id: string; value: string }[] }>("graph", `${G}/servicePrincipals/${rid}?$select=appRoles`),
        { appRoles: [] },
      );
      roleMaps.set(rid, new Map(sp.appRoles.map((r) => [r.id, r.value])));
    }),
  );

  const names = await resolveObjects([
    ...grants.flatMap((g) => [g.clientId, g.resourceId, g.principalId ?? ""]).filter(Boolean),
    ...appRoleAssignments.map((a) => a.principalId),
  ]);

  const delegated: PermissionGrant[] = grants.map((g) => {
    const perms = g.scope.split(" ").filter(Boolean);
    return {
      id: g.id,
      kind: "delegated",
      clientAppId: names.get(g.clientId)?.appId ?? g.clientId,
      clientName: displayOf(names.get(g.clientId)),
      resourceName: displayOf(names.get(g.resourceId)),
      permissions: perms,
      consentType: g.consentType === "AllPrincipals" ? "AllPrincipals" : "Principal",
      principalName: g.principalId ? displayOf(names.get(g.principalId)) : undefined,
      isAgent: agentSpIds.has(g.clientId),
      highPrivilege: perms.some((p) => HIGH_PRIV.test(p)),
    };
  });

  const application: PermissionGrant[] = appRoleAssignments.map((a) => {
    const value = roleMaps.get(a.resourceId)?.get(a.appRoleId) ?? a.appRoleId;
    return {
      id: a.id,
      kind: "application",
      clientAppId: names.get(a.principalId)?.appId ?? a.principalId,
      clientName: displayOf(names.get(a.principalId)),
      resourceName: a.resourceDisplayName,
      permissions: [value],
      consentType: "AppRole",
      isAgent: true,
      highPrivilege: HIGH_PRIV.test(value),
    };
  });

  return [...application, ...delegated];
}

export async function graphPing(): Promise<string> {
  const me = await apiFetch<{ userPrincipalName: string }>("graph", `${G}/me?$select=userPrincipalName`);
  return me.userPrincipalName;
}

/** Group memberships for the signed-in user (used when the token's groups claim overflows). */
export async function getMyGroupIds(): Promise<string[]> {
  const r = await apiFetch<{ value: string[] }>("graph", `${G}/me/getMemberGroups`, { body: { securityEnabledOnly: false } });
  return r.value;
}
