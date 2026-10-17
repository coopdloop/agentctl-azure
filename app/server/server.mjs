// Production server for App Service (Linux, Node 22). No npm dependencies.
// - serves the built SPA from ../dist with history-API fallback
// - serves /config.js from app settings
// - forwards /proxy/<allowlisted-host>/... for APIs without browser CORS support
// - /healthz for the App Service health check

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderConfigJs } from "./config.mjs";
import { createProxyMiddleware } from "./proxy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, "..", "dist");
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://login.microsoftonline.com https://management.azure.com https://graph.microsoft.com https://api.loganalytics.azure.com https://api.loganalytics.io https://*.services.ai.azure.com",
    "frame-src 'self' https://login.microsoftonline.com",
    "frame-ancestors 'none'",
  ].join("; "),
};

const proxy = createProxyMiddleware();

async function serveFile(res, filePath, cache) {
  const body = await readFile(filePath);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
    "cache-control": cache ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok");
    }
    if (url.pathname === "/config.js") {
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "text/javascript", "cache-control": "no-store" });
      return res.end(renderConfigJs());
    }
    if (url.pathname.startsWith("/proxy/")) {
      return proxy(req, res, () => {});
    }

    const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const candidate = join(DIST, safe);
    if (candidate.startsWith(DIST)) {
      const s = await stat(candidate).catch(() => null);
      if (s?.isFile()) return serveFile(res, candidate, safe.startsWith("/assets/"));
    }
    return serveFile(res, join(DIST, "index.html"), false);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal error");
    console.error(err);
  }
});

server.listen(PORT, () => console.log(`agentctl listening on :${PORT}`));
