# AI risk controls

agentctl evaluates **50 AI risk controls in 11 domains** against your Azure environment, every
Foundry account and every agent. Each control is cross-walked to seven frameworks. Results appear
under **Risk & compliance** and in each agent's **Compliance** tab.

- **Research and sources:** [`reports/AI risk frameworks controls crosswalk.md`]({{ repo_url }}/blob/main/reports/AI%20risk%20frameworks%20controls%20crosswalk.md), with the notes in `research_notes/`.
- **Code:** `app/src/controls/`:
  - `catalog.ts`: controls and mappings;
  - `frameworks.ts`: framework registry;
  - `evaluate.ts`: evaluators;
  - `useCompliance.ts`: evidence collection.

## Frameworks

| Framework | Version | Binding | Used for |
|---|---|---|---|
| OWASP Top 10 for LLM Applications | 2025 | no | LLM-level threats (LLM01–LLM10) |
| OWASP Top 10 for Agentic Applications | 2026 | no | Agent threats (ASI01–ASI10), plus T-ids and MCP Top 10 ids as refinements |
| NIST AI RMF 1.0 + AI 600-1 GenAI Profile | 1.0 / 2024 | no | Governance spine (Govern / Map / Measure / Manage) |
| ISO/IEC 42001:2023 Annex A | 2023 | no (certifiable) | Management-system controls |
| EU AI Act (2024/1689, amended by 2026/1744) | 2026 | **yes** | Arts. 4, 5, 25 and 50 apply now; high-risk duties (†) from 2 Dec 2027 (Annex III) |
| MITRE ATLAS | v2026.09 | no | Adversary techniques and mitigations |
| Microsoft Cloud Security Benchmark v2: AI | preview | no | Azure-native control language (AI-1 to AI-7) |

**Every OWASP LLM and Agentic Top 10 item maps to at least one control.** A unit test enforces this.

## Domains

| Prefix | Domain | Examples |
|---|---|---|
| GV | Governance | inventory, sponsors, intake, impact assessment |
| ID | Identity & access | Entra Agent ID per agent, no local auth, least privilege |
| NW | Network | private isolation, egress allowlist |
| DP | Data protection | CMK, trace content capture, DLP, RAG isolation |
| GR | Guardrails | harm filters, jailbreak, indirect injection, tool-call scanning |
| TL | Tools & actions | tier allowlist, MCP governance, human approval, sandboxing |
| MO | Monitoring | diagnostics, tracing, Defender for AI, alert routing |
| SC | Supply chain | approved models, GitOps change control, AI bill of materials |
| TE | Testing & evaluation | threat model, evaluation, red teaming |
| IR | Incident & oversight | kill switch, incident response, orphan detection |
| TR | Transparency | AI-interaction disclosure, user notice |

## How a control is evaluated

| Evidence type | Meaning | Count |
|---|---|---|
| Automated | Fully decided from Azure state | 25 |
| Partial | An automated signal plus a human sign-off for the rest | 20 |
| Attestation | Sign-off only (e.g. impact assessment, training) | 5 |

Results per target:

| Status | Meaning |
|---|---|
| Pass | Evidence satisfies the control (or a current sign-off covers it) |
| Fail | Evidence contradicts the control |
| Warning | Partially met, preview-only, or risk accepted |
| Needs sign-off | A human attestation is missing |
| Unknown | The evidence source isn't readable with your access |
| N/A | The control doesn't apply (e.g. no MCP tools) |

**Score** = (pass + ½ warning) ÷ (pass + warning + fail + needs sign-off). Unknown and N/A are excluded.

**Evidence sources**, all read with the signed-in user's token:

| Source | Used by |
|---|---|
| Foundry agents API (definition, tools, `require_approval`, `allowed_tools`, instance identity, metadata) | ID, GR-06, TL, SC-02 |
| ARM / Resource Graph (accounts: `disableLocalAuth`, network, CMK, outbound; deployments; RAI policies; diagnostic settings) | ID-02, NW, DP-01, GR, MO-01 |
| Defender for Cloud (`pricings` AI tier; AI alerts and recommendations via Resource Graph) | MO-04, MO-05, GR-02 |
| Entra Agent ID (Graph beta; sponsors) | GV-02, IR-03 |
| Azure RBAC + Graph grants | ID-03 |
| App Insights traces (runs, content capture) | MO-02, DP-04, GV-01 shadow agents |
| Azure Policy states (approved-model policy) | SC-01 |

## Sign-offs (attestations)

There are two places to record human judgement. Both are reviewed changes, not UI toggles.

1. **Per agent:** `spec.governance` in the agent manifest, set in the builder's **Risk & governance** step or the Harness page.
   - Fields: risk tier, intake id, impact assessment, threat model, evaluation, red team, kill-switch drill (each an id plus a date), user-facing, disclosure link.
   - It is deployed as the `agentctl.governance` metadata value on the agent version, so **a new version without fresh evidence shows up as stale**.
   - Freshness limits:
     - impact assessment: 365 days;
     - evaluation: 180 days;
     - red team: 90 days for high tier, 365 for medium;
     - kill-switch drill: 180 days for high tier, 365 otherwise;
     - threat model: 365 days.
   - Lowering an agent's risk tier is a **write-tier change** in the change request, so reviewers see it.
2. **Environment-wide, or per agent/account for one control:** Terraform `control_attestations` (→ `AGENTCTL_ATTESTATIONS`). For example:
   ```hcl
   control_attestations = {
     "GV-05"            = { status = "attested", evidence = "https://lms…/ai-literacy", owner = "platform-security", date = "2026-09-01", expires = "2027-09-01" }
     "TL-04@crm-writer" = { status = "attested", evidence = "tool hash a1b2… approved CR-88", owner = "sam.okafor@contoso.com", date = "2026-10-01", expires = "2027-04-01" }
     "DP-04@hr-bot"     = { status = "risk_accepted", evidence = "pilot debugging, 30-day retention", owner = "…", date = "2026-10-10", expires = "2026-11-10" }
   }
   approved_mcp_hosts = ["mcp-d365.contoso.com"]   # TL-02 registry
   ```
   - `attested` turns *needs sign-off* into pass, `risk_accepted` into warning, and `not_applicable` into N/A.
   - Expired sign-offs don't count.
   - **A sign-off never overrides a failing automated check.** For example, "approval enforced" while `require_approval = never` stays failed, with a note.

## Using the results

- **Overview:** score per framework and per domain.
- **Controls:** filter by domain or status; click a control for its description, mappings, and the evidence for every target.
- **Frameworks:** each framework item (e.g. ASI02, Art. 14, AI-5) with its mapped controls and their worst status. Items no control covers are flagged.
- **Agents:** score and per-domain status per agent, with the account controls of the account it runs on.
- **Agent → Compliance tab:** that agent's results, plus an **AI bill of materials** (CycloneDX 1.6) download.
- **Export evidence:** JSON evidence pack (catalog, mappings, results) or CSV, for auditors or a GRC import.
- **Fixing:** most agent failures (approval, mandatory instructions, guardrails) are fixed through **Harness injection** → bundle → GitOps; account and environment failures through Terraform or Azure Policy.

## Known limits

These come from the research's open items; each is shown as a caveat on the control.

- **No documented field links an agent to its guardrail.** Guardrail checks use the agent's model deployment policy. An agent-level guardrail would replace it, which agentctl can't see yet.
- **Tool-call and tool-response guardrails (preview) don't cover MCP tools.** For MCP agents, GR-03 shows a warning and TL-02/TL-03/TL-04 are the compensating controls.
- **Preview filter names** (indirect attack, PII, task adherence) are matched by pattern, case-insensitively.
- **Not read yet:** Conditional Access for agents (ID-04), capability-host storage (DP-02), workspace retention (MO-06), project connection auth types (ID-05). These are sign-offs until wired.
- **Client-executed function tools:** approval is enforced by the calling app, so TL-03 asks for a sign-off.
- **Framework versions move** (ATLAS monthly, AI RMF under revision, MCP Top 10 in beta). Versions are stored in `frameworks.ts`; re-check the mappings when they change.
