// agentctl-verify: the GitOps pipeline's first gate. Runs the same checks as the Review page
// (src/bundle/verify.ts) against bundle folders in the agents-gitops repo.
//
//   node agentctl-verify.mjs [--json out.json] [--policy policy.json] <bundle-dir>...
//
// Exit codes: 0 all bundles pass (warnings allowed), 1 at least one check failed, 2 usage error.
// Approver groups come from --policy (same shape as the app's `approvals` config) or the
// AGENTCTL_APPROVERS_* env vars, so the pipeline recomputes approvals with the platform's policy.

import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { buildRuntimeConfig } from "../server/config.mjs";

interface Args {
  dirs: string[];
  json?: string;
  policy?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dirs: [] };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--json") a.json = argv[++i];
    else if (v === "--policy") a.policy = argv[++i];
    else if (v === "-h" || v === "--help") usage(0);
    else if (v.startsWith("-")) usage(2, `unknown option ${v}`);
    else a.dirs.push(v);
  }
  if (!a.dirs.length) usage(2, "no bundle directories given");
  return a;
}

function usage(code: number, msg?: string): never {
  if (msg) console.error(`agentctl-verify: ${msg}`);
  console.error("usage: agentctl-verify [--json out.json] [--policy policy.json] <bundle-dir>...");
  process.exit(code);
}

/** Reads every file under dir as UTF-8, keyed by forward-slash relative path. */
function readBundle(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isSymbolicLink?.()) throw new Error(`symlinks are not allowed in bundles: ${p}`);
      if (st.isDirectory()) {
        if (name === ".terraform") continue; // local init artefacts are not part of the bundle
        walk(p);
      } else if (!name.startsWith(".terraform.lock")) {
        files[relative(dir, p).split(sep).join("/")] = readFileSync(p, "utf8");
      }
    }
  };
  walk(dir);
  return files;
}

const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtime = buildRuntimeConfig(process.env);
  if (args.policy) runtime.approvals = { ...runtime.approvals, ...JSON.parse(readFileSync(args.policy, "utf8")) };
  (globalThis as Record<string, unknown>).__AGENTCTL_CONFIG__ = runtime;
  // Import after the config is set: risk.ts reads approver groups at call time from `config`.
  const { verifyBundle } = await import("../src/bundle/verify");

  const gha = Boolean(process.env.GITHUB_ACTIONS);
  const results: Result[] = [];
  let failed = false;
  for (const dir of args.dirs) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`agentctl-verify: not a directory: ${dir}`);
      failed = true;
      results.push({ dir, ok: false, checks: [{ name: "Bundle", status: "fail", detail: "directory not found (deleted agent?)" }] });
      continue;
    }
    const files = readBundle(dir);
    const v = await verifyBundle(files);
    const checks = [...v.checks];
    // The folder name is the agent name; a bundle must not be dropped into another agent's folder.
    if (v.after && basename(dir) !== v.after.metadata.name)
      checks.push({ name: "Folder", status: "fail", detail: `folder ${basename(dir)} does not match metadata.name ${v.after.metadata.name}` });
    const ok = !checks.some((c) => c.status === "fail");
    failed ||= !ok;

    console.log(`\n${ok ? "PASS" : "FAIL"}  ${dir}${v.cr ? `  (${v.cr.metadata.id}: ${v.cr.metadata.title})` : ""}`);
    for (const c of checks) {
      console.log(`  ${c.status.toUpperCase().padEnd(4)}  ${c.name.padEnd(26)} ${c.detail}`);
      if (gha && c.status !== "pass") console.log(`::${c.status === "fail" ? "error" : "warning"} file=${dir}/change-request.yaml,title=${esc(c.name)}::${esc(c.detail)}`);
    }
    results.push({
      dir,
      ok,
      agent: v.after?.metadata.name,
      environment: v.after?.metadata.environment,
      changeRequest: v.cr ? { id: v.cr.metadata.id, title: v.cr.metadata.title, changeType: v.cr.spec.changeType, proposal: Boolean(v.cr.spec.proposal), baseManifestSha256: v.cr.spec.baseManifestSha256 ?? null, manifestSha256: v.cr.spec.manifestSha256 } : null,
      declared: v.cr ? { tier: v.cr.spec.risk.tier, score: v.cr.spec.risk.score, approvers: v.cr.spec.approvals.required.map((r) => r.group), minApprovers: v.cr.spec.approvals.minApprovers } : null,
      recomputed: v.recomputed ?? null,
      owners: v.after?.metadata.owners ?? [],
      // Approvals use the *current* owners for updates, so a PR cannot add an owner and self-approve.
      approvingOwners: (v.cr?.spec.changeType === "update" ? v.before?.metadata.owners : v.after?.metadata.owners) ?? [],
      foundry: v.after ? { subscriptionId: v.after.spec.foundry.subscriptionId, resourceGroup: v.after.spec.foundry.resourceGroup, account: v.after.spec.foundry.account, project: v.after.spec.foundry.project } : null,
      checks,
    });
  }

  if (args.json) writeFileSync(args.json, JSON.stringify(results, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(results));
  process.exit(failed ? 1 : 0);
}

type Result = { dir: string; ok: boolean; changeRequest?: { id: string; title: string; proposal: boolean; [k: string]: unknown } | null; declared?: { tier: string; approvers: string[]; [k: string]: unknown } | null; checks: { name: string; status: string; detail: string }[]; [k: string]: unknown };

function summary(results: Result[]): string {
  const icon = (s: string) => (s === "pass" ? "✅" : s === "warn" ? "⚠️" : "❌");
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  let md = "## agentctl bundle verification\n\n";
  for (const r of results) {
    md += `### ${r.ok ? "✅" : "❌"} \`${r.dir}\`${r.changeRequest ? ` — ${cell(r.changeRequest.title)}` : ""}\n\n`;
    if (r.declared) md += `Risk **${r.declared.tier}** · approvers ${r.declared.approvers.map((a) => `\`${a}\``).join(", ")}${r.changeRequest?.proposal ? " · **proposal**" : ""}\n\n`;
    md += "| | Check | Detail |\n|---|---|---|\n";
    for (const c of r.checks) md += `| ${icon(c.status)} | ${cell(c.name)} | ${cell(c.detail)} |\n`;
    md += "\n";
  }
  return md;
}

main().catch((e) => {
  console.error(`agentctl-verify: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});
