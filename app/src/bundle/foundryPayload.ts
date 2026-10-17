// Translates the manifest into a Foundry agents API "create version" body:
//   POST {projectEndpoint}/agents/{name}/versions?api-version=v1
// Every apply creates a new immutable agent version, which maps 1:1 to a merged change request.
// Values in ${...} are resolved by the pipeline (e.g. OpenAPI specs fetched from specUrl).
//
// Note: Foundry's own `definition.harness` field selects a managed runtime loop (e.g. GitHub
// Copilot); it is unrelated to agentctl harness *injection*, which is composed into instructions.

import { composeInstructions } from "../lib/manifestDefaults";
import type { AgentManifest, ToolSpec } from "../schema/manifest";

const connId = (m: AgentManifest, name: string) =>
  `/subscriptions/${m.spec.foundry.subscriptionId}/resourceGroups/${m.spec.foundry.resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${m.spec.foundry.account}/projects/${m.spec.foundry.project}/connections/${name}`;

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { $raw: s };
  }
}

function toolPayload(m: AgentManifest, t: ToolSpec): Record<string, unknown> {
  switch (t.type) {
    case "code_interpreter":
      return { type: "code_interpreter", container: { type: "auto" } };
    case "file_search":
      return { type: "file_search", vector_store_ids: m.spec.knowledge.vectorStores.map((v) => `\${vector_store_id:${v.name}}`) };
    case "browser_automation":
      return { type: "browser_automation_preview", browser_automation_preview: { connection: { project_connection_id: connId(m, "playwright") } } };
    case "bing_grounding":
      return {
        type: "bing_grounding",
        bing_grounding: { search_configurations: [{ project_connection_id: connId(m, t.connection.connectionName), count: t.connection.topK ?? 5 }] },
      };
    case "sharepoint_grounding":
      return { type: "sharepoint_grounding_preview", sharepoint_grounding_preview: { project_connections: [{ project_connection_id: connId(m, t.connection.connectionName) }] } };
    case "fabric_dataagent":
      return { type: "fabric_dataagent_preview", fabric_dataagent_preview: { project_connections: [{ project_connection_id: connId(m, t.connection.connectionName) }] } };
    case "azure_ai_search":
      return {
        type: "azure_ai_search",
        azure_ai_search: {
          indexes: [
            {
              project_connection_id: connId(m, t.connection.connectionName),
              index_name: t.connection.indexName ?? m.spec.knowledge.searchIndexes[0]?.indexName ?? "",
              query_type: t.connection.queryType ?? "vector_semantic_hybrid",
              top_k: t.connection.topK ?? 5,
            },
          ],
        },
      };
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
                ? { type: "project_connection", security_scheme: { project_connection_id: connId(m, t.openapi.auth.connectionName ?? "") } }
                : { type: "anonymous" },
        },
      };
    case "mcp":
      return {
        type: "mcp",
        server_label: t.mcp.serverLabel,
        server_url: t.mcp.serverUrl,
        ...(t.mcp.allowedTools.length ? { allowed_tools: t.mcp.allowedTools } : {}),
        require_approval: t.requireApproval === "never" ? "never" : "always",
        ...(t.mcp.headersFromConnection ? { project_connection_id: connId(m, t.mcp.headersFromConnection) } : {}),
      };
    case "azure_function": {
      const queue = "${function_queue_service_endpoint}";
      return {
        type: "azure_function",
        azure_function: {
          function: {
            name: t.azureFunction.functionName,
            description: t.description ?? t.name,
            parameters: t.azureFunction.parametersSchema ? safeJson(t.azureFunction.parametersSchema) : { type: "object", properties: {} },
          },
          input_binding: { type: "storage_queue", storage_queue: { queue_service_endpoint: queue, queue_name: t.azureFunction.inputQueue } },
          output_binding: { type: "storage_queue", storage_queue: { queue_service_endpoint: queue, queue_name: t.azureFunction.outputQueue } },
        },
      };
    }
    case "connected_agent":
      // Agent-to-agent: the target agent's A2A endpoint is resolved by the pipeline.
      return { type: "a2a_preview", base_url: `\${a2a_base_url:${t.connectedAgent.agentRef}}`, a2a_version: "0.3" };
  }
}

export function foundryAgentPayload(m: AgentManifest, manifestSha: string): Record<string, unknown> {
  // Agent metadata: max 16 keys, 512 chars per value.
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
    description: m.metadata.description.slice(0, 512),
    metadata,
    definition: {
      kind: "prompt",
      model: m.spec.model.deployment,
      instructions: composeInstructions(m),
      tools: m.spec.tools.map((t) => toolPayload(m, t)),
      temperature: m.spec.model.temperature,
      top_p: m.spec.model.topP,
      ...(m.spec.model.responseFormat === "json_object" ? { text: { format: { type: "json_object" } } } : {}),
    },
  };
}
