// GET /api/config (served as /config.js via staticwebapp.config.json): runtime config from the
// Static Web App's application settings. No secrets.
module.exports = async function (context) {
  const { renderConfigJs } = await import("../lib/config.mjs");
  context.res = {
    status: 200,
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    body: renderConfigJs({ ...process.env, AGENTCTL_PROXY_BASE: process.env.AGENTCTL_PROXY_BASE || "/api/proxy" }),
  };
};
