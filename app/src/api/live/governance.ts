// Evidence sources for the AI risk controls that used to need sign-offs:
//   - project/account capability hosts (DP-02: customer-owned agent state storage)
//   - project connections and their auth types (ID-05: no static secrets)
//   - Log Analytics workspace retention (MO-06)
//   - Conditional Access policies targeting agents / workload identities (ID-04)
//   - Foundry evaluation runs (OpenAI-compatible Evals API) and red-team runs (TE-02 / TE-03)
// All read with the signed-in user's token; each source fails independently.

import { config } from "../../config";
import type { ConditionalAccessPolicy, EvaluationEvidence, FoundryProject, ProjectPosture, WorkspacePosture } from "../types";
import { cloudUrl } from "./endpoints";
import { viaProxy } from "./foundry";
import { apiFetch, fetchAllPages } from "./http";

const ARM = cloudUrl("arm");
const CS_API = "2025-06-01";

interface ArmConnection {
  name: string;
  properties: { category?: string; authType?: string; target?: string };
}

/** Capability hosts (empty = "basic" Microsoft-managed agent storage) and connections per project. */
export async function listProjectPosture(projects: FoundryProject[]): Promise<ProjectPosture[]> {
  const accountHosts = new Map<string, Promise<number>>();
  return Promise.all(
    projects
      .filter((p) => p.id) // projects synthesised from an endpoint have no ARM id
      .map(async (p) => {
        const accountId = p.id.split("/projects/")[0];
        if (!accountHosts.has(accountId))
          accountHosts.set(accountId, fetchAllPages<unknown>("arm", `${ARM}${accountId}/capabilityHosts?api-version=${CS_API}`).then((v) => v.length));
        const [projectHosts, acctHosts, connections] = await Promise.all([
          fetchAllPages<unknown>("arm", `${ARM}${p.id}/capabilityHosts?api-version=${CS_API}`).then((v) => v.length).catch(() => null),
          accountHosts.get(accountId)!.catch(() => null),
          fetchAllPages<ArmConnection>("arm", `${ARM}${p.id}/connections?api-version=${CS_API}`).catch(() => null),
        ]);
        return {
          projectId: p.id,
          project: p.name,
          account: p.account,
          capabilityHosts: projectHosts,
          accountCapabilityHosts: acctHosts,
          connections: connections?.map((c) => ({ name: c.name, category: c.properties.category ?? "", authType: c.properties.authType ?? "" })) ?? null,
        };
      }),
  );
}

/** Retention of the primary and additional workspaces (needs the workspace resource ids). */
export async function getWorkspacePosture(): Promise<WorkspacePosture[]> {
  const ids = [config.azure.logAnalyticsWorkspaceResourceId].filter(Boolean);
  return Promise.all(
    ids.map(async (id) => {
      const r = await apiFetch<{ properties: { retentionInDays?: number } }>("arm", `${ARM}${id}?api-version=2023-09-01`).catch(() => null);
      return { id, retentionDays: r?.properties.retentionInDays ?? null };
    }),
  );
}

interface CaPolicy {
  id: string;
  displayName: string;
  state: string;
  conditions?: { clientApplications?: Record<string, unknown> | null } & Record<string, unknown>;
}

/**
 * Conditional Access policies. Agent targeting is detected from the clientApplications condition:
 * any include* property mentioning agents (Entra Agent ID) counts as agent-targeted; workload
 * identities (service principals) count separately. Property names for agents are matched
 * loosely because the schema is new.
 */
export async function listConditionalAccess(): Promise<ConditionalAccessPolicy[]> {
  const policies = await fetchAllPages<CaPolicy>("graphPolicy", `${cloudUrl("graph")}/v1.0/identity/conditionalAccess/policies`);
  return policies.map((p) => {
    const apps = p.conditions?.clientApplications ?? {};
    const included = (pattern: RegExp) =>
      Object.entries(apps).some(([k, v]) => /^include/i.test(k) && pattern.test(k) && Array.isArray(v) && v.length > 0);
    return {
      id: p.id,
      displayName: p.displayName,
      state: p.state,
      targetsAgents: included(/agent/i) || JSON.stringify(p.conditions ?? {}).toLowerCase().includes("agentidentit"),
      targetsServicePrincipals: included(/serviceprincipal/i),
    };
  });
}

interface EvalObj {
  id: string;
  name?: string;
  created_at?: number;
  metadata?: Record<string, string>;
}
interface EvalRun {
  id: string;
  name?: string;
  status: string;
  created_at: number;
  report_url?: string;
  result_counts?: { passed?: number; failed?: number; errored?: number; total?: number };
  data_source?: unknown;
  metadata?: Record<string, string>;
}
interface RedTeamRun {
  id?: string;
  name?: string;
  displayName?: string;
  status?: string;
  createdAt?: string;
  creationTime?: string;
  target?: unknown;
  properties?: Record<string, unknown>;
}

/** Names of agents a run refers to (by searching its target / data source / metadata). */
function agentRefs(obj: unknown, agentNames: string[]): string[] {
  const text = JSON.stringify(obj ?? {}).toLowerCase();
  return agentNames.filter((n) => text.includes(`"${n.toLowerCase()}"`) || text.includes(`/agents/${n.toLowerCase()}`));
}

/** Evaluation runs (Evals API) and red-team runs (preview) per project, linked to agents by name. */
export async function listEvaluationEvidence(projects: FoundryProject[], agentNames: string[]): Promise<EvaluationEvidence[]> {
  const v = config.azure.foundryApiVersion;
  const perProject = await Promise.all(
    projects.map(async (p) => {
      const root = viaProxy(p.endpoint);
      const out: EvaluationEvidence[] = [];
      const evals = await apiFetch<{ data: EvalObj[] }>("foundry", `${root}/openai/evals?api-version=${v}&limit=50`, {}, "foundry").catch(() => ({ data: [] as EvalObj[] }));
      const runs = await Promise.all(
        evals.data.slice(0, 25).map(async (e) => {
          const r = await apiFetch<{ data: EvalRun[] }>("foundry", `${root}/openai/evals/${encodeURIComponent(e.id)}/runs?api-version=${v}&limit=20`, {}, "foundry").catch(() => ({ data: [] as EvalRun[] }));
          return r.data.map((run) => ({ e, run }));
        }),
      );
      for (const { e, run } of runs.flat()) {
        out.push({
          kind: "evaluation",
          project: p.name,
          account: p.account,
          id: run.id,
          name: run.name ?? e.name ?? e.id,
          status: run.status,
          createdAt: new Date(run.created_at * 1000).toISOString(),
          agentNames: agentRefs([run.data_source, run.metadata, e.metadata, e.name, run.name], agentNames),
          passed: run.result_counts?.passed,
          failed: (run.result_counts?.failed ?? 0) + (run.result_counts?.errored ?? 0),
          url: run.report_url,
        });
      }
      // Red teaming is a preview feature: the header opts in; unsupported projects simply return nothing.
      const rt = await apiFetch<{ value: RedTeamRun[] }>("foundry", `${root}/redTeams/runs?api-version=${v}`, { headers: { "Foundry-Features": "RedTeams=V1Preview" } }, "foundry").catch(
        () => ({ value: [] as RedTeamRun[] }),
      );
      for (const r of rt.value) {
        out.push({
          kind: "red_team",
          project: p.name,
          account: p.account,
          id: r.id ?? r.name ?? "",
          name: r.displayName ?? r.name ?? r.id ?? "red team run",
          status: r.status ?? (r.properties?.status as string) ?? "unknown",
          createdAt: r.createdAt ?? r.creationTime ?? "",
          agentNames: agentRefs([r.target, r.properties, r.displayName, r.name], agentNames),
        });
      }
      return out;
    }),
  );
  return perProject.flat();
}
