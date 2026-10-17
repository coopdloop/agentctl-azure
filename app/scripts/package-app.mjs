// Packages the built SPA + dependency-free server into a zip for App Service zip deploy.
import JSZip from "jszip";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appDir, "..", "artifacts");
const zip = new JSZip();

function addDir(dir, filter = () => true) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) addDir(p, filter);
    else if (filter(p)) zip.file(relative(appDir, p), readFileSync(p));
  }
}

addDir(join(appDir, "dist"), (p) => !p.endsWith(".map"));
addDir(join(appDir, "server"));
zip.file("package.json", JSON.stringify({ name: "agentctl", private: true, type: "module", scripts: { start: "node server/server.mjs" } }, null, 2));

mkdirSync(outDir, { recursive: true });
const out = join(outDir, "agentctl-app.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`wrote ${relative(process.cwd(), out)}`);
