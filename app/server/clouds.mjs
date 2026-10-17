// Azure cloud endpoint profiles. AGENTCTL_CLOUD picks one; AGENTCTL_ENDPOINT_* override single values
// (e.g. a sovereign cloud whose Foundry hosts differ). Used for MSAL, API base URLs, token
// scopes, the proxy allowlist and the CSP, so nothing else hard-codes a cloud.
//
// Verify the AzureUSGovernment / AzureChinaCloud Foundry values against your cloud before use:
// Foundry feature availability differs by cloud.

export const CLOUDS = {
  AzureCloud: {
    authority: "https://login.microsoftonline.com",
    arm: "https://management.azure.com",
    graph: "https://graph.microsoft.com",
    logAnalytics: "https://api.loganalytics.azure.com",
    logAnalyticsAudience: "https://api.loganalytics.io",
    foundryAudience: "https://ai.azure.com",
    foundryHostSuffixes: [".services.ai.azure.com", ".cognitiveservices.azure.com", ".openai.azure.com"],
  },
  AzureUSGovernment: {
    authority: "https://login.microsoftonline.us",
    arm: "https://management.usgovcloudapi.net",
    graph: "https://graph.microsoft.us",
    logAnalytics: "https://api.loganalytics.us",
    logAnalyticsAudience: "https://api.loganalytics.us",
    foundryAudience: "https://ai.azure.us",
    foundryHostSuffixes: [".services.ai.azure.us", ".cognitiveservices.azure.us", ".openai.azure.us"],
  },
  AzureChinaCloud: {
    authority: "https://login.chinacloudapi.cn",
    arm: "https://management.chinacloudapi.cn",
    graph: "https://microsoftgraph.chinacloudapi.cn",
    logAnalytics: "https://api.loganalytics.azure.cn",
    logAnalyticsAudience: "https://api.loganalytics.azure.cn",
    foundryAudience: "https://ai.azure.cn",
    foundryHostSuffixes: [".services.ai.azure.cn", ".cognitiveservices.azure.cn", ".openai.azure.cn"],
  },
};

const list = (v) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const url = (v) => {
  if (!v) return undefined;
  const u = new URL(v); // throws on garbage: fail fast at startup rather than at request time
  if (u.protocol !== "https:") throw new Error(`agentctl: endpoint must be https: ${v}`);
  return u.origin;
};

/** Resolves the cloud profile from env. Unknown names fall back to AzureCloud with a warning. */
export function resolveCloud(env = process.env) {
  let name = env.AGENTCTL_CLOUD || "AzureCloud";
  if (!CLOUDS[name]) {
    console.warn(`agentctl: unknown AGENTCTL_CLOUD "${name}", using AzureCloud`);
    name = "AzureCloud";
  }
  const base = CLOUDS[name];
  const suffixes = list(env.AGENTCTL_ENDPOINT_FOUNDRY_HOST_SUFFIXES);
  return {
    name,
    authority: url(env.AGENTCTL_ENDPOINT_AUTHORITY) ?? base.authority,
    arm: url(env.AGENTCTL_ENDPOINT_ARM) ?? base.arm,
    graph: url(env.AGENTCTL_ENDPOINT_GRAPH) ?? base.graph,
    logAnalytics: url(env.AGENTCTL_ENDPOINT_LOG_ANALYTICS) ?? base.logAnalytics,
    logAnalyticsAudience: url(env.AGENTCTL_ENDPOINT_LOG_ANALYTICS_AUDIENCE) ?? base.logAnalyticsAudience,
    foundryAudience: url(env.AGENTCTL_ENDPOINT_FOUNDRY_AUDIENCE) ?? base.foundryAudience,
    foundryHostSuffixes: (suffixes.length ? suffixes : base.foundryHostSuffixes).map((s) => (s.startsWith(".") ? s : `.${s}`).toLowerCase()),
  };
}

/** Services the browser may send through /proxy instead of calling directly (private endpoints). */
export const PROXYABLE_SERVICES = ["arm", "graph", "logAnalytics"];

export function parseProxyServices(v) {
  const wanted = list(v);
  const bad = wanted.filter((s) => !PROXYABLE_SERVICES.includes(s));
  if (bad.length) console.warn(`agentctl: ignoring unknown AGENTCTL_PROXY_SERVICES: ${bad.join(", ")}`);
  return wanted.filter((s) => PROXYABLE_SERVICES.includes(s));
}

/**
 * Proxy allowlist: Foundry host suffixes (always proxied) plus the exact hosts of any services
 * routed through the proxy. Entries starting with "." are suffixes; others are exact hosts.
 */
export function proxyAllowlist(cloud, proxyServices) {
  return [...cloud.foundryHostSuffixes, ...proxyServices.map((s) => new URL(cloud[s]).host.toLowerCase())];
}

/** connect-src for the CSP: only what the browser calls directly. */
export function connectSources(cloud, proxyServices) {
  const direct = PROXYABLE_SERVICES.filter((s) => !proxyServices.includes(s)).map((s) => cloud[s]);
  // Log Analytics also answers on its audience host in some SDK paths.
  if (!proxyServices.includes("logAnalytics")) direct.push(cloud.logAnalyticsAudience);
  return ["'self'", cloud.authority, ...new Set(direct)];
}
