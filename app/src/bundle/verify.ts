// Independent verification of a downloaded bundle. Used by the Review page (approvers) and
// designed to be ported 1:1 into the GitOps pipeline as its first gate.

import YAML from "yaml";
import { MANDATORY_INJECTIONS } from "../lib/harnessLibrary";
import { composeInstructions, tierRank } from "../lib/manifestDefaults";
import type { AgentManifest, ChangeRequest } from "../schema/manifest";
import { validateAgent, validateChangeRequest } from "../schema/validate";
import { sha256 } from "./buildBundle";
import { assessRisk, computeChanges, requiredApprovals } from "./risk";

export interface Check {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

export interface Verification {
  checks: Check[];
  cr?: ChangeRequest;
  after?: AgentManifest;
  before?: AgentManifest | null;
  recomputed?: { tier: string; score: number; approvers: string[]; minApprovers: number };
  ok: boolean;
}

export async function verifyBundle(files: Record<string, string>): Promise<Verification> {
  const checks: Check[] = [];
  const add = (name: string, status: Check["status"], detail: string) => checks.push({ name, status, detail });

  // 1. integrity
  const sums = files["checksums.sha256"];
  if (!sums) add("Checksums", "fail", "checksums.sha256 missing");
  else {
    const listed = new Map(sums.trim().split("\n").map((l) => [l.slice(66), l.slice(0, 64)] as const));
    const bad: string[] = [];
    for (const [p, h] of listed) if (files[p] === undefined || (await sha256(files[p])) !== h) bad.push(p);
    const unlisted = Object.keys(files).filter((p) => p !== "checksums.sha256" && !listed.has(p));
    if (bad.length || unlisted.length)
      add("Checksums", "fail", [bad.length ? `mismatch: ${bad.join(", ")}` : "", unlisted.length ? `unlisted: ${unlisted.join(", ")}` : ""].filter(Boolean).join("; "));
    else add("Checksums", "pass", `${listed.size} files verified`);
  }

  // 2/3. schema validation
  let after: AgentManifest | undefined;
  let cr: ChangeRequest | undefined;
  let before: AgentManifest | null = null;
  try {
    after = YAML.parse(files["manifest/agent.yaml"] ?? "");
    const issues = validateAgent(after);
    add("agent.yaml schema", issues.length ? "fail" : "pass", issues.length ? issues.slice(0, 5).map((i) => `${i.path} ${i.message}`).join("; ") : "valid");
  } catch (e) {
    add("agent.yaml schema", "fail", `unparseable: ${String(e)}`);
  }
  try {
    cr = YAML.parse(files["change-request.yaml"] ?? "");
    const issues = validateChangeRequest(cr);
    add("change-request.yaml schema", issues.length ? "fail" : "pass", issues.length ? issues.slice(0, 5).map((i) => `${i.path} ${i.message}`).join("; ") : "valid");
  } catch (e) {
    add("change-request.yaml schema", "fail", `unparseable: ${String(e)}`);
  }
  if (files["manifest/base.yaml"]) {
    try {
      before = YAML.parse(files["manifest/base.yaml"]);
    } catch {
      add("base.yaml", "fail", "unparseable");
    }
  }

  // 4/5. hashes bind the change request to the manifests
  if (cr && files["manifest/agent.yaml"]) {
    const h = await sha256(files["manifest/agent.yaml"]);
    add("Manifest hash", h === cr.spec.manifestSha256 ? "pass" : "fail", h === cr.spec.manifestSha256 ? "matches change request" : "agent.yaml does not match spec.manifestSha256");
  }
  if (cr?.spec.changeType === "update") {
    if (!files["manifest/base.yaml"]) add("Base hash", "warn", "update without base.yaml; risk cannot be recomputed");
    else {
      const h = await sha256(files["manifest/base.yaml"]);
      add("Base hash", h === cr.spec.baseManifestSha256 ? "pass" : "fail", h === cr.spec.baseManifestSha256 ? "matches; pipeline must still compare with live state" : "base.yaml does not match spec.baseManifestSha256");
    }
  }

  // 6. recompute risk and approvals; declared must not understate
  let recomputed: Verification["recomputed"];
  if (after && cr) {
    const changes = computeChanges(before, after);
    const risk = assessRisk(changes, after);
    const approvals = requiredApprovals(changes, risk);
    recomputed = { tier: risk.tier, score: risk.score, approvers: approvals.required.map((a) => a.group), minApprovers: approvals.minApprovers };
    const under = tierRank(cr.spec.risk.tier) < tierRank(risk.tier);
    add("Declared risk", under ? "fail" : "pass", under ? `declared ${cr.spec.risk.tier}, recomputed ${risk.tier}` : `declared ${cr.spec.risk.tier} ≥ recomputed ${risk.tier}`);
    const declared = new Set(cr.spec.approvals.required.map((a) => a.group));
    const expected = cr.spec.proposal ? [...recomputed.approvers, ...after.metadata.owners] : recomputed.approvers;
    const missing = expected.filter((g) => !declared.has(g));
    add("Approvers", missing.length ? "fail" : "pass", missing.length ? `missing: ${missing.join(", ")}` : `${declared.size} group(s), min ${cr.spec.approvals.minApprovers}`);
    if (cr.spec.approvals.minApprovers < approvals.minApprovers)
      add("Minimum approvers", "fail", `declared ${cr.spec.approvals.minApprovers}, policy requires ${approvals.minApprovers}`);
  }

  // 7. payload consistent with manifest
  if (after && files["foundry/agent-definition.json"]) {
    try {
      const payload = JSON.parse(files["foundry/agent-definition.json"]);
      const def = payload.definition ?? payload; // agents API body (or legacy assistants body)
      const same = def.instructions === composeInstructions(after) && def.model === after.spec.model.deployment;
      add("Foundry payload", same ? "pass" : "fail", same ? "instructions and model match manifest" : "payload drifted from manifest");
    } catch {
      add("Foundry payload", "fail", "invalid JSON");
    }
  }

  // 8. platform policy
  if (after) {
    const missing = MANDATORY_INJECTIONS.filter((m) => !after!.spec.harness.injections.some((i) => i.id === m.id)).map((m) => m.id);
    add("Mandatory harness", missing.length ? "warn" : "pass", missing.length ? `missing ${missing.join(", ")}` : "all present");
    const unattended = after.spec.tools.filter((t) => t.riskTier !== "read" && t.requireApproval === "never").map((t) => t.name);
    add("Unattended write tools", unattended.length ? "warn" : "pass", unattended.length ? unattended.join(", ") : "none");
  }

  return { checks, cr, after, before, recomputed, ok: !checks.some((c) => c.status === "fail") };
}
