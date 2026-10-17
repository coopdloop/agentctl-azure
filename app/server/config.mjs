// Runtime configuration, built from environment variables.
// Served to the browser as /config.js so one build works in every environment.
// In App Service these come from app settings (set by Terraform); locally from app/.env.local.

const list = (v) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function buildRuntimeConfig(env = process.env) {
  return {
    mode: env.AGENTCTL_MODE === "live" ? "live" : "mock",
    environment: env.AGENTCTL_ENVIRONMENT || "local",
    auth: {
      tenantId: env.AGENTCTL_TENANT_ID || "",
      clientId: env.AGENTCTL_CLIENT_ID || "",
      redirectUri: env.AGENTCTL_REDIRECT_URI || "",
    },
    azure: {
      subscriptionId: env.AGENTCTL_SUBSCRIPTION_ID || "",
      // Restrict discovery to these resource groups (empty = whole subscription).
      resourceGroups: list(env.AGENTCTL_RESOURCE_GROUPS),
      // Log Analytics workspace *customer id* (GUID), used by the query API.
      logAnalyticsWorkspaceId: env.AGENTCTL_LAW_WORKSPACE_ID || "",
      logAnalyticsWorkspaceResourceId: env.AGENTCTL_LAW_RESOURCE_ID || "",
      appInsightsResourceId: env.AGENTCTL_APPINSIGHTS_RESOURCE_ID || "",
      // Optional fixed list of Foundry project endpoints; otherwise discovered via ARM.
      foundryProjectEndpoints: list(env.AGENTCTL_FOUNDRY_PROJECT_ENDPOINTS),
      foundryApiVersion: env.AGENTCTL_FOUNDRY_API_VERSION || "v1",
      foundryScope: env.AGENTCTL_FOUNDRY_SCOPE || "https://ai.azure.com/.default",
    },
    gitops: {
      repo: env.AGENTCTL_GITOPS_REPO || "",
      basePath: env.AGENTCTL_GITOPS_BASE_PATH || "agents",
      agentModuleSource: env.AGENTCTL_AGENT_MODULE_SOURCE || "../../modules/foundry-agent",
    },
    approvals: {
      // Entra group object ids or names per risk tier; written into change requests.
      read: list(env.AGENTCTL_APPROVERS_READ || "agent-owners"),
      write: list(env.AGENTCTL_APPROVERS_WRITE || "agent-owners,platform-security"),
      privileged: list(env.AGENTCTL_APPROVERS_PRIVILEGED || "agent-owners,platform-security,identity-admins"),
    },
  };
}

export function renderConfigJs(env = process.env) {
  return `window.__AGENTCTL_CONFIG__ = ${JSON.stringify(buildRuntimeConfig(env))};\n`;
}
