// /api/proxy/<host>/<path>: the allowlisted pass-through used for APIs without browser CORS
// (Foundry Agent Service). Same core as the App Service server (server/proxy.mjs). The browser's
// token arrives in Authorization or, if the platform strips that header, x-agentctl-authorization.
let settings;
module.exports = async function (context, req) {
  const [{ proxyRequest }, { buildServerSettings }] = await Promise.all([import("../lib/proxy.mjs"), import("../lib/config.mjs")]);
  settings ??= buildServerSettings(process.env);
  const query = new URL(req.url).search;
  const r = await proxyRequest({
    target: `${req.params.target ?? ""}${query}`,
    method: req.method,
    headers: req.headers,
    body: req.rawBody || undefined,
    allowlist: settings.proxyAllowlist,
  });
  context.res = { status: r.status, headers: r.headers, body: r.body, isRaw: true };
};
