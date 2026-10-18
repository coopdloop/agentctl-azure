import { parseAccessConfig, type AccessConfig } from "./auth/scope";

export type RiskTier = "read" | "write" | "privileged";

export interface CloudProfile {
  name: string;
  authority: string;
  arm: string;
  graph: string;
  logAnalytics: string;
  logAnalyticsAudience: string;
  foundryAudience: string;
  foundryHostSuffixes: string[];
}

export interface RuntimeConfig {
  mode: "mock" | "live";
  cloud: CloudProfile;
  network: { proxyServices: ("arm" | "graph" | "logAnalytics")[]; proxyBase: string };
  environment: string;
  auth: { tenantId: string; clientId: string; redirectUri: string };
  azure: {
    subscriptionId: string;
    subscriptionIds: string[];
    resourceGroups: string[];
    logAnalyticsWorkspaceId: string;
    logAnalyticsWorkspaceResourceId: string;
    additionalWorkspaceIds: string[];
    appInsightsResourceId: string;
    foundryProjectEndpoints: string[];
    foundryApiVersion: string;
    foundryScope: string;
  };
  gitops: { repo: string; basePath: string; agentModuleSource: string };
  access: AccessConfig;
  controls: { attestations: Record<string, Attestation>; approvedMcpHosts: string[] };
  approvals: Record<RiskTier, string[]>;
}

/** A human sign-off for a control (environment-wide "GV-05" or per agent "TL-04@crm-writer"). */
export interface Attestation {
  status: "attested" | "risk_accepted" | "not_applicable";
  evidence?: string;
  owner?: string;
  /** yyyy-mm-dd */
  date: string;
  /** yyyy-mm-dd; after this the attestation counts as expired. */
  expires?: string;
  note?: string;
}

declare global {
  interface Window {
    __AGENTCTL_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const defaults: RuntimeConfig = {
  mode: "mock",
  environment: "local",
  cloud: {
    name: "AzureCloud",
    authority: "https://login.microsoftonline.com",
    arm: "https://management.azure.com",
    graph: "https://graph.microsoft.com",
    logAnalytics: "https://api.loganalytics.azure.com",
    logAnalyticsAudience: "https://api.loganalytics.io",
    foundryAudience: "https://ai.azure.com",
    foundryHostSuffixes: [".services.ai.azure.com", ".cognitiveservices.azure.com", ".openai.azure.com"],
  },
  network: { proxyServices: [], proxyBase: "/proxy" },
  auth: { tenantId: "", clientId: "", redirectUri: "" },
  azure: {
    subscriptionId: "",
    subscriptionIds: [],
    resourceGroups: [],
    logAnalyticsWorkspaceId: "",
    logAnalyticsWorkspaceResourceId: "",
    additionalWorkspaceIds: [],
    appInsightsResourceId: "",
    foundryProjectEndpoints: [],
    foundryApiVersion: "v1",
    foundryScope: "https://ai.azure.com/.default",
  },
  gitops: { repo: "", basePath: "agents", agentModuleSource: "../../../modules/foundry-agent" },
  access: { scopes: [], unscopedDefault: "all" },
  controls: { attestations: {}, approvedMcpHosts: [] },
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
  cloud: { ...defaults.cloud, ...injected.cloud },
  network: { ...defaults.network, ...injected.network },
  auth: { ...defaults.auth, ...injected.auth },
  azure: { ...defaults.azure, ...injected.azure },
  gitops: { ...defaults.gitops, ...injected.gitops },
  access: parseAccessConfig(injected.access),
  controls: {
    attestations: injected.controls?.attestations && typeof injected.controls.attestations === "object" ? injected.controls.attestations : {},
    approvedMcpHosts: Array.isArray(injected.controls?.approvedMcpHosts) ? injected.controls.approvedMcpHosts.map(String) : [],
  },
  approvals: { ...defaults.approvals, ...injected.approvals },
};

/** Live mode needs an app registration. Subscriptions are optional (empty = all the user can read). */
export const liveCapable = Boolean(config.auth.clientId && config.auth.tenantId);
