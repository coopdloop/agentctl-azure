// TypeScript mirror of agent.schema.json / change-request.schema.json.
// The JSON Schemas are the contract with the GitOps pipeline; keep both in sync
// (schema.test.ts checks that the sample manifests validate).

import type { RiskTier } from "../config";

export const API_VERSION = "agentctl.lariat.dev/v1alpha1";

export type ToolType =
  | "code_interpreter"
  | "file_search"
  | "bing_grounding"
  | "azure_ai_search"
  | "sharepoint_grounding"
  | "fabric_dataagent"
  | "browser_automation"
  | "openapi"
  | "mcp"
  | "azure_function"
  | "connected_agent"
  | "function";

export type ApprovalMode = "always" | "never" | "write_only";

export interface ToolBase {
  name: string;
  type: ToolType;
  description?: string;
  riskTier: RiskTier;
  requireApproval: ApprovalMode;
  /** Set when the platform (not the agent owner) added this tool via harness injection. */
  injected?: { by: string; reason: string; changeRequest?: string };
}

export interface OpenApiTool extends ToolBase {
  type: "openapi";
  openapi: {
    specUrl?: string;
    specInline?: string;
    operations: { operationId: string; method: string; path: string }[];
    auth: { type: "anonymous" | "managed_identity" | "connection"; audience?: string; connectionName?: string };
  };
}
export interface McpTool extends ToolBase {
  type: "mcp";
  mcp: {
    serverLabel: string;
    serverUrl: string;
    allowedTools: string[];
    headersFromConnection?: string;
  };
}
export interface FunctionTool extends ToolBase {
  type: "azure_function";
  azureFunction: {
    functionAppResourceId: string;
    functionName: string;
    inputQueue: string;
    outputQueue: string;
    parametersSchema?: string;
  };
}
/** Client-executed function: the calling app runs it and returns the output. */
export interface FunctionCallTool extends ToolBase {
  type: "function";
  function: { parametersSchema: string; strict: boolean };
}
export interface ConnectedAgentTool extends ToolBase {
  type: "connected_agent";
  connectedAgent: { agentRef: string; delegationDescription: string };
}
export interface ConnectionTool extends ToolBase {
  type: "bing_grounding" | "azure_ai_search" | "sharepoint_grounding" | "fabric_dataagent";
  connection: { connectionName: string; indexName?: string; queryType?: string; topK?: number };
}
export interface BuiltinTool extends ToolBase {
  type: "code_interpreter" | "file_search" | "browser_automation";
  builtin?: { vectorStoreIds?: string[]; allowedDomains?: string[] };
}

export type ToolSpec = OpenApiTool | McpTool | FunctionTool | FunctionCallTool | ConnectedAgentTool | ConnectionTool | BuiltinTool;

export type AuthFlow = "delegated" | "obo" | "app";

export interface HarnessInjection {
  id: string;
  position: "prepend" | "append";
  text: string;
  reason: string;
  mandatory: boolean;
}

export interface ContentFilterSetting {
  enabled: boolean;
  blocking: boolean;
  severityThreshold: "Low" | "Medium" | "High";
}

export interface AgentManifest {
  apiVersion: typeof API_VERSION;
  kind: "Agent";
  metadata: {
    name: string;
    displayName: string;
    description: string;
    owners: string[];
    team: string;
    costCenter?: string;
    dataClassification: "public" | "internal" | "confidential" | "highly_confidential";
    environment: "dev" | "test" | "prod";
    labels?: Record<string, string>;
  };
  spec: {
    foundry: {
      subscriptionId: string;
      resourceGroup: string;
      account: string;
      project: string;
    };
    model: {
      deployment: string;
      modelName: string;
      temperature?: number;
      topP?: number;
      responseFormat?: "auto" | "text" | "json_object";
    };
    instructions: { system: string; version: string };
    harness: { injections: HarnessInjection[] };
    tools: ToolSpec[];
    knowledge: {
      vectorStores: { name: string; source: string }[];
      searchIndexes: { connectionName: string; indexName: string }[];
    };
    identity: {
      type: "agent_identity" | "user_assigned_mi" | "project_mi";
      allowedAuthFlows: AuthFlow[];
      delegatedScopes: string[];
      appRoles: string[];
      azureRoleAssignments: { scope: string; role: string; justification: string }[];
    };
    access: {
      allowedGroups: string[];
      allowedClientApps: string[];
      exposure: "internal" | "teams" | "m365_copilot" | "api";
    };
    guardrails: {
      raiPolicy: {
        name: string;
        basePolicy: string;
        mode: "Blocking" | "Asynchronous_filter" | "Deferred";
        filters: {
          hate: ContentFilterSetting;
          sexual: ContentFilterSetting;
          violence: ContentFilterSetting;
          selfharm: ContentFilterSetting;
        };
        promptShields: { jailbreak: boolean; indirectAttack: boolean };
        protectedMaterial: { text: boolean; code: boolean };
      };
      limits: { maxTokensPerRun: number; maxToolCallsPerRun: number; maxRunSeconds: number };
      piiRedactionInTraces: boolean;
    };
    observability: { tracing: boolean; captureContent: boolean; sampleRate: number };
    lifecycle: { reviewCadenceDays: number; expiresOn?: string };
  };
}

export type ChangeOp =
  | "create_agent"
  | "add_tool"
  | "remove_tool"
  | "modify_tool"
  | "update_instructions"
  | "inject_instruction"
  | "remove_injection"
  | "update_guardrails"
  | "update_identity"
  | "update_access"
  | "update_model"
  | "update_metadata"
  | "update_other";

export interface ChangeItem {
  op: ChangeOp;
  path: string;
  summary: string;
  riskTier: RiskTier;
}

export interface ChangeRequest {
  apiVersion: typeof API_VERSION;
  kind: "ChangeRequest";
  metadata: {
    id: string;
    title: string;
    createdAt: string;
    requestedBy: string;
    source: "agentctl-ui";
  };
  spec: {
    target: { agent: string; project: string; account: string; foundryAgentId?: string };
    changeType: "create" | "update";
    rationale: string;
    changes: ChangeItem[];
    risk: { tier: RiskTier; score: number; reasons: string[] };
    approvals: { required: { group: string; reason: string }[]; minApprovers: number };
    baseManifestSha256?: string;
    manifestSha256: string;
  };
}
