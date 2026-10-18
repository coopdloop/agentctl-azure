import { config, type RiskTier } from "../config";
import { maxTier, tierRank } from "../lib/manifestDefaults";
import type { AgentManifest, ChangeItem, ChangeRequest, ContentFilterSetting, ToolSpec } from "../schema/manifest";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const PRIVILEGED_ROLES = /^(Owner|Contributor|User Access Administrator|Role Based Access Control Administrator|Key Vault Administrator|Storage Blob Data Owner)$/i;
const PRIVILEGED_PERMS = /(\.ReadWrite\.All|^Directory\.|^RoleManagement\.|^Application\.ReadWrite|^AppRoleAssignment\.|Mail\.Send|\.All$)/;
const SEVERITY_RANK = { Low: 0, Medium: 1, High: 2 } as const;

function filterWeakened(b: ContentFilterSetting, a: ContentFilterSetting) {
  return (b.enabled && !a.enabled) || (b.blocking && !a.blocking) || SEVERITY_RANK[a.severityThreshold] > SEVERITY_RANK[b.severityThreshold];
}

/** Returns human-readable reasons when the guardrails got weaker. Empty = not weakened. */
export function guardrailWeakenings(b: AgentManifest["spec"]["guardrails"], a: AgentManifest["spec"]["guardrails"]): string[] {
  const out: string[] = [];
  for (const k of ["hate", "sexual", "violence", "selfharm"] as const) {
    if (filterWeakened(b.raiPolicy.filters[k], a.raiPolicy.filters[k])) out.push(`content filter "${k}" weakened`);
  }
  if (b.raiPolicy.promptShields.jailbreak && !a.raiPolicy.promptShields.jailbreak) out.push("jailbreak shield disabled");
  if (b.raiPolicy.promptShields.indirectAttack && !a.raiPolicy.promptShields.indirectAttack) out.push("indirect-attack shield disabled");
  if (b.raiPolicy.mode === "Blocking" && a.raiPolicy.mode !== "Blocking") out.push(`filter mode changed to ${a.raiPolicy.mode}`);
  if (a.limits.maxTokensPerRun > b.limits.maxTokensPerRun * 2) out.push("token limit more than doubled");
  if (a.limits.maxToolCallsPerRun > b.limits.maxToolCallsPerRun * 2) out.push("tool-call limit more than doubled");
  if (b.piiRedactionInTraces && !a.piiRedactionInTraces) out.push("PII redaction in traces disabled");
  return out;
}

function toolTierWithApproval(t: ToolSpec): RiskTier {
  // A write tool that never asks for approval is treated as privileged.
  if (t.riskTier === "write" && t.requireApproval === "never") return "privileged";
  return t.riskTier;
}

export function computeChanges(before: AgentManifest | null, after: AgentManifest): ChangeItem[] {
  const items: ChangeItem[] = [];
  if (!before) {
    items.push({
      op: "create_agent",
      path: "/",
      summary: `Create agent "${after.metadata.name}" in ${after.spec.foundry.account}/${after.spec.foundry.project}`,
      riskTier: "write",
    });
    after.spec.tools.forEach((t, i) =>
      items.push({ op: "add_tool", path: `/spec/tools/${i}`, summary: `Tool ${t.name} (${t.type}, ${t.riskTier}, approval: ${t.requireApproval})`, riskTier: toolTierWithApproval(t) }),
    );
    identityItems(null, after).forEach((x) => items.push(x));
    return items;
  }

  // tools
  const bTools = new Map(before.spec.tools.map((t) => [t.name, t]));
  const aTools = new Map(after.spec.tools.map((t) => [t.name, t]));
  after.spec.tools.forEach((t, i) => {
    const prev = bTools.get(t.name);
    if (!prev) {
      items.push({
        op: "add_tool",
        path: `/spec/tools/${i}`,
        summary: `${t.injected ? "Inject" : "Add"} tool ${t.name} (${t.type}, ${t.riskTier}, approval: ${t.requireApproval})`,
        riskTier: toolTierWithApproval(t),
      });
    } else if (!same(prev, t)) {
      const loosened = prev.requireApproval !== "never" && t.requireApproval === "never";
      items.push({
        op: "modify_tool",
        path: `/spec/tools/${i}`,
        summary: `Modify tool ${t.name}${loosened ? " — approval requirement removed" : ""}`,
        riskTier: loosened ? "privileged" : maxTier(toolTierWithApproval(prev), toolTierWithApproval(t)),
      });
    }
  });
  before.spec.tools.forEach((t) => {
    if (!aTools.has(t.name))
      items.push({ op: "remove_tool", path: `/spec/tools`, summary: `Remove tool ${t.name}`, riskTier: t.injected ? "write" : "read" });
  });

  // instructions + harness
  if (before.spec.instructions.system !== after.spec.instructions.system) {
    items.push({
      op: "update_instructions",
      path: "/spec/instructions/system",
      summary: `Update system instructions ${before.spec.instructions.version} → ${after.spec.instructions.version}`,
      riskTier: "write",
    });
  }
  const bInj = new Map(before.spec.harness.injections.map((i) => [i.id, i]));
  const aInj = new Map(after.spec.harness.injections.map((i) => [i.id, i]));
  for (const [id, inj] of aInj) {
    const prev = bInj.get(id);
    if (!prev) items.push({ op: "inject_instruction", path: "/spec/harness/injections", summary: `Inject harness instruction ${id} (${inj.position})`, riskTier: "read" });
    else if (!same(prev, inj)) items.push({ op: "inject_instruction", path: "/spec/harness/injections", summary: `Modify harness instruction ${id}`, riskTier: "write" });
  }
  for (const [id, inj] of bInj) {
    if (!aInj.has(id))
      items.push({
        op: "remove_injection",
        path: "/spec/harness/injections",
        summary: `Remove ${inj.mandatory ? "MANDATORY " : ""}harness instruction ${id}`,
        riskTier: inj.mandatory ? "privileged" : "write",
      });
  }

  // guardrails
  if (!same(before.spec.guardrails, after.spec.guardrails)) {
    const weak = guardrailWeakenings(before.spec.guardrails, after.spec.guardrails);
    items.push({
      op: "update_guardrails",
      path: "/spec/guardrails",
      summary: weak.length ? `Guardrails weakened: ${weak.join("; ")}` : "Guardrails tightened or adjusted",
      riskTier: weak.length ? "privileged" : "read",
    });
  }

  identityItems(before, after).forEach((x) => items.push(x));

  if (!same(before.spec.access, after.spec.access)) {
    items.push({
      op: "update_access",
      path: "/spec/access",
      summary: before.spec.access.exposure !== after.spec.access.exposure ? `Exposure ${before.spec.access.exposure} → ${after.spec.access.exposure}` : "Access lists changed",
      riskTier: before.spec.access.exposure !== after.spec.access.exposure ? "write" : "read",
    });
  }
  if (!same(before.spec.model, after.spec.model)) {
    items.push({ op: "update_model", path: "/spec/model", summary: `Model ${before.spec.model.deployment} → ${after.spec.model.deployment}`, riskTier: "read" });
  }
  if (!same(before.metadata, after.metadata)) {
    const reclass = before.metadata.dataClassification !== after.metadata.dataClassification;
    items.push({
      op: "update_metadata",
      path: "/metadata",
      summary: reclass ? `Data classification ${before.metadata.dataClassification} → ${after.metadata.dataClassification}` : "Metadata updated",
      riskTier: reclass ? "write" : "read",
    });
  }
  if (!same(before.spec.observability, after.spec.observability)) {
    const content = !before.spec.observability.captureContent && after.spec.observability.captureContent;
    items.push({
      op: "update_other",
      path: "/spec/observability",
      summary: content ? "Prompt/response content capture enabled in traces" : "Observability settings changed",
      riskTier: content ? "write" : "read",
    });
  }
  if (!same(before.spec.knowledge, after.spec.knowledge)) {
    items.push({ op: "update_other", path: "/spec/knowledge", summary: "Knowledge sources changed", riskTier: "write" });
  }
  if (!same(before.spec.governance, after.spec.governance)) {
    // Lowering an agent's risk tier relaxes the controls it is held to, so reviewers must see it.
    const rank = { low: 0, medium: 1, high: 2 } as const;
    const b = before.spec.governance?.riskTier, a = after.spec.governance?.riskTier;
    const lowered = Boolean(b && a && rank[a] < rank[b]);
    items.push({
      op: "update_other",
      path: "/spec/governance",
      summary: lowered ? `Agent risk tier lowered ${b} → ${a}` : "Governance evidence updated (risk tier, attestations)",
      riskTier: lowered ? "write" : "read",
    });
  }
  if (!same(before.spec.lifecycle, after.spec.lifecycle)) {
    items.push({ op: "update_other", path: "/spec/lifecycle", summary: "Lifecycle settings changed", riskTier: "read" });
  }
  return items;
}

function identityItems(before: AgentManifest | null, after: AgentManifest): ChangeItem[] {
  const out: ChangeItem[] = [];
  const b = before?.spec.identity;
  const a = after.spec.identity;
  const newScopes = a.delegatedScopes.filter((s) => !b?.delegatedScopes.includes(s));
  const newRoles = a.appRoles.filter((s) => !b?.appRoles.includes(s));
  const newRbac = a.azureRoleAssignments.filter((r) => !b?.azureRoleAssignments.some((x) => x.role === r.role && x.scope === r.scope));
  const newFlows = a.allowedAuthFlows.filter((f) => !b?.allowedAuthFlows.includes(f));

  if (newScopes.length)
    out.push({
      op: "update_identity",
      path: "/spec/identity/delegatedScopes",
      summary: `Delegated scopes added: ${newScopes.join(", ")}`,
      riskTier: newScopes.some((s) => PRIVILEGED_PERMS.test(s)) ? "privileged" : "write",
    });
  if (newRoles.length)
    out.push({
      op: "update_identity",
      path: "/spec/identity/appRoles",
      summary: `Application permissions added: ${newRoles.join(", ")}`,
      riskTier: "privileged", // app-only permissions act without a user → always privileged
    });
  if (newRbac.length)
    out.push({
      op: "update_identity",
      path: "/spec/identity/azureRoleAssignments",
      summary: `Azure RBAC added: ${newRbac.map((r) => `${r.role} @ ${r.scope.split("/").slice(-2).join("/")}`).join(", ")}`,
      riskTier: newRbac.some((r) => PRIVILEGED_ROLES.test(r.role)) ? "privileged" : "write",
    });
  if (b && newFlows.length)
    out.push({ op: "update_identity", path: "/spec/identity/allowedAuthFlows", summary: `Auth flows enabled: ${newFlows.join(", ")}`, riskTier: newFlows.includes("app") ? "privileged" : "write" });
  if (b && b.type !== a.type) out.push({ op: "update_identity", path: "/spec/identity/type", summary: `Identity type ${b.type} → ${a.type}`, riskTier: "write" });
  return out;
}

const WEIGHT: Record<RiskTier, number> = { read: 4, write: 12, privileged: 30 };

export function assessRisk(changes: ChangeItem[], after: AgentManifest): ChangeRequest["spec"]["risk"] {
  const reasons: string[] = [];
  let score = changes.reduce((s, c) => s + WEIGHT[c.riskTier], 0);
  if (after.metadata.environment === "prod") {
    score += 10;
    reasons.push("targets production");
  }
  if (after.metadata.dataClassification === "confidential") {
    score += 8;
    reasons.push("confidential data");
  } else if (after.metadata.dataClassification === "highly_confidential") {
    score += 18;
    reasons.push("highly confidential data");
  }
  if (after.spec.access.exposure === "m365_copilot" || after.spec.access.exposure === "api") {
    score += 6;
    reasons.push(`broad exposure (${after.spec.access.exposure})`);
  }
  const tier = changes.reduce<RiskTier>((t, c) => maxTier(t, c.riskTier), "read");
  for (const c of changes) if (tierRank(c.riskTier) >= tierRank("write")) reasons.push(`${c.riskTier}: ${c.summary}`);
  return { tier, score: Math.min(100, Math.round(score)), reasons };
}

export function requiredApprovals(changes: ChangeItem[], risk: ChangeRequest["spec"]["risk"]): ChangeRequest["spec"]["approvals"] {
  const req = new Map<string, string>();
  for (const g of config.approvals[risk.tier]) req.set(g, `required for ${risk.tier}-tier changes`);
  if (changes.some((c) => c.op === "update_identity" && c.riskTier === "privileged")) {
    for (const g of config.approvals.privileged) if (!req.has(g)) req.set(g, "privileged identity/permission change");
  }
  if (changes.some((c) => c.op === "update_guardrails" && c.riskTier === "privileged") || changes.some((c) => c.op === "remove_injection" && c.riskTier === "privileged")) {
    const sec = config.approvals.write.find((g) => /security/i.test(g)) ?? "platform-security";
    req.set(sec, "guardrail weakening / mandatory harness removal");
  }
  return {
    required: [...req.entries()].map(([group, reason]) => ({ group, reason })),
    minApprovers: risk.tier === "privileged" ? 2 : 1,
  };
}
