// Posture findings computed from the observed state. Each finding can be turned into a change
// request ("fix") on the harness page, which is how the platform applies extra guardrails.

import type { StatusLevel } from "../components/common";
import type { Agent, AgentIdentity, AzureRoleAssignment, ContentSafety, ModelDeployment, PermissionGrant, PolicyState, RaiPolicy } from "../api/types";
import { MANDATORY_INJECTIONS } from "./harnessLibrary";
import { extractInjections } from "./manifestDefaults";

export type FixKind = "inject-mandatory" | "require-approval" | "strict-rai" | "review-identity" | "none";

export interface Finding {
  id: string;
  severity: Exclude<StatusLevel, "good" | "info">;
  category: "Harness" | "Tools" | "Content safety" | "Data protection" | "Identity" | "Compliance" | "Ownership";
  title: string;
  resource: string;
  detail: string;
  remediation: string;
  fix: FixKind;
  agent?: Pick<Agent, "project" | "id" | "name">;
}

const PRIV_ROLE = /^(Owner|Contributor|User Access Administrator)$/i;

export function computeFindings(input: {
  agents: Agent[];
  deployments: ModelDeployment[];
  rai: RaiPolicy[];
  grants: PermissionGrant[];
  roles: AzureRoleAssignment[];
  identities: AgentIdentity[];
  policy: PolicyState[];
  contentSafety?: ContentSafety;
}): Finding[] {
  const out: Finding[] = [];
  const ref = (a: Agent) => ({ project: a.project, id: a.id, name: a.name });

  for (const a of input.agents) {
    const { injections } = extractInjections(a.instructions);
    const missing = MANDATORY_INJECTIONS.filter((m) => !injections.some((i) => i.id === m.id));
    if (missing.length) {
      out.push({
        id: `harness-${a.id}`,
        severity: a.metadata.environment === "prod" ? "serious" : "warning",
        category: "Harness",
        title: "Missing mandatory harness instructions",
        resource: a.name,
        detail: `Not present: ${missing.map((m) => m.id).join(", ")}`,
        remediation: "Inject the mandatory platform instructions through a change request.",
        fix: "inject-mandatory",
        agent: ref(a),
      });
    }
    for (const t of a.tools) {
      if (t.type === "browser_automation") {
        out.push({
          id: `browser-${a.id}`,
          severity: "critical",
          category: "Tools",
          title: "Browser automation enabled",
          resource: `${a.name} → ${t.name}`,
          detail: `Agent can drive a real browser${t.requireApproval === "never" ? " without approval" : ""}.`,
          remediation: "Require approval on every call, restrict allowed domains, or remove the tool.",
          fix: "require-approval",
          agent: ref(a),
        });
      } else if (t.type === "mcp" && t.requireApproval === "never") {
        // MCP servers expose arbitrary tools; without approval every call executes unattended.
        out.push({
          id: `approval-${a.id}-${t.name}`,
          severity: "serious",
          category: "Tools",
          title: "Write-capable tool runs without approval",
          resource: `${a.name} → ${t.name}`,
          detail: `${t.type} tool ${t.detail ?? ""} has require_approval = never.`,
          remediation: "Set require_approval to always (or write_only) via a change request.",
          fix: "require-approval",
          agent: ref(a),
        });
      }
    }
    const dep = input.deployments.find((d) => d.account === a.account && d.name === a.model);
    const pol = dep && input.rai.find((r) => r.account === dep.account && r.name === dep.raiPolicyName);
    const jailbreakOff = pol && !pol.contentFilters.some((f) => f.name === "jailbreak" && f.enabled && f.blocking);
    if (pol && (pol.mode !== "Blocking" || jailbreakOff)) {
      out.push({
        id: `rai-${a.id}`,
        severity: a.metadata.environment === "prod" ? "critical" : "warning",
        category: "Content safety",
        title: "Weak content-safety policy on agent model",
        resource: `${a.name} → ${dep!.name} (${pol.name})`,
        detail: `${pol.mode !== "Blocking" ? `Mode ${pol.mode}. ` : ""}${jailbreakOff ? "Jailbreak shield not blocking." : ""}`,
        remediation: "Move the agent to a deployment with the strict RAI policy, or tighten the policy.",
        fix: "strict-rai",
        agent: ref(a),
      });
    }
  }

  for (const g of input.grants.filter((g) => g.isAgent && g.highPrivilege)) {
    out.push({
      id: `grant-${g.id}`,
      severity: g.kind === "application" ? "serious" : "warning",
      category: "Identity",
      title: g.kind === "application" ? "High-privilege application permission held by agent" : "High-privilege delegated scope for agent",
      resource: `${g.clientName} → ${g.resourceName}`,
      detail: g.permissions.join(", "),
      remediation: "Replace with a narrower permission or move to delegated/OBO so access is bounded by the user.",
      fix: "review-identity",
      agent: matchAgent(input.agents, g.clientName),
    });
  }
  for (const r of input.roles.filter((r) => r.isAgent && PRIV_ROLE.test(r.roleName))) {
    out.push({
      id: `rbac-${r.id}`,
      severity: "critical",
      category: "Identity",
      title: `Agent principal holds ${r.roleName}`,
      resource: r.principalName,
      detail: `Scope: ${r.scope}`,
      remediation: "Replace with a data-plane role scoped to the specific resource.",
      fix: "review-identity",
    });
  }
  for (const i of input.identities.filter((i) => i.kind === "agent_identity" && i.sponsors.length === 0)) {
    out.push({
      id: `sponsor-${i.id}`,
      severity: "warning",
      category: "Ownership",
      title: "Agent identity has no sponsor",
      resource: i.displayName,
      detail: "No accountable human sponsor is assigned in Entra Agent ID.",
      remediation: "Assign a sponsor in Entra (or update metadata.owners in the manifest).",
      fix: "none",
      agent: matchAgent(input.agents, i.displayName),
    });
  }
  for (const c of input.contentSafety?.capture ?? []) {
    if (!c.capturedSpans) continue;
    const a = input.agents.find((x) => x.name === c.agentName);
    const cls = a?.metadata.dataClassification ?? "internal";
    out.push({
      id: `capture-${c.agentName}`,
      severity: cls === "confidential" || cls === "highly_confidential" ? "serious" : "warning",
      category: "Data protection",
      title: "Prompt and response content stored in traces",
      resource: c.agentName,
      detail: `${c.capturedSpans} of ${c.spans} spans include gen_ai.input/output.messages (system prompt and user input) in Log Analytics; agent classification: ${cls}.`,
      remediation: "Turn off message content recording in the Foundry project's tracing settings, or restrict and shorten workspace retention for this data.",
      fix: "none",
      agent: a ? { project: a.project, id: a.id, name: a.name } : undefined,
    });
  }
  for (const f of input.contentSafety?.filters ?? []) {
    if (f.category !== "jailbreak" || !f.flagged) continue;
    out.push({
      id: `jailbreak-${f.agentName}-${f.source}`,
      severity: "serious",
      category: "Content safety",
      title: "Jailbreak attempts detected",
      resource: f.agentName,
      detail: `${f.flagged} of ${f.evaluations} ${f.source} evaluations flagged; ${f.blocked} blocked.`,
      remediation: "Review the flagged runs in Activity; consider stricter RAI policy or limiting who can call the agent.",
      fix: "strict-rai",
      agent: matchAgent(input.agents, f.agentName),
    });
  }
  const nonCompliant = input.policy.filter((p) => p.complianceState === "NonCompliant");
  for (const p of nonCompliant) {
    out.push({
      id: `policy-${p.policyDefinitionName}-${p.resourceId}`,
      severity: "warning",
      category: "Compliance",
      title: p.policyDefinitionDisplayName,
      resource: p.resourceId.split("/").pop() ?? p.resourceId,
      detail: `Assignment ${p.policyAssignmentName}`,
      remediation: "Remediate the resource configuration in the infrastructure repo.",
      fix: "none",
    });
  }
  const rank = { critical: 0, serious: 1, warning: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function matchAgent(agents: Agent[], name: string) {
  const a = agents.find((x) => x.name === name);
  return a ? { project: a.project, id: a.id, name: a.name } : undefined;
}
