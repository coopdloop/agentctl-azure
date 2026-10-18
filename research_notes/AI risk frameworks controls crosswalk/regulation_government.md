# Regulatory & Government Guidance for Deploying Tool-Using LLM Agents (EU AI Act, UK NCSC/DSIT/ETSI, US CISA/NSA/OMB, others) — status as of Oct 2026

Note on sourcing: items marked **[verified this session]** were fetched or searched from the cited page during this research (Oct 2026). Items marked **[prior knowledge; URL not re-fetched]** come from the primary legal text or document as the researcher already knew it. The URL is the canonical primary source, but the page was not re-opened this session. The report writer should treat the second group as reliable for stable legal text (article contents of Reg. 2024/1689) but lower-confidence for anything that might have been amended.

## Q1. EU AI Act (Regulation (EU) 2024/1689): timeline, Digital Omnibus changes, and article-level obligations an agent platform can evidence

### Takeaway
The Digital Omnibus on AI is **adopted law**, not a proposal: Regulation (EU) 2026/1744, dated 8 July 2026, in force since 27 July 2026. It pushes Annex III high-risk obligations from 2 Aug 2026 to **2 Dec 2027** and Annex I (product-embedded) obligations to **2 Aug 2028**. It leaves the Feb 2025 prohibitions, the Aug 2025 GPAI obligations and Art. 50 transparency largely intact, adds two new Art. 5 prohibitions from 2 Dec 2026, softens Art. 4 AI literacy, and centralises supervision of GPAI-based systems in the AI Office. For an enterprise deploying agents on Azure OpenAI or Foundry models today, the obligations that already bite are: Art. 4 (literacy), Art. 5 (prohibitions), Art. 50 (disclosure of AI interaction and synthetic content), and Art. 25 (the risk of becoming a "provider"). The provider side (Microsoft/OpenAI) carries Art. 53/55. The full high-risk stack (Arts. 9–15, 26, 27, 72, 73) applies only if an agent's use case falls in Annex III, and not until Dec 2027.

### Cited Findings

**Original application timeline (Art. 113)** [prior knowledge; URL not re-fetched] — [EUR-Lex, Reg. 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj); [Art. 113 text](https://artificialintelligenceact.eu/article/113/)
- Entry into force: 1 Aug 2024. General application: 2 Aug 2026.
- **2 Feb 2025:** Chapters I and II apply (definitions, Art. 4 AI literacy, Art. 5 prohibitions).
- **2 Aug 2025:** Chapter III Section 4 (notified bodies), Chapter V (GPAI models, Arts. 51–56), Chapter VII (governance), Chapter XII (penalties) and Art. 78 apply. Art. 101 (Commission fines on GPAI providers) is the exception.
- **2 Aug 2026:** GPAI fines under Art. 101 become enforceable. Under Art. 111(3), GPAI models placed on the market before 2 Aug 2025 must comply by 2 Aug 2027.
- **2 Aug 2027 (original):** Art. 6(1) / Annex I product-safety high-risk.
- Penalties (Art. 99): up to €35M or 7% of worldwide turnover for Art. 5 breaches; €15M or 3% for most other obligations (including deployer duties under Art. 26 and transparency under Art. 50); €7.5M or 1% for supplying incorrect information. — [Art. 99](https://artificialintelligenceact.eu/article/99/)

**Digital Omnibus on AI: adopted status and changes** [verified this session]
- Legal instrument: Regulation (EU) 2026/1744 of the European Parliament and of the Council of 8 July 2026. It amends Reg. 2024/1689, 2018/1139 and 2023/1230, and has applied since 27 July 2026. — [artificialintelligenceact.eu – Digital Omnibus](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/)
- Council final approval came on 29 June 2026. Secondary sources give OJ publication as 24 July 2026 and entry into force as 27 July 2026. — [Formalize summary](https://formalize.com/en/blog/eu-ai-act-digital-omnibus); [Orrick, Jul 2026](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes). Caveat: one vendor page (Usercentrics) contradicts itself on whether a delay happened; the law-firm and AI Act Explorer sources consistently support it.
- The Commission proposed the Omnibus on 19 Nov 2025. [prior knowledge; this date was not re-verified this session]
- **New dates:** — [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)
  - Annex III high-risk (Art. 6(2)) applies from **2 Dec 2027** (amended Art. 113(c)(i)). Systems placed on the market before then are caught only if substantially modified afterwards.
  - Annex I high-risk (Art. 6(1)) applies from **2 Aug 2028** (Art. 113(c)(ii)).
  - High-risk systems used by public authorities must comply by **2 Aug 2030** (Art. 111(2)).
  - Art. 50(2) machine-readable marking: generative systems placed on the market before 2 Aug 2026 have until **2 Dec 2026** (Art. 111(4)).
  - New Art. 5(1)(ba)/(bb) prohibitions apply from **2 Dec 2026**: (ba) non-consensual realistic intimate or sexual depictions of identifiable persons ("nudifiers"); (bb) CSAM generation. Under Art. 5(1a)–(1b), placing a system on the market is prohibited only where that output is the intended purpose or a reasonably foreseeable, reproducible outcome lacking adequate safeguards.
  - Post-market monitoring guidance under Art. 72(3) is now due by 2 Sep 2027. Art. 96 guidelines are due by 1 Aug 2027.
- **Art. 4 AI literacy reframed:** the obligation becomes taking measures to *support* AI literacy, not guaranteeing a given level for each individual. The Commission must publish practical examples. — [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/)
- **New Art. 4a:** exceptional processing of special-category data for bias detection and correction, under conditions: strict necessity, synthetic or anonymised data insufficient, access controls, no onward transfer, deletion, and records of necessity. It extends to deployers of high-risk systems and creates no duty to run bias detection. — [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes) (Orrick frames this as an amendment to Art. 10(5))
- **Art. 27 FRIA:** deployers may cross-reference an existing GDPR DPIA (Art. 27(4)–(5)), and the AI Office must supply a simplified questionnaire template. — [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/)
- **AI Office centralisation (Art. 75(1), new Arts. 75a–75d):** exclusive competence over AI systems based on a GPAI model from the same provider or group, and over AI integrated into VLOPs/VLOSEs. Powers cover investigations, inspections, retention orders, commitments, fines and periodic penalties of up to 5% of average daily turnover per day. The AI Office also receives serious-incident reports for these systems. — [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)
- **SME / small mid-cap (SMC) relief:** SMCs are non-SMEs with fewer than 750 staff and turnover up to €150M or balance sheet up to €129M. Relief covers simplified technical documentation (Art. 11(1)), proportionate QMS (Art. 17(2)) and lower fine caps (Art. 99(6a)). — [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)
- **Other changes:**
  - Narrower "safety component" definition (Art. 3(14)/Art. 6(1a)–(1c)).
  - Systems covered by the Cyber Resilience Act (Reg. 2024/2847) are deemed compliant with certain cybersecurity requirements (Art. 42(3)).
  - New Art. 40(2) paragraph on unified standards.
  - Fines now apply to breaches of Art. 25(2) and (4) (Art. 99(4)(da)).
  - Sources: [AI Act Explorer](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)

**Article-level obligations and what an agent platform could evidence** [article text: prior knowledge; URLs not re-fetched; dates as amended above]
- **Art. 4 AI literacy** (from 2 Feb 2025; softened by the Omnibus). Providers and deployers take measures for sufficient AI literacy of staff operating or using AI systems, taking into account the context of use. *Evidence:* role-based training records for agent builders, approvers and operators; acceptable-use policy. — [Art. 4](https://artificialintelligenceact.eu/article/4/)
- **Art. 5 prohibited practices** (from 2 Feb 2025). Bans include:
  - subliminal, manipulative or deceptive techniques causing significant harm (5(1)(a));
  - exploiting vulnerabilities (b);
  - social scoring (c);
  - predicting criminal offences solely from profiling (d);
  - untargeted facial-image scraping (e);
  - emotion recognition in workplaces and education (f);
  - biometric categorisation inferring sensitive traits (g);
  - real-time remote biometric identification for law enforcement (h);
  - the two Omnibus additions from 2 Dec 2026.
  
  *Evidence:* use-case intake screening against the Art. 5 list; deny-listed agent purposes and tools.
  
  Sources: [Art. 5](https://artificialintelligenceact.eu/article/5/); Commission guidelines on prohibited practices (Feb 2025) [prior knowledge].
- **Art. 9 risk management system** (high-risk providers). A continuous, iterative process across the lifecycle:
  - identify known and reasonably foreseeable risks, including reasonably foreseeable misuse;
  - estimate and evaluate them, including from post-market data;
  - adopt targeted measures;
  - test against predefined metrics and probabilistic thresholds before market placement (9(6)–(8));
  - consider impacts on under-18s and vulnerable groups (9(9)).
  
  *Evidence:* agent threat model and risk register, evaluation and red-team results, residual-risk sign-off. — [Art. 9](https://artificialintelligenceact.eu/article/9/)
- **Art. 10 data governance** (high-risk providers). Training, validation and test data need governance practices covering design choices, collection and provenance, preparation, assumptions, bias examination and mitigation (10(2)(f)–(g)), and gaps. Data must be relevant, sufficiently representative and, to the best extent possible, free of errors (10(3)). *Agent relevance:* applies mainly to fine-tuning and evaluation datasets. RAG corpora are not expressly addressed (see Gaps). — [Art. 10](https://artificialintelligenceact.eu/article/10/)
- **Art. 12 record-keeping** (high-risk). Systems must technically allow automatic recording of events (logs) over their lifetime. Logs must enable identification of situations that may result in risk or substantial modification, facilitate post-market monitoring (Art. 72), and support deployer monitoring under Art. 26(5). Art. 12(3) adds minimum fields for remote biometric ID. Retention: providers keep logs under their control for at least 6 months (Art. 19); deployers do the same (Art. 26(6)). *Evidence:* immutable agent traces covering prompts, tool calls, tool results, approvals and identity, with a retention policy of 6 months or more. — [Art. 12](https://artificialintelligenceact.eu/article/12/); [Art. 19](https://artificialintelligenceact.eu/article/19/)
- **Art. 13 transparency to deployers** (high-risk providers). Systems must be sufficiently transparent for deployers to interpret output and use it appropriately, and come with instructions for use. The instructions cover the provider's identity, intended purpose, accuracy, robustness and cybersecurity levels and metrics, foreseeable risks, human-oversight measures, computational needs, and log-collection mechanisms (13(3)(f)). *Evidence:* model and agent cards. Downstream, Microsoft/OpenAI transparency notes serve the Art. 53 / Annex XII role. — [Art. 13](https://artificialintelligenceact.eu/article/13/)
- **Art. 14 human oversight** (high-risk). Systems must be designed so that natural persons can effectively oversee them, proportionate to risk and autonomy. Overseers must be able to:
  - understand capacities and limits;
  - stay aware of automation bias;
  - correctly interpret output;
  - decide not to use, or to disregard, override or reverse the output (14(4)(d));
  - intervene or interrupt via a "stop" button or similar procedure that brings the system to a halt in a safe state (14(4)(e)).
  
  *Evidence:* human-in-the-loop approval gates for consequential tool calls, a kill switch / run cancellation, and override logs. — [Art. 14](https://artificialintelligenceact.eu/article/14/)
- **Art. 15 accuracy, robustness, cybersecurity** (high-risk). Systems must achieve an appropriate level of each and perform consistently through the lifecycle. They must be resilient to errors, faults and inconsistencies, with fail-safe or backup plans (15(4)). Systems that keep learning must address feedback loops. Art. 15(5) requires resilience against attempts to alter use, outputs or performance by exploiting vulnerabilities, including data poisoning, model poisoning, adversarial examples / model evasion, confidentiality attacks and model flaws. *Agent mapping:* prompt-injection defences, tool sandboxing, egress controls, adversarial testing. — [Art. 15](https://artificialintelligenceact.eu/article/15/)
- **Art. 25 value-chain responsibilities.** A deployer or other third party becomes a *provider* of a high-risk system if it:
  - puts its name or trademark on the system;
  - makes a substantial modification; or
  - modifies the intended purpose of a non-high-risk system, including a GPAI-based system, so that it becomes high-risk (25(1)(a)–(c)).
  
  *Key risk for enterprises building agents on GPAI models for Annex III purposes such as HR screening or credit.* — [Art. 25](https://artificialintelligenceact.eu/article/25/)
- **Art. 26 deployer obligations** (high-risk; now applies from 2 Dec 2027 for Annex III). Deployers must:
  - use the system per its instructions with appropriate technical and organisational measures (26(1));
  - assign human oversight to persons with the necessary competence, training, authority and support (26(2));
  - ensure input data under their control is relevant and sufficiently representative (26(4));
  - monitor operation, inform the provider, and suspend use and notify the provider and market surveillance authority of risks or serious incidents (26(5));
  - keep automatically generated logs for at least 6 months (26(6));
  - inform workers' representatives before workplace use (26(7));
  - inform natural persons subject to Annex III decisions (26(11));
  - cooperate with authorities (26(12)).
  
  Public bodies must also register their use (26(8)). — [Art. 26](https://artificialintelligenceact.eu/article/26/)
- **Art. 27 FRIA.** Required for deployers that are bodies governed by public law or private entities providing public services, and for deployers of Annex III point 5(b)–(c) systems (creditworthiness, life/health insurance pricing). The FRIA covers processes, period and frequency of use, affected categories, specific risks of harm, oversight measures, and measures if risks materialise. Results are notified to the market surveillance authority. The Omnibus allows a DPIA cross-reference and a simplified template. — [Art. 27](https://artificialintelligenceact.eu/article/27/); [Omnibus](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/)
- **Art. 50 transparency** (applies to *all* AI systems, not only high-risk). Art. 50 was not deferred by the Omnibus beyond the 50(2) legacy grace; its general application date is 2 Aug 2026 [prior knowledge for the general date].
  - **50(1)** Providers design systems that interact directly with natural persons so that people are informed they are interacting with AI, unless this is obvious.
  - **50(2)** Providers of systems generating synthetic audio, image, video or text mark outputs in a machine-readable, detectable format.
  - **50(3)** Deployers of emotion recognition or biometric categorisation inform the people exposed.
  - **50(4)** Deployers disclose deepfakes, and disclose AI-generated or manipulated text published to inform the public on matters of public interest, unless it has undergone human review or editorial control.
  - **50(5)** Information must be given clearly, at the latest at first interaction.
  
  *Agent relevance:* customer-facing chat or email agents need AI-interaction disclosure. An enterprise building its own agent on an Azure model is likely the "provider" of that AI *system* for 50(1) purposes (inference). — [Art. 50](https://artificialintelligenceact.eu/article/50/); legacy grace per [Omnibus Art. 111(4)](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/)
- **Art. 53 GPAI provider obligations** (from 2 Aug 2025; borne by OpenAI/Microsoft etc., not by the deployer):
  - technical documentation per Annex XI, made available to the AI Office on request;
  - information and documentation for downstream providers integrating the model, per Annex XII;
  - a copyright-compliance policy, including respecting text-and-data-mining opt-outs;
  - a publicly available sufficiently detailed summary of training content using the AI Office template.
  
  Open-source exemptions apply under 53(2). — [Art. 53](https://artificialintelligenceact.eu/article/53/)
- **Art. 55 GPAI with systemic risk.** Systemic risk is presumed above 10^25 training FLOPs (Art. 51(2)). Additional duties:
  - model evaluation per state-of-the-art protocols, including adversarial testing;
  - assessing and mitigating Union-level systemic risks;
  - tracking, documenting and reporting serious incidents and corrective measures to the AI Office without undue delay;
  - an adequate level of cybersecurity protection for the model and its physical infrastructure.
  
  Sources: [Art. 55](https://artificialintelligenceact.eu/article/55/); [Art. 51](https://artificialintelligenceact.eu/article/51/)
- **Art. 72 post-market monitoring** (high-risk providers). Actively and systematically collect, document and analyse performance data, including from deployers, throughout the lifetime, based on a post-market monitoring plan. The Commission's template implementing act / guidance is now due by 2 Sep 2027 per the Omnibus. — [Art. 72](https://artificialintelligenceact.eu/article/72/); [Omnibus](https://artificialintelligenceact.eu/ai-act-explorer/digital-omnibus/)
- **Art. 73 serious incident reporting** (high-risk providers; deployers inform providers under Art. 26(5)). Providers report to the market surveillance authority immediately after establishing a causal link (or its reasonable likelihood), and no later than:
  - 15 days after awareness (73(2));
  - 2 days for a widespread infringement or serious and irreversible critical-infrastructure disruption (73(3));
  - 10 days in the event of a death (73(4)).
  
  "Serious incident" (Art. 3(49)) includes death or serious harm to health, serious and irreversible disruption of critical infrastructure, infringement of fundamental-rights obligations, and serious harm to property or the environment. Under the Omnibus, reports for GPAI-based systems from the same provider go to the AI Office. — [Art. 73](https://artificialintelligenceact.eu/article/73/); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)

**GPAI Code of Practice status** [verified this session]
- The Commission published the Code on 10 July 2025. It has three chapters:
  - Transparency (with a Model Documentation Form) and Copyright, both covering Art. 53;
  - Safety & Security, for Art. 55 systemic-risk providers only.
  
  The Commission and AI Board confirmed it as an "adequate voluntary tool" for demonstrating compliance. — [EC – Contents of the GPAI Code](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai)
- Signatories include OpenAI, Microsoft, Anthropic, Google, Amazon, IBM and Mistral AI. xAI signed only the Safety & Security chapter. Meta is not listed. — [EC – Contents of the GPAI Code](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai)
- The AI Office chairs a Signatory Taskforce and is preparing compliance assessments ahead of enforcement starting in Aug 2026. — [EC – Signatory Taskforce](https://digital-strategy.ec.europa.eu/en/pages/signatory-taskforce-gpai-code-practice)
- Enforcement is staggered: new models are enforceable from Aug 2026 and models already on the market from Aug 2027. — [King & Spalding](https://www.kslaw.com/news-and-insights/no-stop-the-clock-for-the-eu-ai-act-and-a-belated-general-purpose-ai-code-of-practice-what-does-this-mean-to-you). A vendor blog conflicts on legacy-model timing ([PageCrawl](https://pagecrawl.io/blog/eu-ai-act-august-2026-gpai-enforcement-monitoring)); the Art. 111(3) text supports 2 Aug 2027 for legacy models.

### Inferences
- An enterprise using Azure OpenAI or Foundry models to build agents is normally a **downstream provider and/or deployer of an AI system**, not a GPAI model provider. Art. 53/55 duties sit with OpenAI and Microsoft, both signatories of the Code. The enterprise should obtain their Annex XII downstream documentation (transparency notes, model cards) as evidence.
- Duties binding *now* for typical internal or customer-facing agents:
  - Art. 4 literacy measures;
  - Art. 5 screening, including the new Dec 2026 bans, mostly irrelevant to enterprise agents except image generation;
  - Art. 50(1) disclosure for agents that converse with people;
  - Art. 50(2) marking if agents generate synthetic content (via provider tooling such as C2PA in Azure OpenAI image models — inference, not verified).
- The Arts. 9–15/26/27/72/73 stack is triggered only for agents used in an Annex III area: employment and worker management, access to essential services or credit, education, law enforcement, migration, justice, critical infrastructure. It now applies from 2 Dec 2027. Building agent platforms with Art. 12-grade logging, Art. 14 stop and override, and Art. 15(5) adversarial robustness now is still prudent: deadlines are fixed, and Art. 25 can turn a general agent into a high-risk system when it is repurposed.
- Omnibus centralisation means incidents involving systems built on, for example, OpenAI models *by OpenAI's own group* go to the AI Office. Third-party enterprise deployments likely remain with national market surveillance authorities. This is an interpretation; the exact scope of the "same provider" carve-out needs legal confirmation.

### Gaps
- The full Omnibus Art. 4 (entry into force) text was truncated on the AI Act Explorer page. The OJ publication date (24 July 2026) comes only from secondary sources.
- Not confirmed: whether the final Omnibus kept the Commission proposal's removal of the EU-database registration duty (Art. 49(2)) for Art. 6(3) "not high-risk" self-assessments.
- No information found on the status of the Commission's Art. 50 Code of Practice on marking and labelling AI-generated content, or on Art. 50 guidelines, as of Oct 2026.
- No AI Office GPAI enforcement actions after Aug 2026 were found.
- Art. 10 does not explicitly address RAG knowledge bases or tool outputs. Whether they count as "input data" (deployer, Art. 26(4)) or as training data is unresolved in the sources found.

## Q2. UK: NCSC Guidelines for Secure AI System Development; DSIT AI Cyber Security Code of Practice; ETSI TS 104 223

### Takeaway
The UK approach is voluntary and lifecycle-based. The NCSC/CISA 2023 guidelines set out four stages: secure design, development, deployment, and operation and maintenance. The DSIT Code of Practice (31 Jan 2025) operationalises this into 13 principles across five phases. It was then standardised internationally as **ETSI TS 104 223 V1.1.1 (April 2025)**, which has 13 principles and 72 trackable provisions. That makes it the most "auditable" government baseline for agent platforms.

### Cited Findings
- **NCSC/CISA "Guidelines for secure AI system development"** (27 Nov 2023) [prior knowledge; URL not re-fetched] — [NCSC collection](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development); [CISA](https://www.cisa.gov/news-events/alerts/2023/11/26/cisa-and-uk-ncsc-unveil-joint-guidelines-secure-ai-system-development)
  - Led by UK NCSC and US CISA; co-sealed by 23 agencies from 18 countries.
  - **Secure design:** raise staff awareness of threats and risks; model the threats to the system; design for security as well as functionality and performance; consider security benefits and trade-offs when selecting the model.
  - **Secure development:** secure the supply chain; identify, track and protect assets; document data, models and prompts; manage technical debt.
  - **Secure deployment:** secure infrastructure; protect the model continuously; develop incident-management procedures; release AI responsibly; make it easy for users to do the right thing.
  - **Secure operation and maintenance:** monitor system behaviour; monitor inputs; follow a secure-by-design approach to updates; collect and share lessons learned.
- **DSIT "Code of Practice for the Cyber Security of AI"** — published 31 Jan 2025 — [GOV.UK](https://www.gov.uk/government/publications/ai-cyber-security-code-of-practice/code-of-practice-for-the-cyber-security-of-ai) [verified this session]
  - Five phases and 13 principles:
    - **Secure design:** P1 Raise awareness of AI security threats and risks; P2 Design your AI system for security as well as functionality and performance; P3 Evaluate the threats and manage the risks to your AI system; P4 Enable human responsibility for AI systems.
    - **Secure development:** P5 Identify, track and protect your assets; P6 Secure your infrastructure; P7 Secure your supply chain; P8 Document your data, models and prompts; P9 Conduct appropriate testing and evaluation.
    - **Secure deployment:** P10 Communication and processes associated with End-users and Affected Entities.
    - **Secure maintenance:** P11 Maintain regular security updates, patches and mitigations; P12 Monitor your system's behaviour.
    - **Secure end of life:** P13 Ensure proper data and model disposal.
  - Stakeholder roles: Developers; System Operators (those who embed or deploy a model or system); Data Custodians.
  - Agent-relevant provisions:
    - **2.6** Permissions granted to AI systems over other systems are limited to what is needed and risk-assessed (least-privilege tool access).
    - **4.1 / 4.3** Build in human-oversight capabilities; where oversight is a risk control, technical measures must support it.
    - **6.3** Least-privilege separation of development and tuning environments.
    - **7.1–7.4** Secure supply chain; justify poorly documented components; re-evaluate released models; notify end-users before model updates.
    - **8.3** Audit log of changes to system prompts and model configuration.
    - **12.1** System Operators log system and user activity for incident investigation.
    - **12.2** Analyse logs for anomalies, drift and poisoning.
    - **12.4** Track performance over time.
    - The introduction names indirect prompt injection as an AI-specific risk, but no dedicated provision addresses it.
- **ETSI TS 104 223 V1.1.1** "Securing Artificial Intelligence (SAI); Baseline Cyber Security Requirements for AI Models and Systems" — published April 2025 by ETSI TC SAI. It is derived from the UK Code and has 13 core principles expanding to 72 trackable principles across the same five phases. It addresses data poisoning, model obfuscation and indirect prompt injection, and an SME implementation guide was announced. — [ETSI press release](https://www.etsi.org/newsroom/press-releases/2521-etsi-technical-specification-sets-international-benchmark-for-securing-artificial-intelligence/); [ETSI PDF](https://etsi.org/deliver/etsi_ts/104200_104299/104223/01.01.01_60/ts_104223v010101p.pdf); [Help Net Security](https://www.helpnetsecurity.com/2025/04/25/etsi-ts-104-223-securing-ai/) [verified this session]
- The UK government said it would submit the Code and its Implementation Guide to ETSI to shape a global standard. — [GOV.UK](https://www.gov.uk/government/publications/ai-cyber-security-code-of-practice/code-of-practice-for-the-cyber-security-of-ai)
- UK NCSC also co-authored the May 2026 Five Eyes agentic guidance (see Q3). — [CISA bulletin](https://content.govdelivery.com/accounts/USDHSCISA/bulletins/41544ff)

### Inferences
- For a crosswalk, ETSI TS 104 223 provision IDs (mirroring DSIT 1.x–13.x numbering) are the best UK/European anchor for control IDs. An agent platform operating Azure models is a "System Operator" (and often a "Developer" for its agent layer).
- DSIT 8.3 (prompt and config change audit) and 2.6 (scoped permissions for AI acting on other systems) map directly to GitOps-managed agent definitions and per-agent managed identities.

### Gaps
- The ETSI TS 104 223 normative text (72 provisions) was not read in full. Whether ETSI published the companion implementation guide (expected as ETSI TR 104 128) was not verified.
- No UK statutory AI bill was found or checked as of Oct 2026.

## Q3. US: CISA/NSA/FBI joint guidance, OMB M-25-21/M-25-22, and federal AI policy status

### Takeaway
The most directly relevant US document is the Five Eyes joint guide **"Careful Adoption of Agentic AI Services" (1 May 2026)** from CISA, NSA, ASD's ACSC, Canadian Cyber Centre, NCSC-NZ and NCSC-UK. It recommends:
- a unique identity per agent with short-lived credentials;
- least privilege and gradual expansion of autonomy;
- human approval for high-impact actions;
- independent monitoring and detailed action logs;
- layered prompt-injection defences;
- starting with low-risk tasks.

It builds on "Deploying AI Systems Securely" (Apr 2024) and "AI Data Security" (May 2025). On policy, the US is deregulatory: OMB M-25-21 sets binding minimum practices only for federal agencies' high-impact AI, and EO 14365 (Dec 2025) pushes federal preemption of state AI laws, though state laws remain in force.

### Cited Findings
- **"Careful Adoption of Agentic AI Services"** — CISA release dated 1 May 2026 (some sources say 30 Apr), about 28 pages. Co-authored by CISA, NSA, ASD's ACSC (lead partner), Canadian Centre for Cyber Security, NCSC-NZ and NCSC-UK. Described as the first Five Eyes guidance specific to agentic AI. Audience: developers, vendors, operators. Full guide hosted at cyber.gov.au. — [CISA resource page](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services); [CISA bulletin](https://content.govdelivery.com/accounts/USDHSCISA/bulletins/41544ff); [CyberScoop](https://cyberscoop.com/cisa-nsa-five-eyes-guidance-secure-deployment-ai-agents/) [verified this session]
  - **Five risk categories:**
    - privilege (broad permissions let one compromised agent reach many systems);
    - design and configuration (over-permissioned third-party components, static or stale permissions, lateral movement);
    - behavioural (unpredictable actions, unintended goal pursuit, prompt injection, data poisoning);
    - structural (cascading failures in interconnected workflows, larger attack surface);
    - accountability (hard to trace, audit and assign responsibility).
    
    — [Covington](https://www.covingtonblogs.com/2026/05/28/cisa-releases-guidance-on-the-careful-adoption-of-agentic-ai-services/). One source lists "supply chain" in place of accountability ([Crowell](https://www.crowell.com/en/insights/client-alerts/american-and-allied-cyber-agencies-issue-first-joint-guidance-on-securing-agentic-ai)).
  - **Controls:**
    - a secure, verifiable identity for each agent from design onward; temporary credentials for sensitive actions; continuous verification;
    - least privilege and isolation, "never granting it broad or unrestricted access, especially to sensitive data or critical systems"; expand access and autonomy gradually; fail-safe defaults;
    - human review checkpoints so agents cannot escalate to higher-risk activities on their own, and human approval for high-impact actions;
    - monitoring of internal processes, not just inputs and outputs, with *independent* monitoring that cross-validates agent self-reports against system logs; detailed logs of decisions and actions;
    - against prompt injection: grounding, a clear instruction hierarchy, deny lists and "do-not-do" rules, non-overridable safety constraints, red teaming, overlapping safeguards;
    - start with low-risk, clearly defined tasks; secure by default; threat-model with existing frameworks; update governance to assign legal accountability and risk ownership.
    
    — [Mayer Brown, Jun 2026](https://www.mayerbrown.com/en/insights/publications/2026/06/multi-agency-guidance-on-securing-agentic-ai-systems); [Covington](https://www.covingtonblogs.com/2026/05/28/cisa-releases-guidance-on-the-careful-adoption-of-agentic-ai-services/)
  - Commentary says the guide treats prompt injection as the most persistent and hardest-to-fix threat, and calls for cryptographically anchored identities. — [CSA Research Note](https://labs.cloudsecurityalliance.org/research/csa-research-note-cisa-agentic-ai-guidance-20260503-csa-styl/) (secondary)
- **"Deploying AI Systems Securely"** — 15 Apr 2024. NSA AI Security Center with CISA, FBI, ASD ACSC, CCCS, NCSC-NZ and NCSC-UK. [prior knowledge; URL not re-fetched] — [NSA/DoD PDF](https://media.defense.gov/2024/Apr/15/2003439257/-1/-1/0/CSI-DEPLOYING-AI-SYSTEMS-SECURELY.PDF)
  - Secure the deployment environment: governance, robust architecture, hardened configurations, network protection.
  - Continuously protect the AI system: validate the system before and during use, secure exposed APIs, actively monitor model behaviour, protect model weights.
  - Secure operation and maintenance: strict access controls, user awareness and training, audits and penetration testing, robust logging and monitoring, updates and patching, high availability and disaster recovery, secure deletion.
- **"AI Data Security: Best Practices for Securing Data Used to Train & Operate AI Systems"** — 22 May 2025. NSA AISC, CISA, FBI, ASD ACSC, NCSC-NZ, NCSC-UK. [prior knowledge; URL not re-fetched] — [CISA](https://www.cisa.gov/resources-tools/resources/ai-data-security-best-practices-securing-data-used-train-operate-ai-systems)
  - Highlights three risk areas: data supply chain, maliciously modified (poisoned) data, and data drift.
  - Best practices: provenance tracking; integrity checks (hashes, digital signatures); trusted infrastructure; data classification and access control; encryption (e.g., AES-256); secure storage; privacy-preserving techniques; secure deletion; ongoing risk assessment aligned to the NIST RMF.
- **OMB M-25-21** "Accelerating Federal Use of AI through Innovation, Governance, and Public Trust" — 3 Apr 2025. It rescinds and replaces M-24-10. [verified this session from PDF text] — [OMB PDF](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf)
  - "High-impact AI" is AI whose output serves as a principal basis for decisions or actions with legal, material, binding or significant effect on rights or safety. A high-impact determination is possible with or without human oversight.
  - Agencies must document implementation of the minimum practices in §4(b) within **365 days** (i.e., by ~3 Apr 2026). Otherwise they must stop using non-compliant high-impact AI, unless the CAIO grants a waiver, which is tracked, reported to OMB and published.
  - **Minimum practices (§4(b)):**
    - (i) pre-deployment testing, using alternative methods such as querying the service when model, code or data are not accessible;
    - (ii) an AI impact assessment covering purpose and benefit, data quality, impacts on privacy and civil rights, a reassessment schedule, costs, independent review, and a signed risk acceptance;
    - (iii) ongoing monitoring for performance and adverse impacts, including changes after deployment, with traceability;
    - (iv) operator training and assessment;
    - (v) human oversight, intervention and accountability, with an appropriate fail-safe;
    - (vi) remedies and appeals for affected individuals;
    - (vii) end-user and public feedback.
  - Pilots are exempt from the minimum practices.
  - Agencies must have a Chief AI Officer (CAIO) and an AI governance board, and must publish AI strategies within 180 days. — [Akin Gump tracker](https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/omb-issues-memorandum-on-accelerating-federal-use-of-ai-through-innovation-governance-and-public-trust)
- **OMB M-25-22** "Driving Efficient Acquisition of AI in Government" — 3 Apr 2025. Covers federal AI acquisition and favours AI developed and produced in the US. — [Akin Gump tracker](https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/omb-issues-memorandum-on-accelerating-federal-use-of-ai-through-innovation-governance-and-public-trust). Detailed contract clauses (vendor lock-in protections, data rights, notice of AI use in contract performance) are prior knowledge and were not re-verified.
- **Federal policy status:**
  - EO 14179 (23 Jan 2025) underpins M-25-21. — [Akin Gump](https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/omb-issues-memorandum-on-accelerating-federal-use-of-ai-through-innovation-governance-and-public-trust)
  - **EO 14365** "Ensuring a National Policy Framework for Artificial Intelligence" (11 Dec 2025, 90 Fed. Reg. 58499) aims to limit state AI laws. It led to a DOJ AI Litigation Task Force (established 10 Jan 2026) and directed a Commerce evaluation of state laws and an FTC Section 5 policy statement, both due 11 Mar 2026; neither release was confirmed in the sources. Carve-outs cover child safety, compute and data-centre infrastructure, and state procurement. — [Paul Hastings](https://www.paulhastings.com/insights/client-alerts/president-trump-signs-executive-order-challenging-state-ai-laws); [Latham](https://www.lw.com/en/insights/ai-executive-order-targets-state-laws-and-seeks-uniform-federal-standards); [Ropes & Gray, Mar 2026](https://www.ropesgray.com/en/insights/alerts/2026/03/examining-the-landscape-and-limitations-of-the-federal-push-to-override-state-ai-regulation)
  - In March 2026 the White House released legislative recommendations (a "National Policy Framework for AI") urging Congress to preempt state AI laws that impose "undue burdens". State laws remain in effect unless Congress legislates or legal challenges succeed. — [Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2026/03/the-white-house-legislative-recommendations-national-policy-framework-for-artificial-intelligence-an); [Holland & Knight](https://www.hklaw.com/en/insights/publications/2026/03/white-house-releases-a-national-policy-framework-for-artificial)
  - EO 14110 (Biden) was revoked in Jan 2025, and "America's AI Action Plan" was released 23 Jul 2025. [prior knowledge; not re-verified]

### Inferences
- For a private enterprise, CISA/NSA guidance is voluntary but is the de facto US security baseline. M-25-21 binds only federal agencies, but it is relevant if the platform serves US federal customers (FedRAMP or agency use) and as a model for "high-impact" gating. Its impact assessment plus signed risk acceptance pattern maps well to a per-agent approval and registration workflow.
- The Five Eyes guide's "independent monitoring that cross-validates agent self-reports against system logs" points toward platform-side telemetry (e.g., Azure Monitor / Log Analytics of actual tool and API calls), not trusting agent-emitted traces alone.

### Gaps
- The primary PDF of "Careful Adoption of Agentic AI Services" (cyber.gov.au) was not read. Findings rely on CISA's landing page and law-firm summaries, so exact section names and any MCP or tool-protocol, kill-switch or vendor-procurement provisions are unverified.
- No OMB memo after M-25-21/M-25-22 (e.g., an "M-26-xx" on agentic AI) was found. An Oct 2026 blog claiming September 2026 AI executive orders ([ibl.ai](https://ibl.ai/blog/super-intelligence-force-agency-ai-procurement)) is single-source and unverified, so treat it as unconfirmed.
- Not confirmed: the status of the Commerce state-law evaluation, the FTC AI policy statement, or any congressional preemption bill as of Oct 2026.

## Q4. Other notable jurisdictions: Singapore, Australia, Canada (brief)

### Takeaway
Singapore published the first government framework dedicated to agentic AI (IMDA, 22 Jan 2026). It is voluntary but explicit that organisations remain legally accountable for their agents. Australia (ASD's ACSC) and Canada (Cyber Centre) contribute mainly through the Five Eyes agentic guidance. Neither has binding agent-specific law that was found.

### Cited Findings
- **Singapore – Model AI Governance Framework for Agentic AI** (IMDA)
  - Launched 22 Jan 2026 at WEF Davos as the first government framework specifically for agentic AI. Voluntary and a "living document", building on the 2020 Model AI Governance Framework.
  - Applies to organisations deploying agentic AI in Singapore, whether they build their own agents or use third-party ones. Organisations remain legally responsible for agents' actions.
  - Four dimensions: bounding risks upfront (limiting autonomy and tool access), human accountability allocation, technical controls and safety testing with monitoring, and end-user responsibility and training.
  - Sources: [Bird & Bird](https://cm.twobirds.com/en/insights/2026/singapore/singapore-introduces-new-model-ai-governance-framework-for-agentic-ai); [Allen & Gledhill](https://www.allenandgledhill.com/sg/publication/articles/32314/launches-new-model-ai-governance-framework-for-agentic-ai)
  - One source reports a v1.5 update (May/June 2026) co-published with the AI Verify Foundation. Single source; unverified. — [CASRAI](https://casrai.org/guides/singapore-model-ai-governance-framework-agentic-ai/)
- **Australia:** ASD's ACSC was the lead partner on CISA's May 2026 release, and the full guide is hosted on cyber.gov.au. — [CISA](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services). The 2024 Voluntary AI Safety Standard (10 guardrails) is prior knowledge and was not re-verified; the current status of proposed mandatory guardrails was not verified.
- **Canada:** the Canadian Centre for Cyber Security co-authored the agentic guidance. — [CISA bulletin](https://content.govdelivery.com/accounts/USDHSCISA/bulletins/41544ff). The federal Artificial Intelligence and Data Act (AIDA, Bill C-27) died on the order paper in Jan 2025, and the Treasury Board Directive on Automated Decision-Making (with Algorithmic Impact Assessment) remains the federal-government instrument. [prior knowledge; not re-verified]

### Inferences
- Across jurisdictions, there is strong convergence on a common agent control set:
  - bounded autonomy and least-privilege tools;
  - per-agent identity;
  - human approval for high-impact actions;
  - comprehensive, independently verified logging;
  - staged rollout from low-risk tasks;
  - clear human accountability.
  
  The EU AI Act makes a subset legally mandatory (Arts. 12, 14, 15, 26), but only for high-risk use and only from Dec 2027.

### Gaps
- The IMDA primary document URL and full text were not fetched.
- No Australian or Canadian agent-specific government frameworks beyond the Five Eyes guide were found or checked.
- Japan, Korea (AI Basic Act, effective Jan 2026 — prior knowledge, unverified) and China were not researched, as they are out of scope for the brief treatment requested.
