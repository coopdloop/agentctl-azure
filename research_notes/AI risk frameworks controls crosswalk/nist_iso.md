# AI governance standards for tool-using LLM agents: NIST AI RMF 1.0, NIST AI 600-1, NIST agent work, ISO/IEC 42001, ISO/IEC 23894 (status as of 2026-10-17)

> Method note: NIST AI RMF subcategory text and NIST AI 600-1 action IDs/text below were extracted directly from the official PDFs (NIST.AI.100-1.pdf, NIST.AI.600-1.pdf) with pdftotext and paraphrased. AI 600-1's two-column table layout sometimes puts a fragment of an action's text before its ID in the extracted output. The IDs are reliable, and the paraphrases were checked against reading order, but quote from the PDF before you put exact wording in a catalog. ISO texts are paywalled, so ISO titles come from iso.org pages and secondary summaries, and uncertainty is flagged where it applies.

## NIST AI RMF 1.0 (NIST AI 100-1): identity, status, structure, and agent-relevant subcategories

### Takeaway
AI RMF 1.0 (NIST AI 100-1, released 26 Jan 2023) is still the only version as of Oct 2026. NIST says it "is being revised as part of the White House AI Action Plan", but has published no draft or version number. The framework has 4 functions (GOVERN, MAP, MEASURE, MANAGE), 19 categories and 72 subcategories. For agents, the most useful subcategories are GOVERN 1.6 (inventory), 1.7 (decommissioning), 2.1/2.3 (accountability), 3.2 (human-AI roles), 4.3 (incidents), 6.1/6.2 (third parties); MAP 1.5 (risk tolerance), 3.5 (human oversight), 4.1/4.2 (component and third-party risk); MEASURE 2.4/2.6/2.7/2.10 (monitoring, safety, security, privacy); and MANAGE 2.3/2.4/3.1/3.2/4.1/4.3 (response, deactivation, third-party monitoring, post-deployment monitoring, incident communication).

### Cited Findings
**Identity, versions and companions**
- Official name: "Artificial Intelligence Risk Management Framework (AI RMF 1.0)", NIST AI 100-1. Released January 26, 2023. Earlier milestones: RFI on July 29, 2021, initial draft on March 17, 2022, second draft on August 18, 2022 — [NIST AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework)
- Revision status, verbatim from NIST: "The AI RMF 1.0 is being revised as part of the White House AI Action Plan." The page gives no date or draft — [NIST AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework). Third-party trackers likewise report no draft, version number or release date as of Oct 2026, and note that the front matter commits NIST to a formal community review no later than 2028 — [nistairmfkit.com](https://nistairmfkit.com/ai-rmf-2-0/); [normgrid timeline](https://www.normgrid.com/nist-ai-rmf/timeline/) (secondary sources)
- Companion resources: the AI RMF Playbook, the AI RMF Crosswalks and Roadmap, the Trustworthy and Responsible AI Resource Center (launched March 30, 2023), the Generative AI Profile NIST AI 600-1 (July 26, 2024), and a concept note for an AI RMF Profile on Trustworthy AI in Critical Infrastructure (April 7, 2026) — [NIST AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework)
- Related NIST AI documents: NIST AI 100-2 E2025, "Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations", final on 03/24/2025 with a corrected PDF on 4/1/2025, by Vassilev (NIST), Oprea, Fordyce, Anderson, Davies (UK AISI) and Hamin (US AISI) — [CSRC AI 100-2 E2025](https://csrc.nist.gov/pubs/ai/100/2/e2025/final). The COSAiS project also builds on SP 800-218A and Draft NIST AI 800-1 — [CSRC COSAiS](https://csrc.nist.gov/projects/cosais)

**Structure: the 19 categories (verbatim titles from the PDF)** — [NIST AI 100-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
- GOVERN 1: Policies, processes, procedures and practices for mapping, measuring and managing AI risks are in place, transparent and implemented effectively.
- GOVERN 2: Accountability structures are in place so that the appropriate teams and individuals are empowered, responsible and trained.
- GOVERN 3: Workforce diversity, equity, inclusion and accessibility processes are prioritized. (This is one of the areas the Action Plan reportedly targets for revision; see the secondary sources above.)
- GOVERN 4: Organizational teams are committed to a culture that considers and communicates AI risk.
- GOVERN 5: Processes are in place for robust engagement with relevant AI actors.
- GOVERN 6: Policies and procedures are in place to address AI risks and benefits arising from third-party software and data and other supply chain issues.
- MAP 1: Context is established and understood.
- MAP 2: Categorization of the AI system is performed.
- MAP 3: AI capabilities, targeted usage, goals, and expected benefits and costs compared with appropriate benchmarks are understood.
- MAP 4: Risks and benefits are mapped for all components of the AI system including third-party software and data.
- MAP 5: Impacts to individuals, groups, communities, organizations and society are characterized.
- MEASURE 1: Appropriate methods and metrics are identified and applied.
- MEASURE 2: AI systems are evaluated for trustworthy characteristics.
- MEASURE 3: Mechanisms for tracking identified AI risks over time are in place.
- MEASURE 4: Feedback about efficacy of measurement is gathered and assessed.
- MANAGE 1: AI risks based on assessments and other analytical output from MAP and MEASURE are prioritized, responded to and managed.
- MANAGE 2: Strategies to maximize AI benefits and minimize negative impacts are planned, prepared, implemented, documented and informed by input from relevant AI actors.
- MANAGE 3: AI risks and benefits from third-party entities are managed.
- MANAGE 4: Risk treatments, including response and recovery, and communication plans for identified and measured AI risks are documented and monitored regularly.

**Agent-relevant subcategories (ID: paraphrase of the official text)** — all from the [NIST AI 100-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
- *Policy and legal*
  - GOVERN 1.1: Legal and regulatory requirements involving AI are understood, managed and documented.
  - GOVERN 1.2: Trustworthy-AI characteristics are integrated into organizational policies and procedures.
- *Risk tolerance*
  - GOVERN 1.3: Processes determine the needed level of risk-management activity based on organizational risk tolerance.
  - MAP 1.5: Organizational risk tolerances are determined and documented.
  - MEASURE 2.6: The system is evaluated regularly for safety risks. Residual negative risk must not exceed risk tolerance, and the system must be able to fail safely, especially when operating beyond its knowledge limits.
  - MANAGE 1.1: Determine whether the system achieves its purpose and whether development or deployment should proceed.
  - MANAGE 1.3: Responses to high-priority risks (mitigate, transfer, avoid, accept) are developed, planned and documented.
  - MANAGE 1.4: Negative residual risks to downstream acquirers and end users are documented.
- *Monitoring the risk program*
  - GOVERN 1.4: The risk management process and its outcomes are established through transparent policies and controls.
  - GOVERN 1.5: Ongoing monitoring and periodic review of the risk process are planned, with roles and review frequency defined.
- *Inventory*
  - GOVERN 1.6: Mechanisms are in place to inventory AI systems, resourced according to risk priorities. (In practice this is where an agent registry belongs.)
- *Decommissioning*
  - GOVERN 1.7: Processes exist to decommission and phase out AI systems safely, without increasing risk or reducing trustworthiness.
  - MANAGE 2.4: Mechanisms are in place and applied, with responsibilities assigned, to supersede, disengage or deactivate AI systems whose performance or outcomes are inconsistent with intended use. (This is the kill switch.)
- *Accountability*
  - GOVERN 2.1: Roles, responsibilities and lines of communication for AI risk are documented and clear.
  - GOVERN 2.2: Personnel and partners receive AI risk training.
  - GOVERN 2.3: Executive leadership takes responsibility for AI risk decisions.
- *Human oversight*
  - GOVERN 3.2: Policies define and differentiate roles and responsibilities for human-AI configurations and oversight.
  - MAP 2.2: The system's knowledge limits, and how humans may use and oversee its output, are documented.
  - MAP 3.4: Operator and practitioner proficiency processes are defined, assessed and documented.
  - MAP 3.5: Processes for human oversight are defined, assessed and documented in line with GOVERN policies.
- *Culture, incidents and testing*
  - GOVERN 4.1: Policies foster a critical-thinking, safety-first mindset.
  - GOVERN 4.2: Teams document and communicate the risks and impacts of the AI they design, deploy or use.
  - GOVERN 4.3: Practices enable AI testing, identification of incidents, and information sharing.
- *Feedback*
  - GOVERN 5.1 and 5.2: External feedback is collected and integrated into system design.
  - MAP 5.2: Practices for regular engagement and impact feedback are in place.
  - MEASURE 3.3: End users and affected communities have channels to report problems and appeal outcomes.
- *Third party and supply chain*
  - GOVERN 6.1: Policies address third-party AI risks, including IP infringement.
  - GOVERN 6.2: Contingency processes handle failures or incidents in high-risk third-party data or AI systems.
  - MAP 4.1: Technology and legal risks of components, including third-party data and software, are mapped.
  - MAP 4.2: Internal risk controls for components, including third-party AI technologies, are identified and documented. (Applies to tools, MCP servers and model APIs.)
  - MANAGE 3.1: Third-party AI risks and benefits are regularly monitored, and controls are applied and documented.
  - MANAGE 3.2: Pre-trained models used in development are monitored as part of regular monitoring and maintenance.
- *Context and scope*
  - MAP 1.1: Intended purposes, context-specific laws and norms, and deployment settings are documented.
  - MAP 1.6: System requirements are elicited.
  - MAP 2.1: The tasks and methods the system supports are defined.
  - MAP 3.3: The targeted application scope is specified from capability and context. (Maps to scoping an agent's tools and permissions.)
  - MAP 5.1: The likelihood and magnitude of each impact are characterized, using public incident reports among other inputs.
- *Testing, evaluation, verification and validation (TEVV)*
  - MAP 2.3: TEVV considerations are documented.
  - MEASURE 1.1: Metrics are selected for the most significant risks.
  - MEASURE 1.3: Internal experts who were not front-line developers, or independent assessors, are involved in regular assessments.
  - MEASURE 2.1: Test sets, metrics and TEVV tools are documented.
  - MEASURE 2.3: Performance is measured under conditions similar to deployment.
  - MEASURE 2.5: The system is shown to be valid and reliable, and generalization limits are documented.
  - MEASURE 2.13: The effectiveness of the TEVV metrics and processes themselves is evaluated.
- *Production monitoring*
  - MEASURE 2.4: The functionality and behavior of the system and its components are monitored in production.
  - MEASURE 3.1: Existing, unanticipated and emergent risks are identified and tracked over time.
  - MANAGE 4.1: Post-deployment monitoring plans are implemented, covering user input, appeal and override, decommissioning, incident response, recovery and change management.
- *Security and resilience*
  - MEASURE 2.7: AI system security and resilience are evaluated and documented.
- *Transparency, accountability and explainability*
  - MEASURE 2.8: Transparency and accountability risks are examined and documented.
  - MEASURE 2.9: The model is explained, validated and documented, and output is interpreted in context. (Relevant to agent action logging and traceability.)
- *Privacy*
  - MEASURE 2.10: Privacy risk of the system is examined and documented.
- *Incident response*
  - MANAGE 2.3: Procedures are followed to respond to and recover from previously unknown risks.
  - MANAGE 4.3: Incidents and errors are communicated to relevant AI actors, including affected communities, and tracking, response and recovery processes are followed and documented.
- AI RMF "use-case profiles" are defined as implementations of the functions, categories and subcategories for a specific setting or application. This is the mechanism through which an "agent profile" would be expressed — [NIST AI 100-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)

### Inferences
- AI RMF 1.0 has no agent-specific subcategory. Agent controls (tool allowlists, scoped credentials, action approval) have to be derived from MAP 3.3/3.5, GOVERN 3.2, MEASURE 2.7 and MANAGE 2.4. In practice, a controls catalog should treat AI RMF as the governance spine and source technical controls from SP 800-53, COSAiS (when published) and AI 600-1.
- Because a revision is pending, catalog entries should pin "AI RMF 1.0 (Jan 2023)" and plan to re-map. Subcategory numbering may change, especially around GOVERN 3 (diversity, equity, inclusion and accessibility), which the Action Plan reportedly targets (secondary sources only).

### Gaps
- No primary-source detail on the scope or timing of the revision. Statements that the revision will remove references to misinformation, DEI and climate come from secondary sources only.
- The full count of 72 subcategories comes from general knowledge of the framework. I did not tally it from the PDF in this session.
- I did not fetch the Playbook (airc.nist.gov) in this session, so Playbook-level "suggested actions" for AI RMF 1.0 are not included.

## NIST AI 600-1 Generative AI Profile: the 12 risks and agent-relevant suggested actions

### Takeaway
NIST AI 600-1, "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile", was released 26 July 2024. It defines 12 GAI risks and about 200 suggested actions (207 unique IDs parsed from the PDF), keyed as GV/MP/MS/MG-x.y-nnn to AI RMF subcategories. Prompt injection, including indirect injection through retrieved data, is described under "Information Security". It appears as an explicit action only in MS-2.7-007 (red-team for prompt injection). MS-2.7-001 explicitly lists "autonomous agents" among the threats to assess.

### Cited Findings
- Release date: NIST-AI-600-1 was released July 26, 2024 — [NIST AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework). PDF: [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- The 12 GAI risks (section 2.1–2.12) — [NIST AI 600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf):
  1. CBRN Information or Capabilities
  2. Confabulation
  3. Dangerous, Violent, or Hateful Content
  4. Data Privacy
  5. Environmental Impacts
  6. Harmful Bias and Homogenization
  7. Human-AI Configuration
  8. Information Integrity
  9. Information Security
  10. Intellectual Property
  11. Obscene, Degrading, and/or Abusive Content
  12. Value Chain and Component Integration
- §2.9 Information Security states that GAI "expands the available attack surface, as GAI itself is vulnerable to attacks like prompt injection or data poisoning". It defines direct prompt injection, and indirect prompt injection where adversaries "exploit LLM-integrated applications by injecting prompts into data likely to be retrieved". It notes that researchers have shown indirect injection can steal proprietary data or run malicious code remotely — [NIST AI 600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- §2.1 CBRN notes that ongoing assessment should monitor "GAI systems' connection or access to relevant data and tools". This is a tool-access concern — [NIST AI 600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- §2.2 defines Confabulation as confidently presented erroneous or false content, including confabulated logic or citations. It flags the risk as especially important in consequential decision-making — [NIST AI 600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

**Representative suggested actions (ID: paraphrase, [GAI risks tagged])** — all from the [NIST AI 600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- *Inventory (GOVERN 1.6)*
  - GV-1.6-001: Enumerate GAI systems into the AI inventory, and adjust inventory requirements for GAI risks. [Information Security]
  - GV-1.6-002: Define inventory exemptions for GAI embedded in application software. [Value Chain]
  - GV-1.6-003: Inventory entries should include data provenance, known issues (AI incident databases, AVID, CVE, NVD, OECD monitor), human oversight roles, and further items.
- *Risk tolerance and acceptable use*
  - GV-1.3-001: Consider risk factors including possibility of malicious use, whether the system introduces significant new security vulnerabilities, and unreliable decision-making.
  - GV-1.3-004: Obtain stakeholder input to identify unacceptable use.
  - GV-3.2-003: Define acceptable use policies for GAI interfaces, modalities and human-AI configurations, including criteria for queries to refuse. [Human-AI Configuration]
  - MG-2.2-001: Compare outputs against predefined organizational risk tolerance.
- *Incident processes*
  - GV-1.5-001: Define responsibilities for periodic review of content provenance and incident monitoring.
  - GV-1.5-002: Establish after-action reviews of incident response and disclosure, and update the processes. [Human-AI Configuration; Information Security]
  - GV-1.5-003: Keep a document retention policy for TEVV history.
  - GV-2.1-001: Establish roles and procedures for communicating GAI incidents to AI actors and downstream stakeholders, including via AI incident database, AVID, CVE, NVD or the OECD monitor.
  - GV-4.3-002: Define a minimum incident-report schema: System ID, Title, Reporter, System/Source, Data Reported, Date, Description, Impact(s), Stakeholders. [Information Security]
- *Deactivation and decommissioning*
  - GV-1.7-001: Protocols ensure GAI systems can be deactivated when necessary. [Information Security; Value Chain]
  - GV-1.7-002: Factors to consider when decommissioning: data retention, data security and leakage after decommissioning, dependencies on upstream and downstream systems, open-source data and models, and users' emotional entanglement.
  - MG-2.4-001: Communication plans for deactivation or disengagement, covering reasons, workarounds, user access removal, alternatives and contacts.
  - MG-2.4-002: Escalate incidents to the risk authority when deactivation or disengagement criteria are met.
  - MG-2.4-003: Remediation procedures with stakeholder timelines.
  - MG-2.4-004: Establish and regularly review criteria that warrant deactivation, in line with risk tolerance. [Information Security]
- *Human-AI configuration and oversight*
  - GV-3.2-001: Independent evaluations, proportional to risk.
  - GV-4.1-003: Oversight functions across the lifecycle, from supply chain to decommissioning.
  - MP-3.4-004: Delineate human proficiency tests from tests of GAI capabilities.
  - MS-2.8-004: Verify the adequacy of user instructions through user testing.
  - MG-4.1-003 and MG-4.2-003 are also tagged Human-AI Configuration.
- *Value chain and third party*
  - GV-6.1-005: Use-case-based supplier risk assessment framework to evaluate and monitor third parties, covering services acquisition, value chain risk management and legal compliance.
  - GV-6.1-010: Update acceptable use policies to cover proprietary and open-source GAI and third-party personnel.
  - GV-6.2-001: Document value-chain risks to find over-reliance on third parties and identify fallbacks.
  - GV-6.2-003: Third-party GAI incident response plans: align with MAP 5.1, define ownership, rehearse regularly.
  - GV-6.2-006: Test rollover and fallback, including manual processing.
  - GV-6.2-007: Review vendor contracts for liability assignment, change notification and secondary data use.
  - MP-5.2-002: Review third-party data and algorithms for unanticipated impacts.
  - MG-3.1-001: Apply risk tolerances and controls (procurement, input/output filtering, grounding, RAG) to third-party GAI resources.
  - MG-3.1-002: Test value-chain risks: data poisoning, malware, software and hardware vulnerabilities, data privacy and localization.
  - MG-3.1-003: Re-assess model risks after fine-tuning or RAG, and for third-party models used in untested use cases.
  - MG-3.2-009: Decommission or retrain pre-trained models that perform outside defined limits.
- *Information security and prompt injection*
  - MS-2.6-007: Regularly evaluate vulnerability to circumvention of safety measures.
  - MS-2.7-001: Apply established security measures to assess vulnerabilities and threats including "backdoors, compromised dependencies, data breaches, eavesdropping, man-in-the-middle attacks, reverse engineering, autonomous agents, model theft or exposure of model weights, AI inference, bypass, extraction…". [Data Privacy; Information Integrity; Information Security; Value Chain]
  - MS-2.7-004: Metrics for security effectiveness, such as unauthorized access attempts, inference, bypass, extraction and penetrations.
  - MS-2.7-006: Measure how quickly security recommendations and incident lessons are implemented.
  - MS-2.7-007: Red-team for resilience against abuse to attack other systems (malicious code, phishing), "GAI attacks (e.g., prompt injection)", and ML attacks (adversarial prompts, data poisoning, membership inference, model extraction, sponge examples). [Information Security; Harmful Bias; Dangerous Content]
  - MS-2.7-008: Verify that fine-tuning does not compromise safety and security controls.
  - MS-2.7-009: Regularly verify that security measures remain effective and have not been compromised.
- *Data privacy*
  - GV-1.1-001: Align with privacy, copyright and IP law.
  - MP-4.1-001: Periodically monitor generated content for PII or sensitive data exposure.
  - MP-4.1-009: Detect PII or sensitive data in generated output.
  - MS-2.2-002: Privacy-enhancing techniques, including output filters and PII removal.
  - MG-4.3-003: Report incidents per legal requirements, such as HIPAA breach reporting. [Information Security; Data Privacy]
- *Confabulation*
  - MS-2.3-001: Consider baseline benchmark performance when selecting a model for fine-tuning or RAG. [Information Security; Confabulation]
  - MS-2.5-003 is tagged Confabulation.
  - MG-3.2-009 (decommission or retrain models that perform out of limits) is tagged Confabulation.
  - MG-4.1-002: Post-deployment monitoring, particularly for confabulation, CBRN and cyber risks.
  - MG-4.3-002: Record and track reported errors, near-misses and negative impacts. [Confabulation; Information Integrity]
- *Incident response and after-action*
  - MG-2.3-001: Incident response and recovery plans must account for the GAI value chain and for newly detected uses.
  - MG-4.3-001: After-action assessments of incidents, including communication to regulators.

### Inferences
- AI 600-1 predates mainstream tool-calling agents. "Autonomous agents" appears only as a threat item in MS-2.7-001, and there are no actions on tool permissions, agent identity or action approval. A catalog for agents should cite MS-2.7-007 and §2.9 for prompt injection, and GV-1.7-001/MG-2.4-004 for kill switches. Those agent-specific controls themselves need to come from SP 800-53, COSAiS or OWASP-type sources.
- The "Value Chain and Component Integration" risk is the natural home for third-party tools, MCP servers and model APIs (GV-6.x, MG-3.1-x).

### Gaps
- PDF table extraction is imperfect. Before quoting action text verbatim, check it against the PDF for GV-1.3-001, MG-2.4-001 to MG-2.4-003 and MS-2.7-001, where extracted fragments straddled the ID boundaries.
- No update or second edition of AI 600-1 was found as of Oct 2026.

## NIST agent-specific work by late 2026 (CAISI, NCCoE, COSAiS, Cyber AI Profile)

### Takeaway
By Oct 2026 NIST has started several agent-specific efforts but published no final agent standard, profile or overlay:
- **CAISI's AI Agent Standards Initiative** (launched Feb 2026), including an RFI on AI agent security.
- **NCCoE concept paper**, "Accelerating the Adoption of Software and AI Agent Identity and Authorization" (initial public draft, 5 Feb 2026).
- **COSAiS**, SP 800-53 overlays with single-agent and multi-agent use cases. These are still only "proposed use cases". The only artifacts published are a concept paper (Aug 2025) and a predictive-AI annotated outline (Jan 2026).
- **CAISI red-teaming research** on agent hijacking.
- **Preliminary draft Cyber AI Profile (NIST IR 8596)**, Dec 2025.

### Cited Findings
- **AI Agent Standards Initiative (CAISI)**
  - The page is titled "Ensuring a Trusted, Interoperable, and Secure Agentic Frontier" and was created February 17, 2026. It has three pillars: industry-led standards (convenings, gap analyses, voluntary guidelines, international standards work with NSF), community-led protocols (interoperable agent protocols, NSF open-source ecosystem funding), and research into agent authentication, identity infrastructure and security evaluations — [NIST CAISI AI Agent Standards Initiative](https://www.nist.gov/caisi/ai-agent-standards-initiative)
  - Activities listed: a CAISI RFI on AI Agent Security (due March 9), the NCCoE draft concept paper on software and AI agent identity and authorization (comments due April 2), and CAISI listening sessions on barriers to adoption in healthcare, finance and education. No document IDs or final reports are listed — [NIST CAISI AI Agent Standards Initiative](https://www.nist.gov/caisi/ai-agent-standards-initiative)
  - The RFI was published in the Federal Register on 2026-01-08 as document 2026-00206, "Request for Information Regarding Security Considerations for Artificial Intelligence Agents" — [Federal Register](https://www.federalregister.gov/documents/2026/01/08/2026-00206/request-for-information-regarding-security-considerations-for-artificial-intelligence-agents)
  - ANSI reported the launch on 2/18/26 — [ANSI](https://www.ansi.org/standards-news/all-news/2-18-26-nist-launches-ai-agent-standards-initiative)
- **NCCoE concept paper on agent identity and authorization**
  - Full title: "Accelerating the Adoption of Software and AI Agent Identity and Authorization". CSRC lists it as an initial public draft dated 2026-02-05 — [CSRC](https://csrc.nist.gov/pubs/other/2026/02/05/accelerating-the-adoption-of-software-and-ai-agent/ipd); [PDF](https://www.nccoe.nist.gov/sites/default/files/2026-02/accelerating-the-adoption-of-software-and-ai-agent-identity-and-authorization-concept-paper.pdf); [NCCoE project page](https://www.nccoe.nist.gov/projects/software-and-ai-agent-identity-and-authorization); [NIST news](https://www.nist.gov/news-events/news/2026/02/new-concept-paper-identity-and-authority-software-agents)
  - Authors are reported as Booth, Fisher, Galluzzo and Roberts. Agents are treated as identifiable entities in enterprise IAM rather than anonymous automation on shared credentials. The intended output is a practice guide built in the NCCoE lab, and RAG-only and LLM-only implementations are reportedly out of scope — [Biometric Update](https://biometricupdate.com/202603/nist-concept-paper-explores-identity-and-authorization-controls-for-ai-agents); [ExecutiveGov](https://executivegov.com/articles/nist-nccoe-concept-paper-ai-agent-access-controls) (secondary)
  - Secondary summaries say it covers authentication, authorization, auditing, non-repudiation and prompt-injection mitigation — [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-nist-ai-agent-standards-initiative-complia/) (secondary, AI-assisted)
  - The project page says input "will inform subsequent project planning activities, including the development of a draft project description". I found no draft project description published as of Oct 2026 — [NCCoE project page](https://www.nccoe.nist.gov/projects/software-and-ai-agent-identity-and-authorization)
- **COSAiS (Control Overlays for Securing AI Systems)**
  - COSAiS is a series of SP 800-53 overlays built on SP 800-218A, Draft NIST AI 800-1 and NIST AI 100-2 E2025.
  - Proposed use cases: (1) Adapting and Using Generative AI (Assistant/LLM); (2) Using and Fine-Tuning Predictive AI; (3) Using AI Agent Systems, Single Agent; (4) Using AI Agent Systems, Multi-Agent; (5) Security Controls for AI Developers.
  - Publications: "NIST SP 800-53 Control Overlays for Securing AI Systems Concept Paper" (Aug 14, 2025), and an annotated outline (discussion draft) for "Using and Fine-Tuning Predictive AI" (Jan 8, 2026, feedback by Feb 13, 2026).
  - The project page was last updated Jan 8, 2026. The agent overlays have no draft listed.
  - Source: [CSRC COSAiS](https://csrc.nist.gov/projects/cosais)
  - Secondary sources report that the concept paper's gap analysis named AC, IA, AU and SR as the 800-53 families with the largest AI gaps. They disagree on timing: "late 2026 through 2027" versus "not before 2027" — [CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-nist-ai-agent-standards-20260416-csa-style/); [agentmodeai](https://agentmodeai.com/nist-cosais-sp-800-53-ai-agent-security-gap/) (secondary)
  - One blog cites a "NISTIR 8605D" for agentic controls. I could not verify it against any NIST source; treat it as unconfirmed — [aibuzz](https://aibuzz.blog/nist-cosais-explained/)
- **CAISI agent hijacking research**
  - A CAISI research blog post (March 23, 2026) presents insights from a large-scale public red-teaming competition on tool-use, coding and computer-use agents, run with Gray Swan, the UK AISI and frontier labs — [CAISI blog](https://www.nist.gov/blogs/caisi-research-blog/insights-ai-agent-security-large-scale-red-teaming-competition)
  - A secondary source reports 13 models tested, over 250,000 attacks, and at least one successful hijack against every model — [CSA note PDF](https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/04/CSA_research_note_nist-caisi-ai-agent-security-agenda-2026_20260414-csa-styled.pdf) (secondary; verify the figures against the paper)
  - CAISI's Sept 2025 DeepSeek evaluation used agent-hijacking tests — [NIST](https://www.nist.gov/news-events/news/2025/09/caisi-evaluation-deepseek-ai-models-finds-shortcomings-and-risks)
- **Cyber AI Profile (NIST IR 8596)**
  - A preliminary draft was released Dec 16, 2025, applying CSF 2.0 across three focus areas: securing AI systems, AI-enabled cyber defense, and thwarting AI-enabled attacks. Comments closed Jan 30, 2026 — [ClearanceJobs](https://news.clearancejobs.com/2025/12/19/nist-releases-new-ai-cybersecurity-framework-and-its-just-the-beginning/); [Mondaq](https://www.mondaq.com/unitedstates/new-technology/1727724/nist-issues-preliminary-draft-of-cyber-ai-profile-a-framework-poised-to-alter-security-operations-in-the-ai-driven-threat-landscape) (secondary)
  - The COSAiS page notes a "Cyber AI Profile Workshop #2" on Jan 14, 2026 — [CSRC COSAiS](https://csrc.nist.gov/projects/cosais)

### Inferences
- An agent controls catalog should note these as "watch items" rather than normative references. Of the agent-specific NIST work, only the NCCoE concept paper (identity and authorization) and the COSAiS concept paper are citable today.
- Expected control emphasis for agents is AC, IA, AU and SR. This comes from the secondary report of the COSAiS gap analysis and from the NCCoE focus on agent identity, authorization, audit and non-repudiation.

### Gaps
- I could not confirm whether an initial public draft of NIST IR 8596 or any COSAiS agent overlay draft was released between Feb and Oct 2026. Primary pages showed none, and the COSAiS page was last updated Jan 2026.
- I found no NIST "AI RMF agent profile". The only new AI RMF profile is the Critical Infrastructure concept note (Apr 2026).
- I found no published synthesis or report of the CAISI RFI responses.
- From memory and not re-verified in this session: a Jan 2025 US AISI technical blog, "Strengthening AI Agent Hijacking Evaluations". Verify it before citing.

## ISO/IEC 42001:2023 (AI management system): Annex A controls and agent relevance

### Takeaway
ISO/IEC 42001:2023, "Information technology — Artificial intelligence — Management system", is a certifiable AIMS standard published December 2023. It has clauses 4–10 in the Harmonized Structure, plus Annex A (normative: 9 control objectives, A.2–A.10, with 38 controls), Annex B (implementation guidance), Annex C (potential organizational objectives and risk sources) and Annex D (use across domains and sectors). For agents, the key controls are:
- A.6.2.6 operation and monitoring
- A.6.2.8 event logs
- A.4.4 tooling resources
- A.5 impact assessment
- A.8.4 incident communication
- A.9.2–A.9.4 responsible and intended use
- A.10.2–A.10.4 allocation of responsibilities, suppliers and customers

### Cited Findings
- Annex A objectives and controls, as listed by a secondary summary (38 controls in 9 objectives) — [RiskProfs Annex A list](https://riskprofs.com/iso-42001-annex-a-controls-list/):
  - **A.2 Policies related to AI**: A.2.2 AI policy; A.2.3 Alignment with other organizational policies; A.2.4 Review of the AI policy
  - **A.3 Internal organization**: A.3.2 AI roles and responsibilities; A.3.3 Reporting of concerns
  - **A.4 Resources for AI systems**: A.4.2 Resource documentation; A.4.3 Data resources; A.4.4 Tooling resources; A.4.5 System and computing resources; A.4.6 Human resources
  - **A.5 Assessing impacts of AI systems**: A.5.2 AI system impact assessment process; A.5.3 Documentation of AI system impact assessments; A.5.4 Assessing AI system impact on individuals or groups of individuals; A.5.5 Assessing societal impacts of AI systems
  - **A.6 AI system life cycle**: A.6.1.2 Objectives for responsible development of AI system; A.6.1.3 Processes for responsible AI system design and development; A.6.2.2 AI system requirements and specification; A.6.2.3 Documentation of AI system design and development; A.6.2.4 AI system verification and validation; A.6.2.5 AI system deployment; A.6.2.6 AI system operation and monitoring; A.6.2.7 AI system technical documentation; A.6.2.8 AI system recording of event logs
  - **A.7 Data for AI systems**: A.7.2 Data for development and enhancement of AI system; A.7.3 Acquisition of data; A.7.4 Quality of data for AI systems; A.7.5 Data provenance; A.7.6 Data preparation
  - **A.8 Information for interested parties of AI systems**: A.8.2 System documentation and information for users; A.8.3 External reporting; A.8.4 Communication of incidents; A.8.5 Information for interested parties
  - **A.9 Use of AI systems**: A.9.2 Processes for responsible use of AI systems; A.9.3 Objectives for responsible use of AI system; A.9.4 Intended use of the AI system
  - **A.10 Third-party and customer relationships**: A.10.2 Allocation of responsibilities; A.10.3 Suppliers; A.10.4 Customers
- Conflicting titles: a myctrl.tools page labels A.9.4 "Providing Information to Other Stakeholders", and its navigation labels A.6.2.6 "Data Sets and Statistical Properties". Both conflict with the RiskProfs list and with the commonly cited titles. The myctrl.tools labels look like a mis-mapping, but confirm against the standard — [myctrl.tools A.9.4](https://myctrl.tools/frameworks/iso-42001-detailed/a-9-4); [myctrl.tools A.6.2.5](https://myctrl.tools/frameworks/iso-42001-detailed/a-6-2-5)
- Annex B gives implementation guidance for each Annex A control and "does not require one universal implementation method" — [RiskProfs](https://riskprofs.com/iso-42001-annex-a-controls-list/)
- ISO's official page for 42001 is at [iso.org/standard/81230.html](https://www.iso.org/standard/81230.html). The control text is paywalled.

**How the controls map to agent concerns**
- *Agent inventory and tooling*: A.4.2, A.4.4 (tools and models used), A.4.5.
- *Accountability*: A.3.2, plus A.10.2 for the split between provider and deployer.
- *Escalation channel*: A.3.3.
- *Human oversight and permitted use*: A.9.2–A.9.4, with A.6.2.2 requirements defining tool scope.
- *Testing and evaluation*: A.6.2.4.
- *Change and release gating*: A.6.2.5.
- *Runtime monitoring*: A.6.2.6.
- *Audit trail of agent actions and tool calls*: A.6.2.8.
- *Retrieved and RAG data and data provenance*: A.7.3–A.7.5.
- *Incident communication*: A.8.4.
- *Model and tool vendors*: A.10.3.
- *Downstream users*: A.10.4.
- *Impact assessment*: A.5.2–A.5.5, with ISO/IEC 42005 as guidance.

### Inferences
- 42001 has no explicit "decommissioning" control title. Retirement falls under A.6 lifecycle (and A.6.1.3 processes) and the Annex B guidance. Security controls such as authentication and least privilege are expected to come from ISO/IEC 27001/27002, which an AIMS typically integrates.
- NIST maintains AI RMF crosswalks, including to ISO/IEC 42001 and 23894, among its companion resources. Use the NIST crosswalk rather than a homemade one where possible — [NIST AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework) (the crosswalk content itself was not fetched).

### Gaps
- The exact wording of a few titles (for example "AI system" vs "AI systems", and the precise A.5.4 phrasing) could not be verified against ISO text. All Annex A titles come from a secondary list, and I did not fetch an official preview. The Annex C and Annex D titles are from general knowledge and were not verified in this session.
- I did not find any amendment to ISO/IEC 42001 by Oct 2026, but I did not explicitly search for one.

## ISO/IEC 23894:2023 (AI risk management guidance), ISO/IEC 42005:2025 and ISO/IEC 42006:2025

### Takeaway
ISO/IEC 23894:2023, "Information technology — Artificial intelligence — Guidance on risk management", is non-certifiable guidance that adapts ISO 31000:2018 to AI. Its main body covers principles, framework and process. Annex A covers objectives, Annex B AI risk sources, and Annex C a mapping of risk management to the AI lifecycle. Two companion standards were published in 2025: ISO/IEC 42005:2025 (AI system impact assessment, May 2025) and ISO/IEC 42006:2025 (requirements for bodies that audit and certify 42001 AIMS, July 2025).

### Cited Findings
- The official table of contents lists Annex A (informative) Objectives, Annex B (informative) Risk sources, and Annex C (informative) Risk management and AI system life cycle — [ANSI preview of ISO/IEC 23894:2023](https://webstore.ansi.org/preview-pages/ISO/preview_ISO+IEC+23894-2023.pdf)
- The Annex B risk sources include complexity of environment, lack of transparency and explainability, level of automation, machine learning–related risk sources, system hardware issues, system life cycle issues, and technology readiness. Annex C is an example mapping of risk management processes to the AI system lifecycle — [OECD.AI Policy Navigator](https://oecd.ai/en/dashboards/policy-initiatives/information-technology-%E2%80%94-artificial-intelligence-%E2%80%94-guidance-on-risk-management-isoiec-23894); [AI Standards Hub](https://aistandardshub.org/a-new-standard-for-ai-risk-management)
- 23894 draws its terms from ISO 31000:2018, ISO/IEC 22989:2022 and ISO Guide 73:2009, and it builds on ISO 31000 — [ANSI preview](https://webstore.ansi.org/preview-pages/ISO/preview_ISO+IEC+23894-2023.pdf); [OECD.AI](https://oecd.ai/en/dashboards/policy-initiatives/information-technology-%E2%80%94-artificial-intelligence-%E2%80%94-guidance-on-risk-management-isoiec-23894)
- A DeepInspect article describes Annex C as mapping risk to objectives. That contradicts the official table of contents, so treat it as unreliable — [DeepInspect](https://www.deepinspect.ai/blog/iso-23894-ai-risk-management)
- ISO/IEC 42005:2025 (AI system impact assessment) is published as Edition 1, May 2025. The SCC database gives the publish date as 2025-05-27 (one secondary source says May 28). It gives guidance on when and how to perform AI system impact assessments across the lifecycle, and on documenting them — [ISO 42005 page](https://www.iso.org/standard/44545.html); [SCC](https://scc-ccn.ca/standardsdb/standards/8188107)
- ISO/IEC 42006:2025 (requirements for bodies providing audit and certification of AI management systems) is Edition 1, published July 2025. It supplements ISO/IEC 17021-1 for certification bodies auditing against 42001 — [ISO 42006 page](https://www.iso.org/standard/42006); [SCC](https://scc-ccn.ca/standardsdb/standards/8187573); [EVS news, 5 Aug 2025](https://www.evs.ee/en/auditing-ai-management-systems). The direct fetch of the ISO page returned 403; these details come from the search-result snippet and the SCC and EVS pages.

### Inferences
- Several Annex B risk sources apply directly to tool-using agents. "Level of automation" covers autonomy and actions without a human, "complexity of environment" covers open-world tool and web inputs, and "system life cycle issues" covers changing model and tool versions. Together they give the ISO-side justification for agent risk entries.
- Inferred from standard 31000 architecture and not clause-verified: the main body follows ISO 31000 — clause 4 principles, clause 5 framework, clause 6 process (communication and consultation; scope, context and criteria; assessment; treatment; monitoring and review; recording and reporting).
- ISO/IEC 42005 is the natural reference for 42001 A.5 controls, and ISO/IEC 42006 matters only if certification is pursued.

### Gaps
- The sources I found do not give the exact 23894 clause numbering or the full list of Annex B subsections. Confirm against the ANSI preview or the full text.
- I did not check whether other ISO/IEC SC 42 agent-related work (for example, any new work item on AI agents) has been published or is in progress by Oct 2026.
