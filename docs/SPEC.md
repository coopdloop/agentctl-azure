# agentctl: Agentic Platform Control Plane

**Status:** v0.2. Frontend, Terraform modules, bundle format, access model and a GitOps repo template (GitHub Actions), validated against a real tenant ([VALIDATION.md](VALIDATION.md)). Bundles are downloaded and committed to the agents-gitops repo by hand; a direct "open PR" integration is not built yet.
**Owner:** Platform / SecOps
**Last updated:** 2026-10-17

---

## 1. Purpose

agentctl is a single place to **see** and **govern** every AI agent running on Azure AI Foundry:

1. **Observe.** See which agents exist, what they are doing (runs, tool calls, tokens, failures), who uses them, and with what authority (delegated, on-behalf-of, app-only, managed identity, Entra Agent ID).
2. **Govern.** Surface guardrail posture: content-safety (RAI) policies, Azure Policy compliance, over-privileged identities, write-capable tools that run without approval, and missing platform instructions.
3. **Change, safely.** Register new agents with an in-depth builder, and apply **harness injection** to existing agents: extra tools (with approval), injected platform instructions, tighter guardrails. Every change is a reviewable **bundle** (manifest + change request + Foundry payload + Terraform) for a GitOps pipeline, not a direct write to production.

Non-goals for v0.1: running agents, a hosted approval queue, and direct mutation of Foundry from the browser.

## 2. Users, roles and data scopes

Full detail: **[ACCESS.md](ACCESS.md)**.

Roles are Entra **app roles** on the agentctl app registration, created by Terraform and carried in the ID token's `roles` claim. They are usually granted through Terraform-managed role groups (`agentctl-<env>-<role>s`).

| Role | Value | Can |
|---|---|---|
| Reader | `AgentCtl.Reader` | Observe views (Overview, Agents, Activity, Guardrails, Data sources), within the user's scope |
| Identity Reader | `AgentCtl.IdentityReader` | Identity & access views (sign-ins, grants, RBAC, agent identities) |
| Requester | `AgentCtl.Requester` | Builder and harness injection; bundles are **proposals** that the agent's owners must approve |
| Builder | `AgentCtl.Builder` | Agent builder; harness injection; "Fix" on findings |
| Approver | `AgentCtl.Approver` | Review bundle: integrity, schema, independent risk recompute |
| Admin | `AgentCtl.Admin` | Everything, never scoped, plus bulk remediation |

**Data scopes** map Entra groups to Foundry projects (and optional agent name globs such as `hr-*`). Terraform grants each scope group Foundry User on exactly its projects and a table-scoped **Telemetry Reader** role on the workspace (App* tables only). The UI filters every view to the user's scopes. Users in no scope see `unscoped_default` (`all` or `none`).

The app role gates the **UI only**. Every Azure call uses the **signed-in user's own token**, so data visibility is enforced by Azure RBAC and Entra on the source systems. agentctl cannot show a user something they couldn't read themselves. Project isolation is Azure-enforced; agent-name globs and per-agent telemetry filtering are UI-only.

## 3. Architecture

```
 Browser (React + Fluent UI v9, MSAL.js auth code + PKCE)
   │  token per audience (silent → popup consent)
   ├─────────────► management.azure.com      ARM: Foundry accounts/projects/deployments/RAI, RBAC, Azure Policy
   ├─────────────► graph.microsoft.com       Grants, app role assignments, Entra Agent ID, name resolution
   ├─────────────► api.loganalytics.azure.com KQL: App Insights gen_ai traces, Entra sign-in & Graph activity logs
   └── /proxy/<host>/… ──► <acct>.services.ai.azure.com   Foundry Agent Service (no browser CORS)
            ▲
 App Service (Linux, Node 22): server/server.mjs, zero npm dependencies
   • serves dist/ (SPA, history fallback) with strict CSP
   • /config.js       runtime config from app settings (no secrets)
   • /proxy/*         pass-through to an allowlist of *.services.ai.azure.com, *.cognitiveservices.azure.com, *.openai.azure.com;
                      forwards the user's Authorization header; holds no credentials
   • /healthz
```

**Clouds, subscriptions, private networks.** Endpoints come from a cloud profile (`AGENTCTL_CLOUD`); Foundry is discovered across subscriptions with Azure Resource Graph; and any of ARM, Graph and Log Analytics can be routed through `/proxy` (`AGENTCTL_PROXY_SERVICES`) so a VNet-integrated App Service reaches private endpoints. See **[ENVIRONMENTS.md](ENVIRONMENTS.md)**.

**Why a proxy at all?** ARM, Graph and Log Analytics send CORS headers for browser origins; the Foundry project data plane does not reliably do so. The proxy is a dumb, allowlisted pipe, so the app stays "frontend-only" in the sense that matters: no server-side identity and no business logic. The same middleware runs in the Vite dev server (`vite.config.ts`) and in production (`server/server.mjs`).

**Mock and live.** A `DataSource` interface (`src/api/types.ts`) has two implementations:
- `MockDataSource`: a seeded, deterministic tenant (8 agents, 3 projects, 30 days of runs, identities, grants, RAI policies, policy states) with deliberate findings. Needs zero Azure setup.
- `LiveDataSource`: the real APIs listed below.

The mode is toggled in the UI (account menu or Data sources). Live mode is available only when tenant, client and subscription ids are configured.

**Runtime config.** One build serves every environment. `/config.js` is rendered from `AGENTCTL_*` environment variables: app settings in Azure, `app/.env.local` locally. Terraform outputs a ready-made `.env.local`.

**CSP.** `script-src 'self'` with no `unsafe-eval`. JSON Schema validators are precompiled to standalone code at build time (`scripts/gen-validators.mjs`), so Ajv never calls `new Function` in the browser.

## 4. Sources of truth

| View / feature | API | Token audience | User needs |
|---|---|---|---|
| Foundry accounts, projects (+ project MI), all subscriptions | Azure Resource Graph (`Microsoft.ResourceGraph/resources`); fallback ARM `Microsoft.CognitiveServices/accounts[/projects]` `2025-06-01` per subscription, then `AGENTCTL_FOUNDRY_PROJECT_ENDPOINTS` | ARM `user_impersonation` | Read on the resources (RBAC-filtered) |
| Model deployments + RAI policy per deployment | ARM `…/deployments`, `…/raiPolicies` | ARM | Reader |
| Agent definitions (instructions, tools, model, version, instance identity) | Foundry agents API `GET {project}/agents?api-version=v1` and classic `GET {project}/assistants?api-version=v1`, via `/proxy` | `https://ai.azure.com/.default` | Foundry User on project |
| Runs, tool calls, tokens, latency, traces | Log Analytics → `AppDependencies`, `AppRequests` (`gen_ai.*` OTel attributes from Foundry tracing) | `https://api.loganalytics.io/Data.Read` | Log Analytics Reader, or agentctl Telemetry Reader (App* tables only) |
| Content-filter results, content capture | `AppDependencies` (`microsoft.foundry.content_filter.results`, `gen_ai.input/output.messages`) | Log Analytics | same |
| Who uses agents / auth flow | `SigninLogs`, `AADNonInteractiveUserSignInLogs`, `AADServicePrincipalSignInLogs`, `AADManagedIdentitySignInLogs` | Log Analytics | Log Analytics Reader + Entra diagnostic export |
| What agents call in Graph | `MicrosoftGraphActivityLogs` | Log Analytics | same |
| Delegated / OBO grants | Graph `GET /oauth2PermissionGrants` | Graph `DelegatedPermissionGrant.Read.All` | consent |
| App-only permissions | Graph `GET /servicePrincipals/{id}/appRoleAssignments` | Graph `Application.Read.All` | consent |
| Agent identities, blueprints, sponsors | Graph beta `servicePrincipals/microsoft.graph.agentIdentity`, `applications/microsoft.graph.agentIdentityBlueprint` (preview). Fallback: SPs tagged `agentctl-agent` | Graph `AgentIdentity.Read.All` | consent |
| Azure RBAC held by agents | ARM `Microsoft.Authorization/roleAssignments` + `roleDefinitions` | ARM | Reader |
| Policy compliance (AI resources) | ARM `Microsoft.PolicyInsights/policyStates/latest/queryResults` | ARM | Reader |

All KQL lives in `app/src/api/live/kql.ts`. Every query is bounded by time range and `top N`.

### 4.1 Auth flow classification

| Flow | Rule |
|---|---|
| **Delegated** | Interactive user sign-in (`SigninLogs`): the user called the agent with their own token. |
| **On-behalf-of** | Non-interactive user sign-in where the **client** is a known agent app, **or** is itself a resource that users sign in to (a middle tier), **or** the `Agent` column (Entra Agent ID sign-ins) is populated. |
| **Agent identity** | Service-principal sign-in by an Entra Agent ID identity (or a tagged SP). |
| **App-only** | Any other service-principal (client credentials) sign-in. |
| **Managed identity** | `AADManagedIdentitySignInLogs`, e.g. Foundry project MIs. |

Entra does not label OBO explicitly in sign-in logs, so the OBO rule is a heuristic. It is documented in the UI and kept in one KQL function so it is easy to refine. Agent runs can also carry an explicit `agentctl.auth_flow` span attribute, which takes precedence.

### 4.2 Telemetry contract for agents

To appear in Activity, agents must emit OpenTelemetry GenAI spans to the Application Insights resource connected to their Foundry project.
- **Agents API:** Foundry emits server-side `invoke_agent` and `chat` spans with `gen_ai.agent.name` / version, token usage, content-filter results and (with content capture on) the full messages. The caller comes from the client's HTTP span in the same operation (`enduser.id`, stored as `UserAuthenticatedId`).
- **Classic (assistants) SDK:** spans such as `start_thread_run`, `process_thread_run` and `submit_tool_outputs`, with runs keyed by `gen_ai.thread.run.id`.

Recognised attributes: `gen_ai.operation.name` (`invoke_agent` | `start_thread_run` | `process_thread_run` | `create_run` | `create_thread_and_run` | `chat` | `execute_tool` | `submit_tool_outputs`), `gen_ai.agent.name|id`, `gen_ai.tool.name`, `gen_ai.usage.input_tokens|output_tokens`, `gen_ai.request.model`, `gen_ai.thread.id`, `enduser.id`. Optional: `agentctl.auth_flow`, which takes precedence for flow classification.

## 5. Features

### 5.1 Overview
KPI tiles (agents, runs, tokens, active users, unapproved write tools, open findings), runs over time (succeeded/failed), auth-flow mix, tokens by agent (colour follows the agent), top findings, most-used tools, and agents by activity. A global time range (1h/24h/7d/30d) applies to every view.

### 5.2 Agents and agent detail
A searchable inventory across projects: environment, model, tools (unapproved write tools flagged), harness status (mandatory injections present?), owner, runs, failure rate, tokens, last run.
Detail tabs: **Overview** (effective prompt with platform injections highlighted, definition, tools with risk/approval), **Activity**, **Identity & access** (who uses it, grants, RBAC), **Guardrails** (findings, RAI filters of its deployment), **Manifest** (deployed state reverse-mapped to the manifest schema, i.e. the "before" of any change).

### 5.3 Activity & traces
Runs reconstructed per `OperationId` (caller, auth flow, status, tool calls, tokens, duration), with filters for agent, status and caller. A drawer shows the **span waterfall** (agent → model turns → tool calls).

### 5.4 Identity & access
Tabs: **Usage by principal** (flow classification above, failures, conditional access), **Graph activity** (normalised endpoints, scopes/roles actually used), **Permissions** (delegated vs app-only, admin vs user consent, high-privilege flag), **Agent identities** (Agent ID identities and blueprints, missing sponsors), **Azure RBAC** (Owner/Contributor/UAA flagged).

### 5.5 Guardrails
- **Findings engine** (`src/lib/findings.ts`): missing mandatory harness instructions; browser automation; MCP tools with `require_approval=never`; weak RAI policy on an agent's deployment (non-blocking mode or jailbreak shield off); high-privilege app permissions or delegated scopes held by agents; agents with Owner/Contributor/UAA; agent identities without sponsors; non-compliant Azure Policy states.
- **Fix:** each fixable finding opens Harness injection with a preset already applied (inject mandatory instructions, require approval, strict RAI, identity review) and the rationale pre-filled.
- **Bulk remediation (Admin):** one change-request bundle per affected agent, in one zip.
- **Content safety:** a policy × category matrix and deployment → policy mapping. **Content-filter activity:** filtered and jailbreak-detected requests per agent from trace data. **Content capture:** agents whose traces contain prompt/response content are flagged (data-protection finding). **Azure Policy:** compliance list. **Harness library:** a catalog of platform instructions and pre-vetted tools.

### 5.6 Agent builder
An eight-step wizard: Basics & ownership → Project & model → Instructions & harness → Tools → Knowledge → Identity & access → Guardrails → Observability & lifecycle → Review & export. Step badges show live schema validation. Drafts persist in browser storage.
- **Tools:** all Foundry built-ins (code interpreter, file search, Bing, AI Search, SharePoint, Fabric, browser automation), OpenAPI (operations, auth: MI/connection/anonymous), MCP (server URL, allowed tools), Azure Functions (queue bindings), client-executed **function** tools (JSON Schema parameters, strict mode), and connected agents (A2A).
- **Risk inference** per tool: OpenAPI non-GET → write, DELETE → privileged; MCP with an empty allowlist → privileged, write-verb tool names → write; browser automation → always privileged with approval "always". Users can raise a tier but not lower it.
- **Identity:** Agent ID, a dedicated UAMI, or the project MI; allowed flows (delegated/OBO/app); delegated scopes; app roles; Azure RBAC with justifications; access groups, client apps and exposure.
- **Guardrails:** RAI policy (four categories × enabled/blocking/threshold, jailbreak & indirect-attack shields, protected material), runtime limits, PII redaction in traces.

### 5.7 Harness injection
Pick a deployed agent. Its current state becomes `before`, and an editable copy becomes `after`. You can inject tools (from the catalog or custom), add or remove platform instructions, edit owner instructions (with a version-bump check), tighten guardrails, and change identity. A sticky bar shows the live change count and risk tier. **Review & export** produces the bundle.

### 5.8 Review bundle (Approver)
Drop a bundle zip. agentctl verifies the checksums, both schemas, `manifestSha256`/`baseManifestSha256`, recomputes risk and approvers from `base.yaml` → `agent.yaml` (a declared tier or minimum approver count lower than the recomputed one is a **fail**; proposals must list the owners), checks that the Foundry payload matches the manifest, and warns on missing mandatory injections or unattended write tools. The same code runs in the pipeline as the `agentctl-verify` CLI (§7.4).

## 6. Guardrailing model

### 6.1 Harness
*Harness* = platform-owned additions to an agent that its owners don't control:
- **Injected instructions:** fragments with `id`, `position` (prepend/append), `mandatory`, `reason`. They are composed around the owner's prompt with HTML-comment markers (`<!-- agentctl:harness id=… -->`). This lets agentctl round-trip them from the deployed prompt and detect removal.
- **Injected tools:** tools with an `injected: {by, reason, changeRequest}` stamp.
- **Mandatory baseline:** `platform.identity-disclosure`, `platform.prompt-injection-defense`. These are added to every new agent, and their removal is privileged.

### 6.2 Risk tiers and approvals

| Change | Tier |
|---|---|
| Add read tool; inject instruction; tighten guardrails; model/lifecycle/metadata edits | read |
| Add write tool **with** approval; edit owner instructions; enable content capture; exposure change; new delegated scopes; non-privileged RBAC | write |
| Write tool **without** approval; remove approval from a tool; browser automation; any app-only permission; enable app flow; privileged scopes (`*.ReadWrite.All`, `Directory.*`, `Mail.Send`…); Owner/Contributor/UAA; guardrail weakening; removing a mandatory injection | privileged |

Approver groups per tier come from config (`AGENTCTL_APPROVERS_*`; Terraform `approver_groups`); the agents-gitops repo's `platform/policy.json` must match. Privileged identity changes add identity admins; guardrail weakening adds platform-security. `minApprovers` is 2 for privileged changes. The score (0-100) adds weight for prod, data classification and broad exposure. It is used for triage only; the **tier** drives approvals.

## 7. Contracts

### 7.1 Agent manifest (`agentctl.lariat.dev/v1alpha1`, kind `Agent`)
JSON Schema 2020-12: `app/src/schema/agent.schema.json`. The top-level sections are `metadata` (name slug, owners, team, classification, environment) and `spec` with: `foundry`, `model`, `instructions`, `harness.injections[]`, `tools[]` (discriminated by `type`), `knowledge`, `identity`, `access`, `guardrails` (`raiPolicy`, `limits`, `piiRedactionInTraces`), `observability`, `lifecycle`.

Notable schema rules: privileged tools must have `requireApproval: always`; browser automation must be privileged; delegated scopes require the delegated or OBO flow; app roles require the app flow; RAI policy names may not start with `Microsoft.`.

### 7.2 Change request (kind `ChangeRequest`)
`app/src/schema/change-request.schema.json` contains: `target`, `changeType` (create/update), `proposal` (true when exported by a Requester), `rationale`, `changes[]` (op, path, summary, riskTier), `risk`, `approvals`, `baseManifestSha256`, `manifestSha256`.

### 7.3 Bundle layout
```
cr-YYYYMMDD-xxxxxx-<agent>/
  README.md                       human summary + suggested pipeline steps
  manifest/agent.yaml             desired state
  manifest/base.yaml              deployed state (updates only)
  change-request.yaml             risk, approvals, change list
  diff/agent.yaml.diff            unified diff
  instructions/system.md          owner instructions
  instructions/effective.md       exactly what will be deployed (harness composed)
  foundry/agent-definition.json   POST {project}/agents/{name}/versions?api-version=v1 body
                                  ({description, metadata, definition:{kind:"prompt", model, instructions, tools}}); ${…} placeholders
  terraform/main.tf               module "…" { source = <agent module> … } + pipeline variables
                                  (apply_agent_definition, placeholder_values); terraform-fmt clean
  approvals/CODEOWNERS            reviewer routing
  schema/*.schema.json            schemas used
  checksums.sha256                sha256 of every file
```

### 7.4 Pipeline (agents-gitops repo)
Bundles live in a separate repo, created from `templates/agents-gitops/` with `scripts/init-gitops-repo.sh`. Its README covers setup. One folder per agent: `agents/<name>/`.

**On a PR** (`agent-bundle` workflow; it runs from the base branch and reads the PR as data only):
1. **verify:** `tools/agentctl-verify.mjs` (built from `app/cli/agentctl-verify.ts`, pinned by sha256) runs every §5.8 check, with approver groups from `platform/policy.json`. It also enforces PR shape: no deleted agents, no mixing of agent bundles with platform files, and the folder name must equal `metadata.name`.
2. **drift:** with a read-only OIDC identity, the live agent's `agentctl.manifest_sha256` must equal `baseManifestSha256` (updates), or the agent must not exist (creates). Re-applying an already-live bundle passes.
3. **gate:** the recomputed approver groups are mapped to GitHub teams/users (`platform/approvers.json`), and each must have approved the **current head commit**. For updates, owners come from `base.yaml`, so a PR can't add an owner and self-approve. Proposals also need an owner. Unmapped names fail closed.

**On merge** (`deploy-agents`): re-verify, drift check, `terraform init/plan/apply` in the agent's `agents-<env>` GitHub environment (platform backend/providers, per-environment `placeholder_values`, `apply_agent_definition = true`), then confirm the live manifest hash.

Still manual: inlining OpenAPI specs referenced by URL (`apply-agent.sh` refuses them) and decommissioning agents.

## 8. Infrastructure (Terraform)

`infra/main.tf` + `terraform.tfvars.example` is a minimal root. `infra/modules/agentctl` is the reusable module to copy into your infra repo.

| Component | Default | Notes |
|---|---|---|
| Resource group | create | or `resource_group = { create = false, name = … }` |
| Log Analytics | create | or `existing_id` |
| Application Insights (workspace-based) | create | or `existing_id`; the agent tracing sink |
| Foundry account + project (+ deployments) | **existing** | `existing_account_ids`, or `create = true` for a sandbox (adds an App Insights connection to the project) |
| Entra app registration (SPA) + SP | always | 6 app roles, groups claim, redirect URIs (prod + localhost), required access for Graph/ARM/Log Analytics/Foundry, assignment required, optional admin consent |
| App role assignments | input | `app_role_assignments` (object ids per role) and/or `role_groups` (creates one group per role with members) |
| Data scopes | input | `access_scopes`: scope groups, Foundry User per project, Telemetry Reader custom role (App* tables), `AGENTCTL_ACCESS_SCOPES` |
| App Service plan B1 + Linux web app (Node 22) | on (`app_service.enabled`) | HTTPS only, FTPS off, TLS 1.2, health check, app settings = runtime config |
| Diagnostic settings | on | Foundry accounts + web app → workspace |
| Entra diagnostic setting | **off** | sign-in + Graph activity logs → workspace (needs P1/P2 + Security Admin; one per tenant) |
| Viewer RBAC | input | Reader (account or subscription), Log Analytics Reader, Foundry User (by role id) on the accounts; for unscoped admins and analysts |
| Storage account | **off** | optional bundle archive; key access disabled |
| Cloud, subscriptions, workspaces | `AzureCloud`, provider sub | `cloud`, `observed_subscription_ids` / `observe_all_subscriptions`, `additional_log_analytics_ids`; existing resources in any subscription |
| Private networking | **off** | `network`: VNet integration, private endpoints (web app, Foundry, AMPLS), private DNS (BYO or created), derived `AGENTCTL_PROXY_SERVICES` |

`infra/modules/foundry-agent` is called by every bundle. It creates the agent's identity (UAMI, or takes an Agent ID principal / project MI), its RBAC, the RAI policy, optionally attaches the policy to the deployment, and optionally applies the agent definition.

## 9. Other Azure services

**Required for full live functionality**
- **Entra ID P1/P2.** Exporting sign-in logs to Log Analytics requires it. Without it, the Identity → Usage view is empty; grants and RBAC still work.
- **Entra diagnostic setting.** Sign-in logs + `MicrosoftGraphActivityLogs` → the workspace. Toggle it in Terraform, or reuse your existing tenant export by pointing `log_analytics.existing_id` at that workspace (recommended if Sentinel already collects them).
- **Foundry tracing → App Insights.** Each Foundry project needs its App Insights connection, or the agent runtime must export OTel to App Insights.

**Not needed now**
- **Storage account.** Not needed while bundles are downloaded. It becomes useful for (a) a bundle archive, (b) a shared approval queue / audit trail if approvals move into agentctl, and (c) hand-off to the pipeline (e.g. a blob trigger). It is included as an opt-in (`bundle_storage.enabled`).

**Recommended next**
- **API Management (AI gateway)** in front of agents and tools: enforces `limits` (tokens/run, tool calls), approval for MCP/OpenAPI tools, and content safety at the edge. It is also a better telemetry source for tool calls.
- **Microsoft Defender for Cloud (AI threat protection):** jailbreak and data-leak alerts per deployment. It would add a Defender tab via `Microsoft.Security/alerts`.
- **Microsoft Purview DSPM for AI:** sensitive-data interactions with agents.
- **Azure Resource Graph:** faster discovery when moving to multi-subscription.
- **Key Vault:** only if the pipeline needs secrets (e.g. MCP connection headers). agentctl itself has no secrets.

## 10. Security considerations
- No client secret and no server-side token use. MSAL auth code + PKCE, with tokens in `sessionStorage`.
- `app_role_assignment_required = true`: only assigned users and groups can sign in.
- Proxy: host allowlist, header allowlist (Authorization, Content-Type, Accept, request-id), no cookies, no redirects followed.
- CSP without `unsafe-eval`, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy.
- KQL inputs are escaped; operation ids are validated against a strict pattern.
- Bundles are integrity-checked (sha256), and the change request is bound to the manifest hashes. Approvers and the pipeline re-derive risk instead of trusting declared values.
- Least privilege for data: scoped users get Foundry User on their projects only and a custom role limited to the App* telemetry tables, never the Entra sign-in or Graph activity tables.
- **Trace content:** Foundry server-side tracing records prompts and responses when content capture is on. Trace readers can see that content. agentctl flags it as a finding ([VALIDATION.md](VALIDATION.md) F1).

## 11. Assumptions and known gaps
- **Entra Agent ID** Graph endpoints and the `AgentIdentity.Read.All` scope are preview. agentctl degrades to tagged SPs, and Terraform skips unknown scopes (`graph_scopes_skipped` output).
- **Foundry APIs:** both the agents API (named, versioned agents) and the classic assistants API are read. Bundles target the agents API. Workflows and hosted agents aren't modelled yet.
- **RAI filter names** in `modules/foundry-agent` use the lowercase names returned by recent API versions (`hate`, `jailbreak`, `indirect_attack`, `protected_material_text`…). Verify them against your account's existing policies before the first apply.
- **OBO** classification is heuristic (§4.1).
- **Runtime limits** are recorded in metadata only. Enforcement needs APIM or the agent host.
- **Sovereign clouds:** endpoint profiles exist for US Gov and China, but only the public cloud has been validated end to end (ENVIRONMENTS.md §1).
- **Private networking** has been validated at plan level and for proxy routing; App Service could not be deployed in the reference tenant (quota).
- **Telemetry isolation** is per workspace, not per scope (see ACCESS.md §4).

## 12. Roadmap
1. ~~GitOps pipeline~~ (done: `templates/agents-gitops`). Next: open PRs from agentctl directly, and show live-vs-manifest drift in the UI.
2. Approval queue in agentctl, backed by the storage account (or Cosmos DB), with Entra-signed approvals.
3. APIM AI gateway integration: runtime enforcement of limits and tool approval; a gateway telemetry tab.
4. A Defender for AI alerts tab; Purview DSPM signals.
5. ~~Multi-subscription, private networking, cloud profiles~~ (done, ENVIRONMENTS.md). Next: Foundry workflows and hosted agents.
7. SSDLC: CI (typecheck/test/build, dependency audit, CodeQL, secret scanning, IaC scanning, SBOM), threat model, OIDC deploys.
6. Kill switch: a harness tool already exists in the catalog; add a platform-side pause list.
