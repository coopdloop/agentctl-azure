// Cloud endpoints (from the runtime config's cloud profile) and private-network routing.
// When a service is listed in network.proxyServices, requests to its host go through the
// same-origin /proxy (App Service with VNet integration reaches the private endpoint).

import { config } from "../../config";

export type CloudService = "arm" | "graph" | "logAnalytics";

export const cloudUrl = (service: CloudService): string => config.cloud[service];

/** Rewrites https://<host>/... to <origin>/proxy/<host>/... when <host> belongs to a proxied service. */
export function routeUrl(url: string): string {
  if (!config.network.proxyServices.length || typeof window === "undefined") return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const proxied = config.network.proxyServices.some((s) => new URL(config.cloud[s]).host.toLowerCase() === u.host.toLowerCase());
  return proxied ? `${window.location.origin}/proxy/${u.host}${u.pathname}${u.search}` : url;
}
