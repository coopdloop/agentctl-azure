# Azure evidence catalog for AI risk controls (agents on Azure AI Foundry / Microsoft Foundry)

Scope: what a control-plane app can check **automatically**, reading Azure with the user's token (ARM, Azure Resource Graph, Azure Policy, Microsoft Graph incl. beta Entra Agent ID, the Foundry project data-plane agents API, Log Analytics / App Insights), and exactly where each piece of evidence lives. Research date: 2026-10-17. Naming note: Microsoft now brands the product "Microsoft Foundry". The ARM namespace is still `Microsoft.CognitiveServices/accounts` (kind `AIServices`), and the Foundry RBAC roles were renamed (Azure AI User → Foundry User, and so on; role IDs unchanged) — [Guardrails overview](https://learn.microsoft.com/en-us/azure/foundry/guardrails/guardrails-overview).

Legend: **[GA]** = generally available, **[Preview]** = preview, **[Unverified]** = from background knowledge and not re-confirmed against a primary source this session.

---

## 1. Foundry account (Microsoft.CognitiveServices/accounts, kind AIServices) security properties

### Takeaway
Most infrastructure-hygiene controls can be read straight from `properties.*` on the account. This works through ARM GET or through Azure Resource Graph (`resources | where type =~ 'microsoft.cognitiveservices/accounts'`). The latest API versions are `2026-07-01` (GA) and `2026-07-15-preview`. Newer agent-specific properties also exist: `networkInjections` (agent subnet), `agentHostingConfigurations`, `capabilitySettings`, `a365LoggingEnabled` and `storedCompletionsDisabled`.

### Cited Findings
- **API versions.** The ARM schema lists, newest first: 2026-07-15-preview, 2026-07-01, 2026-05-15-preview, 2026-05-01, 2026-03-15-preview, 2026-03-01, 2026-01-15-preview, 2025-12-01, 2025-10-01-preview, 2025-09-01, 2025-07-01-preview, 2025-06-01, 2025-04-01-preview, 2024-10-01 … — [ARM template ref: accounts](https://learn.microsoft.com/en-us/azure/templates/microsoft.cognitiveservices/accounts)
- **Security-relevant `AccountProperties`**, verbatim names from the same source:
  - `disableLocalAuth` (bool): key access off, so Entra-only.
  - `publicNetworkAccess`: `'Enabled' | 'Disabled'`.
  - `networkAcls` (NetworkRuleSet):
    - `defaultAction` `'Allow'|'Deny'`
    - `bypass` `'AzureServices'|'None'`
    - `ipRules[].value`
    - `virtualNetworkRules[].id/state/ignoreMissingVnetServiceEndpoint`
  - `restrictOutboundNetworkAccess` (bool) and `allowedFqdnList` (string[]): data-exfiltration egress control.
  - `encryption.keySource`: `'Microsoft.CognitiveServices'` (platform-managed) or `'Microsoft.KeyVault'` (CMK). The key itself is in `encryption.keyVaultProperties.{keyVaultUri,keyName,keyVersion,identityClientId}`.
  - `userOwnedStorage[].{resourceId,identityClientId}` and `amlWorkspace`.
  - `identity.type`: `'None'|'SystemAssigned'|'UserAssigned'|'SystemAssigned, UserAssigned'`, plus `identity.userAssignedIdentities`. This sits at the resource level, not inside properties.
  - `networkInjections[]`:
    - `scenario`: `'agent'|'none'`
    - `subnetArmId`
    - `useMicrosoftManagedNetwork`: VNet injection for the Agent Service.
  - `allowProjectManagement` (bool): this is what makes a Foundry (project-capable) account. Related fields: `associatedProjects`, `defaultProject`.
  - `storedCompletionsDisabled` (bool).
  - `raiMonitorConfig.{adxStorageResourceId,identityClientId}`.
  - `dynamicThrottlingEnabled`, `customSubDomainName` (required for Entra token auth), `locations` (multi-region), `migrationToken`, `restore`.
  - `foundryAutoUpgrade.{mode,plannedByMicrosoft,scheduledAt,statusReason}`.
  - `a365LoggingEnabled`: "Specifies whether A365 logging is enabled. Defaults to true. Set to false to opt out."
  - `capabilitySettings.{blobStore,documentStore,vectorStore}`: these are the agent runtime state stores.
  - `agentHostingConfigurations[]` (hostingType `'ManagedCluster'`, `clusterResourceId`, `hostingManagementIdentityResourceId`, `workloadIdentityResourceId`, `storageAccountResourceId`): a customer-owned AKS cluster for hosted agents, which can only be set at creation.

  — [ARM template ref: accounts](https://learn.microsoft.com/en-us/azure/templates/microsoft.cognitiveservices/accounts)
- **Diagnostic logs.** The account's resource-log categories are `Audit`, `AzureOpenAIRequestUsage`, `ManagedNetworkEvent`, `RequestResponse` and `Trace`. All of them land in the **AzureDiagnostics** table. Other relevant tables are AzureActivity and AzureMetrics — [Monitoring data reference for Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/monitor-openai-reference)
- **Content-safety metrics** (Azure Monitor metrics, exportable through diagnostic settings):
  - `RAIHarmfulRequests` "Harmful Volume Detected". Dimensions include Category, Severity, TextType and ModelDeploymentName.
  - `RAIRejectedRequests` "Blocked Volume".
  - `RAISystemEvent` "Safety System Event".
  - `RAITotalRequests` "Total Volume Sent For Safety Check".
  - Also listed: "Potential Abusive User Count".
  - Cost signal: `FoundryModelEstimatedCost` [Preview], with dimension ProjectId.

  — [Monitoring data reference](https://learn.microsoft.com/en-us/azure/foundry/openai/monitor-openai-reference)

### Inferences
- **Concrete checks** an evidence engine can run in one Resource Graph query over `resources` where `type =~ 'microsoft.cognitiveservices/accounts' and kind =~ 'AIServices'`:
  - `properties.disableLocalAuth == true`
  - `properties.publicNetworkAccess == 'Disabled'` OR `properties.networkAcls.defaultAction == 'Deny'`
  - `properties.restrictOutboundNetworkAccess == true` with a non-empty `allowedFqdnList`
  - `properties.encryption.keySource == 'Microsoft.KeyVault'`
  - `identity.type != 'None'`
  - `properties.networkInjections[?scenario=='agent'].subnetArmId` present (private agent networking)
  - `properties.privateEndpointConnections[].properties.privateLinkServiceConnectionState.status == 'Approved'`. This is the standard private-endpoint shape for ARM resources. It is **[Unverified]** for this exact RP version but is the property the built-in Private Link policy evaluates.
- **Diagnostic settings are not a property of the account.** Read them with `GET {accountId}/providers/Microsoft.Insights/diagnosticSettings?api-version=2021-05-01-preview` **[Unverified API version]**. Check for category group `audit`/`allLogs`, or for the categories `Audit` and `RequestResponse`, plus a `workspaceId`. Alternatively, rely on the policy-compliance result for "Diagnostic logs in Azure AI services resources should be enabled" (see §3).
- **Child resources to enumerate for evidence** (types visible in ARM): `accounts/deployments` (carries `properties.raiPolicyName` and `properties.model.{format,name,version}`), `accounts/raiPolicies`, `accounts/raiBlocklists`, `accounts/projects`, `accounts/projects/connections` / `accounts/connections` (authType reveals key-vs-Entra), `accounts/capabilityHosts`. The deployment `raiPolicyName` property is long-standing ARM schema but was **[Unverified]** this session.

### Gaps
- I did not retrieve the change log, so I could not confirm the exact API version where `networkInjections`, `a365LoggingEnabled` and `capabilitySettings` first appeared.
- "A365 logging" (`a365LoggingEnabled`) is not explained in the schema. It is presumably Microsoft Agent 365 logging, but I did not confirm this.
- I did not retrieve child resources such as `defenderForAISettings`. I have seen them referenced elsewhere, but they were not confirmed this session.

---

## 2. RAI policies / guardrails (accounts/raiPolicies) and per-deployment / per-agent assignment

### Takeaway
A Foundry "guardrail" **is** an ARM `raiPolicy`. The portal docs say egress controls are configured "in the same guardrail (RAI policy)". The latest preview schema extends the classic content-filter list with:
- agent intervention-point sources (`PreRun`, `PreToolCall`, `PostToolCall`, `PostRun`)
- an `action` enum that includes `HITL`
- `safetyProviders`
- an `egressPolicy` for hosted agents

All of this is readable by ARM GET on `accounts/{a}/raiPolicies`.

### Cited Findings
- **Endpoint and example filters.** The endpoint is `PUT/GET https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/raiPolicies/{raiPolicyName}?api-version=2024-10-01` (GA). The example filters, by `name`, are:
  - `Hate`, `Sexual`, `Selfharm` and `Violence`, each with `severityThreshold` (`Low|Medium|High`) and `source` (`Prompt|Completion`)
  - `Jailbreak` (source Prompt)
  - `Protected Material Text` and `Protected Material Code` (source Completion)
  - `Profanity`

  `basePolicyName` is e.g. `Microsoft.Default`. `type` is `UserManaged|SystemManaged` — [REST: Rai Policies – Create Or Update 2024-10-01](https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update)
- **`mode` enum.** Values are `Default` (0), `Deferred` (1), `Blocking` (2) and `Asynchronous_filter` (3). The docs say: "Please use 'Asynchronous_filter' after 2024-10-01. It is the same as 'Deferred' in previous version." — [REST 2024-10-01](https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update). The 2026-07-15-preview schema text says "after 2025-06-01" — [ARM ref raiPolicies](https://learn.microsoft.com/en-us/azure/templates/microsoft.cognitiveservices/accounts/raipolicies).
- **Blocklists.** `customBlocklists[]` = `{blocklistName, blocking, source}` — [REST 2024-10-01](https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update)
- **Latest schema (2026-07-15-preview; GA 2026-07-01 also listed).** `RaiPolicyContentFilter` = `{name, enabled, blocking, severityThreshold, source, action}`:
  - `source` ∈ `'Completion' | 'PostRun' | 'PostToolCall' | 'PreRun' | 'PreToolCall' | 'Prompt'`
  - `action` ∈ `'ANNOTATING' | 'BLOCKING' | 'HITL' | 'None' | 'RETRY'`
  - New top-level properties: `safetyProviders[] {safetyProviderName, blocking, source}` and `egressPolicy {defaultAction 'Allow'|'Deny' (server default Deny / fail-closed), mode 'Audit'|'Enforced' (default Enforced), rules[] {name, ruleType 'Fqdn', match{host,path}, action{actionType 'Allow'|'Deny'|'Rewrite'|'Transform', headers[], rewrite}}}`. The egress policy is described as "controlling which external endpoints sandboxed agents can reach".

  — [ARM ref: accounts/raiPolicies](https://learn.microsoft.com/en-us/azure/templates/microsoft.cognitiveservices/accounts/raipolicies)
- **Guardrail risk names and where they apply.** Applicable to both models and agents: Hate, Sexual, Self-harm, Violence, User prompt attacks, Indirect attacks, Protected material code/text, PII (Preview) and Task Adherence (Preview). Models only: Spotlighting (Preview) and Groundedness (Preview). Intervention points are User input, Tool call (Preview, agents only), Tool response (Preview, agents only) and Output. For agents the only action is "Annotate and block"; models can also use "Annotate" alone. Agent guardrails as a whole are Preview — [Guardrails overview](https://learn.microsoft.com/en-us/azure/foundry/guardrails/guardrails-overview)
- **Inheritance.** "The agentic guardrail fully overrides the model's guardrail." If no custom guardrail is set, an agent inherits its model deployment's guardrail. The model default is **Microsoft.DefaultV2**. A specific gap: if the agent guardrail has no tool-call/tool-response controls, tool calls are **not** scanned — [Guardrails overview](https://learn.microsoft.com/en-us/azure/foundry/guardrails/guardrails-overview)
- **Turning filters off.** Output content-harm filters can only be turned off by customers approved for "modified guardrails" (Limited Access) — [Guardrails overview](https://learn.microsoft.com/en-us/azure/foundry/guardrails/guardrails-overview)
- **Hosted-agent egress.** Network egress controls for hosted agents (Preview) are configured "in the same guardrail (RAI policy)" — [Guardrails overview](https://learn.microsoft.com/en-us/azure/foundry/guardrails/guardrails-overview)

### Inferences
- **Mapping portal risks to ARM `contentFilters[].name`.** User prompt attacks = `Jailbreak`. Indirect attacks: the ARM name is likely `Indirect Attack` **[Unverified]**. I could not confirm the exact ARM `name` strings for PII, Task Adherence and Groundedness. The safe implementation is to read the policy and normalise case-insensitively, keeping unknown names.
- **Source values vs intervention points.** The source values `PreRun`/`PreToolCall`/`PostToolCall`/`PostRun` almost certainly correspond to agent intervention points (user input / tool call / tool response / output). A check for "agent tool calls are guarded" = there exists a contentFilter with `source in ('PreToolCall','PostToolCall')`, `enabled==true` and `blocking==true` (or `action=='BLOCKING'`) for `Jailbreak` / indirect-attack.
- **Evidence checks:**
  - Every deployment's `raiPolicyName` resolves to a policy where the four harm categories are enabled + blocking at ≤ Medium threshold, on both Prompt and Completion.
  - `Jailbreak` is enabled + blocking.
  - Protected material is enabled on Completion.
  - `mode != 'Asynchronous_filter'` where synchronous blocking is required.
  - `action=='HITL'` on high-risk tool filters is evidence of human oversight.
  - `egressPolicy.defaultAction=='Deny'` and `mode=='Enforced'` for hosted agents.

### Gaps
- I could not find which field on the agent object / agent version references a guardrail (raiPolicy). The Foundry agents REST reference page I retrieved showed no `rai_config` / `rai_policy_name` / guardrail field. This needs a follow-up against the azure-rest-api-specs `ai-foundry` data-plane spec or the SDK models. The portal shows the assignment, so it must exist somewhere.
- I did not find documentation of valid `safetyProviderName` values (presumably third-party/partner safety providers).

---

## 3. Azure Policy built-ins for Azure AI services / Foundry

### Takeaway
There is a solid set of built-ins: key access, network, Private Link, CMK, managed identity, diagnostics, approved models, and model eligibility. There are also new **[Preview] content-filter built-ins for both deployments and agents**. Compliance can be read from `policyresources` in Resource Graph or from Policy Insights. Defender for Cloud now ships a built-in **EU AI Act** regulatory standard. I found **no** built-in NIST AI RMF or ISO/IEC 42001 standard in Defender for Cloud.

### Cited Findings (display name — definition GUID — effects — version), all from [Built-in policy definitions for Foundry Tools](https://learn.microsoft.com/en-us/azure/ai-services/policy-reference) (page updated 2026-07-13)
- [Preview]: Cognitive Services Agents should only use allowed control — `595f98a5-b562-4ab6-b9c8-2ff9f39a3f7c` — Audit/Disabled — 1.0.0-preview ("minimum levels of multi-severity content filtering… for agents")
- [Preview]: Cognitive Services Agents should only use allowed prompt content filtering — `9224c1cc-34fc-44f1-ad08-5c4b079c9ce6` — Audit/Disabled — 1.0.0-preview
- [Preview]: Cognitive Services Deployments should only use allowed completion content filtering — `af253d37-136a-42f8-a1fc-30010c083d41` — Audit/Disabled
- [Preview]: Cognitive Services Deployments should only use allowed control — `930f48f9-f07e-427c-9494-52603581c6a9` — Audit/Disabled
- [Preview]: Cognitive Services Deployments Should Only Use Allowed Control Mode — `c1ad46c6-37f8-4af0-9c71-c208375c87dd` — Audit/Disabled
- [Preview]: Cognitive Services Deployments should only use allowed prompt content filtering — `f3a9c2e0-7b4d-4d8f-9c3a-2e1f6b9a8d4e` — Audit/Disabled
- [Preview]: Foundry model deployments should meet eligibility requirements — `8791d062-ba96-4c34-b604-8538f7e30ca0` — Audit/Deny/Disabled (checks model preview/GA status and distribution source)
- Foundry model deployments should only use approved models — `aafe3651-cb78-4f68-9f81-e7e41509110f` — Audit/Deny/Disabled — 1.0.2
- Azure AI Services resources should encrypt data at rest with a customer-managed key (CMK) — `67121cc7-ff39-4ab8-b7e3-95b84dab487d` — Audit/Deny/Disabled — 2.2.0
- Azure AI Services resources should have key access disabled (disable local authentication) — `71ef260a-8f18-47b7-abcb-62d0673d94dc` — Audit/Deny/Disabled — 1.1.0
- Azure AI Services resources should restrict network access — `037eea7a-bd0a-46c5-9a66-03aea78705d3` — Audit/Deny/Disabled — 3.3.0
- Azure AI Services resources should use Azure Private Link — `d6759c02-b87f-42b7-892e-71b3f471d782` — Audit/Disabled — 1.0.0
- Cognitive Services accounts should use a managed identity — `fe3fd216-4f83-4fc1-8984-2bbec80a3418` — Audit/Deny/Disabled
- Cognitive Services accounts should use customer owned storage — `46aa9b05-0e60-4eae-a88b-1e9d374fa515` — Audit/Deny/Disabled
- Configure Azure AI Services resources to disable local key access — `55eff01b-f2bd-4c32-9203-db285f709d30` — DeployIfNotExists
- Configure Cognitive Services accounts to disable local authentication methods — `14de9e63-1b31-492e-a5a3-c3f7fd57f555` — Modify
- Configure Cognitive Services accounts to disable public network access — `47ba1dd7-28d9-4b07-a8d5-9813bed64e0c` — Modify
- Configure Cognitive Services accounts with private endpoints — `db630ad5-52e9-4f4d-9c44-53912fe40053` — DINE
- Diagnostic logs in Azure AI services resources should be enabled — `1b4d1c4e-934c-4703-944c-27c82c06bebb` — AuditIfNotExists — 1.0.0
- Enable logging by category group for Cognitive Services to Event Hub / Log Analytics / Storage — `0628b917-d4b4-4af5-bc2b-b4f87cd173ab` / `55d1f543-d1b0-4811-9663-d6d0dbc6326d` / `14e81583-c89c-47db-af0d-f9ddddcccd9f` — DINE/AINE
- Policy source JSON lives in `Azure/azure-policy` under `built-in-policies/policyDefinitions/Cognitive Services/` and `.../Azure Ai Services/`. For example: `AllowAgentPromptControl_Audit.json`, `AllowDeploymentModelEligibility_Audit.json`, `AllowDeployRegistryModels_Audit.json` — [policy-reference](https://learn.microsoft.com/en-us/azure/ai-services/policy-reference)
- **Defender for Cloud regulatory compliance standards.** "European Union Artificial Intelligence Act (EU AI Act)" is listed as available for Azure, AWS and GCP, alongside NIST CSF v2.0, NIST SP 800-53 R5.1.1, ISO 27001:2022, DORA, CSA CCM v4.0.12 and others. The list contains **no** NIST AI RMF or ISO/IEC 42001 — [Regulatory compliance in Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/concept-regulatory-compliance-standards) (updated 2026-06-17). A Defender for Cloud blog had described the EU AI Act as public preview — [Tech Community blog](https://techcommunity.microsoft.com/blog/microsoftdefendercloudblog/-/4433440). The current Learn table shows no preview marker, so the status is ambiguous.
- **Controls that cannot be automatically assessed** show as greyed out / "unavailable" in a standard — [Regulatory compliance in Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/concept-regulatory-compliance-standards)
- **Purview Compliance Manager** provides "regulatory templates… for all generative AI apps" ("Assessments for AI regulations") — [Purview for Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry)

### Inferences
- **How to query compliance** **[Unverified, standard Azure patterns]**:
  - Resource Graph: `policyresources | where type =~ 'microsoft.policyinsights/policystates' | where properties.policyDefinitionId endswith '<guid>'` (fields `complianceState`, `resourceId`).
  - Or Policy Insights: `POST /subscriptions/{s}/providers/Microsoft.PolicyInsights/policyStates/latest/queryResults?api-version=2019-10-01`.
  - Assignments: `policyresources | where type =~ 'microsoft.authorization/policyassignments'`.
- **The two strongest "AI-specific" automatable controls:**
  1. Approved models / model eligibility (`aafe3651…`, `8791d062…`). This gives a model inventory/allow-list control.
  2. Agent content-filter policies (`595f98a5…`, `9224c1cc…`). This is a guardrail-baseline control.

  Their being assigned and compliant is direct evidence for NIST AI RMF MANAGE/MEASURE, ISO 42001 Annex A operational controls, and EU AI Act Art. 15 (robustness/cybersecurity) style controls.
- **Mapping NIST AI RMF / ISO 42001 to Azure evidence** must be done by the app itself, using its own crosswalk. The EU AI Act standard in Defender can be read from Resource Graph `securityresources` types `microsoft.security/regulatorycompliancestandards[/regulatorycompliancecontrols/regulatorycomplianceassessments]` **[Unverified type names]**.

### Gaps
- I did not retrieve the EU AI Act standard's control list or which policies it maps to.
- I did not retrieve the parameter schemas of the [Preview] content-filter policies (e.g. allowed severity, the parameter names). Fetch the azure-policy JSON files to get them.
- I did not confirm the exact `regulatoryComplianceStandards` name string for the EU AI Act.

---

## 4. Microsoft Defender for Cloud: AI threat protection, AI-SPM recommendations, alerts

### Takeaway
"Defender for AI Services" threat protection is **GA**. Its alert type IDs are prefixed `AI.Azure_*`. The AI posture recommendations now include **agent-specific** checks: MCP human-in-the-loop, an MCP allowed-tools list, jailbreak guardrails, an XPIA guardrail, agent instructions, and App Insights on Foundry. Alerts and recommendations can be queried from Resource Graph `securityresources` or the ARM Microsoft.Security APIs.

### Cited Findings
- **Status and scope.** AI threat protection release state: Generally available. Features: activity monitoring and prompt evidence. Supports Azure OpenAI and Azure AI Model Inference models, text tokens only. 30-day free trial capped at 75B tokens. Enabling at subscription level requires Owner or equivalent data actions. Not available in Azure Government or 21Vianet. Integrates with Defender XDR — [AI threat protection](https://learn.microsoft.com/en-us/azure/defender-for-cloud/ai-threat-protection)
- **Settings.** "Enable user prompt evidence" is a separate setting under the AI services plan's Settings. A further option, "Enable data security for Azure AI with Microsoft Purview", is part of onboarding — [AI onboarding](https://learn.microsoft.com/azure/defender-for-cloud/ai-onboarding); [Purview for Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry)
- **Alert types** (ID — severity) — [Alerts for AI services](https://learn.microsoft.com/en-us/azure/defender-for-cloud/alerts-ai-workloads) (updated 2026-07-06):
  - Credential theft attempt on a model deployment — `AI.Azure_CredentialTheftAttempt` — Medium
  - Jailbreak blocked by Prompt Shields — `AI.Azure_Jailbreak.ContentFiltering.BlockedAttempt` — Medium
  - Jailbreak detected but not blocked — `AI.Azure_Jailbreak.ContentFiltering.DetectedAttempt` — Medium
  - Phishing URL in model response — `AI.Azure_MaliciousUrl.ModelResponse` — High
  - Phishing URL from an unknown source — `AI.Azure_MaliciousUrl.UnknownSource` — High
  - Phishing URL in a user prompt — `AI.Azure_MaliciousUrl.UserPrompt` — High
  - Suspicious user agent — `AI.Azure_AccessFromSuspiciousUserAgent` — Medium
  - ASCII smuggling prompt injection — `AI.Azure_ASCIISmuggling` — High
  - Access from a Tor IP — `AI.Azure_AccessFromAnonymizedIP` — High
  - Access from a suspicious IP — `AI.Azure_AccessFromSuspiciousIP` — High
  - Wallet attack, recurring requests — `AI.Azure_DOWDuplicateRequests` — Medium
  - Wallet attack, volume anomaly — `AI.Azure_DOWVolumeAnomaly` — Medium
  - Access anomaly — `AI.Azure_AccessAnomaly` — Medium
  - Suspicious 'Initial Access' operation by a service principal — `AI.Azure_AnomalousOperation.InitialAccess` — Medium
  - Anomalous tool invocation — `AI.Azure_AnomalousToolInvocation` — Low
  - (Preview) LLM reconnaissance — `AI.Azure_LLMReconnaissance` — Low
  - (Preview) Malware in an uploaded AI model — `AI.AIModelScan_MalwareDetected` — High
  - Exposed Kubernetes service (AI apps on Kubernetes, from Defender for Containers) — Medium
- **AI security recommendations** (name — severity) — [AI recommendations reference](https://learn.microsoft.com/en-us/azure/defender-for-cloud/recommendations-reference-ai):
  - Foundry AI Agent with Indirect prompt Injection risk should require human in the loop control for MCP tool actions (Preview) — High
  - Foundry AI Agent with Indirect prompt Injection risk should use enhanced guardrails controls (Preview) — High
  - Microsoft Entra ID should be used when connecting Microsoft Foundry to default storage account (Preview) — High
  - Microsoft Entra ID should be used when connecting to data stores on Microsoft Foundry project (Preview) — High
  - Security findings should be resolved on AI models within Azure Machine Learning resources (Preview) — High
  - Application Insights should be used on Microsoft Foundry (Preview) — Medium
  - Azure AI Agent should be configured with operational instructions (Preview) — Medium
  - Connected AI agents should be configured with instructions on how to invoke them (Preview) — Medium
  - Foundry AI Agent's Guardrails should include Jailbreak control (Preview) — Medium
  - Foundry Agent's MCP tool should be configured with allowed tools list (Preview) — Medium
  - Network connections should be limited on Microsoft Foundry (Preview) — Medium
  - Azure AI Services resources should have key access disabled / restrict network access / use Azure Private Link — Medium
  - [Enable if required] Customer-managed keys should be used to encrypt data on Microsoft Foundry (Preview) — Medium
  - Content filtering should be used on model deployed in Microsoft Foundry (Preview) — Low
  - Diagnostic logs in Azure AI services resources should be enabled — Low
  - (Enable if required) CMK for Azure AI Services — Low

### Inferences
- **Plan enablement.** Read it via `GET /subscriptions/{s}/providers/Microsoft.Security/pricings?api-version=2024-01-01` and look for the entry with `name == 'AI'`, `properties.pricingTier == 'Standard'` and `properties.extensions[]`. The prompt-evidence extension is believed to be named `AIPromptEvidence`. **[Unverified]**: neither the pricing name "AI" nor the extension name was confirmed in a primary source this session. Implement defensively: match names containing "AI", and log the raw `extensions` list.
- **Queries** **[Unverified type names, standard Azure patterns]**:
  - Recommendations: `securityresources | where type == 'microsoft.security/assessments' | where properties.displayName has 'Foundry' or properties.displayName has 'AI'` (fields `properties.status.code` Healthy/Unhealthy, `properties.resourceDetails.Id`).
  - Alerts: `securityresources | where type == 'microsoft.security/locations/alerts' | where properties.AlertType startswith 'AI.'`.
  - Alerts by ARM: `GET /subscriptions/{s}/providers/Microsoft.Security/alerts?api-version=2022-01-01`.
- **Agent-level evidence.** The agent-specific recommendations (MCP HITL, allowed_tools, jailbreak guardrail, instructions) are Microsoft's own evaluations of the same fields the app can read from the agents API (§5). The app can either consume Defender's verdicts (requires a Defender CSPM / AI plan) or compute them itself.

### Gaps
- I found no published assessment keys (GUIDs) for the new Foundry agent recommendations.
- I did not confirm whether AI-SPM "AI BOM" / agent inventory is exposed through Resource Graph (vs. only the Cloud Security Explorer / attack-path UI).

---

## 5. Foundry agents API (new agents, `api-version=v1`): evidence fields

### Takeaway
New agents are versioned objects at `{project_endpoint}/agents`. The fields useful as evidence are:
- `definition.kind`, `definition.model`, `definition.instructions` and `definition.tools[]`
- per-tool settings, e.g. MCP `require_approval`, `allowed_tools`, `server_url`, `project_connection_id`
- `metadata`
- the per-agent **Entra identity** (`instance_identity` / `blueprint` with `principal_id`/`client_id`/`status`)
- publishing/authorization settings

### Cited Findings
- **Endpoints.** `POST $FOUNDRY_PROJECT_ENDPOINT/agents?api-version=v1` creates an agent or version. `DELETE .../agents/{name}?api-version=v1`. Toolboxes: `POST .../toolboxes/{name}/versions?api-version=v1`, with an MCP endpoint at `.../toolboxes/{name}/versions/{v}/mcp?api-version=v1`. Responses go through `.../openai/v1/responses` — [MCP tool how-to](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol)
- **Example body.** `{"name","description","definition":{"kind":"prompt","model":"<deployment>","instructions":"…","tools":[{"type":"mcp","server_label":"toolbox","server_url":"…","require_approval":"always","project_connection_id":"…"}]}}` — [MCP how-to](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol)
- **MCP fields.** `type:"mcp"`, `server_label`, `server_url`, `require_approval` (`"always"`/`"never"` shown in samples), `allowed_tools` (allow-list), `project_connection_id` (credentials in a project connection), custom `headers`. Runtime approval items are `mcp_approval_request` / `mcp_approval_response`. Microsoft's best practices:
  - use `allowed_tools`
  - treat tool descriptions and results as untrusted input (indirect prompt injection)
  - require approval for high-risk / write operations
  - log approvals and tool calls

  — [MCP how-to](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol)
- **Toolbox auth types.** Toolbox connection auth types include `user-entra-token`, `project-managed-identity` and `agentic-identity` (the agent's per-project identity). Each needs RBAC on the target — [MCP how-to](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol)
- **Agent object fields** (REST reference): `object:"agent"`, `id`, `name`, `state` (`enabled`/`disabled`), `configuration_state`, `state_source`, `agent_instance_identity`, `versions.latest`, `instance_identity` and `blueprint` (each `{principal_id, client_id, status: active|disabled}`), `blueprint_reference`, `agent_card`.
- **Version fields**: `description`, `metadata` (≤16 pairs), `definition` (kinds `prompt`, `hosted`, `workflow`, `external`, `voice`), `agent_endpoint`, `protocol_configuration`, `authorization_schemes` (`Entra`, `BotService`, `BotServiceRbac`, `BotServiceTenant`), `publish_approval_status`, `draft` (preview), `digital_worker_type` (`m365`).
- **Retirement.** "Microsoft Foundry is retiring workflows on December 1, 2026."

  — [Foundry REST API reference: agents](https://ai.azure.com/api-reference/agents/)
- **Identity behaviour.** Legacy agents have null identity and use the shared project identity. Newly created agents get their own Entra Agent Blueprint and Agent Identity by default. Publishing creates an Agent Application with its own identity/blueprint. `instance_identity.principal_id` is used for RBAC assignments — [Manage hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/manage-hosted-agent); [Agent applications](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/agent-applications) (via search summary)
- **Tool catalogue**, with toolbox (T) and direct (D) support:
  - MCP (T/D)
  - Web search (T/D)
  - Azure AI Search (T/D)
  - Code interpreter (T/D)
  - File search (T/D)
  - OpenAPI (T/D)
  - Agent-to-agent A2A (T/D)
  - Browser automation (T/D)
  - Fabric IQ (T/D)
  - Work IQ (T/D)
  - Tool search (T only, preview)
  - Skills (T only, preview)
  - Reminder (T only)
  - Function calling (D only)
  - Grounding with Bing (D only)
  - Computer use (D only)
  - Image generation (D only)
  - SharePoint (D only)
  - Fabric data agent (D only)
  - Azure Functions (D only)

  Toolboxes can apply guardrails (RAI policies) at the toolbox level — [Toolbox overview](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/toolbox-overview)

### Inferences
- **Evidence checks per agent version** (`GET {project}/agents?api-version=v1`, then each `versions.latest.definition`):
  - (a) `instructions` non-empty. This mirrors the Defender recommendation.
  - (b) Every `tools[type=='mcp']` has `require_approval=='always'` (or a per-tool approval map) and a non-empty `allowed_tools`.
  - (c) MCP `server_url` host is in an approved list, or points to a project toolbox.
  - (d) High-risk tool types present (`browser_automation`, `computer_use`, `code_interpreter`, `openapi` with write operations, `a2a`) are flagged for review.
  - (e) `instance_identity` is not null, i.e. the agent has its own Entra Agent ID, not the shared project MI.
  - (f) `metadata` carries required governance tags (owner, risk tier, impact-assessment ID). This is a cheap way to link attestations to agents.
  - (g) `model` resolves to a deployment whose model passes the approved-models policy.
- **Permissions.** Reading agents needs a data-plane role on the project, e.g. Foundry User (formerly Azure AI User). A control-plane app using the user's token gets only what that user can see.

### Gaps
- I did not retrieve the exact JSON `type` strings for the non-MCP tools (e.g. `browser_automation_preview` vs `browser_automation`, `openapi` auth `{type: anonymous|project_connection|managed_identity}`, `a2a_preview`).
- I could not confirm how the agent references its guardrail (see §2 gap).
- I could not confirm whether `instance_identity` is per agent or per version.

---

## 6. Entra Agent ID via Microsoft Graph

### Takeaway
Agent identities are a specialised `servicePrincipal` (`#microsoft.graph.agentIdentity`) with `agentIdentityBlueprintId`, `sponsors`, `owners`, inherited permissions, a `lifecycle` relationship, and an **`attest`** action ("Attest to the continued need for this agent identity"). Together these give directly queryable evidence for accountability (named sponsor), least privilege and periodic access review. A v1.0 version of the resource now also exists.

### Cited Findings
- **Properties**: `agentIdentityBlueprintId` (appId of the blueprint), `accountEnabled`, `createdByAppId`, `createdDateTime`, `disabledByMicrosoftStatus`, `managerApplications` (`$select` only), `servicePrincipalType` = `ServiceIdentity`, `tags` (union with blueprint tags), `customSecurityAttributes`, `appRoleAssignmentRequired`.
- **Relationships**: `sponsors`, `owners`, `appRoleAssignments`, `oauth2PermissionGrants`, `inheritedAppRoleAssignments`, `inheritedOauth2PermissionGrants` (from the blueprint SP), `memberOf`, `ownedObjects`, `createdObjects`, `communicationConfiguration`, `lifecycle` (`identityGovernance.agentIdentityLifecycle`).
- **Methods**: List/Get/Create/Update/Delete, **`attest`**, list/add/remove sponsors and owners, plus deleted-items restore. The page notes a graph-rest-1.0 version also exists.

  — [agentIdentity resource (beta)](https://learn.microsoft.com/en-us/graph/api/resources/agentidentity?view=graph-rest-beta)
- **Sponsors after GA.** A third-party post-GA guide says only users, dynamic-membership groups and M365 groups are accepted as sponsors; role-assignable and fixed security groups are no longer accepted. Sources conflict on whether blueprint creation is `POST /v1.0/applications/microsoft.graph.agentIdentityBlueprint` or beta `/applications` with an @odata.type — [microsoft.github.io identity-spiffe notes](https://microsoft.github.io/identity-spiffe/platform-learnings/agent-id-blueprints-and-users/); [Semperis deep dive](https://www.semperis.com/blog/entra-agent-identities-design-deep-dive/)
- **Sign-in logs.** Agent sign-ins appear in Entra sign-in logs with an "Agent type" filter (Agent ID user, Agent Identity, Agent Identity Blueprint, Not Agentic) and an "Is Agent" filter. Microsoft's sample uses beta `auditLogs/signIns` filtered on service-principal sign-ins and `agent/agentType eq 'AgentIdentity'`. The sample I saw was on the China-cloud host, so verify on global Graph — [Manage agent identities (docs.azure.cn)](https://docs.azure.cn/zh-cn/entra/agent-id/manage-agent-identities-admin)
- **Risk and Conditional Access.** Entra ID Protection scores agent risk. Conditional Access for Agent ID can use agent risk as a condition. A Microsoft-managed policy blocks high-risk agent identities by default — [Manage agent identities](https://docs.azure.cn/zh-cn/entra/agent-id/manage-agent-identities-admin); [Zero Trust assessment AI_006](https://microsoft.github.io/zerotrustassessment/ja/docs/workshop-guidance/AI/AI_006)

### Inferences
- **Evidence queries:**
  - `GET /beta/servicePrincipals/microsoft.graph.agentIdentity?$expand=sponsors` (or the v1.0 equivalent). Flag agents with zero sponsors, `accountEnabled` true but stale, missing tags, or broad app roles. Inherited roles come from `inheritedAppRoleAssignments`.
  - Join on Foundry `instance_identity.client_id` == agentIdentity `appId` to tie each Foundry agent to its directory object.
  - Use the `lifecycle` / `attest` data as evidence of a periodic need-review (ISO 42001 / NIST GOVERN accountability).
  - CA coverage: `GET /identity/conditionalAccess/policies` and inspect `conditions.clientApplications` / agent-targeting conditions **[Unverified property names for agent targeting]**.
- **Permissions** (likely; **[Unverified]**): Application.Read.All or AgentIdentity.Read.All for agent identities, AuditLog.Read.All plus a directory role for sign-ins, Policy.Read.All for Conditional Access. Agent-specific permission names should be confirmed on each method page.
- **MicrosoftGraphActivityLogs.** This Log Analytics table (Graph activity logs diagnostic setting) records Graph calls by agent identities by AppId/ServicePrincipalId. It is useful evidence of agent API activity **[Unverified for agent-specific columns]**. Entra sign-ins route to the `SigninLogs`, `AADServicePrincipalSignInLogs` and `AADManagedIdentitySignInLogs` tables through Entra diagnostic settings **[Unverified whether agent sign-ins use a separate table]**.

### Gaps
- I did not retrieve the agentIdentityBlueprint resource page, the agentIdentityLifecycle schema (attestation dates), or the exact Graph permissions per method.
- I did not confirm the agent CA policy schema (the conditionalAccessPolicy fields that target agents).

---

## 7. App Insights / Log Analytics telemetry evidence (OpenTelemetry GenAI)

### Takeaway
Foundry tracing emits OpenTelemetry GenAI spans to the Application Insights resource connected to the project. Spans include `create_agent`, `invoke_agent`, `execute_tool` and `chat`, with `gen_ai.*` attributes. **Message content capture is opt-in** through environment variables, and the default differs by SDK. Platform-side content-filter outcomes are most reliably evidenced through **Azure Monitor RAI metrics** and **Defender alerts**, not trace attributes.

### Cited Findings
- **Repository move.** The GenAI semconv moved from opentelemetry.io to the repo `open-telemetry/semantic-conventions-genai` — [opentelemetry.io notice](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
- **Agent spans** in the semconv: create agent, invoke agent (client and internal), invoke workflow, plan, execute tool, load skill, read skill resource, command execution.
  - Operation names include `chat`, `create_agent`, `embeddings`, `execute_tool`, `invoke_agent`, `create_memory`, among others. All are "Development" stability.
  - Create-agent attributes: `gen_ai.operation.name` (Required), `gen_ai.provider.name` (Required), `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.version`, `gen_ai.agent.description`, `gen_ai.request.model` (Conditionally Required), and `gen_ai.system_instructions` (**Opt-In**).

  — [semantic-conventions-genai: gen-ai-agent-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)
- **Content recording in Foundry SDK tracing.** It is controlled by `AZURE_TRACING_GEN_AI_CONTENT_RECORDING_ENABLED=true` (off by default in the Python sample) and requires an Application Insights resource connected to the project. Agent Framework uses `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`, `OTEL_SEMCONV_STABILITY_OPT_IN` and `AZURE_EXPERIMENTAL_ENABLE_GENAI_TRACING`. The LangChain `AzureAIOpenTelemetryTracer` records content **by default** (`enable_content_recording=False` to redact) — [Trace agents SDK](https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/develop/trace-agents-sdk); [Agent Framework tracing](https://learn.microsoft.com/en-us/azure/foundry/observability/how-to/trace-agent-framework); [LangChain traces](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/langchain-traces)
- **App Insights recommendation.** Defender recommends "Application Insights should be used on Microsoft Foundry (Preview)" — [AI recommendations](https://learn.microsoft.com/en-us/azure/defender-for-cloud/recommendations-reference-ai)
- **RAI metrics.** `RAIHarmfulRequests` (dimensions Category, Severity, TextType) and `RAIRejectedRequests` give per-deployment content-filter counts — [Monitoring reference](https://learn.microsoft.com/en-us/azure/foundry/openai/monitor-openai-reference)

### Inferences
- **KQL evidence**, workspace-based App Insights tables **[Unverified column paths, standard AI schema]**:
  - `AppDependencies | where Properties['gen_ai.operation.name'] in ('invoke_agent','execute_tool','chat') | summarize by tostring(Properties['gen_ai.agent.name']), tostring(Properties['gen_ai.tool.name'])`. This gives a tool-call inventory (evidence of actual vs. declared tool use) plus token usage via `gen_ai.usage.input_tokens/output_tokens`.
  - Content capture is on if `Properties has 'gen_ai.input.messages'` or `'gen_ai.system_instructions'` is populated. This is a privacy-control check: capture should be off in production, or retention/PII handling must be justified.
- **Account linkage.** The project's App Insights link can be discovered as a project connection of category AppInsights **[Unverified]**.

### Gaps
- I could not confirm whether Foundry's server-side agent runtime emits span attributes for content-filter results (e.g. `gen_ai.*` or `azure.ai.*` content_filter attributes). I found no primary documentation.
- I could not retrieve the full semconv attribute list (inference/tool spans: `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.conversation.id`, `gen_ai.input.messages`); the page was truncated.

---

## 8. Purview DSPM for AI signals

### Takeaway
Purview covers Foundry interactions across audit, DSPM for AI, DLP, insider risk, communication compliance, eDiscovery, retention and Compliance Manager. Enablement is a toggle in Foundry Control Plane or in Defender for Cloud. Programmatic evidence is limited to (a) unified audit log records and (b) the Graph `processContent` API for in-app DLP. I found no documented REST API that returns DSPM for AI posture or report data.

### Cited Findings
- **Prerequisite.** Enable "Microsoft Purview Data Security" in Foundry Control Plane, **or** "Enable Data Security for Azure AI with Microsoft Purview" in Defender for Cloud. Policies require pay-as-you-go billing; Audit is included — [Purview for Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry)
- **Capabilities.** Supported: DSPM/DSPM for AI (classic), auditing, classification, sensitivity labels, DLP, IRM, communication compliance, eDiscovery, DLM and Compliance Manager. Encryption without labels is not supported. Key items:
  - The DSPM for AI recommendation "Secure data in Azure AI apps and agents".
  - One-click policies "DSPM for AI - Capture interactions for enterprise AI apps" and "DSPM for AI - Detect sensitive info shared with AI via network".
  - The eDiscovery ItemClass `IPM.SkypeTeams.Message.ConnectedAIApp.AzureAI.<AzureResourceName>`.
  - Data Security Policies apply only to calls with an Entra user-context token or explicit user context (`UserSecurityContext`).
  - DLP blocking requires the app to call the Graph `userDataSecurityAndGovernance processContent` API (beta).

  — [Purview for Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry)
- **Audit record types**: `CopilotInteraction`, `ConnectedAIAppInteraction` (custom/registered apps), `AIAppInteraction` (third-party) — [Audit logs for Copilot and AI](https://learn.microsoft.com/en-us/purview/audit-copilot) (via search summary)

### Inferences
- Foundry interactions most likely log as `ConnectedAIAppInteraction` **[Unverified mapping]**.
- An app can query the unified audit log through the Graph Audit Log Query API (`/security/auditLog/queries`, permission AuditLogsQuery.Read.All) or through the Office 365 Management Activity API **[Unverified for this record type]**.
- The cheapest automatable check is the Defender-side Purview toggle (part of the AI plan's settings/extensions) plus presence of audit records for the resource.

### Gaps
- I found no API for DSPM for AI reports/recommendations, and no confirmation of which audit RecordType Foundry agent interactions use.

---

## 9. Controls that need manual attestation, and how to capture them

### Takeaway
Several AI-governance controls have no Azure signal:
- impact / risk assessments
- AI literacy training (EU AI Act Art. 4)
- red-team / evaluation sign-off
- incident response plan and tabletop
- vendor/model due diligence
- human-oversight procedures
- transparency notices to users
- data-provenance documentation
- post-market monitoring plans

Defender itself greys these out as "can't be automatically assessed". A tool should capture them as attestations with an owner, an evidence link, a date and an expiry, and bind them to Azure objects via tags/metadata. It can partially corroborate them with Azure signals.

### Cited Findings
- **Defender's handling.** Compliance controls that "can't be automatically assessed" show greyed out / unavailable in Defender for Cloud standards — [Regulatory compliance](https://learn.microsoft.com/en-us/azure/defender-for-cloud/concept-regulatory-compliance-standards)
- **Entra attest action.** Entra Agent ID exposes `agentIdentity: attest`, "Attest to the continued need for this agent identity". This is a native, timestamped attestation primitive for agent need/ownership — [agentIdentity](https://learn.microsoft.com/en-us/graph/api/resources/agentidentity?view=graph-rest-beta)
- **Agent metadata.** Agent versions carry `metadata` (≤16 key/value pairs, values ≤512 chars), suitable for linking attestation IDs — [Foundry REST agents](https://ai.azure.com/api-reference/agents/)
- **Compliance Manager templates.** Purview Compliance Manager provides AI-regulation assessment templates with control mapping, which is a home for manual improvement actions and evidence uploads — [Purview for Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry)

### Inferences
- **Suggested attestation model** (fields): control_id; scope (subscription / Foundry account / project / agent name+version / agentIdentity id); attestor (Entra UPN); role; statement; evidence_url (SharePoint/Purview/ADO link, document hash); performed_on; expires_on (e.g. 12 months for impact assessments and training, per-release for red-team); status; reviewer; and a link to the Azure object.
  - Store the attestation ID in Azure resource tags or agent `metadata` (e.g. `ia_id`, `redteam_run`), so that drift — a new agent version without a fresh attestation — is detectable automatically.
- **Partial automation hooks:**
  - **Red-teaming / evaluations.** Foundry evaluations and the AI Red Teaming Agent produce run records in the project. The exact data-plane API was not verified this session. Their presence can corroborate an "adversarial testing performed" attestation.
  - **Incident response.** Corroborate with the Defender AI plan enabled, alerts routed to Defender XDR/Sentinel, and action groups / automation rules present.
  - **Human oversight.** Corroborate with MCP `require_approval=='always'` and guardrail `action=='HITL'`.
  - **Accountability.** Corroborate with agentIdentity `sponsors` non-empty and recent `attest`.
  - **Vendor/model due diligence.** Corroborate with the approved-models and model-eligibility policy assignments and compliance.
- Controls with no corroborating signal should require an expiry and re-attestation workflow: AI literacy training (LMS export), the impact assessment document, the transparency notice text, and the data-governance record for training/grounding data.

### Gaps
- I did not verify the Foundry evaluation / red-team run APIs (data-plane paths and fields) as an automated evidence source.
- I did not retrieve the agentIdentityLifecycle schema, which should hold the attestation timestamps.
