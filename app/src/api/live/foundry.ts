// Foundry Agent Service (project data plane). Two APIs coexist on a project endpoint:
//   - "agents" (current, what the new Foundry portal shows): GET {project}/agents?api-version=v1
//     Agents are addressed by name, versioned, and each gets an Entra Agent ID instance identity.
//   - "assistants" (classic, GA v1): GET {project}/assistants?api-version=v1
// agentctl reads both and labels each agent with the API it came from.
//
// Calls go through the same-origin /proxy/<host>/... route (server/proxy.mjs) because CORS
// support on this endpoint has varied; the user's token is forwarded, the proxy holds none.

import { config } from "../../config";
import type { Agent, FoundryProject } from "../types";
import { fromAgentV2, fromAssistant, type FoundryAgentV2, type FoundryAssistant } from "./foundryMap";
import { apiFetch } from "./http";

export function viaProxy(endpoint: string): string {
  const u = new URL(endpoint);
  return `${window.location.origin}/proxy/${u.host}${u.pathname.replace(/\/$/, "")}`;
}

async function paged<T extends { id: string }>(url: (after?: string) => string): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await apiFetch<{ data: T[]; has_more: boolean; last_id?: string }>("foundry", url(after), {}, "foundry");
    out.push(...page.data);
    if (!page.has_more || !page.last_id) break;
    after = page.last_id;
  }
  return out;
}

const qs = (after?: string) =>
  new URLSearchParams({ "api-version": config.azure.foundryApiVersion, limit: "100", ...(after ? { after } : {}) }).toString();

/**
 * Lists agents from both APIs. A failure on one API is tolerated (e.g. an older project without
 * the agents API); if both fail the first error is rethrown so the UI can prompt for consent.
 */
export async function listProjectAgents(p: FoundryProject): Promise<Agent[]> {
  const root = viaProxy(p.endpoint);
  const [v2, classic] = await Promise.allSettled([
    paged<FoundryAgentV2>((after) => `${root}/agents?${qs(after)}`),
    paged<FoundryAssistant>((after) => `${root}/assistants?${qs(after)}`),
  ]);
  if (v2.status === "rejected" && classic.status === "rejected") throw v2.reason;
  return [
    ...(v2.status === "fulfilled" ? v2.value.map((a) => fromAgentV2(p, a)) : []),
    ...(classic.status === "fulfilled" ? classic.value.map((a) => fromAssistant(p, a)) : []),
  ];
}

