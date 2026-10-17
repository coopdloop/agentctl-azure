import { parseAccessConfig, type AccessConfig } from "./auth/scope";

export type RiskTier = "read" | "write" | "privileged";

export interface RuntimeConfig {
  mode: "mock" | "live";
  environment: string;
  auth: { tenantId: string; clientId: string; redirectUri: string };
  azure: {
    subscriptionId: string;
    resourceGroups: string[];
    logAnalyticsWorkspaceId: string;
    logAnalyticsWorkspaceResourceId: string;
    appInsightsResourceId: string;
    foundryProjectEndpoints: string[];
    foundryApiVersion: string;
    foundryScope: string;
  };
  gitops: { repo: string; basePath: string; agentModuleSource: string };
  access: AccessConfig;
  approvals: Record<RiskTier, string[]>;
}

declare global {
  interface Window {
    __AGENTCTL_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const defaults: RuntimeConfig = {
  mode: "mock",
  environment: "local",
  auth: { tenantId: "", clientId: "", redirectUri: "" },
  azure: {
    subscriptionId: "",
    resourceGroups: [],
    logAnalyticsWorkspaceId: "",
    logAnalyticsWorkspaceResourceId: "",
    appInsightsResourceId: "",
    foundryProjectEndpoints: [],
    foundryApiVersion: "v1",
    foundryScope: "https://ai.azure.com/.default",
  },
  gitops: { repo: "", basePath: "agents", agentModuleSource: "../../../modules/foundry-agent" },
  access: { scopes: [], unscopedDefault: "all" },
  approvals: {
    read: ["agent-owners"],
    write: ["agent-owners", "platform-security"],
    privileged: ["agent-owners", "platform-security", "identity-admins"],
  },
};

// Browser: set by /config.js. Node (agentctl-verify CLI): set on globalThis before import.
const injected = (globalThis as { __AGENTCTL_CONFIG__?: Partial<RuntimeConfig> }).__AGENTCTL_CONFIG__ ?? {};

export const config: RuntimeConfig = {
  ...defaults,
  ...injected,
  auth: { ...defaults.auth, ...injected.auth },
  azure: { ...defaults.azure, ...injected.azure },
  gitops: { ...defaults.gitops, ...injected.gitops },
  access: parseAccessConfig(injected.access),
  approvals: { ...defaults.approvals, ...injected.approvals },
};

/** Live mode needs at least an app registration and a subscription. */
export const liveCapable = Boolean(config.auth.clientId && config.auth.tenantId && config.azure.subscriptionId);
