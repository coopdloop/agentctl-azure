// Approval gate: maps each bundle's *recomputed* approver groups to GitHub teams/users and checks
// that the PR has the approvals on its current head commit. Runs from the base branch only.
//
//   node approval-gate.mjs <verify.json> <platform/approvers.json>
// Env: GITHUB_TOKEN (needs pull-requests:read and org members:read, e.g. a GitHub App token),
//      GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA, GITHUB_API_URL, GITHUB_STEP_SUMMARY (optional).
//
// Rules
//  - Every recomputed approver group must be satisfied by an APPROVED review on HEAD_SHA from a
//    member of the mapped team (or a mapped user). Approvals on older commits do not count.
//  - The owners group ("agent-owners") resolves to the agent's owners: the current (base) owners
//    for updates, so adding yourself as an owner in the PR does not let you approve it.
//  - Proposals additionally require an owner approval (same as the owners group).
//  - Distinct approvers >= max(declared, recomputed) minApprovers. The PR author never counts.
//  - Unmapped groups/owners fail closed: add them to platform/approvers.json.
import { appendFileSync, readFileSync } from "node:fs";

const [reportPath, mapPath] = process.argv.slice(2);
const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA } = process.env;
const API = process.env.GITHUB_API_URL || "https://api.github.com";
if (!reportPath || !mapPath || !GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER || !HEAD_SHA) {
  console.error("approval-gate: missing arguments or environment");
  process.exit(2);
}
const [org] = GITHUB_REPOSITORY.split("/");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const map = JSON.parse(readFileSync(mapPath, "utf8"));
const ownersGroup = map.ownersGroup ?? "agent-owners";

async function gh(path) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function paged(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!batch?.length) return all;
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

const pr = await gh(`/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}`);
const author = pr.user.login.toLowerCase();
// Latest review state per reviewer; only approvals of the current head count.
const latest = new Map();
for (const r of await paged(`/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/reviews`)) {
  if (!r.user || r.state === "COMMENTED") continue;
  latest.set(r.user.login.toLowerCase(), r);
}
const approvers = [...latest.entries()].filter(([login, r]) => r.state === "APPROVED" && r.commit_id === HEAD_SHA && login !== author).map(([login]) => login);

const teamCache = new Map();
async function inTeam(slug, login) {
  const key = `${slug}|${login}`;
  if (!teamCache.has(key)) {
    const m = await gh(`/orgs/${org}/teams/${slug}/memberships/${login}`);
    teamCache.set(key, m?.state === "active");
  }
  return teamCache.get(key);
}

/** Principals (team slugs / user logins) that can satisfy one approver identity, or null if unmapped. */
function principals(name) {
  if (map.teams?.[name]) return [{ team: map.teams[name] }];
  if (map.users?.[name.toLowerCase()]) return [{ user: map.users[name.toLowerCase()].toLowerCase() }];
  return null;
}

async function satisfiedBy(candidates) {
  const who = [];
  for (const login of approvers)
    for (const c of candidates) if (c.user === login || (c.team && (await inTeam(c.team, login)))) who.push(login);
  return [...new Set(who)];
}

let failed = false;
let md = "## Approval gate\n\n";
for (const r of report) {
  if (!r.ok || !r.changeRequest) {
    failed = true;
    md += `- ❌ \`${r.dir}\`: verification failed, approvals not evaluated\n`;
    continue;
  }
  const groups = [...new Set([...(r.recomputed?.approvers ?? []), ...(r.changeRequest.proposal ? [ownersGroup] : [])])];
  const minApprovers = Math.max(r.declared?.minApprovers ?? 1, r.recomputed?.minApprovers ?? 1);
  md += `### \`${r.dir}\` — ${r.changeRequest.title}\n\n| Requirement | Satisfied by |\n|---|---|\n`;
  for (const g of groups) {
    let candidates;
    if (g === ownersGroup) {
      const owners = r.approvingOwners ?? [];
      const mapped = owners.map(principals);
      if (!owners.length || mapped.every((m) => m === null)) {
        failed = true;
        md += `| ❌ owners (${owners.join(", ") || "none"}) | no owner is mapped in platform/approvers.json${owners.length ? "" : " (update without base.yaml?)"} |\n`;
        continue;
      }
      candidates = mapped.filter(Boolean).flat();
    } else {
      candidates = principals(g);
      if (!candidates) {
        failed = true;
        md += `| ❌ ${g} | not mapped in platform/approvers.json |\n`;
        continue;
      }
    }
    const who = await satisfiedBy(candidates);
    if (!who.length) failed = true;
    md += `| ${who.length ? "✅" : "⏳"} ${g === ownersGroup ? `owners (${(r.approvingOwners ?? []).join(", ")})` : g} | ${who.map((w) => `@${w}`).join(", ") || "waiting for approval on the latest commit"} |\n`;
  }
  const enough = approvers.length >= minApprovers;
  if (!enough) failed = true;
  md += `| ${enough ? "✅" : "⏳"} ≥ ${minApprovers} distinct approver(s) | ${approvers.length} |\n\n`;
}

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
process.exit(failed ? 1 : 0);
