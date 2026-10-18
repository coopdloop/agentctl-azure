# Azure components

Everything agentctl **creates**, **reads**, or **touches**. Defaults in bold; every create can be switched to an existing resource.

## Created by Terraform

| Component | Resource type | Default | Purpose | Notes / cost |
|---|---|---|---|---|
| Resource group | `Microsoft.Resources/resourceGroups` | **create** `rg-agentctl-<env>-<region>` | holds everything below | `resource_group = { create = false, name = … }` |
| Log Analytics workspace | `Microsoft.OperationalInsights/workspaces` | **create** (30–90 day retention) | traces, sign-in logs, diagnostics | pay per GB ingested; or `existing_id` (any subscription) |
| Application Insights | `Microsoft.Insights/components` | **create**, workspace-based | agent tracing sink (OpenTelemetry GenAI spans) | or `existing_id` |
| Entra app registration + service principal | `microsoft.graph/applications` | **always** | SPA sign-in, app roles | free |
| Security groups | `microsoft.graph/groups` | optional (`role_groups`, `access_scopes`) | role and data-scope membership | free |
| Static Web App | `Microsoft.Web/staticSites` | optional (`static_web_app.enabled`) | hosts the SPA + 2 managed functions | **Free** tier: $0; Standard ~$9/month |
| App Service plan + Linux web app | `Microsoft.Web/serverfarms`, `sites` | optional (`app_service.enabled`) | hosts the SPA + Node server | B1 ~$13/month; needs App Service VM quota |
| Foundry account + project + model deployment | `Microsoft.CognitiveServices/accounts` (kind `AIServices`), `…/projects`, `…/deployments` | **existing** by default; `foundry.create = true` for a sandbox | the agents | model usage is pay-as-you-go |
| Role assignments | `Microsoft.Authorization/roleAssignments` | per inputs | viewer and scope access | free |
| Custom role "agentctl Telemetry Reader" | `Microsoft.Authorization/roleDefinitions` | when any scope has `telemetry = true` | App* tables only | free |
| Diagnostic settings | `Microsoft.Insights/diagnosticSettings` | **on** for Foundry accounts and the web app | platform logs → workspace | ingestion cost |
| Entra diagnostic setting | `microsoft.aadiam/diagnosticSettings` | **off** | sign-in + Graph activity logs → workspace | P1/P2 + Security Administrator |
| Storage account (bundle archive) | `Microsoft.Storage/storageAccounts` | **off** | future approval queue | Entra-only access, no shared keys |
| Private networking | private endpoints, DNS zones, AMPLS | **off** (`network`) | private Foundry / Log Analytics / web app | see [Private networking](../ENVIRONMENTS.md) |

## Read at runtime (with the user's token)

| Service | API | What agentctl reads |
|---|---|---|
| Azure Resource Graph | `Microsoft.ResourceGraph/resources` | Foundry accounts and projects across subscriptions; Defender alerts and assessments |
| Azure Resource Manager | `management.azure.com` | deployments, RAI policies (guardrails), diagnostic settings, role assignments, policy states, Defender pricing |
| Foundry Agent Service | `<account>.services.ai.azure.com/api/projects/<project>` (via the host's proxy) | agents, versions, tools, instructions, metadata |
| Log Analytics | `api.loganalytics.azure.com` | App Insights traces; Entra sign-in and Graph activity logs |
| Microsoft Graph | `graph.microsoft.com` | app registrations, grants, app role assignments, Entra Agent ID (beta), group membership |

## Created by the agents-gitops pipeline (per agent)

| Component | Purpose |
|---|---|
| User-assigned managed identity (optional per manifest) | agent identity when not using Entra Agent ID |
| Role assignments for the agent identity | from the manifest's `identity.azureRoleAssignments` |
| RAI policy (guardrail) on the Foundry account | from the manifest's guardrails |
| Agent version (Foundry data plane) | `POST /agents/<name>/versions` |
| Terraform state blob | one state file per agent in your state storage account |

## Not used

agentctl has **no database, no Key Vault and no server-side identity** (the App Service has a managed identity, but nothing uses it). It holds no secrets. The GitOps template needs a storage account for Terraform state and a GitHub App private key in a GitHub secret; both live outside agentctl.
