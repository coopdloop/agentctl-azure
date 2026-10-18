// Parses every ```mermaid block in the given Markdown files with Mermaid itself; exits 1 on errors.
// Usage (docs workflow): npm i --no-save mermaid@<v> jsdom@<v> && node scripts/check-mermaid.mjs docs/**/*.md
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser });
const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false });
let bad = 0;
for (const f of process.argv.slice(2)) {
  const blocks = [...readFileSync(f, "utf8").matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const [i, b] of blocks.entries()) {
    try { await mermaid.parse(b); console.log("OK  ", f, `#${i + 1}`); }
    catch (e) { bad++; console.log("FAIL", f, `#${i + 1}`, String(e.message ?? e).split("\n").slice(0, 4).join(" | ")); }
  }
}
process.exit(bad ? 1 : 0);
