// Foundry Agent Service (project data plane). The endpoint does not reliably return CORS
// headers for browser origins, so calls go through the same-origin /proxy/<host>/... route
// (server/proxy.mjs). The user's own token is forwarded; the proxy holds no credentials.

import { config } from "../../config";
import type { Agent, AgentTool, FoundryProject } from "../types";
import { apiFetch } from "./http";

interface FoundryTool {
  type: string;
  server_label?: string;
  server_url?: string;
  require_approval?: string | Record<string, unknown>;
  openapi?: { name?: string };
  function?: { name?: string };
  azure_function?: { function?: { name?: string } };
  connected_agent?: { name?: string; id?: string };
  bing_grounding?: { search_configurations?: { connection_id?: string }[] };
  sharepoint_grounding?: { connections?: { connection_id?: string }[] };
  fabric_dataagent?: { connections?: { connection_id?: string }[] };
}

interface FoundryAgent {
  id: string;
  name: string | null;
  description: string | null;
  model: string;
  instructions: string | null;
  tools: FoundryTool[];
  temperature?: number;
  top_p?: number;
  created_at: number;
  metadata: Record<string, string>;
}

export function viaProxy(endpoint: string): string {
  const u = new URL(endpoint);
  return `${window.location.origin}/proxy/${u.host}${u.pathname.replace(/\/$/, "")}`;
}

const lastSeg = (id?: string) => id?.split("/").pop();

function mapTool(t: FoundryTool): AgentTool {
  switch (t.type) {
    case "mcp":
      return {
        type: "mcp",
        name: t.server_label ?? "mcp",
        detail: t.server_url,
        requireApproval: typeof t.require_approval === "string" ? t.require_approval : t.require_approval ? "write_only" : undefined,
      };
    case "openapi":
      return { type: "openapi", name: t.openapi?.name ?? "openapi" };
    case "function":
      return { type: "azure_function", name: t.function?.name ?? "function" };
    case "azure_function":
      return { type: "azure_function", name: t.azure_function?.function?.name ?? "azure_function" };
    case "connected_agent":
      return { type: "connected_agent", name: t.connected_agent?.name ?? "connected_agent", detail: t.connected_agent?.id };
    case "bing_grounding":
      return { type: t.type, name: "bing", detail: lastSeg(t.bing_grounding?.search_configurations?.[0]?.connection_id) };
    case "sharepoint_grounding":
      return { type: t.type, name: "sharepoint", detail: lastSeg(t.sharepoint_grounding?.connections?.[0]?.connection_id) };
    case "fabric_dataagent":
      return { type: t.type, name: "fabric", detail: lastSeg(t.fabric_dataagent?.connections?.[0]?.connection_id) };
    default:
      return { type: t.type, name: t.type };
  }
}

export async function listProjectAgents(p: FoundryProject): Promise<Agent[]> {
  const out: FoundryAgent[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const qs = new URLSearchParams({ "api-version": config.azure.foundryApiVersion, limit: "100", ...(after ? { after } : {}) });
    const page = await apiFetch<{ data: FoundryAgent[]; has_more: boolean; last_id?: string }>(
      "foundry",
      `${viaProxy(p.endpoint)}/assistants?${qs}`,
      {},
      "foundry",
    );
    out.push(...page.data);
    if (!page.has_more || !page.last_id) break;
    after = page.last_id;
  }
  return out.map((a) => ({
    id: a.id,
    name: a.name ?? a.id,
    description: a.description ?? "",
    project: p.name,
    account: p.account,
    resourceGroup: p.resourceGroup,
    model: a.model,
    instructions: a.instructions ?? "",
    tools: a.tools.map(mapTool),
    temperature: a.temperature,
    topP: a.top_p,
    createdAt: new Date(a.created_at * 1000).toISOString(),
    metadata: a.metadata ?? {},
    owner: a.metadata?.["agentctl.owners"]?.split(",")[0],
  }));
}
