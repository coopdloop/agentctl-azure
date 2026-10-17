// Pass-through proxy for Azure data-plane APIs that do not send CORS headers to browsers
// (notably the Foundry Agent Service project endpoint).
//
//   /proxy/<host>/<path>?<query>  ->  https://<host>/<path>?<query>
//
// The browser still acquires the token (MSAL) and sends it in the Authorization header;
// this proxy holds no credentials and adds none. Only hosts matching the allowlist are
// forwarded, so it cannot be used as an open proxy.

export const PROXY_PREFIX = "/proxy/";

const DEFAULT_ALLOWED_HOST_SUFFIXES = [
  ".services.ai.azure.com",
  ".cognitiveservices.azure.com",
  ".openai.azure.com",
];

const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept", "x-ms-client-request-id"];
const DROP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "strict-transport-security",
  "set-cookie",
]);

/** Entries starting with "." match subdomains (never the bare suffix); other entries match exactly. */
export function isAllowedHost(host, allowlist = DEFAULT_ALLOWED_HOST_SUFFIXES) {
  if (!/^[a-z0-9.-]+$/i.test(host)) return false;
  const h = host.toLowerCase();
  return allowlist.some((s) => (s.startsWith(".") ? h.endsWith(s) && h.length > s.length : h === s.toLowerCase()));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}

/** Connect/Node-style middleware: (req, res, next). Used by both Vite dev server and server.mjs. */
export function createProxyMiddleware({ allowedHostSuffixes } = {}) {
  const suffixes = allowedHostSuffixes?.length ? allowedHostSuffixes : DEFAULT_ALLOWED_HOST_SUFFIXES;

  return async function proxy(req, res, next) {
    if (!req.url?.startsWith(PROXY_PREFIX)) return next();

    const rest = req.url.slice(PROXY_PREFIX.length);
    const slash = rest.indexOf("/");
    const host = slash === -1 ? rest : rest.slice(0, slash);
    const path = slash === -1 ? "/" : rest.slice(slash);

    if (!isAllowedHost(host, suffixes)) {
      res.statusCode = 403;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: { code: "HostNotAllowed", message: `Proxy target ${host} is not allowlisted.` } }));
      return;
    }

    try {
      // Only a fixed allowlist of request headers is forwarded (no cookies, no client IPs).
      const headers = new Headers();
      for (const h of FORWARD_REQUEST_HEADERS) {
        const v = req.headers[h];
        if (typeof v === "string") headers.set(h, v);
      }
      const method = req.method ?? "GET";
      const body = ["GET", "HEAD"].includes(method) ? undefined : await readBody(req);

      const upstream = await fetch(`https://${host}${path}`, { method, headers, body, redirect: "manual" });

      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => {
        if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: { code: "ProxyError", message: String(err?.message ?? err) } }));
    }
  };
}
