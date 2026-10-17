// Translates the manifest into the Foundry Agent Service create/update payload
// (POST {projectEndpoint}/assistants?api-version=v1). The pipeline applies this file verbatim;
// values in ${...} are resolved by the pipeline (e.g. OpenAPI specs fetched from specUrl).

import { composeInstructions } from "../lib/manifestDefaults";
import type { AgentManifest, ToolSpec } from "../schema/manifest";

const connId = (m: AgentManifest, name: string) =>
  `/subscriptions/${m.spec.foundry.subscriptionId}/resourceGroups/${m.spec.foundry.resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${m.spec.foundry.account}/projects/${m.spec.foundry.project}/connections/${name}`;

function toolPayload(m: AgentManifest, t: ToolSpec): Record<string, unknown> {
  switch (t.type) {
    case "code_interpreter":
    case "file_search":
      return { type: t.type };
    case "browser_automation":
      return { type: t.type, browser_automation: { connection: { id: connId(m, "playwright") } } };
    case "bing_grounding":
      return { type: t.type, bing_grounding: { search_configurations: [{ connection_id: connId(m, t.connection.connectionName), count: t.connection.topK ?? 5 }] } };
    case "sharepoint_grounding":
      return { type: t.type, sharepoint_grounding: { connections: [{ connection_id: connId(m, t.connection.connectionName) }] } };
    case "fabric_dataagent":
      return { type: t.type, fabric_dataagent: { connections: [{ connection_id: connId(m, t.connection.connectionName) }] } };
    case "azure_ai_search":
      return { type: t.type };
    case "openapi":
      return {
        type: "openapi",
        openapi: {
          name: t.name,
          description: t.description ?? t.name,
          spec: t.openapi.specInline ? safeJson(t.openapi.specInline) : { $resolve: t.openapi.specUrl },
          auth:
            t.openapi.auth.type === "managed_identity"
              ? { type: "managed_identity", security_scheme: { audience: t.openapi.auth.audience ?? "" } }
              : t.openapi.auth.type === "connection"
                ? { type: "connection", security_scheme: { connection_id: connId(m, t.openapi.auth.connectionName ?? "") } }
                : { type: "anonymous" },
        },
      };
    case "mcp":
      return {
        type: "mcp",
        server_label: t.mcp.serverLabel,
        server_url: t.mcp.serverUrl,
        allowed_tools: t.mcp.allowedTools,
        require_approval: t.requireApproval === "never" ? "never" : "always",
      };
    case "azure_function": {
      const queueEndpoint = "${function_queue_service_endpoint}";
      return {
        type: "azure_function",
        azure_function: {
          function: {
            name: t.azureFunction.functionName,
            description: t.description ?? t.name,
            parameters: t.azureFunction.parametersSchema ? safeJson(t.azureFunction.parametersSchema) : { type: "object", properties: {} },
          },
          input_binding: { type: "storage_queue", storage_queue: { queue_service_endpoint: queueEndpoint, queue_name: t.azureFunction.inputQueue } },
          output_binding: { type: "storage_queue", storage_queue: { queue_service_endpoint: queueEndpoint, queue_name: t.azureFunction.outputQueue } },
        },
      };
    }
    case "connected_agent":
      return { type: "connected_agent", connected_agent: { id: `\${agent_id:${t.connectedAgent.agentRef}}`, name: t.name, description: t.connectedAgent.delegationDescription } };
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { $raw: s };
  }
}

export function foundryAgentPayload(m: AgentManifest, manifestSha: string): Record<string, unknown> {
  const fileSearch = m.spec.tools.find((t) => t.type === "file_search");
  const search = m.spec.tools.find((t) => t.type === "azure_ai_search");
  const toolResources: Record<string, unknown> = {};
  if (fileSearch && m.spec.knowledge.vectorStores.length)
    toolResources.file_search = { vector_store_ids: m.spec.knowledge.vectorStores.map((v) => `\${vector_store_id:${v.name}}`) };
  if (search && search.type === "azure_ai_search")
    toolResources.azure_ai_search = {
      indexes: [
        {
          index_connection_id: connId(m, search.connection.connectionName),
          index_name: search.connection.indexName ?? m.spec.knowledge.searchIndexes[0]?.indexName ?? "",
          query_type: search.connection.queryType ?? "vector_semantic_hybrid",
          top_k: search.connection.topK ?? 5,
        },
      ],
    };

  // Foundry metadata: max 16 keys, 512 chars per value.
  const metadata: Record<string, string> = {
    "agentctl.name": m.metadata.name,
    "agentctl.owners": m.metadata.owners.join(",").slice(0, 512),
    "agentctl.team": m.metadata.team,
    "agentctl.classification": m.metadata.dataClassification,
    "agentctl.environment": m.metadata.environment,
    "agentctl.instructions_version": m.spec.instructions.version,
    "agentctl.manifest_sha256": manifestSha,
    "agentctl.harness": m.spec.harness.injections.map((i) => i.id).join(",").slice(0, 512),
    "agentctl.max_tool_calls": String(m.spec.guardrails.limits.maxToolCallsPerRun),
  };

  return {
    name: m.metadata.name,
    description: m.metadata.description.slice(0, 512),
    model: m.spec.model.deployment,
    instructions: composeInstructions(m),
    tools: m.spec.tools.map((t) => toolPayload(m, t)),
    ...(Object.keys(toolResources).length ? { tool_resources: toolResources } : {}),
    temperature: m.spec.model.temperature,
    top_p: m.spec.model.topP,
    ...(m.spec.model.responseFormat && m.spec.model.responseFormat !== "auto" ? { response_format: { type: m.spec.model.responseFormat } } : {}),
    metadata,
  };
}
