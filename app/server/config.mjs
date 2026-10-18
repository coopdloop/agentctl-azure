// Runtime configuration, built from environment variables.
// Served to the browser as /config.js so one build works in every environment.
// In App Service these come from app settings (set by Terraform); locally from app/.env.local.

import { connectSources, parseProxyServices, proxyAllowlist, resolveCloud } from "./clouds.mjs";

const list = (v) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function parseJson(v, fallback) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    console.warn("agentctl: invalid JSON in runtime config; using default");
    return fallback;
  }
}

export function buildRuntimeConfig(env = process.env) {
  const cloud = resolveCloud(env);
  const primarySub = env.AGENTCTL_SUBSCRIPTION_ID || "";
  return {
    mode: env.AGENTCTL_MODE === "live" ? "live" : "mock",
    environment: env.AGENTCTL_ENVIRONMENT || "local",
    auth: {
      tenantId: env.AGENTCTL_TENANT_ID || "",
      clientId: env.AGENTCTL_CLIENT_ID || "",
      redirectUri: env.AGENTCTL_REDIRECT_URI || "",
    },
    // Endpoints for the Azure cloud (AGENTCTL_CLOUD = AzureCloud | AzureUSGovernment | AzureChinaCloud).
    cloud,
    // Services the browser reaches through /proxy (App Service VNet integration -> private endpoints).
    network: { proxyServices: parseProxyServices(env.AGENTCTL_PROXY_SERVICES) },
    azure: {
      // Primary subscription (defaults for new agents); observed subscriptions are the union.
      subscriptionId: primarySub,
      // Subscriptions to observe. Empty = every subscription the signed-in user can read.
      subscriptionIds: [...new Set([primarySub, ...list(env.AGENTCTL_SUBSCRIPTION_IDS)].filter(Boolean))],
      // Restrict discovery to these resource groups (empty = whole subscription).
      resourceGroups: list(env.AGENTCTL_RESOURCE_GROUPS),
      // Log Analytics workspace *customer id* (GUID), used by the query API.
      logAnalyticsWorkspaceId: env.AGENTCTL_LAW_WORKSPACE_ID || "",
      logAnalyticsWorkspaceResourceId: env.AGENTCTL_LAW_RESOURCE_ID || "",
      // More workspaces (any subscription/region) queried together with the primary one.
      additionalWorkspaceIds: list(env.AGENTCTL_LAW_ADDITIONAL_WORKSPACE_IDS),
      appInsightsResourceId: env.AGENTCTL_APPINSIGHTS_RESOURCE_ID || "",
      // Optional fixed list of Foundry project endpoints; otherwise discovered via ARM.
      foundryProjectEndpoints: list(env.AGENTCTL_FOUNDRY_PROJECT_ENDPOINTS),
      foundryApiVersion: env.AGENTCTL_FOUNDRY_API_VERSION || "v1",
      foundryScope: env.AGENTCTL_FOUNDRY_SCOPE || `${cloud.foundryAudience}/.default`,
    },
    gitops: {
      repo: env.AGENTCTL_GITOPS_REPO || "",
      basePath: env.AGENTCTL_GITOPS_BASE_PATH || "agents",
      agentModuleSource: env.AGENTCTL_AGENT_MODULE_SOURCE || "../../../modules/foundry-agent",
    },
    // JSON: {"unscopedDefault":"all"|"none","scopes":[{"name","groups":[oid],"projects":["account/project"],"agents":["glob"]}]}
    access: parseJson(env.AGENTCTL_ACCESS_SCOPES, { scopes: [], unscopedDefault: "all" }),
    // AI risk controls (docs/CONTROLS.md): attestations keyed "<control>" or "<control>@<agent>",
    // and MCP server hosts approved for TL-02.
    controls: {
      attestations: parseJson(env.AGENTCTL_ATTESTATIONS, {}),
      approvedMcpHosts: list(env.AGENTCTL_APPROVED_MCP_HOSTS),
    },
    approvals: {
      // Entra group object ids or names per risk tier; written into change requests.
      read: list(env.AGENTCTL_APPROVERS_READ || "agent-owners"),
      write: list(env.AGENTCTL_APPROVERS_WRITE || "agent-owners,platform-security"),
      privileged: list(env.AGENTCTL_APPROVERS_PRIVILEGED || "agent-owners,platform-security,identity-admins"),
    },
  };
}

/** Server-side settings derived from the same env: proxy allowlist and CSP connect-src. */
export function buildServerSettings(env = process.env) {
  const cloud = resolveCloud(env);
  const proxyServices = parseProxyServices(env.AGENTCTL_PROXY_SERVICES);
  return { proxyAllowlist: proxyAllowlist(cloud, proxyServices), connectSrc: connectSources(cloud, proxyServices), authority: cloud.authority };
}

export function renderConfigJs(env = process.env) {
  return `window.__AGENTCTL_CONFIG__ = ${JSON.stringify(buildRuntimeConfig(env))};\n`;
}
