import type { RiskTier } from "../config";
import { config } from "../config";
import type { Agent, AgentTool, ModelDeployment } from "../api/types";
import {
  API_VERSION,
  type AgentManifest,
  type ApprovalMode,
  type ContentFilterSetting,
  type ToolSpec,
  type ToolType,
} from "../schema/manifest";
import { MANDATORY_INJECTIONS } from "./harnessLibrary";

const filter = (severityThreshold: ContentFilterSetting["severityThreshold"] = "Medium"): ContentFilterSetting => ({
  enabled: true,
  blocking: true,
  severityThreshold,
});

export function defaultRaiPolicy(name = "agentctl-default"): AgentManifest["spec"]["guardrails"]["raiPolicy"] {
  return {
    name,
    basePolicy: "Microsoft.DefaultV2",
    mode: "Blocking",
    filters: { hate: filter(), sexual: filter(), violence: filter(), selfharm: filter() },
    promptShields: { jailbreak: true, indirectAttack: true },
    protectedMaterial: { text: true, code: true },
  };
}

export function emptyManifest(): AgentManifest {
  return {
    apiVersion: API_VERSION,
    kind: "Agent",
    metadata: {
      name: "",
      displayName: "",
      description: "",
      owners: [],
      team: "",
      dataClassification: "internal",
      environment: "dev",
      labels: {},
    },
    spec: {
      foundry: { subscriptionId: config.azure.subscriptionId || "${subscription_id}", resourceGroup: "", account: "", project: "" },
      model: { deployment: "", modelName: "", temperature: 0.2, topP: 1, responseFormat: "auto" },
      instructions: { system: "", version: "1.0.0" },
      harness: { injections: MANDATORY_INJECTIONS.map((i) => ({ ...i })) },
      tools: [],
      knowledge: { vectorStores: [], searchIndexes: [] },
      identity: { type: "agent_identity", allowedAuthFlows: ["obo"], delegatedScopes: [], appRoles: [], azureRoleAssignments: [] },
      access: { allowedGroups: [], allowedClientApps: [], exposure: "internal" },
      guardrails: {
        raiPolicy: defaultRaiPolicy(),
        limits: { maxTokensPerRun: 32000, maxToolCallsPerRun: 20, maxRunSeconds: 120 },
        piiRedactionInTraces: true,
      },
      observability: { tracing: true, captureContent: false, sampleRate: 1 },
      lifecycle: { reviewCadenceDays: 90 },
    },
  };
}

/** Baseline risk for each tool type. OpenAPI/MCP are refined by what they can actually do. */
export const TOOL_TYPE_INFO: Record<ToolType, { label: string; baseRisk: RiskTier; group: "Foundry built-in" | "Custom"; blurb: string }> = {
  file_search: { label: "File search", baseRisk: "read", group: "Foundry built-in", blurb: "Retrieval over vector stores uploaded to the project." },
  code_interpreter: { label: "Code interpreter", baseRisk: "write", group: "Foundry built-in", blurb: "Sandboxed Python execution; can create files." },
  bing_grounding: { label: "Grounding with Bing", baseRisk: "read", group: "Foundry built-in", blurb: "Public web search via a Bing connection. Data leaves the tenant boundary." },
  azure_ai_search: { label: "Azure AI Search", baseRisk: "read", group: "Foundry built-in", blurb: "Query an AI Search index through a project connection." },
  sharepoint_grounding: { label: "SharePoint", baseRisk: "read", group: "Foundry built-in", blurb: "Grounding on SharePoint content using the caller's identity (OBO)." },
  fabric_dataagent: { label: "Fabric data agent", baseRisk: "read", group: "Foundry built-in", blurb: "Query Microsoft Fabric data agents with the caller's identity." },
  browser_automation: { label: "Browser automation", baseRisk: "privileged", group: "Foundry built-in", blurb: "Drives a real browser (Playwright). Always privileged." },
  openapi: { label: "OpenAPI 3 tool", baseRisk: "read", group: "Custom", blurb: "Call any REST API described by an OpenAPI spec." },
  mcp: { label: "MCP server", baseRisk: "write", group: "Custom", blurb: "Remote Model Context Protocol server with an allowlist of tools." },
  azure_function: { label: "Azure Function", baseRisk: "write", group: "Custom", blurb: "Queue-triggered Azure Function as a tool." },
  connected_agent: { label: "Connected agent (A2A)", baseRisk: "write", group: "Custom", blurb: "Delegate a sub-task to another Foundry agent." },
};

const RISK_ORDER: RiskTier[] = ["read", "write", "privileged"];
export const maxTier = (...tiers: RiskTier[]): RiskTier =>
  tiers.reduce<RiskTier>((a, b) => (RISK_ORDER.indexOf(b) > RISK_ORDER.indexOf(a) ? b : a), "read");
export const tierRank = (t: RiskTier) => RISK_ORDER.indexOf(t);

const WRITE_VERBS = /(create|update|delete|remove|send|post|write|put|patch|approve|grant|reset|execute|run|deploy)/i;

/** Derives the risk tier from what the tool can actually do, not just its type. */
export function inferToolRisk(tool: ToolSpec): RiskTier {
  const base = TOOL_TYPE_INFO[tool.type].baseRisk;
  if (tool.type === "openapi") {
    const ops = tool.openapi.operations;
    const writes = ops.some((o) => o.method !== "GET");
    const destructive = ops.some((o) => o.method === "DELETE");
    return destructive ? "privileged" : writes ? "write" : "read";
  }
  if (tool.type === "mcp") {
    const t = tool.mcp.allowedTools;
    if (t.length === 0) return "privileged"; // empty allowlist = every tool the server exposes
    return t.some((n) => WRITE_VERBS.test(n)) ? "write" : "read";
  }
  return base;
}

export function defaultApprovalFor(tier: RiskTier): ApprovalMode {
  return tier === "read" ? "never" : "always";
}

/** Best-effort mapping of a live Foundry agent definition into the manifest shape. */
export function agentToManifest(agent: Agent, deployments: ModelDeployment[], subscriptionId: string): AgentManifest {
  const m = emptyManifest();
  const dep = deployments.find((d) => d.name === agent.model && d.account === agent.account);
  const slug = agent.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63) || "agent";

  m.metadata = {
    name: /^[a-z]/.test(slug) ? slug : `a-${slug}`,
    displayName: agent.metadata.displayName ?? agent.name,
    description: agent.description || `${agent.name} (imported from Foundry)`,
    owners: agent.owner ? [agent.owner] : agent.metadata.owner ? [agent.metadata.owner] : ["unknown@unassigned"],
    team: agent.metadata.team ?? "unassigned",
    dataClassification: (agent.metadata.dataClassification as AgentManifest["metadata"]["dataClassification"]) ?? "internal",
    environment: (agent.metadata.environment as AgentManifest["metadata"]["environment"]) ?? "prod",
    labels: { "agentctl.lariat.dev/foundry-agent-id": agent.id },
  };
  m.spec.foundry = { subscriptionId, resourceGroup: agent.resourceGroup, account: agent.account, project: agent.project };
  m.spec.model = {
    deployment: agent.model,
    modelName: dep?.model ?? agent.model,
    temperature: agent.temperature ?? 1,
    topP: agent.topP ?? 1,
    responseFormat: "auto",
  };

  // Split out platform injections that were previously composed into the deployed prompt.
  const { ownerText, injections } = extractInjections(agent.instructions);
  m.spec.instructions = { system: ownerText || agent.instructions, version: agent.metadata.instructionsVersion ?? "1.0.0" };
  m.spec.harness.injections = injections;
  m.spec.tools = agent.tools.map(toolFromFoundry);
  // Built-in policies (Microsoft.*) can't be managed; imported agents get their own policy that
  // starts from the deployment's current base so the change request shows only real deltas.
  if (dep?.raiPolicyName && !dep.raiPolicyName.startsWith("Microsoft.")) {
    m.spec.guardrails.raiPolicy.name = dep.raiPolicyName.replace(/[^A-Za-z0-9_.-]/g, "-");
  } else {
    m.spec.guardrails.raiPolicy.name = `agentctl-${m.metadata.name}`.slice(0, 64);
    if (dep?.raiPolicyName) m.spec.guardrails.raiPolicy.basePolicy = dep.raiPolicyName;
  }
  m.spec.identity.allowedAuthFlows = agent.tools.some((t) => ["sharepoint_grounding", "fabric_dataagent"].includes(t.type))
    ? ["obo"]
    : ["obo", "app"];
  return m;
}

function toolFromFoundry(t: AgentTool, i: number): ToolSpec {
  const name = (t.name || `${t.type}_${i}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const requireApproval = (t.requireApproval as ApprovalMode) ?? "never";
  switch (t.type) {
    case "openapi":
      return {
        name,
        type: "openapi",
        riskTier: "write",
        requireApproval,
        openapi: { operations: [{ operationId: t.detail ?? "unknown", method: "POST", path: "/" }], auth: { type: "managed_identity" } },
      };
    case "mcp":
      return {
        name,
        type: "mcp",
        riskTier: "write",
        requireApproval,
        mcp: { serverLabel: name, serverUrl: t.detail?.startsWith("https://") ? t.detail : "https://unknown.invalid", allowedTools: [] },
      };
    case "azure_function":
      return {
        name,
        type: "azure_function",
        riskTier: "write",
        requireApproval,
        azureFunction: { functionAppResourceId: "/subscriptions/unknown", functionName: t.detail ?? name, inputQueue: "in", outputQueue: "out" },
      };
    case "connected_agent":
      return { name, type: "connected_agent", riskTier: "write", requireApproval, connectedAgent: { agentRef: t.detail ?? name, delegationDescription: "Imported connected agent" } };
    case "bing_grounding":
    case "azure_ai_search":
    case "sharepoint_grounding":
    case "fabric_dataagent":
      return { name, type: t.type, riskTier: "read", requireApproval, connection: { connectionName: t.detail ?? "unknown" } };
    case "browser_automation":
      return { name, type: "browser_automation", riskTier: "privileged", requireApproval: "always" };
    case "code_interpreter":
    case "file_search":
    default:
      return {
        name,
        type: (t.type === "file_search" ? "file_search" : "code_interpreter") as "file_search" | "code_interpreter",
        riskTier: t.type === "file_search" ? "read" : "write",
        requireApproval,
      };
  }
}

const INJECTION_RE = /<!-- agentctl:harness id="([^"]+)" position="(prepend|append)" mandatory="(true|false)" -->\n([\s\S]*?)\n<!-- \/agentctl:harness -->/g;

/** Injections are composed into the deployed prompt with markers so they can be round-tripped. */
export function composeInstructions(m: AgentManifest): string {
  const wrap = (i: AgentManifest["spec"]["harness"]["injections"][number]) =>
    `<!-- agentctl:harness id="${i.id}" position="${i.position}" mandatory="${i.mandatory}" -->\n${i.text}\n<!-- /agentctl:harness -->`;
  const pre = m.spec.harness.injections.filter((i) => i.position === "prepend").map(wrap);
  const post = m.spec.harness.injections.filter((i) => i.position === "append").map(wrap);
  return [...pre, m.spec.instructions.system, ...post].join("\n\n");
}

export function extractInjections(composed: string): { ownerText: string; injections: AgentManifest["spec"]["harness"]["injections"] } {
  const injections: AgentManifest["spec"]["harness"]["injections"] = [];
  const ownerText = composed
    .replace(INJECTION_RE, (_all, id: string, position: "prepend" | "append", mandatory: string, text: string) => {
      injections.push({ id, position, mandatory: mandatory === "true", text, reason: "Imported from deployed agent" });
      return "";
    })
    .trim();
  return { ownerText, injections };
}
