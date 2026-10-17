import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// @ts-expect-error - plain ESM shared with the production server
import { renderConfigJs } from "./server/config.mjs";
// @ts-expect-error - plain ESM shared with the production server
import { createProxyMiddleware } from "./server/proxy.mjs";

/** Gives the dev server the same /config.js and /proxy/* behaviour as server/server.mjs. */
function agentctlDevServer(env: Record<string, string>): Plugin {
  return {
    name: "agentctl-dev-server",
    configureServer(server) {
      const proxy = createProxyMiddleware();
      server.middlewares.use((req, res, next) => {
        if (req.url === "/config.js") {
          res.setHeader("content-type", "text/javascript");
          res.setHeader("cache-control", "no-store");
          res.end(renderConfigJs({ ...process.env, ...env }));
          return;
        }
        return proxy(req, res, next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "AGENTCTL_");
  return {
    plugins: [react(), agentctlDevServer(env)],
    server: { port: 5173, strictPort: true },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory")) return "charts";
            if (id.includes("@azure/msal")) return "msal";
            if (id.includes("jszip") || id.includes("/diff/") || id.includes("/yaml/") || id.includes("ajv")) return "bundle";
            return "vendor"; // react + fluent stay together to avoid cross-chunk init cycles
          },
        },
      },
    },
    test: {
      environment: "node",
    },
  };
});
