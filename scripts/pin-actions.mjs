#!/usr/bin/env node
// Pins GitHub Actions to full commit SHAs (tags are mutable; a moved tag is a supply-chain attack).
//   node scripts/pin-actions.mjs [--check] [dir...]     default dirs: .github templates
// Rewrites `uses: owner/repo[/path]@<tag-or-sha>` to `uses: owner/repo[/path]@<sha> # <tag>`,
// resolving to the newest release tag in the same major version (or the given exact tag).
// --check: exit 1 if any action is not pinned (used in CI). Needs git (uses `git ls-remote`).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const check = args.includes("--check");
const dirs = args.filter((a) => !a.startsWith("--"));
const roots = dirs.length ? dirs : [".github", "templates"];

const files = [];
const walk = (d) => {
  let entries;
  try {
    entries = readdirSync(d);
  } catch {
    return;
  }
  for (const n of entries) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.ya?ml$/.test(n) && /workflows|actions/.test(p)) files.push(p);
  }
};
roots.forEach(walk);

const USES = /^(\s*-?\s*uses:\s*)([\w.-]+\/[\w.-]+)(\/[\w./-]+)?@([\w.-]+)(\s*#\s*(\S+))?\s*$/;
const cache = new Map();

/** Returns [sha, tag] for the newest tag matching the requested major (or exact tag). */
function resolve(repo, want) {
  const key = `${repo}@${want}`;
  if (cache.has(key)) return cache.get(key);
  const out = execFileSync("git", ["ls-remote", "--tags", `https://github.com/${repo}.git`], { encoding: "utf8" });
  const tags = new Map();
  for (const line of out.trim().split("\n")) {
    const [sha, ref] = line.split("\t");
    const m = ref?.match(/^refs\/tags\/(.+?)(\^\{\})?$/);
    if (!m) continue;
    // Prefer the peeled commit (^{}) of annotated tags.
    if (m[2] || !tags.has(m[1])) tags.set(m[1], sha);
  }
  const semver = (t) => t.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  let pick;
  if (/^v?\d+$/.test(want)) {
    const major = want.replace(/^v/, "");
    pick = [...tags.keys()]
      .filter((t) => semver(t)?.[1] === major && semver(t)[2] !== undefined)
      .sort((a, b) => {
        const [, , a2, a3] = semver(a).map((x) => Number(x ?? 0));
        const [, , b2, b3] = semver(b).map((x) => Number(x ?? 0));
        return b2 - a2 || b3 - a3;
      })[0] ?? (tags.has(want) ? want : undefined);
  } else if (tags.has(want)) pick = want;
  else if (tags.has(`v${want}`)) pick = `v${want}`;
  if (!pick) throw new Error(`no tag ${want} in ${repo}`);
  const r = [tags.get(pick), pick];
  cache.set(key, r);
  return r;
}

let unpinned = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  let changed = false;
  lines.forEach((line, i) => {
    const m = line.match(USES);
    if (!m || m[2].startsWith("./") || m[2] === "docker") return;
    const [, prefix, repo, path = "", ref, , comment] = m;
    if (/^[0-9a-f]{40}$/.test(ref)) return; // already pinned
    unpinned++;
    if (check) {
      console.error(`${f}:${i + 1}: ${repo}${path}@${ref} is not pinned to a commit SHA`);
      return;
    }
    const [sha, tag] = resolve(repo, comment ?? ref);
    lines[i] = `${prefix}${repo}${path}@${sha} # ${tag}`;
    changed = true;
    console.log(`${f}: ${repo}${path}@${ref} -> ${sha.slice(0, 12)} (${tag})`);
  });
  if (changed) writeFileSync(f, lines.join("\n"));
}
if (check && unpinned) process.exit(1);
if (check) console.log(`all actions pinned (${files.length} files)`);
