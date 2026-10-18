// AI risk controls catalog: 50 controls in 11 domains, cross-walked to the major AI risk
// frameworks. Source: reports/AI risk frameworks controls crosswalk.md (research, 2026-10).
// Evaluators live in ./evaluate.ts (one per control id); framework metadata in ./frameworks.ts.

export type ControlDomain = "GV" | "ID" | "NW" | "DP" | "GR" | "TL" | "MO" | "SC" | "TE" | "IR" | "TR";
export type ControlScope = "env" | "account" | "agent";
/** auto = fully automated signal; partial = automated corroboration + attestation; manual = attestation only. */
export type EvidenceType = "auto" | "partial" | "manual";
export type Severity = "high" | "medium" | "low";

export interface ControlMappings {
  llm?: string[]; // OWASP Top 10 for LLM Applications 2025
  asi?: string[]; // OWASP Top 10 for Agentic Applications 2026 (+ T-ids / MCP ids)
  rmf?: string[]; // NIST AI RMF 1.0 subcategories / AI 600-1 actions
  iso?: string[]; // ISO/IEC 42001:2023 Annex A
  aia?: string[]; // EU AI Act articles († = high-risk-only)
  atlas?: string[]; // MITRE ATLAS v2026.09 (AML. prefix omitted)
  mcsb?: string[]; // Microsoft Cloud Security Benchmark v2 AI domain (preview)
}

export interface Control {
  id: string;
  domain: ControlDomain;
  title: string;
  description: string;
  scope: ControlScope[];
  evidence: EvidenceType;
  severity: Severity;
  mappings: ControlMappings;
  /** Where the automated evidence comes from (shown in the UI). */
  signals: string;
  /** What to capture when attesting (partial/manual controls). */
  attest?: string;
  /** Signals that depend on preview features or unverified paths (see the report's open items). */
  caveat?: string;
}

export const DOMAINS: Record<ControlDomain, string> = {
  GV: "Governance",
  ID: "Identity & access",
  NW: "Network",
  DP: "Data protection",
  GR: "Guardrails",
  TL: "Tools & actions",
  MO: "Monitoring",
  SC: "Supply chain",
  TE: "Testing & evaluation",
  IR: "Incident & oversight",
  TR: "Transparency",
};

export const CONTROLS: Control[] = [
  // ── Governance ────────────────────────────────────────────────────────────────
  {
    id: "GV-01", domain: "GV", title: "Agent inventory", severity: "high", evidence: "auto", scope: ["env", "agent"],
    description: "Every Foundry account, project and agent version is registered with owner, purpose, risk tier and data classification; unregistered (shadow) agents are detected.",
    mappings: { llm: ["LLM10"], asi: ["ASI10", "MCP09"], rmf: ["GOVERN 1.6", "GV-1.6-001", "GV-1.6-003"], iso: ["A.4.2", "A.4.4"], aia: ["Art. 6", "Art. 25", "Art. 26(8)†"], atlas: ["M0023"], mcsb: ["AI-1"] },
    signals: "Resource Graph Foundry accounts/projects; agents API; owner + risk tier + intake id in agent metadata; agent names seen in traces but not in the inventory.",
  },
  {
    id: "GV-02", domain: "GV", title: "Accountable human sponsor", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Each agent identity has at least one human sponsor and owners, and its continued need is re-attested at least every 12 months.",
    mappings: { asi: ["ASI03", "ASI10", "T9"], rmf: ["GOVERN 2.1", "GOVERN 3.2", "GOVERN 1.5"], iso: ["A.3.2", "A.10.2"], aia: ["Art. 26(2)†", "Art. 14†"] },
    signals: "Graph agentIdentity sponsors (beta) joined on the agent's instance identity.",
    caveat: "Attestation timestamp (lifecycle) schema unverified.",
  },
  {
    id: "GV-03", domain: "GV", title: "Use-case intake and risk tiering", severity: "high", evidence: "partial", scope: ["agent"],
    description: "Before build, each agent purpose is screened against Art. 5 (prohibited) and Annex III (high-risk), classified for Art. 25 provider risk, assigned a risk tier and entered in a risk register.",
    mappings: { asi: ["ASI01"], rmf: ["MAP 1.1", "MAP 1.5", "MAP 2.1", "MAP 3.3", "MG-1.3", "GV-1.3-004"], iso: ["A.9.4", "A.5.2"], aia: ["Art. 5", "Art. 6", "Art. 9†", "Art. 25"] },
    signals: "Risk tier and intake id present in agent governance metadata.",
    attest: "Intake record: purpose, Annex III yes/no, Art. 5 screen, signed residual-risk acceptance.",
  },
  {
    id: "GV-04", domain: "GV", title: "Impact assessment", severity: "high", evidence: "manual", scope: ["agent"],
    description: "An AI impact assessment (ISO/IEC 42005-style; FRIA where Art. 27 applies; DPIA where personal data is processed) is completed before release and refreshed annually.",
    mappings: { rmf: ["MAP 5.1", "MP-5.2"], iso: ["A.5.2", "A.5.3", "A.5.4", "A.5.5"], aia: ["Art. 27†"] },
    signals: "Impact assessment id + date in agent governance metadata (12-month expiry).",
    attest: "IA document link and hash, approver, date.",
  },
  {
    id: "GV-05", domain: "GV", title: "AI literacy and operator training", severity: "medium", evidence: "manual", scope: ["env"],
    description: "Builders, approvers (human-in-the-loop reviewers) and operators complete role-based AI training, including automation-bias and approval-fatigue awareness.",
    mappings: { asi: ["ASI09", "T10"], rmf: ["GOVERN 2.2", "MAP 3.4"], iso: ["A.4.6"], aia: ["Art. 4"], atlas: ["M0018"] },
    signals: "Environment attestation.",
    attest: "LMS export for users holding Foundry roles or approver duties, with completion dates (12-month expiry).",
  },
  {
    id: "GV-06", domain: "GV", title: "Third-party model and tool due diligence", severity: "medium", evidence: "partial", scope: ["env"],
    description: "Model providers, MCP server operators and tool vendors are assessed; transparency notes, model cards and GPAI documentation are retained; contracts cover change notification and data use.",
    mappings: { llm: ["LLM03"], asi: ["ASI04", "T17"], rmf: ["GOVERN 6.1", "GOVERN 6.2", "MAP 4.1", "MAP 4.2", "MANAGE 3.1"], iso: ["A.10.3"], aia: ["Art. 25(4)", "Art. 53"] },
    signals: "Approved-model policy compliance (SC-01) as corroboration.",
    attest: "Vendor file per approved model and per external MCP/OpenAPI endpoint.",
  },
  // ── Identity & access ─────────────────────────────────────────────────────────
  {
    id: "ID-01", domain: "ID", title: "Distinct Entra Agent ID per agent", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Every agent runs under its own Entra agent identity, not the shared project managed identity or keys.",
    mappings: { llm: ["LLM06"], asi: ["ASI03", "T9", "MCP07"], rmf: ["MEASURE 2.7", "MAP 3.3"], iso: ["A.6.2.2"], aia: ["Art. 15(5)†"], atlas: ["M0026", "M0027", "T0091"], mcsb: ["AI-4"] },
    signals: "Agent version instance_identity present (agents API).",
  },
  {
    id: "ID-02", domain: "ID", title: "Entra-only authentication on Foundry accounts", severity: "high", evidence: "auto", scope: ["account"],
    description: "Local (API key) authentication is disabled on Foundry accounts.",
    mappings: { asi: ["ASI03", "MCP01"], rmf: ["MEASURE 2.7"], iso: ["A.4.5"], aia: ["Art. 15(5)†"], atlas: ["T0055", "M0019"] },
    signals: "ARM properties.disableLocalAuth; Azure Policy 71ef260a; Defender recommendation.",
  },
  {
    id: "ID-03", domain: "ID", title: "Least-privilege agent permissions", severity: "high", evidence: "auto", scope: ["agent"],
    description: "No Owner, Contributor or User Access Administrator for agent identities, and no high-privilege Graph application permissions or delegated scopes.",
    mappings: { llm: ["LLM06"], asi: ["ASI03", "T3", "MCP02"], rmf: ["MAP 3.3", "MAP 4.2"], iso: ["A.9.2"], aia: ["Art. 15†"], atlas: ["M0026", "M0028", "T0012"], mcsb: ["AI-4"] },
    signals: "ARM role assignments and Graph app role assignments / delegated grants of the agent's identity.",
  },
  {
    id: "ID-04", domain: "ID", title: "Conditional Access for agent identities", severity: "medium", evidence: "partial", scope: ["env"],
    description: "A Conditional Access policy targets agent identities (blocks high-risk agents, constrains autonomous agents), and agent risk is monitored.",
    mappings: { asi: ["ASI03", "ASI10", "T9"], rmf: ["MEASURE 2.7", "MANAGE 2.4"], aia: ["Art. 15†"], atlas: ["T0091", "M0019"] },
    signals: "Graph conditional access policies (not read yet: needs Policy.Read.All).",
    attest: "Policy name/id and scope.",
    caveat: "Agent-targeting CA property names unverified.",
  },
  {
    id: "ID-05", domain: "ID", title: "No static secrets in tools or instructions", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Connections and tool credentials use Entra rather than API keys, and no credentials appear in agent instructions.",
    mappings: { llm: ["LLM07"], asi: ["ASI03", "MCP01"], rmf: ["MEASURE 2.7"], atlas: ["T0083", "T0098", "T0082", "M0005"] },
    signals: "Secret pattern scan of instructions; OpenAPI tool auth type.",
    caveat: "Connection authType enum unverified; connections not read yet.",
  },
  {
    id: "ID-06", domain: "ID", title: "On-behalf-of user context for user-data tools", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Tools that read or write a user's data execute with the user's delegated token, not the agent's standing privileges.",
    mappings: { llm: ["LLM06"], asi: ["ASI03", "MCP07"], rmf: ["MAP 3.3"], iso: ["A.9.2"], atlas: ["M0027"] },
    signals: "SharePoint/Fabric tools (OBO by design) vs other data tools.",
    attest: "Design attestation listing each tool's identity mode.",
  },
  // ── Network ───────────────────────────────────────────────────────────────────
  {
    id: "NW-01", domain: "NW", title: "Private network isolation", severity: "high", evidence: "auto", scope: ["account"],
    description: "Public network access is disabled or default-deny, with approved private endpoints, for Foundry accounts.",
    mappings: { llm: ["LLM10"], asi: ["ASI05"], rmf: ["MEASURE 2.7"], aia: ["Art. 15(5)†"], atlas: ["T0132", "M0019", "M0032"] },
    signals: "ARM publicNetworkAccess, networkAcls.defaultAction, private endpoint connections; Azure Policy 037eea7a / d6759c02.",
  },
  {
    id: "NW-02", domain: "NW", title: "Egress allowlisting", severity: "medium", evidence: "auto", scope: ["account"],
    description: "Outbound access from the account is restricted to an FQDN allowlist to limit exfiltration through tools.",
    mappings: { llm: ["LLM06"], asi: ["ASI02", "ASI05", "MCP05"], rmf: ["MEASURE 2.7"], aia: ["Art. 15(5)†"], atlas: ["T0086", "T0025", "T0077", "M0032"] },
    signals: "ARM restrictOutboundNetworkAccess + allowedFqdnList.",
    caveat: "Hosted-agent egressPolicy (preview) not read yet.",
  },
  // ── Data protection ───────────────────────────────────────────────────────────
  {
    id: "DP-01", domain: "DP", title: "Customer-managed keys (by data classification)", severity: "medium", evidence: "auto", scope: ["account"],
    description: "Accounts hosting confidential or high-risk agents encrypt data at rest with customer-managed keys.",
    mappings: { llm: ["LLM02"], rmf: ["MEASURE 2.10"], iso: ["A.7.2"], aia: ["Art. 15†"], atlas: ["M0005"] },
    signals: "ARM encryption.keySource == Microsoft.KeyVault; Azure Policy 67121cc7.",
  },
  {
    id: "DP-02", domain: "DP", title: "Customer-governed agent state stores", severity: "medium", evidence: "partial", scope: ["account"],
    description: "Threads, files and vector stores live in customer-owned storage/search/Cosmos resources under the organisation's own access, retention and network controls.",
    mappings: { llm: ["LLM08"], asi: ["ASI06", "MCP10"], rmf: ["MEASURE 2.10"], iso: ["A.7.3"], atlas: ["T0080", "M0031"] },
    signals: "ARM userOwnedStorage / capability hosts (not read yet).",
    attest: "Capability host configuration and storage resources.",
  },
  {
    id: "DP-03", domain: "DP", title: "Sensitive data detection and DLP", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "A PII guardrail is enabled where applicable, Purview data security covers Foundry, and DLP is enforced where user context exists.",
    mappings: { llm: ["LLM02"], asi: ["ASI03"], rmf: ["MEASURE 2.10", "MP-4.1-001", "MS-2.2-002"], iso: ["A.7.4"], aia: ["Art. 26(9)†"] },
    signals: "PII content filter on the agent's guardrail.",
    attest: "Purview DSPM for AI enablement and DLP policy scope.",
    caveat: "PII filter ARM name unverified (preview).",
  },
  {
    id: "DP-04", domain: "DP", title: "Trace content capture governance", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Production agents don't capture prompts and responses in traces unless justified and retention-controlled.",
    mappings: { llm: ["LLM02", "LLM07"], rmf: ["MEASURE 2.10"], iso: ["A.6.2.8", "A.7.4"], aia: ["Art. 12†", "Art. 26(6)†"] },
    signals: "App Insights spans carrying gen_ai.input/output.messages for the agent.",
    attest: "Exemption with justification and retention (attest DP-04@<agent>).",
  },
  {
    id: "DP-05", domain: "DP", title: "Memory and RAG isolation and provenance", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Memory and vector indexes are partitioned, sources are authenticated and curated, outputs aren't re-ingested automatically, and memory can be rolled back.",
    mappings: { llm: ["LLM08", "LLM04"], asi: ["ASI06", "T1", "MCP10"], rmf: ["MG-3.1-001", "MP-4.1"], iso: ["A.7.5"], aia: ["Art. 10†"], atlas: ["T0070", "T0071", "T0080.000", "M0031"] },
    signals: "Knowledge tools present (file search, AI Search, SharePoint, Fabric).",
    attest: "Data-flow attestation: partitioning, ingestion sources, retention, rollback test.",
  },
  // ── Guardrails ────────────────────────────────────────────────────────────────
  {
    id: "GR-01", domain: "GR", title: "Harm-category content filter baseline", severity: "high", evidence: "auto", scope: ["agent"],
    description: "The agent's guardrail has Hate, Sexual, Self-harm and Violence enabled and blocking at Medium or stricter on prompts and completions.",
    mappings: { llm: ["LLM09"], rmf: ["MS-2.6", "MG-2.2-001"], iso: ["A.6.2.6"], aia: ["Art. 15†", "Art. 5"], atlas: ["M0020"], mcsb: ["AI-2"] },
    signals: "Deployment raiPolicyName → raiPolicies contentFilters.",
    caveat: "No documented agent → guardrail field; the model deployment's policy is used.",
  },
  {
    id: "GR-02", domain: "GR", title: "Direct prompt-attack (jailbreak) shield", severity: "high", evidence: "auto", scope: ["agent"],
    description: "The jailbreak classifier is enabled and blocking on user input for every agent.",
    mappings: { llm: ["LLM01"], asi: ["ASI01", "MCP06"], rmf: ["MS-2.7-007", "MS-2.6-007"], iso: ["A.6.2.6"], aia: ["Art. 15(5)†"], atlas: ["T0051.000", "T0054", "M0020"], mcsb: ["AI-2"] },
    signals: "Jailbreak filter on the guardrail; Defender 'detected but not blocked' jailbreak alerts.",
  },
  {
    id: "GR-03", domain: "GR", title: "Indirect prompt-injection scanning", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Tool outputs and retrieved documents are scanned for indirect prompt injection before entering the agent's context.",
    mappings: { llm: ["LLM01"], asi: ["ASI01", "ASI06", "MCP06", "T6"], rmf: ["MS-2.7-007"], aia: ["Art. 15(5)†"], atlas: ["T0051.001", "T0099", "T0110.002", "M0020", "M0030"], mcsb: ["AI-2"] },
    signals: "Indirect-attack filter on the guardrail.",
    caveat: "Tool-response scanning excludes MCP tools: TL-02/TL-03/TL-04 are compensating controls.",
  },
  {
    id: "GR-04", domain: "GR", title: "Tool-call scanning and task adherence", severity: "medium", evidence: "auto", scope: ["agent"],
    description: "Proposed tool calls are scanned before execution, and actions inconsistent with user intent are flagged or blocked.",
    mappings: { llm: ["LLM05"], asi: ["ASI01", "ASI02", "T6"], rmf: ["MEASURE 2.6"], atlas: ["T0053", "M0033", "M0038"], mcsb: ["AI-2"] },
    signals: "Guardrail filters at the PreToolCall intervention point / task adherence.",
    caveat: "Preview; ARM names unverified.",
  },
  {
    id: "GR-05", domain: "GR", title: "Output validation and safe rendering", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Protected-material filters are on for completions, and consuming apps treat model and tool output as untrusted.",
    mappings: { llm: ["LLM05", "LLM09"], asi: ["ASI05", "ASI09"], rmf: ["MEASURE 2.7"], aia: ["Art. 15†"], atlas: ["T0077", "T0050", "M0033"] },
    signals: "Protected material (text/code) filters on completions.",
    attest: "Secure-coding review of output handling in consuming apps.",
  },
  {
    id: "GR-06", domain: "GR", title: "Operational instructions without security reliance", severity: "medium", evidence: "auto", scope: ["agent"],
    description: "Every agent has version-controlled operational instructions including the platform's mandatory safety instructions, with no secrets or authorization logic in them.",
    mappings: { llm: ["LLM07"], asi: ["ASI01"], rmf: ["MAP 2.2"], iso: ["A.6.2.3"], atlas: ["T0056", "T0069", "M0021"], mcsb: ["AI-3"] },
    signals: "Instructions present; mandatory harness injections present; secret scan.",
  },
  // ── Tools & actions ───────────────────────────────────────────────────────────
  {
    id: "TL-01", domain: "TL", title: "Tier-based tool allowlist", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Each agent's tool types fall within the allowlist for its risk tier; open-ended tools (browser automation, code interpreter, A2A, write-capable APIs) need explicit approval.",
    mappings: { llm: ["LLM06"], asi: ["ASI02", "T2"], rmf: ["MAP 3.3", "GV-3.2-003"], iso: ["A.4.4", "A.9.4"], aia: ["Art. 9†"], atlas: ["T0053", "M0028"], mcsb: ["AI-4"] },
    signals: "Agent tool types vs the tier allowlist.",
    attest: "Approval for out-of-tier tools (attest TL-01@<agent>).",
  },
  {
    id: "TL-02", domain: "TL", title: "MCP server governance", severity: "high", evidence: "auto", scope: ["agent"],
    description: "MCP tools point only at registered servers and declare a non-empty allowed-tools list.",
    mappings: { llm: ["LLM03"], asi: ["ASI02", "ASI04", "T16", "MCP09", "MCP02", "MCP03"], rmf: ["MAP 4.2", "MANAGE 3.1"], iso: ["A.10.3"], atlas: ["T0010.005", "M0028"] },
    signals: "MCP server_url host vs approved registry; allowed_tools.",
  },
  {
    id: "TL-03", domain: "TL", title: "Human approval for high-impact actions", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Write, delete, payment and external-communication tools require human approval, with parameters shown; approvals are logged.",
    mappings: { llm: ["LLM06", "LLM01"], asi: ["ASI02", "ASI09", "T10"], rmf: ["MAP 3.5", "GOVERN 3.2"], iso: ["A.9.2"], aia: ["Art. 14(4)(d)†"], atlas: ["M0029"], mcsb: ["AI-5"] },
    signals: "require_approval on write/privileged tools (MCP, OpenAPI, functions).",
  },
  {
    id: "TL-04", domain: "TL", title: "Tool definition pinning (anti rug-pull)", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "MCP and OpenAPI tool definitions are hashed at approval time and any change triggers re-review before use.",
    mappings: { llm: ["LLM03"], asi: ["ASI04", "T17", "MCP03", "MCP04"], rmf: ["MAP 4.2", "MG-3.1-002"], iso: ["A.6.2.5"], atlas: ["T0110.000", "T0110.001", "T0109", "M0014"] },
    signals: "No native Azure signal.",
    attest: "Tool definition hash and re-approval record (attest TL-04@<agent>).",
  },
  {
    id: "TL-05", domain: "TL", title: "Sandboxed code execution", severity: "high", evidence: "partial", scope: ["agent"],
    description: "Generated code runs only in an isolated sandbox (Foundry code interpreter or isolated hosting), never with production write paths.",
    mappings: { llm: ["LLM05"], asi: ["ASI05", "T11", "MCP05"], rmf: ["MEASURE 2.7"], aia: ["Art. 15(4)†", "Art. 15(5)†"], atlas: ["T0105", "T0102", "M0032"] },
    signals: "code_interpreter (platform sandbox) vs custom execution tools.",
    attest: "Architecture attestation for custom execution tools.",
  },
  {
    id: "TL-06", domain: "TL", title: "Action and cost budgets", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Per-agent limits on tool calls per run, run time, tokens and spend, with rate limits and wallet-abuse detection.",
    mappings: { llm: ["LLM10"], asi: ["ASI02", "ASI08", "T4"], rmf: ["MANAGE 2.2"], atlas: ["T0034.002", "T0029", "M0036", "M0004"] },
    signals: "agentctl.max_tool_calls metadata; deployment capacity (TPM); Defender wallet alerts.",
    attest: "Runtime enforcement point (agent host / APIM policy).",
  },
  {
    id: "TL-07", domain: "TL", title: "Authorization outside the model (complete mediation)", severity: "high", evidence: "manual", scope: ["agent"],
    description: "Every tool backend enforces its own authorization on the calling identity; the model never decides access.",
    mappings: { llm: ["LLM06", "LLM07"], asi: ["ASI02", "ASI03", "ASI08"], rmf: ["MAP 4.2"], iso: ["A.6.2.2"], atlas: ["M0032", "M0033"] },
    signals: "Applies to agents with write-capable tools.",
    attest: "Per tool: authorization enforcement point, scopes checked, policy reference.",
  },
  {
    id: "TL-08", domain: "TL", title: "Inter-agent communication controls", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Connected/A2A agents authenticate with Entra, delegation doesn't transitively inherit privilege, and targets are registered agents.",
    mappings: { asi: ["ASI07", "ASI08", "T12", "T14", "T16"], rmf: ["MAP 4.2"], atlas: ["T0118", "M0032"] },
    signals: "Connected-agent tools resolve to agents in the inventory.",
    attest: "Delegation design (attest TL-08@<agent>).",
  },
  // ── Monitoring ────────────────────────────────────────────────────────────────
  {
    id: "MO-01", domain: "MO", title: "Platform diagnostic logging", severity: "high", evidence: "auto", scope: ["account"],
    description: "Foundry accounts send audit, request and trace logs to Log Analytics.",
    mappings: { llm: ["LLM06"], asi: ["ASI10", "T8", "MCP08"], rmf: ["MEASURE 2.4", "MANAGE 4.1"], iso: ["A.6.2.8"], aia: ["Art. 12†", "Art. 26(5)†"], atlas: ["M0024"], mcsb: ["AI-6"] },
    signals: "Diagnostic settings on the account → the agentctl workspace; Azure Policy 1b4d1c4e.",
  },
  {
    id: "MO-02", domain: "MO", title: "Agent tracing", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Every production agent emits OpenTelemetry GenAI spans to the App Insights resource connected to its project.",
    mappings: { asi: ["ASI10", "T8", "MCP08"], llm: ["LLM06"], rmf: ["MEASURE 2.4", "MEASURE 2.9"], iso: ["A.6.2.6", "A.6.2.8"], aia: ["Art. 12†"], atlas: ["M0024"], mcsb: ["AI-6"] },
    signals: "Runs for the agent in App Insights over the last 30 days.",
  },
  {
    id: "MO-03", domain: "MO", title: "Independent corroboration of agent activity", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Agent-reported traces are reconciled against platform records of what the identity actually did (sign-ins, Graph and ARM calls).",
    mappings: { asi: ["ASI10", "T8"], rmf: ["MEASURE 2.4", "MEASURE 3.1"], iso: ["A.6.2.6"], aia: ["Art. 12†"], atlas: ["M0024", "M0038"] },
    signals: "Entra sign-in and Graph activity logs for the agent identity (needs Entra diagnostic export, P1/P2).",
    attest: "Reconciliation query / SIEM rule reference.",
  },
  {
    id: "MO-04", domain: "MO", title: "Defender AI threat protection", severity: "high", evidence: "auto", scope: ["env"],
    description: "The Defender for AI Services plan is on and AI posture recommendations are tracked to healthy.",
    mappings: { llm: ["LLM01", "LLM10"], asi: ["ASI01", "ASI02"], rmf: ["MS-2.7-004", "MEASURE 3.1"], iso: ["A.6.2.6"], aia: ["Art. 15†"], atlas: ["M0024", "M0020"], mcsb: ["AI-6"] },
    signals: "Microsoft.Security/pricings 'AI' tier; Defender assessments for AI resources.",
  },
  {
    id: "MO-05", domain: "MO", title: "AI alert routing and triage", severity: "medium", evidence: "partial", scope: ["env"],
    description: "AI alerts and content-safety signals flow to the SOC (Defender XDR/Sentinel) with owners and playbooks.",
    mappings: { asi: ["ASI02", "ASI10"], rmf: ["MANAGE 2.3", "MEASURE 3.1"], iso: ["A.6.2.6"], aia: ["Art. 26(5)†"], atlas: ["M0024"] },
    signals: "Defender AI alerts present and visible.",
    attest: "Triage runbook and routing rule.",
  },
  {
    id: "MO-06", domain: "MO", title: "Tamper-evident log retention ≥ 6 months", severity: "medium", evidence: "partial", scope: ["env"],
    description: "Agent and platform logs are retained for at least 180 days, with an immutable copy.",
    mappings: { llm: ["LLM08"], asi: ["ASI10", "T8", "MCP08"], rmf: ["GV-1.5-003"], iso: ["A.6.2.8"], aia: ["Art. 19†", "Art. 26(6)†"] },
    signals: "Workspace retention (not read yet).",
    attest: "Retention setting and immutable export.",
  },
  // ── Supply chain ──────────────────────────────────────────────────────────────
  {
    id: "SC-01", domain: "SC", title: "Approved models only", severity: "high", evidence: "auto", scope: ["env"],
    description: "Deployments use allowlisted models and versions; unvetted models are barred from production by policy.",
    mappings: { llm: ["LLM03"], asi: ["ASI04"], rmf: ["MANAGE 3.2", "MG-3.1-003"], iso: ["A.10.3", "A.4.4"], aia: ["Art. 25†"], atlas: ["T0010.003", "M0014"], mcsb: ["AI-1"] },
    signals: "Azure Policy 'approved models' (aafe3651) / model eligibility (8791d062) compliance.",
  },
  {
    id: "SC-02", domain: "SC", title: "Change control for agent definitions", severity: "high", evidence: "auto", scope: ["agent"],
    description: "Agent definitions are managed in GitOps with review, and model versions are pinned.",
    mappings: { llm: ["LLM03"], asi: ["ASI04", "T17"], rmf: ["MG-3.1-003", "GOVERN 1.4"], iso: ["A.6.2.5"], aia: ["Art. 25(1)(b)†"] },
    signals: "agentctl.manifest_sha256 on the live version (deployed via the pipeline); deployment model version.",
  },
  {
    id: "SC-03", domain: "SC", title: "Agent bill of materials", severity: "low", evidence: "auto", scope: ["agent"],
    description: "Each agent version has a generated AI bill of materials: model, tools, MCP endpoints, instruction hash, guardrail, knowledge sources.",
    mappings: { llm: ["LLM03"], asi: ["ASI04", "ASI10", "T17"], rmf: ["GV-1.6-003", "MAP 4.1"], iso: ["A.4.2", "A.6.2.7"], aia: ["Art. 11†"], atlas: ["M0023"] },
    signals: "Generated by agentctl from live state (export on the controls page).",
  },
  // ── Testing & evaluation ──────────────────────────────────────────────────────
  {
    id: "TE-01", domain: "TE", title: "Agent threat model", severity: "medium", evidence: "manual", scope: ["agent"],
    description: "Medium- and high-tier agents have a threat model (OWASP ASI / MAESTRO based) reviewed on material change.",
    mappings: { asi: ["ASI01", "ASI02", "ASI03", "ASI04", "ASI05", "ASI06", "ASI07", "ASI08", "ASI09", "ASI10"], rmf: ["MAP 4.1", "MAP 5.1"], iso: ["A.6.1.3"], aia: ["Art. 9(2)†"] },
    signals: "Threat model id + date in agent governance metadata.",
    attest: "Threat model link, reviewer, date.",
  },
  {
    id: "TE-02", domain: "TE", title: "Pre-release evaluation", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Quality, safety and agent evaluators (tool-call accuracy, intent resolution, task adherence) pass release criteria before publishing.",
    mappings: { llm: ["LLM09"], asi: ["ASI08"], rmf: ["MEASURE 2.3", "MEASURE 2.5", "MAP 2.3"], iso: ["A.6.2.4"], aia: ["Art. 9(6)†", "Art. 15(1)†"] },
    signals: "Evaluation run id + date in agent governance metadata (180-day freshness).",
    attest: "Release-criteria sign-off.",
  },
  {
    id: "TE-03", domain: "TE", title: "Adversarial and red-team testing", severity: "high", evidence: "partial", scope: ["agent"],
    description: "Direct and indirect prompt injection, tool misuse and exfiltration are tested before release and periodically (90 days for high tier).",
    mappings: { llm: ["LLM01"], asi: ["ASI01", "ASI02", "ASI06"], rmf: ["MS-2.7-007", "MEASURE 1.3"], iso: ["A.6.2.4"], aia: ["Art. 15(5)†"], atlas: ["M0035"], mcsb: ["AI-7"] },
    signals: "Red-team run id + date in agent governance metadata (AI Red Teaming Agent / PyRIT).",
    attest: "Report and remediation tracking.",
  },
  // ── Incident & oversight ──────────────────────────────────────────────────────
  {
    id: "IR-01", domain: "IR", title: "Kill switch with tested deactivation", severity: "high", evidence: "partial", scope: ["agent"],
    description: "Defined criteria trigger immediate disablement of the agent and its identity; drills are run and recorded.",
    mappings: { asi: ["ASI10", "ASI08", "T13"], rmf: ["MANAGE 2.4", "GV-1.7-001", "MG-2.4-002"], iso: ["A.6.2.6"], aia: ["Art. 14(4)(e)†", "Art. 26(5)†"], atlas: ["M0029"] },
    signals: "Kill-switch drill date in agent governance metadata (180 days high tier, 365 otherwise).",
    attest: "Deactivation criteria and drill record.",
  },
  {
    id: "IR-02", domain: "IR", title: "AI incident response and reporting", severity: "medium", evidence: "partial", scope: ["env"],
    description: "The IR plan covers agent incidents, uses a minimum incident schema, notifies providers and meets Art. 73 clocks where applicable.",
    mappings: { asi: ["ASI10", "MCP08"], rmf: ["MANAGE 4.3", "MANAGE 2.3", "GV-4.3-002"], iso: ["A.8.4", "A.3.3"], aia: ["Art. 26(5)†", "Art. 73†"] },
    signals: "Defender AI alerts routed (MO-05) as corroboration.",
    attest: "IR plan and tabletop record (12-month expiry).",
  },
  {
    id: "IR-03", domain: "IR", title: "Decommissioning without orphans", severity: "medium", evidence: "auto", scope: ["env"],
    description: "Retired agents have identities removed and access revoked; no orphaned agent identities or ownerless agents remain.",
    mappings: { asi: ["ASI03", "ASI10", "MCP02"], rmf: ["GOVERN 1.7", "MG-2.4-001"], iso: ["A.6.2.6"] },
    signals: "Agent identities without a Foundry agent; agents without owners.",
  },
  // ── Transparency ──────────────────────────────────────────────────────────────
  {
    id: "TR-01", domain: "TR", title: "AI interaction disclosure", severity: "medium", evidence: "partial", scope: ["agent"],
    description: "Agents that interact with people disclose that they are AI; synthetic media is marked machine-readably.",
    mappings: { asi: ["ASI09"], rmf: ["GV-3.2-003", "MEASURE 2.8"], iso: ["A.8.2"], aia: ["Art. 50(1)", "Art. 50(2)", "Art. 50(4)"] },
    signals: "userFacing + disclosure link in governance metadata; identity-disclosure harness instruction.",
    attest: "Screenshot/transcript of the disclosure.",
  },
  {
    id: "TR-02", domain: "TR", title: "User information, feedback and appeal", severity: "low", evidence: "manual", scope: ["agent"],
    description: "Users get instructions, limitations and a channel to report problems or contest outcomes.",
    mappings: { asi: ["ASI09"], llm: ["LLM09"], rmf: ["MEASURE 3.3", "GOVERN 5.1", "MAP 2.2"], iso: ["A.8.2", "A.8.5"], aia: ["Art. 13†", "Art. 26(11)†"] },
    signals: "Applies to user-facing agents.",
    attest: "User notice link, feedback mechanism, appeal owner (attest TR-02@<agent>).",
  },
];

export const CONTROL_BY_ID = new Map(CONTROLS.map((c) => [c.id, c]));
