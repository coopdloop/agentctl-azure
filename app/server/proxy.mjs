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

// foundry-features opts into Foundry preview APIs (e.g. RedTeams=V1Preview); no credentials.
const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept", "x-ms-client-request-id", "foundry-features"];
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

/**
 * Host-agnostic core: forwards one request to an allowlisted host. Used by the Node middleware
 * below (Vite dev server, App Service) and by the Azure Static Web Apps managed function.
 *   target   "<host>/<path>?<query>" (everything after the proxy prefix)
 *   headers  lower-cased request headers (only FORWARD_REQUEST_HEADERS are sent)
 * Returns { status, headers, body: Buffer }.
 */
export async function proxyRequest({ target, method = "GET", headers = {}, body, allowlist = DEFAULT_ALLOWED_HOST_SUFFIXES }) {
  const json = (status, code, message) => ({
    status,
    headers: { "content-type": "application/json" },
    body: Buffer.from(JSON.stringify({ error: { code, message } })),
  });
  const slash = target.indexOf("/");
  const host = slash === -1 ? target : target.slice(0, slash);
  const path = slash === -1 ? "/" : target.slice(slash);
  if (!isAllowedHost(host, allowlist)) return json(403, "HostNotAllowed", `Proxy target ${host} is not allowlisted.`);
  try {
    // Only a fixed allowlist of request headers is forwarded (no cookies, no client IPs).
    // A fixed user agent (GitHub's API rejects requests without one); the browser's isn't forwarded.
    const fwd = new Headers({ "user-agent": "agentctl-proxy" });
    for (const h of FORWARD_REQUEST_HEADERS) {
      const v = headers[h];
      if (typeof v === "string") fwd.set(h, v);
    }
    // Static Web Apps replaces Authorization on requests to managed functions with its own value,
    // so the SPA also sends the user's token in x-agentctl-authorization; when present and
    // well-formed it takes precedence. (Both come from the same browser, so trust is unchanged.)
    const alt = headers["x-agentctl-authorization"];
    if (typeof alt === "string" && /^Bearer [A-Za-z0-9._~+/=-]+$/.test(alt)) fwd.set("authorization", alt);
    const upstream = await fetch(`https://${host}${path}`, {
      method,
      headers: fwd,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
      redirect: "manual",
    });
    const out = {};
    upstream.headers.forEach((value, key) => {
      if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) out[key] = value;
    });
    return { status: upstream.status, headers: out, body: Buffer.from(await upstream.arrayBuffer()) };
  } catch (err) {
    return json(502, "ProxyError", String(err?.message ?? err));
  }
}

/** Connect/Node-style middleware: (req, res, next). Used by both Vite dev server and server.mjs. */
export function createProxyMiddleware({ allowedHostSuffixes } = {}) {
  const allowlist = allowedHostSuffixes?.length ? allowedHostSuffixes : DEFAULT_ALLOWED_HOST_SUFFIXES;
  return async function proxy(req, res, next) {
    if (!req.url?.startsWith(PROXY_PREFIX)) return next();
    const method = req.method ?? "GET";
    const r = await proxyRequest({
      target: req.url.slice(PROXY_PREFIX.length),
      method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : await readBody(req),
      allowlist,
    });
    res.statusCode = r.status;
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    res.end(r.body);
  };
}
