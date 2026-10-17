// Seeded mock tenant. Deterministic (fixed PRNG seed) so charts and tables are stable between
// reloads. Deliberately contains findings the UI should surface: write tools without approval,
// agents missing mandatory harness injections, an unfiltered deployment, high-privilege grants.

import type {
  Agent,
  AgentIdentity,
  AzureRoleAssignment,
  FoundryProject,
  GraphActivity,
  ModelDeployment,
  PermissionGrant,
  PolicyState,
  RaiPolicy,
} from "../types";
import { HARNESS_INJECTIONS } from "../../lib/harnessLibrary";

export const SUB = "00000000-1111-2222-3333-444444444444";
const rg = (n: string) => `/subscriptions/${SUB}/resourceGroups/${n}`;

export function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PROJECTS: FoundryProject[] = [
  {
    id: `${rg("rg-ai-prod")}/providers/Microsoft.CognitiveServices/accounts/aif-contoso-prod/projects/enterprise-agents`,
    account: "aif-contoso-prod",
    name: "enterprise-agents",
    resourceGroup: "rg-ai-prod",
    location: "eastus2",
    endpoint: "https://aif-contoso-prod.services.ai.azure.com/api/projects/enterprise-agents",
  },
  {
    id: `${rg("rg-ai-prod")}/providers/Microsoft.CognitiveServices/accounts/aif-contoso-prod/projects/security-ops`,
    account: "aif-contoso-prod",
    name: "security-ops",
    resourceGroup: "rg-ai-prod",
    location: "eastus2",
    endpoint: "https://aif-contoso-prod.services.ai.azure.com/api/projects/security-ops",
  },
  {
    id: `${rg("rg-ai-dev")}/providers/Microsoft.CognitiveServices/accounts/aif-contoso-dev/projects/sandbox`,
    account: "aif-contoso-dev",
    name: "sandbox",
    resourceGroup: "rg-ai-dev",
    location: "eastus2",
    endpoint: "https://aif-contoso-dev.services.ai.azure.com/api/projects/sandbox",
  },
];

export const DEPLOYMENTS: ModelDeployment[] = [
  { id: "d1", account: "aif-contoso-prod", name: "gpt-4.1", model: "gpt-4.1", modelVersion: "2025-04-14", sku: "GlobalStandard", capacity: 450, raiPolicyName: "agentctl-strict" },
  { id: "d2", account: "aif-contoso-prod", name: "gpt-4.1-mini", model: "gpt-4.1-mini", modelVersion: "2025-04-14", sku: "GlobalStandard", capacity: 900, raiPolicyName: "Microsoft.DefaultV2" },
  { id: "d3", account: "aif-contoso-prod", name: "o4-mini", model: "o4-mini", modelVersion: "2025-04-16", sku: "DataZoneStandard", capacity: 200, raiPolicyName: "agentctl-strict" },
  { id: "d4", account: "aif-contoso-dev", name: "gpt-4.1-mini", model: "gpt-4.1-mini", modelVersion: "2025-04-14", sku: "GlobalStandard", capacity: 100, raiPolicyName: "Microsoft.DefaultV2" },
  { id: "d5", account: "aif-contoso-dev", name: "gpt-4o-exp", model: "gpt-4o", modelVersion: "2024-11-20", sku: "Standard", capacity: 30, raiPolicyName: "dev-relaxed" },
];

const wrap = (id: string) => {
  const i = HARNESS_INJECTIONS.find((x) => x.id === id)!;
  return `<!-- agentctl:harness id="${i.id}" position="${i.position}" mandatory="${i.mandatory}" -->\n${i.text}\n<!-- /agentctl:harness -->`;
};
const mandatory = [wrap("platform.identity-disclosure"), wrap("platform.prompt-injection-defense")].join("\n\n");

const P = (name: string) => PROJECTS.find((p) => p.name === name)!;
const mk = (a: Omit<Agent, "project" | "account" | "resourceGroup"> & { p: string }): Agent => {
  const { p, ...rest } = a;
  const proj = P(p);
  return { ...rest, project: proj.name, account: proj.account, resourceGroup: proj.resourceGroup };
};

export const AGENTS: Agent[] = [
  mk({
    p: "enterprise-agents",
    id: "asst_hrBen7Qx2LmN4",
    name: "hr-benefits-assistant",
    description: "Answers employee questions about benefits, leave and payroll using HR SharePoint content.",
    model: "gpt-4.1",
    instructions: `${mandatory}\n\nYou are the Contoso HR benefits assistant. Answer questions using only the HR policies available through SharePoint. Cite the policy title. Never give tax or legal advice.\n\n${wrap("platform.pii-handling")}`,
    tools: [
      { type: "sharepoint_grounding", name: "sharepoint", detail: "hr-policies-spo" },
      { type: "file_search", name: "file_search" },
    ],
    temperature: 0.2,
    topP: 1,
    createdAt: "2025-11-04T15:21:00Z",
    metadata: { team: "People Systems", owner: "maria.garcia@contoso.example", dataClassification: "confidential", environment: "prod", instructionsVersion: "2.3.0" },
    owner: "maria.garcia@contoso.example",
    agentIdentityId: "ai-1",
  }),
  mk({
    p: "enterprise-agents",
    id: "asst_itHelp9Kd0PqR2",
    name: "it-helpdesk-agent",
    description: "Tier-1 IT helpdesk: troubleshooting, password guidance, and ServiceNow ticket creation.",
    model: "gpt-4.1-mini",
    instructions: `${mandatory}\n\nYou are the IT helpdesk agent. Help users troubleshoot common issues. When you cannot resolve an issue, create a ServiceNow incident with a clear summary.`,
    tools: [
      { type: "mcp", name: "servicenow", detail: "https://mcp-servicenow.agentctl.internal.example/mcp", requireApproval: "never" },
      { type: "openapi", name: "kb_search" },
      { type: "azure_function", name: "escalate_to_human" },
    ],
    temperature: 0.3,
    createdAt: "2025-09-18T10:02:00Z",
    metadata: { team: "End User Computing", owner: "devon.lee@contoso.example", dataClassification: "internal", environment: "prod", instructionsVersion: "1.8.1" },
    owner: "devon.lee@contoso.example",
    agentIdentityId: "ai-2",
  }),
  mk({
    p: "enterprise-agents",
    id: "asst_finInv3Hs8TyU1",
    name: "finance-invoice-triage",
    description: "Classifies inbound invoices, extracts fields, and routes exceptions to AP clerks.",
    model: "o4-mini",
    instructions: `You are an accounts payable triage agent. Extract vendor, amount, currency, PO number and due date. Flag any invoice above 50,000 USD or without a PO for human review.`,
    tools: [
      { type: "code_interpreter", name: "code_interpreter" },
      { type: "azure_function", name: "post_to_erp" },
      { type: "file_search", name: "file_search" },
    ],
    temperature: 0,
    createdAt: "2026-01-12T08:45:00Z",
    metadata: { team: "Finance Ops", owner: "priya.nair@contoso.example", dataClassification: "highly_confidential", environment: "prod", instructionsVersion: "1.2.0" },
    owner: "priya.nair@contoso.example",
  }),
  mk({
    p: "enterprise-agents",
    id: "asst_salRes5Wz7AbC9",
    name: "sales-research-agent",
    description: "Researches prospects on the public web and drafts account briefs; delegates CRM updates.",
    model: "gpt-4.1",
    instructions: `${mandatory}\n\nYou research companies for account executives. Use web search for public information only. When the user asks to update CRM, delegate to the crm-writer agent.\n\n${wrap("platform.tool-approval-etiquette")}`,
    tools: [
      { type: "bing_grounding", name: "bing", detail: "bing-global" },
      { type: "connected_agent", name: "crm_writer", detail: "asst_crmWr1Te4Jk6L" },
    ],
    temperature: 0.5,
    createdAt: "2026-03-02T13:10:00Z",
    metadata: { team: "Revenue Ops", owner: "sam.okafor@contoso.example", dataClassification: "internal", environment: "prod", instructionsVersion: "3.0.0" },
    owner: "sam.okafor@contoso.example",
    agentIdentityId: "ai-3",
  }),
  mk({
    p: "enterprise-agents",
    id: "asst_crmWr1Te4Jk6L",
    name: "crm-writer",
    description: "Sub-agent that writes account notes and opportunities into Dynamics 365.",
    model: "gpt-4.1-mini",
    instructions: `You update Dynamics 365 records exactly as instructed by the calling agent. Never delete records.`,
    tools: [{ type: "mcp", name: "dynamics", detail: "https://mcp-d365.agentctl.internal.example/mcp", requireApproval: "always" }],
    temperature: 0,
    createdAt: "2026-03-02T13:40:00Z",
    metadata: { team: "Revenue Ops", owner: "sam.okafor@contoso.example", dataClassification: "confidential", environment: "prod", instructionsVersion: "1.0.0" },
    owner: "sam.okafor@contoso.example",
    agentIdentityId: "ai-4",
  }),
  mk({
    p: "security-ops",
    id: "asst_secTri2Np5Vb8Q",
    name: "secops-triage-agent",
    description: "Enriches Defender XDR incidents with sign-in and Graph activity context and proposes a severity.",
    model: "gpt-4.1",
    instructions: `${mandatory}\n\nYou are a SOC tier-1 triage assistant. Enrich incidents with entity context. Never close or remediate incidents — propose actions for a human analyst.`,
    tools: [
      { type: "openapi", name: "defender_incidents" },
      { type: "openapi", name: "log_analytics_query" },
      { type: "azure_function", name: "escalate_to_human" },
    ],
    temperature: 0.1,
    createdAt: "2025-12-01T09:00:00Z",
    metadata: { team: "Security Operations", owner: "alex.kim@contoso.example", dataClassification: "confidential", environment: "prod", instructionsVersion: "2.0.4" },
    owner: "alex.kim@contoso.example",
    agentIdentityId: "ai-5",
  }),
  mk({
    p: "sandbox",
    id: "asst_devDoc6Yu3Gh0R",
    name: "dev-docs-copilot",
    description: "Answers engineering questions over internal docs and the platform wiki.",
    model: "gpt-4.1-mini",
    instructions: `Answer engineering questions using the indexed internal documentation. Include links.`,
    tools: [
      { type: "azure_ai_search", name: "azure_ai_search", detail: "search-eng-docs" },
      { type: "file_search", name: "file_search" },
    ],
    temperature: 0.2,
    createdAt: "2026-06-20T17:30:00Z",
    metadata: { team: "Platform Engineering", owner: "jordan.wu@contoso.example", dataClassification: "internal", environment: "dev", instructionsVersion: "0.4.0" },
    owner: "jordan.wu@contoso.example",
  }),
  mk({
    p: "sandbox",
    id: "asst_brwOps8Lk2Mn5P",
    name: "browser-ops-bot",
    description: "Experimental: automates vendor portal downloads via browser automation.",
    model: "gpt-4o-exp",
    instructions: `Log into vendor portals and download the latest statements.`,
    tools: [{ type: "browser_automation", name: "browser_automation", requireApproval: "never" }],
    temperature: 0.7,
    createdAt: "2026-09-29T11:11:00Z",
    metadata: { team: "Finance Ops", owner: "priya.nair@contoso.example", dataClassification: "confidential", environment: "dev", instructionsVersion: "0.1.0" },
    owner: "priya.nair@contoso.example",
  }),
];

export const USERS = [
  "maria.garcia", "devon.lee", "priya.nair", "sam.okafor", "alex.kim", "jordan.wu", "taylor.reed", "chris.morgan",
  "li.wei", "fatima.haddad", "noah.schmidt", "emma.rossi", "kenji.tanaka", "olivia.brown", "lucas.martin", "ava.dubois",
  "ethan.cohen", "sofia.lopez", "mason.clark", "isabella.silva", "liam.oconnor", "mia.novak", "james.ali", "zoe.park",
].map((u) => `${u}@contoso.example`);

/** Rough share of traffic per agent, used by the generators. */
export const AGENT_WEIGHT: Record<string, number> = {
  "hr-benefits-assistant": 0.26,
  "it-helpdesk-agent": 0.3,
  "finance-invoice-triage": 0.12,
  "sales-research-agent": 0.11,
  "crm-writer": 0.06,
  "secops-triage-agent": 0.1,
  "dev-docs-copilot": 0.04,
  "browser-ops-bot": 0.01,
};

export const AGENT_TOOLS_USED: Record<string, string[]> = {
  "hr-benefits-assistant": ["sharepoint_grounding", "file_search"],
  "it-helpdesk-agent": ["servicenow.create_incident", "servicenow.get_incident", "kb_search", "escalate_to_human"],
  "finance-invoice-triage": ["code_interpreter", "post_to_erp", "file_search"],
  "sales-research-agent": ["bing_grounding", "crm_writer"],
  "crm-writer": ["dynamics.update_account", "dynamics.create_note"],
  "secops-triage-agent": ["defender_incidents.get", "log_analytics_query", "escalate_to_human"],
  "dev-docs-copilot": ["azure_ai_search", "file_search"],
  "browser-ops-bot": ["browser_automation"],
};

/** Agents that run without a signed-in user (app-only / scheduled). */
export const APP_ONLY_AGENTS = new Set(["finance-invoice-triage", "secops-triage-agent", "browser-ops-bot"]);

export const AGENT_IDENTITIES: AgentIdentity[] = [
  { id: "ai-1", appId: "1b0c5e1a-0001-4a1b-9c1d-a1b2c3d4e001", displayName: "hr-benefits-assistant", kind: "agent_identity", blueprintId: "bp-1", sponsors: ["maria.garcia@contoso.example"], createdDateTime: "2025-11-04T15:20:00Z", accountEnabled: true },
  { id: "ai-2", appId: "1b0c5e1a-0002-4a1b-9c1d-a1b2c3d4e002", displayName: "it-helpdesk-agent", kind: "agent_identity", blueprintId: "bp-1", sponsors: ["devon.lee@contoso.example"], createdDateTime: "2025-09-18T10:00:00Z", accountEnabled: true },
  { id: "ai-3", appId: "1b0c5e1a-0003-4a1b-9c1d-a1b2c3d4e003", displayName: "sales-research-agent", kind: "agent_identity", blueprintId: "bp-1", sponsors: ["sam.okafor@contoso.example"], createdDateTime: "2026-03-02T13:09:00Z", accountEnabled: true },
  { id: "ai-4", appId: "1b0c5e1a-0004-4a1b-9c1d-a1b2c3d4e004", displayName: "crm-writer", kind: "agent_identity", blueprintId: "bp-1", sponsors: [], createdDateTime: "2026-03-02T13:39:00Z", accountEnabled: true },
  { id: "ai-5", appId: "1b0c5e1a-0005-4a1b-9c1d-a1b2c3d4e005", displayName: "secops-triage-agent", kind: "agent_identity", blueprintId: "bp-2", sponsors: ["alex.kim@contoso.example"], createdDateTime: "2025-12-01T08:58:00Z", accountEnabled: true },
  { id: "bp-1", appId: "1b0c5e1a-00b1-4a1b-9c1d-a1b2c3d4e0b1", displayName: "Contoso Enterprise Agent Blueprint", kind: "agent_blueprint", sponsors: ["platform-team@contoso.example"], createdDateTime: "2025-09-01T00:00:00Z", accountEnabled: true },
  { id: "bp-2", appId: "1b0c5e1a-00b2-4a1b-9c1d-a1b2c3d4e0b2", displayName: "Contoso SecOps Agent Blueprint", kind: "agent_blueprint", sponsors: ["alex.kim@contoso.example"], createdDateTime: "2025-11-20T00:00:00Z", accountEnabled: true },
  { id: "mi-fin", appId: "7e1d2f3a-0006-4b2c-8d3e-f1e2d3c4b006", displayName: "aif-contoso-prod/enterprise-agents (project MI)", kind: "service_principal_tagged", sponsors: [], createdDateTime: "2025-08-10T00:00:00Z", accountEnabled: true },
];

export const PERMISSION_GRANTS: PermissionGrant[] = [
  { id: "g1", kind: "delegated", clientAppId: AGENT_IDENTITIES[0].appId, clientName: "hr-benefits-assistant", resourceName: "Office 365 SharePoint Online", permissions: ["Sites.Read.All"], consentType: "AllPrincipals", isAgent: true, highPrivilege: false },
  { id: "g2", kind: "delegated", clientAppId: AGENT_IDENTITIES[0].appId, clientName: "hr-benefits-assistant", resourceName: "Microsoft Graph", permissions: ["User.Read", "openid", "profile"], consentType: "AllPrincipals", isAgent: true, highPrivilege: false },
  { id: "g3", kind: "delegated", clientAppId: AGENT_IDENTITIES[1].appId, clientName: "it-helpdesk-agent", resourceName: "Microsoft Graph", permissions: ["User.Read", "User.ReadBasic.All", "Device.Read.All"], consentType: "AllPrincipals", isAgent: true, highPrivilege: false },
  { id: "g4", kind: "delegated", clientAppId: AGENT_IDENTITIES[2].appId, clientName: "sales-research-agent", resourceName: "Microsoft Graph", permissions: ["Mail.Read", "Calendars.Read"], consentType: "AllPrincipals", isAgent: true, highPrivilege: false },
  { id: "g5", kind: "delegated", clientAppId: AGENT_IDENTITIES[2].appId, clientName: "sales-research-agent", resourceName: "Dynamics CRM", permissions: ["user_impersonation"], consentType: "Principal", principalName: "sam.okafor@contoso.example", isAgent: true, highPrivilege: false },
  { id: "g6", kind: "application", clientAppId: AGENT_IDENTITIES[3].appId, clientName: "crm-writer", resourceName: "Dynamics CRM", permissions: ["Accounts.ReadWrite.All"], consentType: "AppRole", isAgent: true, highPrivilege: true },
  { id: "g7", kind: "application", clientAppId: AGENT_IDENTITIES[4].appId, clientName: "secops-triage-agent", resourceName: "Microsoft Graph", permissions: ["SecurityIncident.Read.All"], consentType: "AppRole", isAgent: true, highPrivilege: false },
  { id: "g8", kind: "application", clientAppId: AGENT_IDENTITIES[4].appId, clientName: "secops-triage-agent", resourceName: "Microsoft Graph", permissions: ["AuditLog.Read.All", "Directory.Read.All"], consentType: "AppRole", isAgent: true, highPrivilege: true },
  { id: "g9", kind: "application", clientAppId: AGENT_IDENTITIES[7].appId, clientName: "aif-contoso-prod/enterprise-agents (project MI)", resourceName: "Microsoft Graph", permissions: ["Mail.Send"], consentType: "AppRole", isAgent: true, highPrivilege: true },
  { id: "g10", kind: "delegated", clientAppId: "00000000-aaaa-bbbb-cccc-000000000010", clientName: "Contoso Expenses (non-agent)", resourceName: "Microsoft Graph", permissions: ["User.Read", "Files.ReadWrite.All"], consentType: "AllPrincipals", isAgent: false, highPrivilege: true },
];

export const ROLE_ASSIGNMENTS: AzureRoleAssignment[] = [
  { id: "ra1", principalId: "ai-1", principalName: "hr-benefits-assistant", principalType: "ServicePrincipal", roleName: "Azure AI User", scope: PROJECTS[0].id, isAgent: true },
  { id: "ra2", principalId: "ai-2", principalName: "it-helpdesk-agent", principalType: "ServicePrincipal", roleName: "Azure AI User", scope: PROJECTS[0].id, isAgent: true },
  { id: "ra3", principalId: "mi-fin", principalName: "aif-contoso-prod/enterprise-agents (project MI)", principalType: "ServicePrincipal", roleName: "Storage Blob Data Contributor", scope: `${rg("rg-finance")}/providers/Microsoft.Storage/storageAccounts/stinvoicesprod`, isAgent: true },
  { id: "ra4", principalId: "mi-fin", principalName: "aif-contoso-prod/enterprise-agents (project MI)", principalType: "ServicePrincipal", roleName: "Contributor", scope: rg("rg-finance"), isAgent: true },
  { id: "ra5", principalId: "ai-5", principalName: "secops-triage-agent", principalType: "ServicePrincipal", roleName: "Log Analytics Reader", scope: `${rg("rg-sec")}/providers/Microsoft.OperationalInsights/workspaces/law-sentinel`, isAgent: true },
  { id: "ra6", principalId: "ai-5", principalName: "secops-triage-agent", principalType: "ServicePrincipal", roleName: "Microsoft Sentinel Responder", scope: `${rg("rg-sec")}/providers/Microsoft.OperationalInsights/workspaces/law-sentinel`, isAgent: true },
  { id: "ra7", principalId: "ai-3", principalName: "sales-research-agent", principalType: "ServicePrincipal", roleName: "Cognitive Services OpenAI User", scope: `${rg("rg-ai-prod")}/providers/Microsoft.CognitiveServices/accounts/aif-contoso-prod`, isAgent: true },
  { id: "ra8", principalId: "sp-ci", principalName: "github-actions-deployer", principalType: "ServicePrincipal", roleName: "Owner", scope: rg("rg-ai-prod"), isAgent: false },
];

const filters = (sev: string, blocking = true, enabled = true) =>
  (["hate", "sexual", "violence", "selfharm"] as const).flatMap((name) =>
    (["Prompt", "Completion"] as const).map((source) => ({ name, source, enabled, blocking, severityThreshold: sev })),
  );

export const RAI_POLICIES: RaiPolicy[] = [
  {
    id: "rai1",
    account: "aif-contoso-prod",
    name: "agentctl-strict",
    basePolicyName: "Microsoft.DefaultV2",
    mode: "Blocking",
    contentFilters: [
      ...filters("Low"),
      { name: "jailbreak", source: "Prompt", enabled: true, blocking: true },
      { name: "indirect_attack", source: "Prompt", enabled: true, blocking: true },
      { name: "protected_material_text", source: "Completion", enabled: true, blocking: true },
      { name: "protected_material_code", source: "Completion", enabled: true, blocking: false },
    ],
  },
  {
    id: "rai2",
    account: "aif-contoso-prod",
    name: "Microsoft.DefaultV2",
    basePolicyName: "",
    mode: "Blocking",
    contentFilters: [...filters("Medium"), { name: "jailbreak", source: "Prompt", enabled: true, blocking: true }, { name: "protected_material_text", source: "Completion", enabled: true, blocking: true }],
  },
  {
    id: "rai3",
    account: "aif-contoso-dev",
    name: "dev-relaxed",
    basePolicyName: "Microsoft.DefaultV2",
    mode: "Asynchronous_filter",
    contentFilters: [...filters("High", false), { name: "jailbreak", source: "Prompt", enabled: false, blocking: false }, { name: "indirect_attack", source: "Prompt", enabled: false, blocking: false }],
  },
  {
    id: "rai4",
    account: "aif-contoso-dev",
    name: "Microsoft.DefaultV2",
    basePolicyName: "",
    mode: "Blocking",
    contentFilters: [...filters("Medium"), { name: "jailbreak", source: "Prompt", enabled: true, blocking: true }],
  },
];

const acct = (rgName: string, n: string) => `${rg(rgName)}/providers/Microsoft.CognitiveServices/accounts/${n}`;
export const POLICY_STATES: PolicyState[] = [
  ["Azure AI Services resources should restrict network access", "aif-contoso-prod", "rg-ai-prod", "Compliant"],
  ["Azure AI Services resources should restrict network access", "aif-contoso-dev", "rg-ai-dev", "NonCompliant"],
  ["Azure AI Services resources should have key access disabled (disable local authentication)", "aif-contoso-prod", "rg-ai-prod", "Compliant"],
  ["Azure AI Services resources should have key access disabled (disable local authentication)", "aif-contoso-dev", "rg-ai-dev", "NonCompliant"],
  ["Diagnostic logs in Azure AI services resources should be enabled", "aif-contoso-prod", "rg-ai-prod", "Compliant"],
  ["Diagnostic logs in Azure AI services resources should be enabled", "aif-contoso-dev", "rg-ai-dev", "NonCompliant"],
  ["Azure AI Services resources should use Azure Private Link", "aif-contoso-prod", "rg-ai-prod", "NonCompliant"],
  ["Cognitive Services accounts should use customer owned storage", "aif-contoso-prod", "rg-ai-prod", "Compliant"],
  ["Only approved models should be deployed (custom)", "aif-contoso-dev", "rg-ai-dev", "NonCompliant"],
  ["Only approved models should be deployed (custom)", "aif-contoso-prod", "rg-ai-prod", "Compliant"],
].map(([def, name, rgName, state], i) => ({
  policyAssignmentName: i < 8 ? "asb-ai-baseline" : "agentctl-approved-models",
  policyDefinitionName: `def-${i}`,
  policyDefinitionDisplayName: def,
  resourceId: acct(rgName, name),
  resourceType: "Microsoft.CognitiveServices/accounts",
  complianceState: state as PolicyState["complianceState"],
  timestamp: "2026-10-17T06:00:00Z",
}));

export const GRAPH_ACTIVITY_BASE: Omit<GraphActivity, "calls" | "errors" | "lastSeen">[] = [
  { appId: AGENT_IDENTITIES[0].appId, appName: "hr-benefits-assistant", authFlow: "delegated", method: "GET", endpoint: "/v1.0/me", scopesOrRoles: "User.Read" },
  { appId: AGENT_IDENTITIES[0].appId, appName: "hr-benefits-assistant", authFlow: "delegated", method: "POST", endpoint: "/v1.0/search/query", scopesOrRoles: "Sites.Read.All" },
  { appId: AGENT_IDENTITIES[1].appId, appName: "it-helpdesk-agent", authFlow: "delegated", method: "GET", endpoint: "/v1.0/users/{id}/ownedDevices", scopesOrRoles: "Device.Read.All" },
  { appId: AGENT_IDENTITIES[1].appId, appName: "it-helpdesk-agent", authFlow: "delegated", method: "GET", endpoint: "/v1.0/users/{upn}", scopesOrRoles: "User.ReadBasic.All" },
  { appId: AGENT_IDENTITIES[2].appId, appName: "sales-research-agent", authFlow: "delegated", method: "GET", endpoint: "/v1.0/me/messages", scopesOrRoles: "Mail.Read" },
  { appId: AGENT_IDENTITIES[2].appId, appName: "sales-research-agent", authFlow: "delegated", method: "GET", endpoint: "/v1.0/me/calendarView", scopesOrRoles: "Calendars.Read" },
  { appId: AGENT_IDENTITIES[4].appId, appName: "secops-triage-agent", authFlow: "app", method: "GET", endpoint: "/v1.0/security/incidents", scopesOrRoles: "SecurityIncident.Read.All" },
  { appId: AGENT_IDENTITIES[4].appId, appName: "secops-triage-agent", authFlow: "app", method: "GET", endpoint: "/v1.0/auditLogs/signIns", scopesOrRoles: "AuditLog.Read.All" },
  { appId: AGENT_IDENTITIES[4].appId, appName: "secops-triage-agent", authFlow: "app", method: "GET", endpoint: "/v1.0/users/{id}/memberOf", scopesOrRoles: "Directory.Read.All" },
  { appId: AGENT_IDENTITIES[7].appId, appName: "aif-contoso-prod/enterprise-agents (project MI)", authFlow: "app", method: "POST", endpoint: "/v1.0/users/{id}/sendMail", scopesOrRoles: "Mail.Send" },
  { appId: "00000000-aaaa-bbbb-cccc-000000000010", appName: "Contoso Expenses (non-agent)", authFlow: "delegated", method: "PUT", endpoint: "/v1.0/me/drive/items/{id}/content", scopesOrRoles: "Files.ReadWrite.All" },
];
