# LLM & Agentic AI Threat Taxonomies: OWASP LLM Top 10 2025, OWASP Agentic (T1–T17, ASI Top 10 2026), OWASP MCP, MITRE ATLAS

Research date: 2026-10-17. Primary sources were read directly: OWASP GitHub markdown, the OWASP PDFs (downloaded and converted to text), and the MITRE ATLAS data file `ATLAS-2026.09.yaml`, which was parsed programmatically. Abbreviations used below: GH-LLM = https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/ ; ASI-PDF = https://genai.owasp.org/download/52117/?tmstv=1765059207 ; TM-PDF = https://genai.owasp.org/download/45674/?tmstv=1739819891 ; ATLAS-DATA = https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/v6/ATLAS-2026.09.yaml

## Q1. OWASP Top 10 for LLM Applications 2025: LLM01–LLM10 names and key mitigations

### Takeaway
The 2025 list is still the current LLM list. Its IDs and names are LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation and LLM10 Unbounded Consumption. Agent-relevant mitigations keep repeating the same few ideas. Keep authorization deterministic and outside the LLM ("complete mediation"). Apply least privilege to tools. Require a human to approve high-impact actions. Treat model output as untrusted input. Segregate untrusted content.

### Cited Findings
- **Canonical IDs and names** come from the file headers, e.g. "## LLM01:2025 Prompt Injection" … "## LLM10:2025 Unbounded Consumption" — [GH-LLM directory](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/tree/main/2_0_vulns). Official landing page: [genai.owasp.org/llm-top-10](https://genai.owasp.org/llm-top-10/). It returned HTTP 403 to automated fetches, so the GitHub source of truth was used instead.
- **LLM01:2025 Prompt Injection**: "occurs when user prompts alter the LLM's behavior or output in unintended ways". Injected input need not be human-visible. OWASP states "it is unclear if there are fool-proof methods of prevention". Its seven mitigations:
  1. Constrain model behavior through the system prompt.
  2. Define expected output formats and validate them with deterministic code.
  3. Filter input and output (semantic filters, the RAG Triad).
  4. Enforce least privilege, giving the app its own API tokens and handling functions "in code rather than providing them to the model".
  5. Require human approval for high-risk actions.
  6. Segregate and identify external content.
  7. Run adversarial testing that treats the model as an untrusted user.
  — [LLM01](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM01_PromptInjection.md)
- **LLM02:2025 Sensitive Information Disclosure**: PII, financial, health, business and credential data leaking through the LLM or its application context. Mitigations:
  - Data sanitization (scrub or mask before training) and robust input validation.
  - Strict least-privilege access controls; restrict the model's data sources and secure runtime data orchestration.
  - Federated learning and differential privacy.
  - User education and transparency about data retention and opt-out.
  - "Conceal system preamble" and follow OWASP API8:2023 Security Misconfiguration.
  - Homomorphic encryption; tokenization and redaction.
  — [LLM02](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM02_SensitiveInformationDisclosure.md)
- **LLM03:2025 Supply Chain**: risks to the integrity of training data, models and deployment platforms, including third-party models, LoRA adapters and licensing. Mitigations:
  - Vet suppliers and their terms and conditions.
  - Apply the OWASP A06 vulnerable/outdated-components controls.
  - Red-team and evaluate third-party models.
  - Keep a signed SBOM (and AI/ML BOM).
  - Inventory and audit licenses.
  - Use only models from verifiable sources, with signing and file hashes; code-sign externally supplied code.
  - Monitor collaborative model-development environments.
  - Run anomaly detection and adversarial robustness tests.
  - Maintain a patching policy.
  - For edge models, encrypt them with integrity checks and use vendor attestation.
  — [LLM03](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM03_SupplyChain.md)
- **LLM04:2025 Data and Model Poisoning**: manipulation of pre-training, fine-tuning or embedding data that introduces backdoors or bias. Mitigations:
  - Track data provenance (OWASP CycloneDX / ML-BOM) and run dynamic analysis of third-party software (e.g. Dyana).
  - Vet data vendors.
  - Sandbox the model's exposure to unverified data; use anomaly detection.
  - Version data with data version control (DVC).
  - Store user-supplied information in a vector database rather than retraining.
  - Red-team the model; monitor training loss.
  - Use RAG and grounding at inference time.
  — [LLM04](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM04_DataModelPoisoning.md)
- **LLM05:2025 Improper Output Handling**: "insufficient validation, sanitization, and handling of the outputs generated by large language models before they are passed downstream". Mitigations:
  - "Treat the model as any other user, adopting a zero-trust approach."
  - Follow OWASP ASVS validation guidance.
  - Encode output with context-aware encoding (HTML, SQL and so on).
  - Use parameterized queries.
  - Apply a strict CSP.
  - Log and monitor for anomalous outputs.
  — [LLM05](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM05_ImproperOutputHandling.md)
- **LLM06:2025 Excessive Agency**: damaging actions caused by excessive functionality, permissions or autonomy in the extensions (tools, skills or plugins) an LLM can call. Mitigations:
  1. Minimize extensions.
  2. Minimize extension functionality.
  3. Avoid open-ended extensions such as shell or fetch-URL.
  4. Minimize extension permissions.
  5. Execute extensions in the user's context, with the user's authorization scope.
  6. Require user approval for high-impact actions.
  7. Enforce complete mediation, i.e. "Implement authorization in downstream systems rather than relying on an LLM to decide if an action is allowed".
  8. Sanitize LLM inputs and outputs (ASVS, SAST/DAST/IAST).
  OWASP adds two damage-limiting measures: log and monitor extension activity, and rate-limit actions. — [LLM06](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM06_ExcessiveAgency.md)
- **LLM07:2025 System Prompt Leakage**: system prompts may contain sensitive information that was not meant to be discovered. Mitigations:
  1. Keep sensitive data (API keys, DB names, roles, permission structure) out of system prompts.
  2. Don't rely on the system prompt for strict behavior control.
  3. Put guardrails outside the LLM.
  4. "Critical controls such as privilege separation, authorization bounds checks … must not be delegated to the LLM."
  — [LLM07](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM07_SystemPromptLeakage.md)
- **LLM08:2025 Vector and Embedding Weaknesses**: weaknesses in how RAG vectors and embeddings are generated, stored or retrieved. Examples include cross-tenant access, embedding inversion and poisoning. Mitigations:
  1. Fine-grained, permission-aware vector stores with logical and access partitioning between user groups or tenants.
  2. Data validation and source authentication; audit the knowledge base for hidden content and poisoning.
  3. Review and classify combined data.
  4. Keep detailed immutable logs of retrieval activity.
  — [LLM08](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM08_VectorAndEmbeddingWeaknesses.md)
- **LLM09:2025 Misinformation**: false but credible output, including hallucinated packages or code. Mitigations:
  - RAG; fine-tuning.
  - Cross-verification and human oversight; automatic validation of high-stakes outputs.
  - Risk communication.
  - Secure coding practices.
  - UI design that labels AI content.
  - User training.
  — [LLM09](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM09_Misinformation.md)
- **LLM10:2025 Unbounded Consumption**: excessive, uncontrolled inference that leads to denial of service, "denial of wallet" or model extraction. Its 15 mitigations:
  - Input size validation.
  - Limit exposure of logits and logprobs.
  - Rate limiting and per-user quotas.
  - Dynamic resource allocation management.
  - Timeouts and throttling.
  - Sandboxing, i.e. restricting the LLM's access to network, internal services and APIs.
  - Logging, monitoring and anomaly detection.
  - Watermarking.
  - Graceful degradation.
  - "Limit queued actions and total actions".
  - Adversarial robustness training.
  - Glitch-token filtering.
  - RBAC and least privilege.
  - A centralized model inventory.
  - Automated MLOps with approval workflows.
  — [LLM10](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM10_UnboundedConsumption.md)

### Inferences
- For tool-using agents on Foundry (function calling, OpenAPI, MCP, code interpreter, browser), the LLM-list controls that matter most are:
  - LLM06 #5 and #7: on-behalf-of user context and authorization enforced in the downstream API.
  - LLM01 #4–6.
  - LLM05: tool arguments are model output, so validate them like any other untrusted input.
  - LLM07 #4: never put secrets or authorization logic in instructions.
  - LLM10 "limit queued/total actions", which corresponds to agent step and tool-call budgets.
- Most data-poisoning and training-focused mitigations (federated learning, homomorphic encryption, training-loss monitoring) do little for teams that consume hosted models. Their relevance shifts to RAG and memory stores (LLM08).

### Gaps
- The official 2025 release date could not be re-verified from a primary page (genai.owasp.org blocked the fetch). From prior knowledge, the 2025 list was published in November 2024; treat this as unverified.
- I found no evidence of a newer LLM Top 10 edition (for example 2026) as of October 2026.

## Q2. OWASP GenAI agentic guidance: Agentic AI Threats & Mitigations (T-IDs), Top 10 for Agentic Applications (ASI01–ASI10), Securing Agentic Applications Guide

### Takeaway
There are two related OWASP agentic taxonomies.
- **Agentic AI – Threats and Mitigations** (the Agentic Security Initiative's threat model). v1.0 was released on 17 Feb 2025 with T1–T15. The current download is v1.1 (December 2025), which adds T16 Insecure Inter-Agent Protocol Abuse and T17 Supply Chain Compromise and organizes mitigations into six playbooks.
- **OWASP Top 10 for Agentic Applications for 2026**, published 9 Dec 2025, with IDs ASI01–ASI10 in the form "ASI01:2026". Appendix A maps each ASI entry to LLM Top 10 IDs and T-IDs.

### Cited Findings: Agentic AI – Threats and Mitigations
- **Versions:**
  - The resource page lists v1.0, dated 17 Feb 2025 — [OWASP resource page](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/).
  - The PDF served from that page's download link today is "Version 1.1, December 2025" (PDF metadata: "FINAL DRAFT__Agentic AI - Threats and Mitigations 1.1", created 6 Dec 2025, 53 pages) — [TM-PDF](https://genai.owasp.org/download/45674/?tmstv=1739819891).
- **Threat table (TID, name, one-line description, mitigations)**, all from [TM-PDF](https://genai.owasp.org/download/45674/?tmstv=1739819891), pp. 15–18:
  - **T1 Memory Poisoning**: malicious or false data introduced into short- or long-term memory to alter decisions. *Mitigations:* memory content validation, session isolation, authenticated memory access, anomaly detection, regular memory sanitization, and AI-generated memory snapshots for forensics and rollback.
  - **T2 Tool Misuse**: deceptive prompts manipulate an agent into abusing tools *within authorized permissions*; this includes agent hijacking via ingested adversarial data. *Mitigations:* strict tool access verification and pre-execution validation, tool rate limiting, usage-pattern monitoring, validated instructions, operational boundaries, and execution logs of tool calls.
  - **T3 Privilege Compromise**: weaknesses in permission management, such as dynamic role inheritance or misconfiguration, are exploited. *Mitigations:* granular permissions, dynamic access validation, monitoring of role changes, and auditing of elevated operations. "Prevent cross-agent privilege delegation unless explicitly authorized through predefined workflows."
  - **T4 Resource Overload**: compute, memory or service capacity is exhausted. *Mitigations:* resource management, adaptive scaling, quotas, real-time load monitoring, and per-agent-session rate limits.
  - **T5 Cascading Hallucination Attacks**: plausible false information propagates across systems and can drive destructive tool invocation. *Mitigations:* output validation, behavioral constraints, multi-source validation, feedback loops, and secondary validation before critical decisions.
  - **T6 Intent Breaking & Goal Manipulation**: the agent's planning and goals are manipulated (agent hijacking). *Mitigations:* planning validation frameworks, boundary management for reflection, goal-alignment protection, and a second model that audits behavior and flags goal deviation.
  - **T7 Misaligned & Deceptive Behaviors**: harmful actions from deceptive reasoning or misinterpreted goals, without direct malicious input. *Mitigations:* refusal training, policy restrictions, human confirmation for high-risk actions, logging, deception detection (behavioral consistency, truthfulness verification), and red teaming.
  - **T8 Repudiation & Untraceability**: agent actions cannot be traced because logging or transparency is insufficient. *Mitigations:* comprehensive logging, cryptographic verification, enriched metadata, real-time monitoring, and logs that are "cryptographically signed and immutable".
  - **T9 Identity Spoofing & Impersonation / Agent Identity Compromise**: agents or users are impersonated. v1.1 explicitly includes theft or misuse of "a formal, persistent agent identity (e.g., Microsoft Entra Agent ID)" that gives long-term API access bypassing the conversational interface and its guardrails. *Mitigations:* identity validation frameworks, trust boundaries, least privilege, continuous monitoring, and behavioral profiling by a second model.
  - **T10 Overwhelming Human in the Loop**: human reviewers' cognitive limits are exploited. *Mitigations:* adaptive trust and dynamic intervention thresholds based on risk; low-risk decisions automated and human attention reserved for high-risk anomalies.
  - **T11 Unexpected RCE and Code Attacks**: AI-generated execution environments are exploited. *Mitigations:* restricted code-generation permissions, sandboxed execution, monitoring of generated scripts, and manual review of AI-generated code that has elevated privileges.
  - **T12 Agent Communication Poisoning**: inter-agent channels are manipulated. *Mitigations:* cryptographic message authentication, communication validation policies, monitoring of inter-agent anomalies, and multi-agent consensus for critical decisions.
  - **T13 Rogue Agents in Multi-Agent Systems**: compromised agents operate outside monitoring, including "infectious backdoors". *Mitigations:* policy constraints on autonomy, behavioral monitoring, controlled hosting, red teaming, and I/O monitoring.
  - **T14 Human Attacks on Multi-Agent Systems**: inter-agent delegation and trust are exploited to escalate privileges. *Mitigations:* restricted delegation, inter-agent authentication, behavioral monitoring, and multi-agent task segmentation.
  - **T15 Human Manipulation**: trust is exploited to coerce agents into manipulating users. *Mitigations:* role-aligned behavioral monitoring, restricted tool access, "limit the agent's ability to print links", and guardrail or moderation filtering.
  - **T16 Insecure Inter-Agent Protocol Abuse** (new in v1.1): flaws in protocols such as **MCP or A2A** (consent bypass, context hijacking). *Mitigations:* strong inter-agent authentication; sanitizing protocol data, including context payloads and **tool metadata**; scoping delegation tightly; logging all inter-agent communications and tool invocations; encrypting against adversary-in-the-middle attacks.
  - **T17 Supply Chain Compromise** (new in v1.1): malicious components arriving via models, libraries, tools or build environments. *Mitigations:* signed artifacts, verifiable SBOMs/AIBOMs/agent SBOMs, version control with peer review, supply-chain authentication, restrictions on untrusted tool installs, sandboxing, drift monitoring, and supply-chain red teaming.
- **The six mitigation playbooks and the threats each covers** — [TM-PDF](https://genai.owasp.org/download/45674/?tmstv=1739819891), pp. 33–34:
  1. Preventing AI agent reasoning manipulation (T6, T8, T7).
  2. Preventing memory poisoning and AI knowledge corruption (T1, T5).
  3. Securing AI tool execution and preventing unauthorized actions across supply chains (T2, T3, T11, T4, T16, T17).
  4. Strengthening authentication, identity and privilege controls (T3, T9, T16).
  5. Protecting HITL and preventing threats rooted in human interaction (T10, T15).
  6. Securing multi-agent communication and trust mechanisms (T12, T14, T13).
- **Scope:** the T&M document explicitly defers to LLM03 for supply chain (the v1.0 rationale) and to LLM08 for RAG and embedding issues — [TM-PDF](https://genai.owasp.org/download/45674/?tmstv=1739819891).

### Cited Findings: OWASP Top 10 for Agentic Applications for 2026
- **Release:** published 9 December 2025 — [OWASP resource page](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/). The PDF is "Version 2026", 57 pages, created 9 Dec 2025 — [ASI-PDF](https://genai.owasp.org/download/52117/?tmstv=1765059207). Secondary summaries also report peer review by 100+ researchers — [Giskard](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026); [Cycode](https://cycode.com/blog/owasp-top-10-agentic-applications/).
- Each entry below gives the ID and name, a one-line description, the condensed "Prevention and Mitigation Guidelines", and the Appendix A mapping. All from [ASI-PDF](https://genai.owasp.org/download/52117/?tmstv=1765059207):
  - **ASI01 Agent Goal Hijack**: an attacker redirects the agent's goals or plan via injected content in documents, RAG results, email, tool output and similar.
    - *Mitigations:* treat all natural-language input as untrusted and route it through the LLM01 safeguards; least privilege plus human approval for goal-changing or high-impact actions; lock system prompts under configuration management; validate user and agent intent at run time and pause on goal shift; "intent capsule" (signed goal/constraints envelope per execution cycle; described as emerging); sanitize all connected sources (RAG, email, calendar, files, browsing, peer-agent messages) with CDR and prompt-carrier detection; behavioral baselines and goal-state monitoring; red-team goal override; include agents in the insider-threat program.
    - *Maps to* LLM01, LLM06; T6, T7.
  - **ASI02 Tool Misuse and Exploitation**: legitimate tools are misused because of injection, misalignment or ambiguous instructions. Examples: over-privileged or over-scoped tools, unvalidated forwarding to a shell, unsafe browsing, loop amplification.
    - *Mitigations:* least agency and least privilege per tool (scopes, max rate, egress allowlists); action-level authentication and human approval with a dry-run or diff preview; execution sandboxes and egress controls; a policy-enforcement "Intent Gate" (PEP/PDP that validates intent, arguments and schemas); adaptive tool budgeting; just-in-time ephemeral credentials; "semantic firewalls" (fully qualified tool names and version pins against alias collisions and typosquatting); immutable tool-call logs and drift detection. Builds on LLM06.
    - *Maps to* LLM06; T2, T4, T16.
  - **ASI03 Identity and Privilege Abuse**: agents lack distinct governed identities; privileges are inherited or escalated across agents, memory or delegation chains.
    - *Mitigations:* task-scoped, time-bound tokens with per-agent identities; isolate identity and context per session and wipe state between tasks; per-action authorization by a central policy engine; HITL for escalation; bind OAuth tokens to a signed intent (subject, audience, purpose, session); evaluate agentic identity-management platforms that treat agents as managed non-human identities; no privilege inheritance across agents without re-validation; detect transitive or delegated permission gains and device-code phishing flows.
    - *Maps to* LLM01, LLM06, LLM02; T3.
  - **ASI04 Agentic Supply Chain Vulnerabilities**: third-party tools, MCP servers, prompts, models, agent cards or registries loaded at runtime may be malicious or tampered with.
    - *Mitigations:* sign and attest manifests, prompts and tool definitions, with SBOM/AIBOM; dependency allowlisting and pinning, typosquat scanning, auto-reject of unsigned components; sandboxed containers and reproducible builds; prompts and memory schemas under version control; mutual authentication and attestation between agents (PKI/mTLS, no open registration); runtime re-verification of hashes and signatures; pin by content hash with staged rollout and auto-rollback; a "supply chain kill switch"; zero-trust design.
    - *Maps to* LLM03; T17, T2, T11, T12, T13, T16.
  - **ASI05 Unexpected Code Execution (RCE)**: generated code or commands are executed unsafely.
    - *Mitigations:* LLM05 output handling; no direct agent-to-production path, with pre-production checks for "vibe coding"; ban `eval` and use safe interpreters with taint tracking; never run as root; sandboxed containers with network limits; separate code generation from execution behind validation gates; HITL for elevated runs and a version-controlled auto-execution allowlist; static scans before execution plus runtime monitoring.
    - *Maps to* LLM01, LLM05; T11.
  - **ASI06 Memory & Context Poisoning**: persistent memory, RAG or context is corrupted, skewing future decisions.
    - *Mitigations:* encryption and least privilege; scan all memory writes before commit; segment memory per user, session and domain; accept only authenticated, curated sources and minimize retention; require provenance and detect anomalous updates; block automatic re-ingestion of the agent's own outputs ("bootstrap poisoning"); snapshots, rollback and versioning; expire unverified memory; weight retrieval by trust and tenancy.
    - *Maps to* LLM01, LLM04, LLM08; T1, T4, T6, T12.
  - **ASI07 Insecure Inter-Agent Communication**: agent-to-agent messages (A2A, MCP, gRPC and similar) are intercepted, spoofed, replayed or downgraded.
    - *Mitigations:* end-to-end encryption, mutual authentication, certificate pinning; signed messages with natural-language-aware validation; anti-replay (nonces, timestamps); disable legacy modes; limit metadata inference; protocol pinning and version enforcement (reject downgrades); authenticated discovery and routing; attested registries and **signed agent cards**; typed, versioned schemas.
    - *Maps to* LLM02, LLM06; T12, T16.
  - **ASI08 Cascading Failures**: a single fault propagates and amplifies across agents.
    - *Mitigations:* zero-trust and fault-tolerant design; isolation and trust boundaries; JIT one-time tool access checked against policy-as-code; a policy engine independent of the planner; output validation and human gates; rate limiting; blast-radius guardrails (quotas, circuit breakers between planner and executor); drift detection; "digital twin replay" of recorded actions before any policy expansion; tamper-evident logs bound to agent identity.
    - *Maps to* LLM01, LLM04, LLM06; T5, T8.
  - **ASI09 Human-Agent Trust Exploitation**: agents exploit human trust or authority to induce harmful approvals.
    - *Mitigations:* explicit multi-step confirmations; immutable logs; behavioral detection; user reporting of suspicious interactions; adaptive trust calibration with confidence cues; content provenance metadata; "separate preview from effect" (no state-changing calls during preview); UI risk cues; plan-divergence detection.
    - *Maps to* LLM01, LLM05, LLM06, LLM09; T7, T8, T10.
  - **ASI10 Rogue Agents**: agents drift from their intended purpose, through misalignment, collusion or reward hacking, and act as insider threats.
    - *Mitigations:* signed immutable audit logs; trust zones and sandboxes; watchdog agents and collusion detection; kill switches and credential revocation, plus quarantine; per-agent cryptographic identity attestation and behavioral baselines; periodic behavioral attestation with signed BOMs for prompts and tools and per-run ephemeral credentials; controlled recovery and reintegration.
    - *Maps to* LLM02, LLM09; T13, T14, T15.
- **Other appendices** in the ASI document: AIVSS core-risk mapping, CycloneDX/AIBOM, a mapping to the OWASP Non-Human Identities Top 10, and an "ASI Agentic Exploits & Incidents Tracker" — [ASI-PDF](https://genai.owasp.org/download/52117/?tmstv=1765059207).

### Cited Findings: Securing Agentic Applications Guide and related documents
- **Securing Agentic Applications Guide 1.0**: dated 27 July 2025 on the OWASP resource page; some outlets report 28 July. It is practical guidance for designing, developing and deploying secure LLM-powered agentic applications and complements the T&M document — [OWASP resource](https://genai.owasp.org/resource/securing-agentic-applications-guide-1-0); [Infosecurity Magazine](https://infosecurity-magazine.com/news/owasp-agentic-ai-security-guidance). I did not read this guide's full contents.
- **"State of Agentic AI Security and Governance" v2.01**: reported as published 1 June 2026. It is a separate report from the Securing guide — [Let's Data Science](https://letsdatascience.com/news/owasp-releases-agentic-ai-security-report-v201-b6926a1d). This is a secondary source and was not verified on genai.owasp.org.

### Inferences
- For a Foundry agent platform, ASI02, ASI03 and ASI04 carry the most operational weight:
  - ASI02 calls for a PEP/PDP intent gate in front of tool calls, with egress allowlists and per-tool budgets.
  - ASI03 calls for per-agent managed non-human identities (Entra Agent ID is named in T9) with task-scoped tokens and no transitive delegation.
  - ASI04 calls for pinned, signed MCP/OpenAPI tool definitions and a kill switch.
- ASI07 maps directly to Foundry connected agents and A2A.
- The T-IDs are the granular attack pathways and the ASI entries are the governance-level list. Use the ASI IDs for reporting and the T-IDs and playbooks for control design.

### Gaps
- The six playbooks' step-by-step contents (TM-PDF pp. 34–45) were not transcribed in full; only the threat-table mitigations are captured above.
- I did not find a published post-2026 revision of the ASI Top 10.
- Naming varies slightly between sources: "Tool Misuse and Exploitation" in the PDF versus "Tool Misuse & Exploitation" in some summaries. Use the PDF names.

## Q3. OWASP MCP-specific guidance (by 2026)

### Takeaway
OWASP has four MCP-specific outputs:
- The **OWASP MCP Top 10** (IDs MCP01:2025–MCP10:2025), described as in "Phase 3 – beta release and pilot testing".
- An **MCP Security Cheat Sheet** in the OWASP Cheat Sheet Series.
- The GenAI Security Project's **"A Practical Guide for Securely Using Third-Party MCP Servers 1.0"**.
- A companion guide, **"A Practical Guide for Secure MCP Server Development"**, reported as published February 2026 (secondary report; not opened).

### Cited Findings
- **MCP Top 10 entries**, from [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/), with mitigations from the per-risk docs in [GitHub /2025](https://github.com/OWASP/www-project-mcp-top-10/tree/main/2025):
  - **MCP01 Token Mismanagement & Secret Exposure**: hard-coded or long-lived tokens, and secrets kept in model memory or logs. *Mitigations:* keep secrets in a vault and inject them only at runtime; short-lived scoped tokens bound to agent, tool or session; re-issue tokens per MCP session; keep credentials out of context; redact before logging.
  - **MCP02 Privilege Escalation via Scope Creep**: permissions expand over time. *Mitigations:* least privilege; policy-as-code; JIT and expiry-based access; per-agent identity and credential binding; entitlement reviews and drift detection; separation of duties.
  - **MCP03 Tool Poisoning**: tool schemas, definitions or outputs are tampered with to steer the agent. *Mitigations:* signed schemas and manifests with hash-pinned versions; an immutable schema registry with multi-person approval; RBAC on the registry; semantic policy checks (OPA) in CI and at a runtime PDP.
  - **MCP04 Software Supply Chain Attacks & Dependency Tampering**. *Mitigations:* signed components and provenance verified at install and startup; SBOM/CBOM; version pinning and approved registries.
  - **MCP05 Command Injection & Execution**. *Mitigations:* allowlist commands, arguments and paths; reject shell metacharacters; never use `shell=True`, `eval` or `exec`; pass structured arguments; sandbox tools (containers, micro-VMs, gVisor/Kata) with timeouts and read-only file systems; least privilege.
  - **MCP06 Prompt Injection via Contextual Payloads** (the per-risk doc is titled "Intent Flow Subversion"). *Mitigations:* anchor the user's intent; a PDP that allows only goal-aligned actions; an independent "checker" guardrail model; treat MCP `resources/` and tool outputs as untrusted; tag untrusted context; detect intent drift and use HITL.
  - **MCP07 Insufficient Authentication & Authorization**. *Mitigations:* mTLS; short-lived OAuth/JWT tokens bound to agent identity and validated server-side; RBAC/ABAC evaluated per request; deny by default; rotate and revoke tokens.
  - **MCP08 Lack of Audit and Telemetry**. *Mitigations:* structured, tamper-evident logs (timestamp, agent_id, session_id, tool_invoked, parameters, response summary, user identity); forward to a SIEM (Sentinel is named) or XDR; alerts on high-risk tool use.
  - **MCP09 Shadow MCP Servers**: unapproved MCP deployments. *Mitigations:* a central MCP registry gated in CI/CD; network discovery and weekly scanning; secure baseline configuration templates.
  - **MCP10 Context Injection & Over-Sharing**: shared or persistent context leaks across tasks, users or tenants. *Mitigations:* ephemeral per-session contexts; context namespaces per user, agent, workflow and tenant; isolated vector stores per tenant.
- **MCP Top 10 status:** the page shows the project at "Phase 3 – beta release and pilot testing" while its project panel says "Production Project". No explicit release date is shown — [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/). Cycode refers to it as "version 0.1 (2025)" — [Cycode](https://cycode.com/blog/owasp-mcp-top-10/).
- **MCP Security Cheat Sheet:**
  - Key risks listed: tool poisoning, rug pulls, tool shadowing, data exfiltration, over-scoped tokens, supply chain and sandbox escape.
  - Twelve best-practice areas:
    1. Least privilege with per-server, short-lived credentials.
    2. Tool schema integrity: review full definitions and **pin them with hashes**.
    3. Sandboxing local servers.
    4. HITL, showing full parameters.
    5. Input and output validation, including SSRF.
    6. Authentication and transport: validate the OAuth token **audience**, use TLS, validate Origin and Host headers.
    7. Optional message-level integrity.
    8. Multi-server isolation, treating each server as a separate security domain.
    9. Supply chain: vetting, integrity checks, typosquatting.
    10. Monitoring that logs all invocations with secrets redacted.
    11. Consent dialogs, with a re-prompt **when tool definitions change**.
    12. Treat tool returns as untrusted and enforce authorization in application code.
  — [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html)
- **"CheatSheet – A Practical Guide for Securely Using Third-Party MCP Servers 1.0"**: the OWASP site dates it 4 Nov 2025; a third-party catalog says 23 Oct 2025. It covers tool poisoning, prompt injection, memory poisoning and tool interference, with authentication and authorization, client sandboxing, secure discovery and governance workflows — [OWASP resource](https://genai.owasp.org/resource/cheatsheet-a-practical-guide-for-securely-using-third-party-mcp-servers-1-0/); [AIGL](https://www.aigl.blog/a-practical-guide-for-securely-using-third-party-mcp-servers-owasp-genai-security-project-v1-0-oct-23-2025/).
- **"A Practical Guide for Secure MCP Server Development"**: an OWASP GenAI resource — [OWASP resource](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/). The February 2026 date comes from a search summary only.

### Inferences
- The MCP Top 10 overlaps heavily with the ASI list: MCP03/MCP04 correspond to ASI04, MCP06 to ASI01, MCP07/MCP02 to ASI03, and MCP05 to ASI05. Because the MCP Top 10 is still in beta, it is better suited as an MCP-specific control checklist than as the primary reporting taxonomy.

### Gaps
- No final (non-beta) release of the MCP Top 10 was confirmed.
- I did not read the full contents of the two GenAI MCP practical guides.
- A GitHub repository "OWASP/www-project-agentic-skills-top-10" exists, which suggests an Agentic Skills Top 10 project, but its contents and status were not examined.

## Q4. MITRE ATLAS: version, tactics, agent-relevant techniques and mitigations

### Takeaway
- **Release cadence and version:** ATLAS now ships monthly, date-versioned releases in data format 6.0.0. The latest is **v2026.09**, released 15 Sep 2026: 16 tactics, 208 techniques and sub-techniques, 40 mitigations and 73 case studies.
- **Renamed tactic:** AML.TA0001 is now "AI Attack Adaptation".
- **Renamed techniques:** several of the caller's names are out of date. AML.T0053 is now **"AI Agent Tool Invocation"** (formerly "LLM Plugin Compromise") and AML.T0056 is **"Extract LLM System Prompt"** (formerly "LLM Meta Prompt Extraction").
- **New agent techniques since late 2025** include T0080 AI Agent Context Poisoning (with Memory and Thread sub-techniques), T0086 Exfiltration via AI Agent Tool Invocation, T0110 AI Agent Tool Poisoning, T0109 AI Supply Chain Rug Pull and T0118 Autonomous AI Agent Communication.
- **Agent-specific mitigations:** M0026–M0033 and M0036–M0038.

### Cited Findings
- **Release metadata:** the manifest lists release '2026.09' (release date 2026-09-15, format-version 6.0.0, path v6/ATLAS-2026.09.yaml); the previous releases are 2026.08 (08-31), 2026.07 (07-31) and 2026.06 (06-30) — [atlas-data manifest](https://github.com/mitre-atlas/atlas-data/blob/main/dist/manifest.yaml). GitHub release tag v2026.09 was published 2026-09-15 — [atlas-data releases](https://github.com/mitre-atlas/atlas-data/releases). The legacy `dist/ATLAS.yaml` is v5.6.0 and is marked deprecated — [legacy ATLAS.yaml](https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/ATLAS.yaml).
- **Counts in 2026.09:** 16 tactics, 208 techniques plus sub-techniques, 40 mitigations, 73 case studies — [ATLAS-DATA](https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/v6/ATLAS-2026.09.yaml), counted by parsing the file.
- **Tactics (ID: name)** — [ATLAS-DATA](https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/v6/ATLAS-2026.09.yaml):
  - TA0000: AI Model Access
  - TA0001: AI Attack Adaptation (shown as "AI Attack Staging" in legacy v5.6.0)
  - TA0002: Reconnaissance
  - TA0003: Resource Development
  - TA0004: Initial Access
  - TA0005: Execution
  - TA0006: Persistence
  - TA0007: Defense Evasion
  - TA0008: Discovery
  - TA0009: Collection
  - TA0010: Exfiltration
  - TA0011: Impact
  - TA0012: Privilege Escalation
  - TA0013: Credential Access
  - TA0014: Command and Control
  - TA0015: Lateral Movement
- **Agent-relevant techniques.** Each entry gives the ID and current name, the date the entry was created in the data, its maturity rating, and a one-line description quoted or paraphrased from the data. All from [ATLAS-DATA](https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/v6/ATLAS-2026.09.yaml). Technique pages follow the pattern https://atlas.mitre.org/techniques/AML.T0051.
  - *Prompt injection, jailbreak and system prompt:*
    - **AML.T0051 LLM Prompt Injection** (2023; Realized): crafted prompts cause unintended LLM behavior. Sub-techniques: **.000 Direct** (Realized), **.001 Indirect** ("via a separate data channel … documents, emails, databases or websites"; Demonstrated), **.002 Triggered** (added 2025-11-04: injection triggered by a user action or event).
    - **AML.T0054 LLM Jailbreak** (Realized): bypasses safety and guardrails.
    - **AML.T0056 Extract LLM System Prompt** (Feasible).
    - **AML.T0069 Discover LLM System Information**, with sub-techniques .000 Special Character Sets, .001 System Instruction Keywords and .002 System Prompt.
    - **AML.T0065 LLM Prompt Crafting**.
    - **AML.T0068 LLM Prompt Obfuscation**: hiding injections from humans and guardrails.
    - **AML.T0061 LLM Prompt Self-Replication**: worm-like propagation.
    - **AML.T0093 Prompt Infiltration via Public-Facing Application** (2025-10).
    - **AML.T0094 Delay Execution of LLM Instructions** (2025-11).
    - **AML.T0129 Triggers in Multimodal Inputs** (2026-09).
    - **AML.T0131 Crafted AI Assistant Links** (2026-09): links that pre-fill attacker input into an assistant.
  - *Data leakage and exfiltration:*
    - **AML.T0057 LLM Data Leakage** (Demonstrated).
    - **AML.T0024 Exfiltration via AI Inference API**, with sub-techniques .000 Infer Training Data Membership, .001 Invert AI Model and .002 Extract AI Model.
    - **AML.T0025 Exfiltration via Cyber Means**.
    - **AML.T0077 LLM Response Rendering** (2025-04): exfiltration via rendered markdown or image URLs.
    - **AML.T0086 Exfiltration via AI Agent Tool Invocation** (2025-09-30; Realized): "AI agent tools capable of performing write operations may be invoked to exfiltrate data".
    - **AML.T0085 Data from AI Services**, with sub-techniques .000 RAG Databases and .001 AI Agent Tools.
  - *Agent tools:*
    - **AML.T0053 AI Agent Tool Invocation** (Demonstrated): "use their access to an AI agent to invoke tools the agent has access to".
    - **AML.T0101 Data Destruction via AI Agent Tool Invocation** (2025-11; Realized).
    - **AML.T0098 AI Agent Tool Credential Harvesting**.
    - **AML.T0099 AI Agent Tool Data Poisoning**: poisoning data sources reachable through tools.
    - **AML.T0110 AI Agent Tool Poisoning** (2026-03; Realized), with sub-techniques .000 Definition and Instructions (tool descriptions), .001 Implementation and .002 Runtime Response.
    - **AML.T0011.002 Poisoned AI Agent Tool** (User Execution; 2026-01).
    - **AML.T0010.005 AI Supply Chain Compromise: AI Agent Tool** (2026-03).
    - **AML.T0109 AI Supply Chain Rug Pull** (2026-03): a benign component turns malicious in an update.
    - **AML.T0111 AI Supply Chain Reputation Inflation**.
    - **AML.T0115 Publish Poisoned AI Artifacts**, with sub-technique .002 AI Agent Tools.
  - *Agent context, memory and configuration:*
    - **AML.T0080 AI Agent Context Poisoning** (2025-09-30; Realized), with sub-techniques **.000 Memory** (persists across sessions) and **.001 Thread**.
    - **AML.T0070 RAG Poisoning**.
    - **AML.T0071 False RAG Entry Injection**.
    - **AML.T0066 Retrieval Content Crafting**.
    - **AML.T0064 Gather RAG-Indexed Targets**.
    - **AML.T0092 Manipulate User LLM Chat History** (anti-forensics).
    - **AML.T0081 Modify AI Agent Configuration**.
    - **AML.T0083 Credentials from AI Agent Configuration**.
    - **AML.T0082 RAG Credential Harvesting**.
    - **AML.T0084 Discover AI Agent Configuration**, with sub-techniques .000 Embedded Knowledge, .001 Tool Definitions, .002 Activation Triggers and .003 Call Chains.
    - **AML.T0133 Discover AI Agent Runtime Capabilities** (2026-09).
    - **AML.T0018.003 Modify Prompt Construction Logic** (2026-07): templates, role delimiters, tool-call formatting.
    - **AML.T0002.002 Acquire Public AI Artifacts: AI Agent Configuration**.
  - *Agents as an attack vector or command channel:*
    - **AML.T0100 AI Agent Clickbait**: lures for computer-use and browser agents.
    - **AML.T0134 AI Targeted Cloaking** (2026-09): different content served to AI than to humans.
    - **AML.T0130 AI Agent Response Biasing**.
    - **AML.T0112.000 Machine Compromise: Local AI Agent**.
    - **AML.T0108 AI Agent** (Command and Control via agents).
    - **AML.T0103 Deploy AI Agent**.
    - **AML.T0105 Escape to Host** (sandbox breakout).
    - **AML.T0102 Generate Malicious Commands**.
    - **AML.T0118 Autonomous AI Agent Communication** (2026-08), with sub-techniques .000 Communication via Shared Artifacts and .001 Direct Agent Communication.
    - 2026-08 additions on AI-driven offensive operations: **AML.T0116 Autonomous Reconnaissance**, **AML.T0117 Autonomous Attack-Path Adaptation**, **AML.T0124 Autonomous Attack Orchestration**.
  - *Resource abuse and impact:*
    - **AML.T0034 Cost Harvesting**, with sub-techniques .000 Excessive Queries, .001 Resource-Intensive Queries and **.002 Agentic Resource Consumption** (2026-03: "coerce an agentic AI system into performing computationally expensive tool calls").
    - **AML.T0029 Denial of AI Service**.
    - **AML.T0048 External Harms**, with sub-techniques .000 Financial, .001 Reputational, .002 Societal, .003 User and .004 AI Intellectual Property Theft.
  - *Supply chain:* **AML.T0010 AI Supply Chain Compromise**, with sub-techniques .000 Hardware, .001 AI Software, .002 Data, .003 Model, .004 Container Registry and .005 AI Agent Tool.
  - *Identity:*
    - **AML.T0091 Use Alternate Authentication Material**, with sub-techniques .000 Application Access Token and .001 Web Session Cookie.
    - **AML.T0055 Unsecured Credentials**.
    - **AML.T0012 Valid Accounts**.
    - **AML.T0132 Misconfigured or Publicly Exposed AI Services** (2026-09).
- **Mitigations relevant to agents, with the techniques each maps to in the data** — [ATLAS-DATA](https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/v6/ATLAS-2026.09.yaml):
  - **AML.M0020 Generative AI Guardrails**: controls between users, tools and models that evaluate prompts, retrieved context, outputs and agent actions. Maps to T0051, T0053, T0054, T0056, T0057, T0061, T0068, T0070, T0071, T0099, T0100, T0102, T0108, T0112.000 and others.
  - **AML.M0021 Generative AI Guidelines**: system-prompt instructions and constraints. Maps to T0051, T0053, T0054, T0056, T0057, T0100.
  - **AML.M0022 Generative AI Model Alignment**.
  - **AML.M0024 AI Telemetry Logging**: log model inputs and outputs. Maps to T0051.x, T0053, T0085, T0086, T0101, T0114.
  - **AML.M0026 Privileged AI Agent Permissions Configuration**, **AML.M0027 Single-User AI Agent Permissions Configuration** and **AML.M0028 AI Agent Tools Permissions Configuration**. Each maps to T0053, T0085, T0086 and T0101; M0026/M0027 also map to T0082.
  - **AML.M0029 Human In-the-Loop for AI Agent Actions**. Maps to T0053, T0086, T0101.
  - **AML.M0030 Restrict AI Agent Tool Invocation on Untrusted Data**. Maps to T0053, T0086, T0101.
  - **AML.M0031 Memory Hardening**: protects saved preferences, episodic and semantic memory, summaries and chat history. Maps to T0080 and T0080.000.
  - **AML.M0032 Segmentation of AI Agent Components**: enforceable boundaries around tools, data, identities and execution environments. Maps to T0053, T0085, T0086, T0098.
  - **AML.M0033 Input and Output Validation for AI Agent Components**. Maps to T0051.x, T0053, T0086.
  - **AML.M0035 AI Red Team**: maps broadly, including T0010.005, T0034.002, T0051.x, T0053, T0080.x and T0081.
  - **AML.M0036 Limit AI Workload Resource Consumption**. Maps to T0029, T0034.x.
  - **AML.M0037 AI Agent Authority Expansion Controls** and **AML.M0038 AI Agent Scope Drift Detection**. Both map to T0116, T0117, T0124.
  - **AML.M0039 AI Honeypots**.
  - Classic mitigations that still apply:
    - **M0004 Limit AI Service Query Volume and Rate**.
    - **M0005 Control Access to AI Models and Data at Rest**.
    - **M0019 Control Access to AI Models and Data in Production**: maps to T0051, T0091.000, T0096.
    - **M0013 Code Signing**.
    - **M0014 Verify AI Artifacts**.
    - **M0016 Vulnerability Scanning**: maps to T0115.002.
    - **M0023 AI Bill of Materials**.
    - **M0018 User Training**.
    - **M0034 Deepfake Detection**.

### Inferences
- **Coverage gaps in the mitigation data:** the newest agent techniques have no mapped mitigations as of 2026.09, among them T0110 Tool Poisoning, T0109 Rug Pull and T0118. Crosswalks should borrow controls from OWASP for these: signed and hash-pinned tool definitions, as in MCP03, the MCP cheat sheet and ASI04. *(Observation from the parsed mitigation→technique relationships; only the mitigations listed above were inspected.)*
- **Crosswalk anchors between ATLAS and OWASP:**
  - LLM01 / ASI01 ↔ T0051 (.000/.001/.002), T0093, T0094.
  - LLM06 / ASI02 ↔ T0053, T0086, T0101, with M0026–M0030.
  - ASI06 ↔ T0080 (.000/.001), T0070, with M0031.
  - ASI04 / LLM03 ↔ T0010 (.005), T0109, T0110, T0011.002.
  - LLM07 ↔ T0056, T0069.
  - LLM02 ↔ T0057, T0024.
  - LLM05 ↔ T0077, T0050.
  - LLM10 ↔ T0034 (.002), T0029, with M0036.
  - ASI07 ↔ T0118.
  - ASI03 ↔ T0091, T0083, T0098.

### Gaps
- Tactic assignments per technique were not extracted. In format v6 the technique records showed no `tactics` field; tactic mapping appears to live elsewhere in the file. Check atlas.mitre.org for each technique's tactic.
- The former names ("LLM Plugin Compromise" for T0053, "LLM Meta Prompt Extraction" for T0056, "AI Attack Staging" for TA0001) come from prior knowledge plus the legacy v5.6.0 file, which shows "AI Attack Staging". The exact rename dates were not verified.
- IDs AML.T0104 and T0019/T0058 do not appear in 2026.09: T0104 was never present or has been removed, and T0019/T0058 appear to be consolidated into T0115 Publish Poisoned AI Artifacts (2026-07). This consolidation is an inference from their absence and was not confirmed in release notes.
