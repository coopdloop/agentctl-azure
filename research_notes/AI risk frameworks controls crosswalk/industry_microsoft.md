# Industry AI Security/Control Frameworks: CSA AICM, Google SAIF, Microsoft RAI Standard and Azure AI Foundry Agent Security

Notes gathered 2026-10-17. "Verified" means read on a primary page during this session. Anything taken from training knowledge or secondary sources is labelled that way.

## CSA AI Controls Matrix (AICM): version, structure, agent-relevant controls, mappings, shared responsibility; CSA agentic guidance

### Takeaway
AICM v1.0 came out in July 2025 with 243 control objectives in 18 domains. v1.1 followed in July 2026 with 247 controls, still in 18 domains. 17 of the domains come from CCM, and one, Model Security (MDS, 13 controls), is new and AI-specific. Each control has a five-actor shared responsibility model and is mapped to ISO 42001, NIST AI RMF / NIST AI 600-1, the EU AI Act, BSI AIC4 and, from v1.1, AIUC-1. AICM itself has no dedicated "agent" domain. CSA covers agents in separate material: MAESTRO (a 7-layer threat model) and the Agentic AI Red Teaming Guide.

### Cited Findings
- AICM v1.0 was released in July 2025 (CSA press release dated 2025-07-10) with **243 control objectives across 18 security domains**, aimed at generative AI and covering model security through supply-chain risk. — [CSA press release](https://cloudsecurityalliance.org/press-releases/2025/07/10/cloud-security-alliance-delivers-the-ai-guardrails-you-ve-been-looking-for); [CSA intro article](https://cloudsecurityalliance.org/articles/introducing-the-csa-ai-controls-matrix-a-comprehensive-framework-for-trustworthy-ai)
- **AICM v1.1**: CSA blog by Marina Bregkou, 2026-07-14, plus a CSA research note dated 2026-07-30. Controls went from 243 to **247**, still in **18 domains**. The additions are described as refinements synchronized with **CCM v4.1** (released Jan 2026: 17 domains, 207 controls), not new AI-specific requirements. v1.1 also added an **AIUC-1** mapping (described as agentic-AI focused) and grew the **AI-CAIQ to 320 questions**. — [CSA Labs research note, AICM v1.1](https://labs.cloudsecurityalliance.org/research/csa-research-note-aicm-v1-1-update-20260730-csa-styled/)
- **Model Security (MDS)** has existed since v1.0. It has **13 controls (MDS-01 to MDS-13)**, unchanged in v1.1, and was built from scratch. The other 17 domains derive from CCM. MDS covers protecting training data and model architecture from tampering, securing weights against theft, misuse guardrails, and hardening inference pipelines against manipulation such as prompt injection. CSA says secondary coverage calling MDS "new in v1.1" is wrong. — [CSA Labs research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-aicm-v1-1-update-20260730-csa-styled/)
- A third-party catalogue lists the control ID ranges as **LOG-01 to LOG-15, IAM-01 to IAM-19, STA-01 to STA-16, DSP-01 to DSP-24, MDS-01 to MDS-13** (it labels the version "v1.0.3"). — [OpenSecurityArchitecture AICM catalogue](https://opensecurityarchitecture.org/frameworks/csa-aicm/controls)
- Domains named in CSA's own text: Identity & Access Management; Data Security & Privacy Lifecycle Management; Model Security; Supply Chain Management, Transparency & Accountability. — [CSA intro article](https://cloudsecurityalliance.org/articles/introducing-the-csa-ai-controls-matrix-a-comprehensive-framework-for-trustworthy-ai)
- **Five analytical pillars** on each control:
  - Control Type: AI-specific, AI-and-cloud hybrid, or cloud-specific.
  - Control Applicability & Ownership.
  - Architectural Relevance: Physical, Network, Compute, Storage, Application, Data.
  - Lifecycle Relevance: Preparation, Development, Evaluation/Validation, Deployment, Delivery, Service Retirement.
  - Threat Category: 9 categories, e.g. Model Manipulation, Data Poisoning.
  
  Components: control objectives, the **AI-CAIQ** questionnaire (basis for STAR Level 1 Self-Assessment for AI), Implementation Guidelines, Auditing Guidelines (input to STAR audits), and mappings. — [CSA intro article](https://cloudsecurityalliance.org/articles/introducing-the-csa-ai-controls-matrix-a-comprehensive-framework-for-trustworthy-ai)
- **Shared Security Responsibility Model (SSRM)**: five actors, **Cloud Service Providers, Model Providers, Orchestrated Service Providers, Application Providers, AI Customers**, each with its own implementation and auditing guidelines. MDS responsibility sits mainly with Model Providers. Application Providers and AI Customers carry a narrower share tied to how they consume and configure models. — [CSA Labs research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-aicm-v1-1-update-20260730-csa-styled/). The intro article names four stack layers: GenAI Ops, The Model, Orchestrated Services, GenAI Applications. — [CSA intro article](https://cloudsecurityalliance.org/articles/introducing-the-csa-ai-controls-matrix-a-comprehensive-framework-for-trustworthy-ai)
- **Mappings**:
  - At v1.0 launch: BSI AIC4, NIST AI 600-1, ISO 42001 and the EU AI Act. The ISO 42001 and EU AI Act mappings were due in August 2025. — [CSA intro article](https://cloudsecurityalliance.org/articles/introducing-the-csa-ai-controls-matrix-a-comprehensive-framework-for-trustworthy-ai)
  - At v1.1: EU AI Act, NIST AI RMF, ISO/IEC 42001:2023, BSI AIC4, AIUC-1. — [CSA Labs research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-aicm-v1-1-update-20260730-csa-styled/)
- **MAESTRO** is CSA's agentic-AI threat-modeling framework. It has **7 layers**: Foundation Models, Data Operations, Agent Frameworks, Deployment & Infrastructure, Evaluation & Observability, Security & Compliance, Agent Ecosystem. It extends STRIDE, PASTA and LINDDUN with AI-specific threats. CSA has continued to publish applications of it, e.g. a MAESTRO-in-CI/CD post (Feb 2026) and an OpenClaw threat model (Feb 2026). — [CSA blog: OpenAI Responses API with MAESTRO](https://cloudsecurityalliance.org/blog/2025/03/24/threat-modeling-openai-s-responses-api-with-the-maestro-framework); [CSA blog 2026-02-11](https://cloudsecurityalliance.org/blog/2026/02/11/applying-maestro-to-real-world-agentic-ai-threat-models-from-framework-to-ci-cd-pipeline); [CSA blog 2026-02-20](https://cloudsecurityalliance.org/blog/2026/02/20/openclaw-threat-model-maestro-framework-analysis). The layer names come from secondary summaries and differ slightly between sources.
- **CSA Agentic AI Red Teaming Guide** (generally dated May 28, 2025; one source says August 2025). It covers about **12 threat categories**, including agent authorization/permission escalation, hallucination chains, orchestration flaws, memory manipulation/poisoning, multi-agent collusion and supply chain. It deliberately leaves threat modeling to MAESTRO. — [CSA artifact page](https://www.cloudsecurityalliance.org/artifacts/agentic-ai-red-teaming-guide); [Campus Technology, 2025-06-13](https://campustechnology.com/articles/2025/06/13/cloud-security-alliance-offers-playbook-for-red-teaming-agentic-ai-systems.aspx). CSA also published "Evaluating PyRIT for Agentic AI Red Teaming", which found PyRIT tests model-mediated behaviour but does not execute or control real autonomous agents. — [CSA artifact](https://cloudsecurityalliance.org/artifacts/evaluating-pyrit-for-agentic-ai-red-teaming)

### Inferences
- For tool-using agents, the AICM controls that matter most are likely MDS (prompt-injection hardening, guardrails), IAM (agent/non-human identity), LOG (audit of agent actions), DSP (data handling in prompts and RAG), STA (model and tool supply chain, which also anchors the SSRM) and AIS (application security). This is an inference from domain names. I did not read the individual control text.
- In SSRM terms, an enterprise building agents on Azure AI Foundry is mostly an **Application Provider and AI Customer**. Microsoft is the Cloud Service Provider and Orchestrated Service Provider (Agent Service), and the model vendor (OpenAI, Microsoft, others) is the Model Provider.
- AICM is a control catalogue. MAESTRO and the red teaming guide are threat and testing material. In a crosswalk they map to "threat model" and "adversarial testing" controls, not to AICM IDs.

### Gaps
- I could not confirm the full list of 18 domain names and codes from a primary page; the AICM spreadsheet is a gated download. From training knowledge (unverified), the codes are the 17 CCM codes plus MDS: A&A, AIS, BCR, CCC, CEK, DCS, DSP, GRC, HRS, IAM, IPY, I&S, LOG, SEF, STA, TVM, UEM, plus MDS. Check against the CSA download.
- I did not read individual MDS-01..13 titles or agent-specific control text. The per-domain breakdown of the four controls added in v1.1 is also unconfirmed.

## Google SAIF: core elements, risk map, controls, agent-specific guidance

### Takeaway
SAIF has two parts. The six conceptual "core elements" date from June 2023. The operational part on saif.google is a risk map of **15 risks**, each mapped to **controls in six categories**. Three of those controls are agent-specific: **Agent Permissions, Agent User Control and Agent Observability** (the last is marked "New"). Google's 2025 paper on secure AI agents sets out three principles: well-defined human controllers, carefully limited powers, and observable actions and planning. It recommends a hybrid defense-in-depth that combines deterministic policy enforcement with reasoning-based defenses.

### Cited Findings
- **Six core elements**:
  1. Expand strong security foundations to the AI ecosystem.
  2. Extend detection and response to bring AI into the organization's threat universe.
  3. Automate defenses to keep pace with existing and new threats.
  4. Harmonize platform-level controls for consistent security across the organization.
  5. Adapt controls to adjust mitigations and create faster feedback loops.
  6. Contextualize AI system risks in surrounding business processes.
  
  — [Google SAIF page, safety.google](https://safety.google/cybersecurity-advancements/saif); launched June 2023, building on SLSA and BeyondCorp — [CSO Online](https://www.csoonline.com/article/3699350/google-launches-secure-ai-framework-to-help-secure-ai-technology.html)
- **SAIF risk map (15 risks)**, with who is responsible for each and the mapped controls — [saif.google risks](https://saif.google/secure-ai-framework/risks):

  | Risk | Responsible | Controls |
  |---|---|---|
  | Data Poisoning | Model Creator | Training Data Sanitization, Secure-by-Default ML Tooling, Model & Data Integrity Mgmt, Model & Data Access Control, Model & Data Inventory Mgmt |
  | Unauthorized Training Data | Model Creator | Training Data Sanitization, Training Data Mgmt |
  | Model Source Tampering | Model Creator | Secure-by-Default ML Tooling, Integrity Mgmt, Access Control, Inventory Mgmt |
  | Excessive Data Handling | Model Creator | User Data Mgmt |
  | Model Exfiltration | Model Creator and Consumer | Inventory Mgmt, Access Control, Secure-by-Default ML Tooling |
  | Model Deployment Tampering | Model Creator and Consumer | Secure-by-Default ML Tooling |
  | Denial of ML Service | Model Consumer | Application Access Mgmt |
  | Model Reverse Engineering | Model Consumer | Application Access Mgmt |
  | **Insecure Integrated Component** (plugins/libraries/apps) | Model Consumer | **Agent Permissions** |
  | **Prompt Injection** | Model Creator and Consumer | Input Validation & Sanitization, Adversarial Training & Testing, Output Validation & Sanitization |
  | Model Evasion | Model Creator and Consumer | Adversarial Training & Testing |
  | **Sensitive Data Disclosure** | Model Creator and Consumer | Privacy Enhancing Technologies, User Data Mgmt, Output Validation, **Agent Permissions, Agent User Control, Agent Observability** |
  | Inferred Sensitive Data | Model Creator and Consumer | Training Data Mgmt, Output Validation |
  | **Insecure Model Output** | Model Consumer | Output Validation & Sanitization |
  | **Rogue Actions** (unintended agent actions, accidental or induced) | Model Consumer | **Agent Permissions, Agent User Control, Agent Observability**, Output Validation |

  Assurance and Governance controls apply to every risk and are not mapped to individual ones.
- **SAIF controls by category** — [saif.google controls](https://saif.google/secure-ai-framework/controls):
  - **Data**: Privacy Enhancing Technologies; Training Data Management; Training Data Sanitization; User Data Management.
  - **Infrastructure**: Model & Data Inventory Mgmt; Model & Data Access Controls; Model & Data Integrity Mgmt; Secure-by-Default ML Tooling.
  - **Model**: Input Validation & Sanitization; Output Validation & Sanitization; Adversarial Training & Testing.
  - **Application**:
    - Application Access Management.
    - User Transparency & Controls.
    - **Agent User Control**: require user approval for agent or plugin actions that change user data or act on the user's behalf.
    - **Agent Permissions**: least privilege for agent tools and actions. Permissions adapt to the specific query and trusted context, and the agent shares only contextually appropriate information.
    - **Agent Observability** (New): log agent actions, tool use and reasoning for audit, debugging and monitoring.
  - **Assurance**: Red Teaming; Vulnerability Management; Threat Detection; Incident Response Management.
  - **Governance**: User Policies & Education; Internal Policies & Education; Product Governance; Risk Governance.
- **"Google's Approach for Secure AI Agents"** (2025, Santiago Díaz and Kara Olive): an aspirational framework. Its three principles are:
  1. Agents must have well-defined human controllers.
  2. Agent powers must be carefully limited.
  3. Agent actions and planning must be observable.
  
  It recommends a hybrid defense-in-depth that pairs traditional deterministic controls (runtime policy enforcement) with dynamic reasoning-based defenses. — [Google Research publication page](https://research.google/pubs/an-introduction-to-googles-approach-for-secure-ai-agents/)

### Inferences
- SAIF's three agent controls line up closely with Google's three agent principles: Agent User Control ↔ human controllers, Agent Permissions ↔ limited powers, Agent Observability ↔ observable actions. They also line up with MCSB AI-5, AI-4 and AI-6. This makes a natural backbone for a unified agent-control set.
- In SAIF terms, a team building on a hosted model is mostly a "Model Consumer". The risks it owns are Insecure Integrated Component, Prompt Injection, Sensitive Data Disclosure, Insecure Model Output, Rogue Actions and Denial of ML Service.

### Gaps
- I did not fetch the full text of the secure-agents paper, such as its specific runtime-policy-engine and reasoning-defense recommendations, or the CoSAI relationship. I also did not confirm whether saif.google published further agent-specific risks or controls in 2026 beyond "Agent Observability (New)".

## Microsoft Responsible AI Standard v2: goals and IDs

### Takeaway
RAI Standard v2 (General Requirements, June 2022) has **17 goals across 6 principles**. Each goal has numbered requirements (e.g. A5.1–A5.7). For agents, the most relevant goals are A5 (human oversight and control), A1–A2 (impact assessment and Sensitive/Restricted Uses), T3 (disclosure of AI interaction), RS2 (failures and remediations) and RS3 (ongoing monitoring). PS1 and PS2 defer to Microsoft's internal Privacy Standard and Security Policy.

### Cited Findings (all from [Microsoft Responsible AI Standard v2 General Requirements, June 2022 PDF](https://blogs.microsoft.com/wp-content/uploads/prod/sites/5/2022/06/Microsoft-Responsible-AI-Standard-v2-General-Requirements-3.pdf), text extracted and verified)
- **Accountability**:
  - A1 Impact assessment. A1.3 requires the assessment to be updated at least annually, when new intended uses are added, and before release.
  - A2 Oversight of significant adverse impacts (Sensitive Uses / Restricted Uses review, at least annually).
  - A3 Fit for purpose (evaluation plan, Responsible Release Criteria, customer documentation).
  - A4 Data governance and management.
  - **A5 Human oversight and control**:
    - A5.1: identify the stakeholders responsible for troubleshooting, managing, operating, overseeing and controlling the system.
    - A5.2: identify the system elements (UX, features, alerting/reporting) that enable oversight.
    - A5.3: design those elements.
    - A5.4: define how each oversight/control function will be evaluated.
    - A5.5: define Responsible Release Criteria.
    - A5.6: evaluate on a near-release version.
    - A5.7: escalate any unmet criteria.
- **Transparency**:
  - T1 System intelligibility for decision making.
  - T2 Communication to stakeholders (publish documentation; review annually or on trigger events).
  - **T3 Disclosure of AI interaction**: design UX and outputs so stakeholders know they are interacting with an AI system, then evaluate against release criteria.
- **Fairness**:
  - F1 Quality of service.
  - F2 Allocation of resources and opportunities.
  - F3 Minimization of stereotyping, demeaning and erasing outputs.
- **Reliability & Safety**:
  - RS1 Reliability and safety guidance (operational factors and acceptable ranges, evaluation plan).
  - **RS2 Failures and remediations**: define predictable failures, document a remediation for each, plan for unknown failures, train support staff.
  - **RS3 Ongoing monitoring, feedback, and evaluation**: inventory of system health monitoring methods, an SOP / monitoring action plan, ongoing evaluation checkpoints, escalation to the Office of Responsible AI.
- **Privacy & Security**:
  - PS1 Privacy Standard compliance.
  - PS2 Security Policy compliance.
- **Inclusiveness**:
  - I1 Accessibility Standards compliance.

### Inferences
- v2 predates agentic AI. It has no tool or action controls. In a crosswalk it supplies governance and process controls (impact assessment, release criteria, human oversight design, monitoring SOPs), while the technical agent controls come from MCSB v2 AI-4/AI-5 and the Foundry features.

### Gaps
- I found no evidence of a v3 Responsible AI Standard as of Oct 2026. Microsoft's annual Responsible AI Transparency Reports were not reviewed.

## Microsoft guidance and features for securing agents on Azure AI Foundry, with GA/preview status

### Takeaway
Microsoft's agent security stack has five parts:
- **Foundry guardrails** at four intervention points. User input and output are established; tool call and tool response are **preview** and apply only to Foundry Agent Service agents with supported tools.
- **MCP tool approval** (`require_approval`, `allowed_tools`).
- **Entra Agent ID**, now **GA** with blueprints, sponsors, access packages and Conditional Access for agents.
- **Defender for Cloud AI threat protection** alerts, including "Anomalous tool invocation", plus AI-SPM. AI-SPM for Foundry agents was preview as of late 2025.
- **Purview DSPM for AI**, plus the **AI Red Teaming Agent** (preview).

The normative control set is **MCSB v2's Artificial Intelligence Security domain (AI-1 to AI-7)**, which is itself **preview**.

### Cited Findings
**MCSB v2 – Artificial Intelligence Security domain** (page ms.date 2025-12-01, updated 2026-09-25; MCSB v2 is in public preview) — [MCSB v2 AI Security](https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-v2-artificial-intelligence-security); preview status — [MCSB overview](https://learn.microsoft.com/security/benchmark/azure/introduction)
- Three pillars: AI Platform Security, AI Application Security, and Monitor & Respond.
- The 7 controls:
  - **AI-1** Ensure use of approved models. Implementation example: the "[Preview]: Azure Machine Learning Deployments should only use approved Registry Models" Azure Policy with a Deny effect.
  - **AI-2** Implement multi-layered content filtering.
  - **AI-3** Adopt safety meta-prompts.
  - **AI-4** Apply least privilege for agent functions:
    - a capability manifest per function/plugin with deny-by-default, sandboxed execution and runtime policy enforcement;
    - a separate identity via **Entra Agent ID**, with RBAC/ABAC and short-lived scoped tokens;
    - per-function activity logging and anomaly detection;
    - pre-integration security review and periodic reassessment.
    
    Mapped to NIST 800-53 AC-6, AC-3, CM-7; ISO 27001 A.5.15, A.8.3; CIS 5.4, 6.8; SOC 2 CC6.3. Criticality: "Must have".
  - **AI-5** Ensure human-in-the-loop.
  - **AI-6** Establish monitoring and detection. It recommends the AI Red Teaming Agent or PyRIT to validate detections.
  - **AI-7** Perform continuous AI Red Teaming.
- Each control carries mappings to NIST SP 800-53 r5, PCI-DSS v4, CIS v8.1, NIST CSF 2.0, ISO 27001:2022 and SOC 2, plus MITRE ATT&CK/ATLAS techniques.
- Microsoft states the content was last reviewed Dec 1, 2025 and "might not reflect the latest developments in … agentic AI controls".

**Foundry guardrails / content safety for agents** — [Intervention points (ms.date 2026-03-02, updated 2026-06-05)](https://learn.microsoft.com/azure/foundry/guardrails/intervention-points); [Guardrails overview](https://learn.microsoft.com/en-my/Azure/foundry/guardrails/guardrails-overview)
- A guardrail control defines three things: the risk to detect, the intervention point(s) to scan, and the action (annotate only, or annotate and block).
- Four intervention points:
  - **User input**: e.g. the user-input-attack / jailbreak classifier (Prompt Shields) blocks the prompt.
  - **Tool call (Preview)**: scans the proposed tool name, arguments and data before execution; a block stops the tool call.
  - **Tool response (Preview)**: scans the tool payload for **indirect prompt injection** before it enters agent memory or reaches the user; on detection the agent stops.
  - **Output**: e.g. Protected Material for Text, annotate only.
- Tool call and tool response apply **only to agents**, and only for tools that support moderation: Azure AI Search, Azure Functions, OpenAPI, SharePoint Grounding, Fabric Data Agent, Bing Grounding, Bing Custom Search, Browser Automation. Controls do not take effect for other tools, including MCP tools, which are not on the list.
- Each intervention point adds about 50–100 ms of latency.
- Agent guardrails are preview and currently apply only to agents built in Foundry Agent Service, not to third-party agents registered in the Foundry Control Plane. — [Guardrails overview](https://learn.microsoft.com/en-my/Azure/foundry/guardrails/guardrails-overview) (seen via search snippet)
- **Task adherence**: Microsoft's control-plane page says it detects off-task behaviour and enforces intent boundaries across inputs, tool calls and outputs. — [Azure AI Foundry Control Plane product page](https://azure.microsoft.com/en-us/products/ai-foundry/control-plane). A third-party blog says it became a native guardrail risk type in March 2026 and flags planned tool actions that don't match user intent (e.g. a write when the user only asked to read). — [GAPVelocity blog](https://www.gapvelocity.ai/blog/microsoft-foundry-just-shipped-a-guardrail-for-task-drift) (secondary; date unconfirmed)
- Secondary caveat: an agent-level guardrail *replaces* the model-level guardrail instead of merging with it. — [jannikreinhard.com](https://jannikreinhard.com/secure-microsoft-foundry/?lang=de) (secondary)

**MCP tool approval in Foundry Agent Service** — [Foundry MCP tool docs](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/model-context-protocol); [classic MCP docs](https://learn.microsoft.com/en-us/azure/foundry-classic/agents/how-to/tools-classic/model-context-protocol)
- Guidance: require approval for high-risk tools (writes and resource changes) and allow-list tools with `allowed_tools`.
- `require_approval="always"` means the developer approves each call, through the approval request/response loop.
- Agents (classic) are deprecated and will retire on **2027-03-31**.

**Microsoft Entra Agent ID — GA** — [What's new in Entra Agent ID (ms.date 2026-05-01, updated 2026-08-13)](https://learn.microsoft.com/en-us/entra/agent-id/whats-new-agent-id)
- Microsoft states Agent ID "is now generally available".
- Constructs: **agent identity blueprints**, agent identities, and agents' user accounts. Administrative relationships are split into owners, **sponsors** and managers.
- Admin-center wizard for creating blueprints and identities: **(Preview)**.
- Other capabilities:
  - soft delete with cascade cleanup;
  - Auth SDK sidecar for token acquisition;
  - downstream token validation;
  - federation and sidecar patterns for non-Microsoft agents (AWS Bedrock, GCP, n8n);
  - migration paths for app registrations and Copilot Studio agents.
- The agent registry is converging into **Microsoft Agent 365**.
- Governance:
  - **Access packages** for both OBO and autonomous agents.
  - **Sponsor lifecycle workflows** and templates that transfer sponsorship when a sponsor leaves, to prevent orphaned agents.
- Protection: **Conditional Access for agents**, with templates to block high-risk agent identities, for autonomous agents (no user context), and for on-behalf-of agents; plus **ID Protection for agents**.
- Licensing: Message Center MC1395007 (2026-06-17) adds the "Conditional Access for Agents" and "ID Protection for Agents" service plans in Microsoft Agent 365 and Microsoft 365 E7. GA rollout runs from early July to early August 2026. — [MC1395007 mirror](https://mc.merill.net/message/MC1395007)
- A blueprint lets admins apply one Conditional Access policy to every agent created from it. — [Entra agent identities](https://docs.azure.cn/en-us/entra/agent-id/agent-identities)

**Defender for Cloud AI threat protection** — [Alerts for AI services (ms.date 2026-07-06)](https://learn.microsoft.com/en-us/azure/defender-for-cloud/alerts-ai-workloads)
- Alert IDs:
  - `AI.Azure_CredentialTheftAttempt`: credentials in model responses.
  - `AI.Azure_Jailbreak.ContentFiltering.BlockedAttempt` / `.DetectedAttempt`: Prompt Shields.
  - `AI.Azure_MaliciousUrl.ModelResponse` / `.UnknownSource` / `.UserPrompt`: phishing URLs.
  - `AI.Azure_AccessFromSuspiciousUserAgent`.
  - `AI.Azure_ASCIISmuggling`: invisible-character indirect prompt injection.
  - `AI.Azure_AccessFromAnonymizedIP` (Tor).
  - `AI.Azure_AccessFromSuspiciousIP`.
  - `AI.Azure_DOWDuplicateRequests` and `AI.Azure_DOWVolumeAnomaly`: denial-of-wallet.
  - `AI.Azure_AccessAnomaly`.
  - `AI.Azure_AnomalousOperation.InitialAccess`: service principal.
  - **`AI.Azure_AnomalousToolInvocation`**: an app invoking a tool in a way that deviates from expected behaviour; severity Low.
  - **(Preview)** `AI.Azure_LLMReconnaissance`.
  - **(Preview)** `AI.AIModelScan_MalwareDetected` for uploaded models.
  - An exposed Kubernetes service alert for AI apps on AKS.
- AI-SPM was reported GA, with AI threat protection under CWPP. — [jakubfras substack](https://jakubfras.substack.com/p/deep-dive-defender-for-cloud-ai-spm) (secondary)
- Microsoft Tech Community (late 2025): "AI security posture management for Microsoft Foundry agents… now in preview… Threat protection for Microsoft Foundry agents will be available soon." — [Microsoft Security blog](https://techcommunity.microsoft.com/blog/microsoft-security-blog/-/4469430)
- Defender for Cloud Apps "AI Agent Protection (Preview)", Nov 2025: discovers Copilot Studio and Foundry agents, collects audit logs, and raises XDR alerts and incidents with a dedicated Agent entity. — [Defender for Cloud Apps release notes](https://learn.microsoft.com/en-us/cloud-app-security/release-notes)
- Runtime protection extended to third-party and local agents through Agent 365. Local Windows endpoint agent runtime protection is in public preview. — [Petri](https://petri.com/?p=778590) (secondary)

**Purview DSPM for AI** — [Purview for Azure AI Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry); [DSPM for AI](https://learn.microsoft.com/purview/dspm-for-ai)
- Supported for Foundry: DSPM / DSPM for AI, auditing (prompts and responses go to the unified audit log), data classification, sensitivity labels, DLP, Insider Risk Management, and Communication Compliance.
- Requires pay-as-you-go billing.
- "DSPM for AI (classic)" has been superseded by a new DSPM that supports AI apps and agents.

**Evaluation and red teaming**
- **AI Red Teaming Agent**: public preview since 2025-04-04, integrating PyRIT. — [Foundry devblog](https://devblogs.microsoft.com/foundry/ai-red-teaming-agent-preview/)
- Extended to agentic risks on 2025-11-25, still public preview: prompt injection, harmful content, privacy leaks, robustness, and 20+ attack strategies. — [Foundry devblog, Nov 2025](https://devblogs.microsoft.com/foundry/assess-agentic-risks-with-the-ai-red-teaming-agent-in-microsoft-foundry/)

### Inferences
- Rough mapping of controls to Microsoft features:

  | Control | Microsoft feature |
  |---|---|
  | SAIF Agent User Control / Google "human controllers" / MCSB AI-5 / RAI A5 | MCP `require_approval` plus Entra **sponsors** (accountable human) |
  | SAIF Agent Permissions / MCSB AI-4 | Entra Agent ID, access packages, Conditional Access for agents, `allowed_tools`, tool-call guardrails |
  | SAIF Agent Observability / MCSB AI-6 | Foundry tracing, Defender alerts (AnomalousToolInvocation), Purview audit |
  | SAIF Prompt Injection / Insecure Model Output / MCSB AI-2 | Prompt Shields at input and tool response, output guardrails |
  | MCSB AI-7 / SAIF Red Teaming | AI Red Teaming Agent / PyRIT |

- Guardrail coverage gap: tool-call and tool-response guardrails do not cover MCP or custom tools that aren't on the supported list. Agents relying on MCP need compensating controls such as `require_approval`, gateway policies (APIM) and output validation.
- Status summary, late 2026:
  - **GA**: Entra Agent ID; CA/ID Protection for Agents licensing; most Defender AI alerts; input/output content filters and Prompt Shields (long-standing GA per training knowledge).
  - **Preview**: tool call/response guardrails, agent guardrails generally, MCSB v2, AI Red Teaming Agent, LLM recon and model-scan alerts, the Entra blueprint wizard. AI-SPM and threat protection for Foundry agents were preview at last confirmation (late 2025).

### Gaps
- I did not verify GA/preview status from primary 2026 pages for the following. My training knowledge says groundedness detection and Prompt Shields indirect attacks were long in preview or partial GA, but treat that as unconfirmed.
  - Groundedness detection.
  - Protected material for code.
  - **Spotlighting** (Prompt Shields document/indirect-attack mitigation).
  - Foundry **observability/tracing** (OpenTelemetry, Application Insights).
  - Foundry **evaluations**, including agent evaluators such as Tool Call Accuracy, Intent Resolution and Task Adherence.
- I did not confirm whether Defender for Cloud threat protection for *Foundry agents* (as opposed to model deployments) reached GA in 2026.
- I did not review the specific **Azure Policy built-in definitions** for AI services. Only one was confirmed, via MCSB AI-1: "[Preview]: Azure Machine Learning Deployments should only use approved Registry Models". MCSB maps 420+ policies in total, with the AI-specific ones listed in the [MCSB v2 policy mapping](https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-v2-controls-policy-mapping).
- I did not review the **Cloud Adoption Framework "AI agents" scenario** or the **Well-Architected AI workload** guidance. Both exist on learn.microsoft.com per training knowledge, but their content was not verified in this session.
- I did not retrieve the MCSB AI-5 implementation detail text, such as the approval thresholds Microsoft recommends.
