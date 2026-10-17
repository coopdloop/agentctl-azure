// Pure mapping from Foundry API objects (agents + classic assistants) to agentctl's Agent model.
// No browser or auth dependencies, so it is shared by the app, scripts and tests.

import type { Agent, AgentTool, FoundryProject } from "../types";

export interface FoundryTool {
  type: string;
  name?: string;
  description?: string;
  parameters?: unknown;
  strict?: boolean;
  server_label?: string;
  server_url?: string;
  require_approval?: string | Record<string, unknown>;
  openapi?: { name?: string };
  function?: { name?: string };
  azure_function?: { function?: { name?: string } };
  connected_agent?: { name?: string; id?: string };
  base_url?: string;
  bing_grounding?: { search_configurations?: { connection_id?: string; project_connection_id?: string }[] };
  sharepoint_grounding?: { connections?: { connection_id?: string }[] };
  fabric_dataagent?: { connections?: { connection_id?: string }[] };
  azure_ai_search?: { indexes?: { project_connection_id?: string; index_name?: string }[] };
}

/** Classic assistant object. */
export interface FoundryAssistant {
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

/** Current agents API object (latest version inlined). */
export interface FoundryAgentV2 {
  id: string;
  name: string;
  state?: string;
  versions: {
    latest: {
      id: string;
      version: string;
      description?: string;
      created_at: number;
      metadata?: Record<string, string>;
      status?: string;
      definition: {
        kind: string; // prompt | hosted | workflow | ...
        model?: string;
        instructions?: string;
        tools?: FoundryTool[];
        temperature?: number;
        top_p?: number;
      };
      instance_identity?: { principal_id: string; client_id: string };
      blueprint?: { principal_id: string; client_id: string };
      blueprint_reference?: { blueprint_id: string; type: string };
    };
  };
}

const lastSeg = (id?: string) => id?.split("/").pop();

/** Normalises tool types across both APIs (drops _preview suffixes, maps a2a/function). */
function mapTool(t: FoundryTool): AgentTool {
  const type = t.type.replace(/_preview$/, "");
  const approval = typeof t.require_approval === "string" ? t.require_approval : t.require_approval ? "write_only" : undefined;
  switch (type) {
    case "mcp":
      return { type: "mcp", name: t.server_label ?? "mcp", detail: t.server_url, requireApproval: approval ?? "always" };
    case "openapi":
      return { type: "openapi", name: t.openapi?.name ?? "openapi" };
    case "function":
      return { type: "function", name: t.name ?? t.function?.name ?? "function", detail: "client function", description: t.description, parameters: t.parameters, strict: t.strict };
    case "azure_function":
      return { type: "azure_function", name: t.azure_function?.function?.name ?? "azure_function" };
    case "connected_agent":
      return { type: "connected_agent", name: t.connected_agent?.name ?? "connected_agent", detail: t.connected_agent?.id };
    case "a2a":
      return { type: "connected_agent", name: t.name ?? "a2a", detail: t.base_url };
    case "bing_grounding": {
      const c = t.bing_grounding?.search_configurations?.[0];
      return { type, name: "bing", detail: lastSeg(c?.project_connection_id ?? c?.connection_id) };
    }
    case "sharepoint_grounding":
      return { type, name: "sharepoint", detail: lastSeg(t.sharepoint_grounding?.connections?.[0]?.connection_id) };
    case "fabric_dataagent":
      return { type, name: "fabric", detail: lastSeg(t.fabric_dataagent?.connections?.[0]?.connection_id) };
    case "azure_ai_search":
      return { type, name: "azure_ai_search", detail: t.azure_ai_search?.indexes?.[0]?.index_name };
    default:
      return { type, name: t.name ?? type };
  }
}

function base(p: FoundryProject) {
  return { project: p.name, account: p.account, resourceGroup: p.resourceGroup, subscriptionId: p.subscriptionId };
}

export function fromAssistant(p: FoundryProject, a: FoundryAssistant): Agent {
  return {
    ...base(p),
    id: a.id,
    name: a.name ?? a.id,
    description: a.description ?? "",
    model: a.model,
    instructions: a.instructions ?? "",
    tools: a.tools.map(mapTool),
    temperature: a.temperature,
    topP: a.top_p,
    createdAt: new Date(a.created_at * 1000).toISOString(),
    metadata: normaliseMetadata(a.metadata ?? {}),
    owner: a.metadata?.["agentctl.owners"]?.split(",")[0] ?? a.metadata?.owner,
    api: "assistants",
  };
}

export function fromAgentV2(p: FoundryProject, a: FoundryAgentV2): Agent {
  const v = a.versions.latest;
  const md = v.metadata ?? {};
  return {
    ...base(p),
    id: a.name,
    name: a.name,
    description: v.description ?? "",
    model: v.definition.model ?? "",
    instructions: v.definition.instructions ?? "",
    tools: (v.definition.tools ?? []).map(mapTool),
    temperature: v.definition.temperature,
    topP: v.definition.top_p,
    createdAt: new Date(v.created_at * 1000).toISOString(),
    metadata: normaliseMetadata(md),
    owner: md["agentctl.owners"]?.split(",")[0] ?? md.owner,
    agentIdentityId: v.instance_identity?.principal_id,
    api: "agents",
    version: v.version,
    kind: v.definition.kind,
    state: a.state,
    blueprintAppId: v.blueprint?.client_id,
  };
}

/** agentctl writes namespaced keys (agentctl.team, ...); expose them under the plain names too. */
function normaliseMetadata(md: Record<string, string>): Record<string, string> {
  const alias: Record<string, string> = {
    "agentctl.team": "team",
    "agentctl.environment": "environment",
    "agentctl.classification": "dataClassification",
    "agentctl.instructions_version": "instructionsVersion",
    "agentctl.owners": "owner",
  };
  const out = { ...md };
  for (const [from, to] of Object.entries(alias)) {
    if (md[from] && !md[to]) out[to] = from === "agentctl.owners" ? md[from].split(",")[0] : md[from];
  }
  return out;
}
