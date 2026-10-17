import { describe, expect, it } from "vitest";
// @ts-expect-error - plain ESM shared with the production server
import { connectSources, parseProxyServices, proxyAllowlist, resolveCloud } from "../../../server/clouds.mjs";
// @ts-expect-error - plain ESM shared with the production server
import { buildRuntimeConfig } from "../../../server/config.mjs";
// @ts-expect-error - plain ESM shared with the production server
import { isAllowedHost } from "../../../server/proxy.mjs";

describe("cloud profiles", () => {
  it("defaults to the public cloud", () => {
    const c = resolveCloud({});
    expect(c.arm).toBe("https://management.azure.com");
    expect(c.foundryHostSuffixes).toContain(".services.ai.azure.com");
  });

  it("selects sovereign clouds and allows single overrides", () => {
    const gov = resolveCloud({ AGENTCTL_CLOUD: "AzureUSGovernment", AGENTCTL_ENDPOINT_GRAPH: "https://dod-graph.microsoft.us/" });
    expect(gov.arm).toBe("https://management.usgovcloudapi.net");
    expect(gov.graph).toBe("https://dod-graph.microsoft.us");
    expect(() => resolveCloud({ AGENTCTL_ENDPOINT_ARM: "http://insecure.example" })).toThrow(/https/);
  });

  it("derives the Foundry scope and subscriptions in the runtime config", () => {
    const cfg = buildRuntimeConfig({ AGENTCTL_CLOUD: "AzureChinaCloud", AGENTCTL_SUBSCRIPTION_ID: "a", AGENTCTL_SUBSCRIPTION_IDS: "b, a ,c" });
    expect(cfg.azure.foundryScope).toBe("https://ai.azure.cn/.default");
    expect(cfg.azure.subscriptionIds).toEqual(["a", "b", "c"]);
  });
});

describe("private routing", () => {
  const cloud = resolveCloud({});

  it("ignores unknown proxy services", () => {
    expect(parseProxyServices("logAnalytics, evil")).toEqual(["logAnalytics"]);
  });

  it("adds exact hosts for proxied services and keeps them out of connect-src", () => {
    const services = ["logAnalytics"];
    const allow = proxyAllowlist(cloud, services);
    expect(isAllowedHost("api.loganalytics.azure.com", allow)).toBe(true);
    expect(isAllowedHost("x.api.loganalytics.azure.com", allow)).toBe(false); // exact, not suffix
    expect(isAllowedHost("management.azure.com", allow)).toBe(false);
    expect(isAllowedHost("acct.services.ai.azure.com", allow)).toBe(true);
    expect(isAllowedHost("services.ai.azure.com", allow)).toBe(false); // bare suffix never matches
    expect(connectSources(cloud, services)).not.toContain("https://api.loganalytics.azure.com");
    expect(connectSources(cloud, [])).toContain("https://api.loganalytics.azure.com");
  });
});
