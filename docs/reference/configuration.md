# Configuration

One build serves every environment. The SPA reads its runtime configuration from `/config.js`, which the host renders from `AGENTCTL_*` settings:
- **Static Web Apps:** application settings;
- **App Service:** app settings;
- **local:** `app/.env.local`.

Terraform sets all of them; this page is for reference and manual setups. **None of them is a secret.**

## Identity and cloud

| Setting | Example | Meaning |
|---|---|---|
| `AGENTCTL_MODE` | `live` | `live` or `mock` (seeded demo data) |
| `AGENTCTL_ENVIRONMENT` | `prod` | label shown in the UI |
| `AGENTCTL_TENANT_ID` | GUID | Entra tenant |
| `AGENTCTL_CLIENT_ID` | GUID | app registration (SPA) client id |
| `AGENTCTL_REDIRECT_URI` | `https://<host>/` | SPA redirect URI (defaults to the page origin) |
| `AGENTCTL_CLOUD` | `AzureCloud` | `AzureCloud`, `AzureUSGovernment` or `AzureChinaCloud` |
| `AGENTCTL_ENDPOINT_*` | `https://…` | override single endpoints: `AUTHORITY`, `ARM`, `GRAPH`, `LOG_ANALYTICS`, `LOG_ANALYTICS_AUDIENCE`, `FOUNDRY_AUDIENCE`, `FOUNDRY_HOST_SUFFIXES` (https only) |

## Discovery and data

| Setting | Example | Meaning |
|---|---|---|
| `AGENTCTL_SUBSCRIPTION_ID` | GUID | primary subscription (defaults for new agents) |
| `AGENTCTL_SUBSCRIPTION_IDS` | `sub1,sub2` | subscriptions to observe; empty = every subscription the user can read |
| `AGENTCTL_RESOURCE_GROUPS` | `rg-ai-prod` | limit discovery to resource groups |
| `AGENTCTL_FOUNDRY_PROJECT_ENDPOINTS` | `https://<acct>.services.ai.azure.com/api/projects/<p>` | fixed project list / fallback for project-scoped users |
| `AGENTCTL_FOUNDRY_API_VERSION` | `v1` | Foundry data-plane API version |
| `AGENTCTL_FOUNDRY_SCOPE` | `https://ai.azure.com/.default` | Foundry token scope (derived from the cloud) |
| `AGENTCTL_LAW_WORKSPACE_ID` | GUID | primary Log Analytics workspace (customer id) |
| `AGENTCTL_LAW_RESOURCE_ID` | resource id | workspace resource id (diagnostics check) |
| `AGENTCTL_LAW_ADDITIONAL_WORKSPACE_IDS` | `guid,guid` | more workspaces queried together |
| `AGENTCTL_APPINSIGHTS_RESOURCE_ID` | resource id | App Insights resource |

## Networking

| Setting | Example | Meaning |
|---|---|---|
| `AGENTCTL_PROXY_SERVICES` | `logAnalytics` | APIs the browser reaches through the host's proxy (`arm`, `graph`, `logAnalytics`); Foundry always uses it |
| `AGENTCTL_PROXY_BASE` | `/api/proxy` | proxy path (`/proxy` on App Service and locally, `/api/proxy` on Static Web Apps) |

## Access, controls and GitOps

| Setting | Example | Meaning |
|---|---|---|
| `AGENTCTL_ACCESS_SCOPES` | JSON | data scopes ([Access model](../ACCESS.md)) |
| `AGENTCTL_ATTESTATIONS` | JSON | control sign-offs ([AI risk controls](../CONTROLS.md#sign-offs-attestations)) |
| `AGENTCTL_APPROVED_MCP_HOSTS` | `mcp.contoso.com` | MCP server registry (TL-02) |
| `AGENTCTL_GITOPS_REPO` | URL | written into bundles |
| `AGENTCTL_GITOPS_BASE_PATH` | `agents` | bundle folder in the agents repo |
| `AGENTCTL_AGENT_MODULE_SOURCE` | `../../../modules/foundry-agent` | module source in generated Terraform |
| `AGENTCTL_APPROVERS_READ` / `_WRITE` / `_PRIVILEGED` | `agent-owners,platform-security` | approver groups per risk tier (must match the agents repo's `platform/policy.json`) |
