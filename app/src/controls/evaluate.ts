// Evaluates the AI risk controls catalog against live (or mock) state. Pure: takes the data,
// returns one result per control × target. Sources that couldn't be read are `undefined` and
// yield "unknown" rather than a false pass or fail.

import type { Attestation } from "../config";
import type {
  Agent, AgentIdentity, AgentStats, AzureRoleAssignment, ContentSafety, DefenderPosture, FoundryAccountPosture,
  ModelDeployment, PermissionGrant, PolicyState, RaiPolicy,
} from "../api/types";
import { MANDATORY_INJECTIONS } from "../lib/harnessLibrary";
import { ageDays, type AgentRiskTier } from "../lib/governance";
import { agentToManifest } from "../lib/manifestDefaults";
import type { AgentManifest } from "../schema/manifest";
import { CONTROLS, type Control } from "./catalog";

export type Status = "pass" | "fail" | "warn" | "attest" | "na" | "unknown";

export interface Target {
  kind: "env" | "account" | "agent";
  id: string;
  name: string;
}

export interface Result {
  control: string;
  target: Target;
  status: Status;
  evidence: string;
  attestation?: Attestation & { key: string; expired: boolean };
}

export interface EvalInput {
  agents: Agent[];
  deployments: ModelDeployment[];
  rai: RaiPolicy[];
  accounts?: FoundryAccountPosture[];
  defender?: DefenderPosture[];
  identities?: AgentIdentity[];
  roles?: AzureRoleAssignment[];
  grants?: PermissionGrant[];
  safety?: ContentSafety;
  stats?: AgentStats[];
  policy?: PolicyState[];
  attestations: Record<string, Attestation>;
  approvedMcpHosts: string[];
  subscriptionId: string;
  now?: number;
}

type Verdict = { status: Status; evidence: string };
const v = (status: Status, evidence: string): Verdict => ({ status, evidence });

const PRIVILEGED_ROLES = /^(owner|contributor|user access administrator|role based access control administrator)$/i;
const SECRET_RE = /(api[_-]?key|secret|password|passwd|bearer\s+[a-z0-9._-]{20,}|sk-[a-z0-9]{20,}|AccountKey=|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const KNOWLEDGE_TOOLS = new Set(["file_search", "azure_ai_search", "sharepoint_grounding", "fabric_dataagent"]);
const OBO_TOOLS = new Set(["sharepoint_grounding", "fabric_dataagent"]);
/** Tool types allowed per agent risk tier without a TL-01 attestation. */
const TIER_TOOLS: Record<AgentRiskTier, Set<string>> = {
  low: new Set(["file_search", "azure_ai_search", "bing_grounding", "sharepoint_grounding", "fabric_dataagent", "function"]),
  medium: new Set(["file_search", "azure_ai_search", "bing_grounding", "sharepoint_grounding", "fabric_dataagent", "function", "openapi", "mcp", "azure_function", "code_interpreter"]),
  high: new Set(["file_search", "azure_ai_search", "bing_grounding", "sharepoint_grounding", "fabric_dataagent", "function", "openapi", "mcp", "azure_function", "code_interpreter", "connected_agent"]),
};

/** Normalised content-filter name: "Protected Material Text" → "protectedmaterialtext". */
const fname = (n: string) => n.toLowerCase().replace(/[\s_-]+/g, "");

interface Filters {
  label: string;
  builtIn: boolean;
  has(name: RegExp, opts?: { source?: string; blocking?: boolean; maxThreshold?: "Low" | "Medium" | "High" }): boolean;
}

/** Microsoft.DefaultV2 behaviour: harm categories block at Medium, jailbreak + protected material on. */
const DEFAULT_V2 = ["hate", "sexual", "selfharm", "violence"].flatMap((name) =>
  ["Prompt", "Completion"].map((source) => ({ name, source, enabled: true, blocking: true, severityThreshold: "Medium" })),
).concat([
  { name: "jailbreak", source: "Prompt", enabled: true, blocking: true, severityThreshold: "Medium" },
  { name: "protectedmaterialtext", source: "Completion", enabled: true, blocking: true, severityThreshold: "Medium" },
  { name: "protectedmaterialcode", source: "Completion", enabled: true, blocking: false, severityThreshold: "Medium" },
]);

function filtersFor(policyName: string | undefined, account: string, rai: RaiPolicy[]): Filters | undefined {
  if (!policyName) return undefined;
  const builtIn = /^Microsoft\.Default/i.test(policyName);
  const p = rai.find((r) => r.account === account && r.name === policyName);
  if (!p && !builtIn) return undefined;
  const list = p ? p.contentFilters.map((f) => ({ ...f, name: fname(f.name) })) : DEFAULT_V2;
  const rank = { Low: 0, Medium: 1, High: 2 } as Record<string, number>;
  return {
    label: policyName,
    builtIn,
    has(name, { source, blocking = true, maxThreshold } = {}) {
      return list.some(
        (f) =>
          name.test(f.name) &&
          f.enabled &&
          (!blocking || f.blocking) &&
          (!source || f.source.toLowerCase() === source.toLowerCase()) &&
          (!maxThreshold || (rank[f.severityThreshold ?? "Medium"] ?? 1) <= rank[maxThreshold]),
      );
    },
  };
}

export function evaluateControls(input: EvalInput): Result[] {
  const now = input.now ?? Date.now();
  const sub = input.subscriptionId;
  const manifests = new Map<string, AgentManifest>(input.agents.map((a) => [key(a), agentToManifest(a, input.deployments, a.subscriptionId || sub || "00000000-0000-0000-0000-000000000000")]));
  const tierOf = (a: Agent): AgentRiskTier => a.governance?.riskTier ?? "medium";
  const depOf = (a: Agent) => input.deployments.find((d) => d.name === a.model && d.account === a.account);
  const filtersOf = (a: Agent) => filtersFor(depOf(a)?.raiPolicyName, a.account, input.rai);
  const statsOf = (a: Agent) => input.stats?.find((s) => s.agentName === a.name || s.agentName === a.id);
  const isProd = (a: Agent) => (a.metadata.environment ?? "prod") === "prod";
  const freshness = (ref: { id: string; date: string } | undefined, maxDays: number, what: string): Verdict => {
    if (!ref) return v("attest", `No ${what} recorded in agent governance metadata`);
    const age = ageDays(ref.date, now);
    return age <= maxDays ? v("pass", `${what} ${ref.id} on ${ref.date} (${age} days ago, limit ${maxDays})`) : v("fail", `${what} ${ref.id} is ${age} days old (limit ${maxDays})`);
  };

  const agentChecks: Record<string, (a: Agent, m: AgentManifest) => Verdict> = {
    "GV-01": (a) => {
      const missing = [!a.owner && "owner", !a.governance?.riskTier && "risk tier", !a.metadata.dataClassification && "data classification"].filter(Boolean);
      return missing.length ? v("fail", `Missing in agent metadata: ${missing.join(", ")}`) : v("pass", `Owner ${a.owner}, tier ${tierOf(a)}, ${a.metadata.dataClassification}`);
    },
    "GV-02": (a) => {
      if (!a.agentIdentityId) return v("fail", "No Entra agent identity (runs as the shared project identity), so no sponsor can be assigned");
      if (!input.identities) return v("unknown", "Agent identities not readable (needs Graph consent / Identity Reader)");
      const id = input.identities.find((i) => i.id === a.agentIdentityId || i.appId === a.agentIdentityId);
      if (!id) return v("unknown", `Identity ${a.agentIdentityId} not found in Entra Agent ID listing`);
      return id.sponsors.length ? v("pass", `Sponsors: ${id.sponsors.join(", ")}`) : v("fail", `Agent identity ${id.displayName} has no sponsor`);
    },
    "GV-03": (a) => (a.governance?.intakeId ? v("pass", `Intake ${a.governance.intakeId}, tier ${tierOf(a)}`) : v("attest", "No intake record id in agent governance metadata")),
    "GV-04": (a) => freshness(a.governance?.impactAssessment, 365, "Impact assessment"),
    "ID-01": (a) => (a.agentIdentityId ? v("pass", `Instance identity ${a.agentIdentityId}`) : v("fail", a.api === "assistants" ? "Classic assistant: runs as the shared project identity" : "No instance identity on the agent version")),
    "ID-03": (a) => {
      if (!input.roles && !input.grants) return v("unknown", "RBAC and Graph grants not readable");
      const mine = (pid: string, pname: string) => pid === a.agentIdentityId || pname === a.name;
      const roles = (input.roles ?? []).filter((r) => mine(r.principalId, r.principalName) && PRIVILEGED_ROLES.test(r.roleName));
      const grants = (input.grants ?? []).filter((g) => g.clientName === a.name && g.highPrivilege);
      if (roles.length || grants.length)
        return v("fail", [...roles.map((r) => `${r.roleName} on ${r.scope.split("/").slice(-2).join("/")}`), ...grants.map((g) => `${g.kind} ${g.permissions.join(" ")}`)].join("; "));
      return v("pass", "No privileged Azure roles or high-privilege Graph permissions");
    },
    "ID-05": (a, m) => {
      if (SECRET_RE.test(a.instructions)) return v("fail", "Instructions contain a credential-like string");
      const anon = m.spec.tools.filter((t) => t.type === "openapi" && t.openapi?.auth.type === "anonymous");
      return anon.length ? v("warn", `Anonymous OpenAPI tools: ${anon.map((t) => t.name).join(", ")}`) : v("pass", "No secrets in instructions; tools use managed identity / connections");
    },
    "ID-06": (a) => {
      const data = a.tools.filter((t) => KNOWLEDGE_TOOLS.has(t.type) || ["openapi", "mcp"].includes(t.type));
      if (!data.length) return v("na", "No user-data tools");
      const nonObo = data.filter((t) => !OBO_TOOLS.has(t.type));
      return nonObo.length ? v("attest", `Identity mode not evidenced for: ${nonObo.map((t) => t.name).join(", ")}`) : v("pass", "Data tools run on-behalf-of the user (SharePoint/Fabric)");
    },
    "DP-03": (a) => {
      const f = filtersOf(a);
      if (!f) return v("unknown", "Guardrail not readable");
      return f.has(/pii|personal/) ? v("pass", `PII filter on ${f.label}`) : v("attest", `No PII filter on ${f.label}; attest Purview DSPM / DLP coverage`);
    },
    "DP-04": (a) => {
      if (!input.safety) return v("unknown", "Trace data not readable");
      const c = input.safety.capture.find((x) => x.agentName === a.name);
      if (!c || !c.spans) return v("unknown", "No spans in range");
      if (!c.capturedSpans) return v("pass", `${c.spans} spans, no message content captured`);
      return isProd(a) ? v("fail", `${c.capturedSpans}/${c.spans} spans store prompt/response content`) : v("warn", `Content captured on non-prod agent (${c.capturedSpans} spans)`);
    },
    "DP-05": (a) => {
      const k = a.tools.filter((t) => KNOWLEDGE_TOOLS.has(t.type));
      return k.length ? v("attest", `Knowledge sources: ${k.map((t) => t.type).join(", ")}; attest partitioning and provenance`) : v("na", "No knowledge/memory tools");
    },
    "GR-01": (a) => {
      const f = filtersOf(a);
      if (!f) return v("unknown", `Guardrail for deployment ${a.model} not readable`);
      const missing = ["hate", "sexual", "selfharm", "violence"].filter(
        (n) => !["Prompt", "Completion"].every((s) => f.has(new RegExp(`^${n}`), { source: s, maxThreshold: "Medium" })),
      );
      return missing.length ? v("fail", `${f.label}: not blocking at Medium on prompt+completion: ${missing.join(", ")}`) : v("pass", `${f.label}${f.builtIn ? " (built-in default)" : ""}: harm categories block at Medium or stricter`);
    },
    "GR-02": (a) => {
      const f = filtersOf(a);
      if (!f) return v("unknown", "Guardrail not readable");
      const detected = (input.defender ?? []).flatMap((d) => d.alerts).filter((x) => /Jailbreak.*Detected/i.test(x.alertType) && x.resourceId.includes(`/accounts/${a.account.toLowerCase()}`));
      if (!f.has(/^jailbreak/)) return v("fail", `${f.label}: jailbreak shield off or not blocking`);
      return detected.length ? v("warn", `Shield on, but ${detected.reduce((s, x) => s + x.count, 0)} jailbreak attempts detected without blocking`) : v("pass", `${f.label}: jailbreak shield blocking`);
    },
    "GR-03": (a) => {
      if (!a.tools.length) return v("na", "No tools or retrieval");
      const f = filtersOf(a);
      if (!f) return v("unknown", "Guardrail not readable");
      const mcp = a.tools.some((t) => t.type === "mcp");
      if (!f.has(/indirect/)) return v("fail", `${f.label}: no indirect prompt-injection filter${mcp ? " (MCP tools also need TL-02/03/04)" : ""}`);
      return mcp ? v("warn", "Indirect-attack filter on, but MCP tool responses aren't scanned; rely on TL-02/03/04") : v("pass", `${f.label}: indirect-attack filter on`);
    },
    "GR-04": (a) => {
      if (!a.tools.length) return v("na", "No tools");
      const f = filtersOf(a);
      if (!f) return v("unknown", "Guardrail not readable");
      return f.has(/taskadherence|toolcall/) || f.has(/.*/, { source: "PreToolCall" }) ? v("pass", "Tool-call intervention configured") : v("warn", "No tool-call scanning / task adherence (preview feature)");
    },
    "GR-05": (a) => {
      const f = filtersOf(a);
      if (!f) return v("unknown", "Guardrail not readable");
      return f.has(/^protectedmaterialtext/, { source: "Completion", blocking: false }) ? v("attest", "Protected-material filter on; attest output handling in consuming apps") : v("fail", `${f.label}: protected-material filter off`);
    },
    "GR-06": (a, m) => {
      if (!a.instructions.trim()) return v("fail", "No instructions");
      if (SECRET_RE.test(a.instructions)) return v("fail", "Instructions contain a credential-like string");
      const missing = MANDATORY_INJECTIONS.filter((x) => !m.spec.harness.injections.some((i) => i.id === x.id)).map((x) => x.id);
      return missing.length ? v("fail", `Missing mandatory instructions: ${missing.join(", ")}`) : v("pass", "Instructions include the mandatory platform instructions");
    },
    "TL-01": (a) => {
      const allowed = TIER_TOOLS[tierOf(a)];
      const extra = [...new Set(a.tools.map((t) => t.type).filter((t) => !allowed.has(t)))];
      return extra.length ? v("fail", `Not allowed for ${tierOf(a)} tier without approval: ${extra.join(", ")}`) : v("pass", `All tool types allowed for ${tierOf(a)} tier`);
    },
    "TL-02": (a) => {
      const mcp = a.tools.filter((t) => t.type === "mcp");
      if (!mcp.length) return v("na", "No MCP tools");
      const problems = mcp.flatMap((t) => {
        const host = (() => { try { return new URL(t.detail ?? "").host; } catch { return ""; } })();
        return [
          !input.approvedMcpHosts.includes(host) && `${t.name}: server ${host || "?"} not in the approved registry`,
          !t.allowedTools?.length && `${t.name}: no allowed_tools list`,
        ].filter(Boolean) as string[];
      });
      return problems.length ? v("fail", problems.join("; ")) : v("pass", "MCP servers registered, allowed_tools set");
    },
    "TL-03": (_a, m) => {
      const risky = m.spec.tools.filter((t) => t.riskTier !== "read");
      if (!risky.length) return v("na", "No write or privileged tools");
      const open = risky.filter((t) => t.requireApproval !== "always");
      return open.length ? v("fail", `Write/privileged tools without approval: ${open.map((t) => `${t.name} (${t.requireApproval})`).join(", ")}`) : v("pass", `${risky.length} write/privileged tool(s) require approval`);
    },
    "TL-04": (a) => {
      const defs = a.tools.filter((t) => ["mcp", "openapi"].includes(t.type));
      return defs.length ? v("attest", `Pin and re-approve definitions for: ${defs.map((t) => t.name).join(", ")}`) : v("na", "No MCP/OpenAPI tools");
    },
    "TL-05": (a) => {
      const exec = a.tools.filter((t) => t.type === "function" && /(exec|shell|run_?code|eval|script)/i.test(t.name));
      if (exec.length) return v("attest", `Custom execution tools need isolation evidence: ${exec.map((t) => t.name).join(", ")}`);
      return a.tools.some((t) => t.type === "code_interpreter") ? v("pass", "Code runs in the Foundry code interpreter sandbox") : v("na", "No code execution tools");
    },
    "TL-06": (a) => {
      const limit = Number(a.metadata["agentctl.max_tool_calls"] ?? NaN);
      const dep = depOf(a);
      if (!Number.isFinite(limit)) return v("attest", `No per-run tool-call limit recorded${dep ? `; deployment capacity ${dep.capacity}K TPM` : ""}`);
      return v("attest", `Limit ${limit} tool calls/run recorded; attest the runtime enforcement point`);
    },
    "TL-07": (_a, m) => (m.spec.tools.some((t) => t.riskTier !== "read") ? v("attest", "Write-capable tools: attest backend authorization") : v("na", "No write-capable tools")),
    "TL-08": (a) => {
      const ca = a.tools.filter((t) => t.type === "connected_agent");
      if (!ca.length) return v("na", "No connected agents");
      const known = new Set(input.agents.flatMap((x) => [x.id, x.name]));
      const unknown = ca.filter((t) => !known.has(t.detail ?? t.name));
      return unknown.length ? v("fail", `Connected agents not in the inventory: ${unknown.map((t) => t.detail ?? t.name).join(", ")}`) : v("attest", "Targets are registered; attest delegation design");
    },
    "MO-02": (a) => {
      if (!input.stats) return v("unknown", "Telemetry not readable");
      const s = statsOf(a);
      return s?.runs ? v("pass", `${s.runs} traced runs in range`) : isProd(a) ? v("fail", "No traced runs in range") : v("warn", "No traced runs in range (non-prod)");
    },
    "MO-03": (a) => (a.agentIdentityId ? v("attest", "Needs Entra sign-in / Graph activity export to reconcile (P1/P2)") : v("fail", "No agent identity to reconcile against")),
    "SC-02": (a) => {
      const managed = Boolean(a.metadata["agentctl.manifest_sha256"]);
      const dep = depOf(a);
      const pinned = Boolean(dep?.modelVersion);
      if (!managed) return v("fail", "Not deployed through the GitOps pipeline (no manifest hash)");
      return pinned ? v("pass", `GitOps-managed; model ${dep!.model} ${dep!.modelVersion}`) : v("warn", "GitOps-managed; model version not pinned");
    },
    "SC-03": (a) => v("pass", `Generated from live state: ${a.tools.length} tools, model ${a.model}`),
    "TE-01": (a) => (tierOf(a) === "low" ? v("na", "Low tier") : freshness(a.governance?.threatModel, 365, "Threat model")),
    "TE-02": (a) => freshness(a.governance?.evaluation, 180, "Evaluation"),
    "TE-03": (a) => (tierOf(a) === "low" ? v("na", "Low tier") : freshness(a.governance?.redTeam, tierOf(a) === "high" ? 90 : 365, "Red-team test")),
    "IR-01": (a) => freshness(a.governance?.killSwitchDrill, tierOf(a) === "high" ? 180 : 365, "Kill-switch drill"),
    "TR-01": (a, m) => {
      if (a.governance?.userFacing === false) return v("na", "Not user-facing");
      const disclosureInstr = m.spec.harness.injections.some((i) => i.id === "platform.identity-disclosure");
      if (a.governance?.userFacing === undefined) return v("attest", "Record whether the agent is user-facing");
      if (a.governance.disclosure && disclosureInstr) return v("pass", `Disclosure ${a.governance.disclosure}; identity-disclosure instruction present`);
      return v("fail", [!a.governance.disclosure && "no disclosure link", !disclosureInstr && "no identity-disclosure instruction"].filter(Boolean).join("; "));
    },
    "TR-02": (a) => (a.governance?.userFacing ? v("attest", "User-facing: attest notice, feedback and appeal channel") : v("na", "Not user-facing")),
  };

  const accountChecks: Record<string, (x: FoundryAccountPosture, agents: Agent[]) => Verdict> = {
    "ID-02": (x) => (x.disableLocalAuth ? v("pass", "disableLocalAuth = true") : v("fail", "API key (local) auth enabled")),
    "NW-01": (x) =>
      x.publicNetworkAccess === "Disabled" || x.networkDefaultAction === "Deny"
        ? v("pass", `publicNetworkAccess ${x.publicNetworkAccess}, default ${x.networkDefaultAction ?? "-"}, ${x.privateEndpoints} private endpoint(s)`)
        : v("fail", `Public network access ${x.publicNetworkAccess} with no default-deny`),
    "NW-02": (x) => (x.restrictOutboundNetworkAccess && x.allowedFqdns > 0 ? v("pass", `Outbound restricted to ${x.allowedFqdns} FQDN(s)`) : v("fail", "Outbound network access unrestricted")),
    "DP-01": (x, agents) => {
      const sensitive = agents.filter((a) => ["confidential", "highly_confidential"].includes(a.metadata.dataClassification ?? "") || tierOf(a) === "high");
      if (!sensitive.length) return v("na", "No confidential or high-tier agents");
      return x.customerManagedKey ? v("pass", "Customer-managed key") : v("fail", `Microsoft-managed keys; hosts ${sensitive.length} confidential/high-tier agent(s)`);
    },
    "DP-02": () => v("attest", "Capability host / user-owned storage not read yet; attest the configuration"),
    "MO-01": (x) => (x.diagnosticsToWorkspace === null ? v("unknown", "Diagnostic settings not readable") : x.diagnosticsToWorkspace ? v("pass", "Diagnostic logs → agentctl workspace") : v("fail", "No diagnostic setting to the workspace")),
  };

  const envChecks: Record<string, () => Verdict> = {
    "GV-01": () => {
      if (!input.stats) return v("unknown", "Telemetry not readable");
      const known = new Set(input.agents.flatMap((a) => [a.name, a.id]));
      const shadow = input.stats.filter((s) => !known.has(s.agentName)).map((s) => s.agentName);
      return shadow.length ? v("fail", `Agents seen in traces but not in the inventory: ${shadow.join(", ")}`) : v("pass", `${input.agents.length} agents inventoried; no shadow agents in traces`);
    },
    "GV-05": () => v("attest", "Training records are outside Azure"),
    "GV-06": () => v("attest", "Vendor due-diligence file"),
    "ID-04": () => v("attest", "Conditional Access for agents isn't read yet"),
    "MO-04": () => {
      if (!input.defender) return v("unknown", "Defender not readable");
      const off = input.defender.filter((d) => d.aiPlan !== "Standard");
      const unhealthy = input.defender.flatMap((d) => d.recommendations).filter((r) => r.status === "Unhealthy");
      if (off.length) return v(off.every((d) => d.aiPlan === "Unknown") ? "unknown" : "fail", `Defender for AI Services ${off.map((d) => `${d.aiPlan} on ${d.subscriptionId.slice(0, 8)}…`).join(", ")}`);
      return unhealthy.length ? v("warn", `Plan on; ${unhealthy.length} unhealthy AI recommendation(s)`) : v("pass", "Defender for AI Services on; AI recommendations healthy");
    },
    "MO-05": () => {
      const n = (input.defender ?? []).reduce((s, d) => s + d.alerts.reduce((t, a) => t + a.count, 0), 0);
      return v("attest", `${n} AI alert(s) in Defender; attest SOC routing and runbooks`);
    },
    "MO-06": () => v("attest", "Workspace retention isn't read yet"),
    "SC-01": () => {
      if (!input.policy) return v("unknown", "Azure Policy states not readable");
      const approved = input.policy.filter((p) => /aafe3651|8791d062|approved.?model/i.test(`${p.policyDefinitionName} ${p.policyDefinitionDisplayName}`));
      if (!approved.length) return v("fail", "No approved-model / model-eligibility policy assigned");
      const non = approved.filter((p) => p.complianceState === "NonCompliant");
      return non.length ? v("fail", `${non.length} deployment(s) non-compliant with the approved-model policy`) : v("pass", `Approved-model policy assigned (${approved.length} evaluations, compliant)`);
    },
    "IR-02": () => v("attest", "IR plan and tabletop are outside Azure"),
    "IR-03": () => {
      const ownerless = input.agents.filter((a) => !a.owner).map((a) => a.name);
      if (!input.identities) return ownerless.length ? v("fail", `Ownerless agents: ${ownerless.join(", ")}`) : v("unknown", "Agent identities not readable");
      const used = new Set(input.agents.map((a) => a.agentIdentityId).filter(Boolean));
      const orphans = input.identities.filter((i) => i.kind === "agent_identity" && !used.has(i.id) && !used.has(i.appId)).map((i) => i.displayName);
      const issues = [orphans.length && `orphaned agent identities: ${orphans.slice(0, 5).join(", ")}${orphans.length > 5 ? "…" : ""}`, ownerless.length && `ownerless agents: ${ownerless.join(", ")}`].filter(Boolean);
      return issues.length ? v("fail", issues.join("; ")) : v("pass", "No orphaned identities or ownerless agents");
    },
  };

  const results: Result[] = [];
  const push = (c: Control, target: Target, verdict: Verdict, attestKeys: string[]) => {
    results.push(applyAttestation(c, target, verdict, attestKeys, input.attestations, now));
  };

  for (const c of CONTROLS) {
    if (c.scope.includes("agent") && agentChecks[c.id])
      for (const a of input.agents) push(c, { kind: "agent", id: key(a), name: a.name }, agentChecks[c.id](a, manifests.get(key(a))!), [`${c.id}@${a.name}`, c.id]);
    if (c.scope.includes("account") && accountChecks[c.id]) {
      if (!input.accounts) push(c, { kind: "account", id: "*", name: "Foundry accounts" }, v("unknown", "Account posture not readable"), [c.id]);
      else for (const x of input.accounts) push(c, { kind: "account", id: x.id, name: x.name }, accountChecks[c.id](x, input.agents.filter((a) => a.account === x.name)), [`${c.id}@${x.name}`, c.id]);
    }
    if (c.scope.includes("env") && envChecks[c.id]) push(c, { kind: "env", id: "env", name: "Environment" }, envChecks[c.id](), [c.id]);
  }
  return results;
}

const key = (a: Agent) => `${a.project}/${a.id}`;

/** Attestations turn attest/fail/warn into pass (attested), warn (risk accepted) or na. Expired ones don't count. */
function applyAttestation(c: Control, target: Target, verdict: Verdict, keys: string[], att: Record<string, Attestation>, now: number): Result {
  const base: Result = { control: c.id, target, ...verdict };
  if (verdict.status === "pass" || verdict.status === "na") return base;
  const k = keys.find((x) => att[x]);
  if (!k) return base;
  const a = att[k];
  const expired = Boolean(a.expires && Date.parse(a.expires) < now);
  const attestation = { ...a, key: k, expired };
  if (expired) return { ...base, attestation, evidence: `${verdict.evidence}. Attestation expired ${a.expires}` };
  if (a.status === "not_applicable") return { ...base, attestation, status: "na", evidence: `Not applicable (attested by ${a.owner ?? "?"}): ${a.note ?? a.evidence ?? ""}` };
  if (a.status === "risk_accepted") return { ...base, attestation, status: "warn", evidence: `Risk accepted by ${a.owner ?? "?"} until ${a.expires ?? "?"}: ${a.evidence ?? ""}` };
  // A sign-off can't override an automated failure: the platform state contradicts it.
  if (verdict.status === "fail" && c.evidence === "auto") return { ...base, attestation, evidence: `${verdict.evidence}. (Attestation ignored: contradicts the automated check)` };
  return { ...base, attestation, status: "pass", evidence: `Attested by ${a.owner ?? "?"} on ${a.date}: ${a.evidence ?? ""}` };
}

// ── Summaries ───────────────────────────────────────────────────────────────────

export interface Rollup {
  pass: number;
  fail: number;
  warn: number;
  attest: number;
  unknown: number;
  na: number;
  /** 0-100: pass = 1, warn = 0.5, fail/attest = 0; unknown and n/a excluded. */
  score: number | null;
}

export function rollup(rs: Result[]): Rollup {
  const r: Rollup = { pass: 0, fail: 0, warn: 0, attest: 0, unknown: 0, na: 0, score: null };
  for (const x of rs) r[x.status]++;
  const denom = r.pass + r.fail + r.warn + r.attest;
  r.score = denom ? Math.round(((r.pass + r.warn * 0.5) / denom) * 100) : null;
  return r;
}

const ORDER: Status[] = ["fail", "attest", "warn", "unknown", "pass", "na"];
/** Worst status across results (fail > attest > warn > unknown > pass > na). */
export function worst(rs: Result[]): Status {
  for (const s of ORDER) if (rs.some((r) => r.status === s)) return s;
  return "na";
}
