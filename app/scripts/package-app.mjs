// Packages the built SPA for both hosting options:
//   artifacts/agentctl-app.zip  App Service (Linux, Node 22): dist + dependency-free server
//   artifacts/agentctl-swa.zip  Azure Static Web Apps: app/ (dist + staticwebapp.config.json) + api/ (managed functions)
// The CSP for Static Web Apps is static, so it is generated here from AGENTCTL_CLOUD /
// AGENTCTL_PROXY_SERVICES (defaults: public cloud, nothing extra proxied).
import JSZip from "jszip";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { connectSources, parseProxyServices, resolveCloud } from "../server/clouds.mjs";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appDir, "..", "artifacts");
mkdirSync(outDir, { recursive: true });

const noMaps = (p) => !p.endsWith(".map");
const pkgVersion = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8")).version;

// ── App Service ──────────────────────────────────────────────────────────────
{
  const zip = new JSZip();
  const add = (dir, filter) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) add(p, filter);
      else if (!filter || filter(p)) zip.file(relative(appDir, p), readFileSync(p));
    }
  };
  add(join(appDir, "dist"), noMaps);
  add(join(appDir, "server"));
  zip.file("package.json", JSON.stringify({ name: "agentctl", version: pkgVersion, private: true, type: "module", scripts: { start: "node server/server.mjs" } }, null, 2));
  writeFileSync(join(outDir, "agentctl-app.zip"), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("wrote artifacts/agentctl-app.zip");
}

// ── Static Web Apps ──────────────────────────────────────────────────────────
{
  const cloud = resolveCloud(process.env);
  const proxyServices = parseProxyServices(process.env.AGENTCTL_PROXY_SERVICES);
  const swaConfig = {
    navigationFallback: { rewrite: "/index.html", exclude: ["/assets/*", "/config.js", "/api/*", "/favicon.*"] },
    routes: [
      { route: "/config.js", rewrite: "/api/config" },
      { route: "/assets/*", headers: { "cache-control": "public, max-age=31536000, immutable" } },
      { route: "/index.html", headers: { "cache-control": "no-cache" } },
    ],
    globalHeaders: {
      "content-security-policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        `connect-src ${connectSources(cloud, proxyServices).join(" ")}`,
        `frame-src 'self' ${cloud.authority}`,
        "frame-ancestors 'none'",
      ].join("; "),
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-frame-options": "DENY",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    },
    platform: { apiRuntime: "node:20" },
  };
  const zip = new JSZip();
  const add = (dir, prefix, filter) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) add(p, join(prefix, name), filter);
      else if (!filter || filter(p)) zip.file(join(prefix, name), readFileSync(p));
    }
  };
  add(join(appDir, "dist"), "app", noMaps);
  zip.file("app/staticwebapp.config.json", JSON.stringify(swaConfig, null, 2));
  add(join(appDir, "swa", "api"), "api");
  // The functions reuse the App Service server modules (config, cloud profiles, proxy core).
  for (const f of ["config.mjs", "clouds.mjs", "proxy.mjs"]) zip.file(`api/lib/${f}`, readFileSync(join(appDir, "server", f)));
  writeFileSync(join(outDir, "agentctl-swa.zip"), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`wrote artifacts/agentctl-swa.zip (cloud ${cloud.name})`);
}
