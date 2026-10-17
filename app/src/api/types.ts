// Domain model for everything the control plane *observes*. Both the mock and the live
// DataSource return these shapes, so pages never know which one they are talking to.

import type { AgentManifest } from "../schema/manifest";

export type TimeRange = "1h" | "24h" | "7d" | "30d";

export interface FoundryProject {
  id: string; // ARM resource id
  subscriptionId?: string;
  account: string;
  name: string;
  resourceGroup: string;
  location: string;
  endpoint: string; // https://<account>.services.ai.azure.com/api/projects/<project>
}

export interface ModelDeployment {
  id: string;
  account: string;
  name: string;
  model: string;
  modelVersion: string;
  sku: string;
  capacity: number;
  raiPolicyName: string;
}

export interface AgentTool {
  type: string;
  name: string;
  detail?: string;
  requireApproval?: string;
  description?: string;
  /** Function tools: JSON schema of the arguments, kept for round-tripping into manifests. */
  parameters?: unknown;
  strict?: boolean;
}

export interface Agent {
  id: string; // Foundry agent id (asst_* or agent name for v2)
  name: string;
  description: string;
  project: string;
  account: string;
  resourceGroup: string;
  subscriptionId?: string;
  model: string;
  instructions: string;
  tools: AgentTool[];
  temperature?: number;
  topP?: number;
  createdAt: string;
  metadata: Record<string, string>;
  /** Owner / identity hints pulled from agent metadata or Entra Agent ID. */
  owner?: string;
  /** Entra Agent ID instance identity (principal object id) — set by the agents API. */
  agentIdentityId?: string;
  /** Which Foundry API the agent lives in: current versioned "agents" or classic "assistants". */
  api?: "agents" | "assistants";
  version?: string;
  kind?: string;
  state?: string;
  blueprintAppId?: string;
}

export interface AgentStats {
  agentName: string;
  runs: number;
  failedRuns: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  p95LatencyMs: number;
  distinctUsers: number;
  lastActivity?: string;
}

export interface TimePoint {
  t: string; // ISO bucket start
  [series: string]: number | string;
}

export interface Span {
  spanId: string;
  parentId?: string;
  name: string;
  kind: "invoke_agent" | "chat" | "execute_tool" | "other";
  start: string;
  durationMs: number;
  success: boolean;
  toolName?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentRun {
  operationId: string;
  agentName: string;
  start: string;
  durationMs: number;
  success: boolean;
  user?: string;
  authFlow?: AuthFlowObserved;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  threadId?: string;
  spans?: Span[];
}

export type AuthFlowObserved = "delegated" | "obo" | "app" | "managed_identity" | "agent_identity";

export interface IdentityUsage {
  principalId: string;
  principalName: string;
  principalType: "user" | "service_principal" | "managed_identity" | "agent_identity";
  clientAppId: string;
  clientAppName: string;
  resource: string;
  authFlow: AuthFlowObserved;
  signIns: number;
  failures: number;
  lastSeen: string;
  conditionalAccess?: string;
  isAgent: boolean;
}

export interface GraphActivity {
  appId: string;
  appName: string;
  authFlow: "delegated" | "app";
  method: string;
  endpoint: string; // normalized RequestUri
  calls: number;
  errors: number;
  scopesOrRoles: string;
  lastSeen: string;
}

export interface PermissionGrant {
  id: string;
  kind: "delegated" | "application";
  clientAppId: string;
  clientName: string;
  resourceName: string;
  permissions: string[];
  consentType: "AllPrincipals" | "Principal" | "AppRole";
  principalName?: string;
  isAgent: boolean;
  highPrivilege: boolean;
}

export interface AgentIdentity {
  id: string;
  appId: string;
  displayName: string;
  kind: "agent_identity" | "agent_blueprint" | "service_principal_tagged";
  blueprintId?: string;
  sponsors: string[];
  createdDateTime: string;
  accountEnabled: boolean;
}

export interface AzureRoleAssignment {
  id: string;
  principalId: string;
  principalName: string;
  principalType: string;
  roleName: string;
  scope: string;
  isAgent: boolean;
}

export interface RaiPolicy {
  id: string;
  account: string;
  name: string;
  basePolicyName: string;
  mode: string;
  contentFilters: { name: string; source: "Prompt" | "Completion"; enabled: boolean; blocking: boolean; severityThreshold?: string }[];
}

export interface PolicyState {
  policyAssignmentName: string;
  policyDefinitionName: string;
  policyDefinitionDisplayName: string;
  resourceId: string;
  resourceType: string;
  complianceState: "Compliant" | "NonCompliant" | "Unknown";
  timestamp: string;
}

export interface Overview {
  agents: number;
  projects: number;
  runs: number;
  failedRuns: number;
  tokens: number;
  activeUsers: number;
  injectedTools: number;
  approvalFreeWriteTools: number;
  nonCompliantResources: number;
  unfilteredDeployments: number;
  runsSeries: TimePoint[]; // { t, succeeded, failed }
  authFlowMix: { flow: AuthFlowObserved; count: number }[];
  topTools: { tool: string; calls: number }[];
}

export interface ContentSafety {
  /** Content filter evaluations per agent / prompt-or-completion / category. */
  filters: { agentName: string; source: string; category: string; evaluations: number; flagged: number; blocked: number }[];
  /** Spans that recorded prompt/response message content. */
  capture: { agentName: string; spans: number; capturedSpans: number }[];
}

export interface SourceHealth {
  source: string;
  ok: boolean;
  detail: string;
  latencyMs?: number;
}

export interface DataSource {
  readonly kind: "mock" | "live";
  listProjects(): Promise<FoundryProject[]>;
  listDeployments(): Promise<ModelDeployment[]>;
  listAgents(): Promise<Agent[]>;
  getAgent(project: string, id: string): Promise<Agent | undefined>;
  agentStats(range: TimeRange): Promise<AgentStats[]>;
  overview(range: TimeRange): Promise<Overview>;
  tokenSeries(range: TimeRange): Promise<TimePoint[]>; // { t, <agentName>: tokens }
  listRuns(range: TimeRange, agentName?: string): Promise<AgentRun[]>;
  getRunSpans(operationId: string): Promise<Span[]>;
  identityUsage(range: TimeRange): Promise<IdentityUsage[]>;
  graphActivity(range: TimeRange): Promise<GraphActivity[]>;
  permissionGrants(): Promise<PermissionGrant[]>;
  agentIdentities(): Promise<AgentIdentity[]>;
  roleAssignments(): Promise<AzureRoleAssignment[]>;
  raiPolicies(): Promise<RaiPolicy[]>;
  contentSafety(range: TimeRange): Promise<ContentSafety>;
  policyStates(): Promise<PolicyState[]>;
  /** The current deployed state expressed as a manifest — the "before" for change requests. */
  manifestFor(agent: Agent): Promise<AgentManifest>;
  health(): Promise<SourceHealth[]>;
}
