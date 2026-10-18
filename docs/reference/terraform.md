# Terraform inputs

Inputs of the `agentctl` module (`infra/modules/agentctl`). Generated from `variables.tf` by `scripts/gen-terraform-docs.py`.

Object inputs accept partial values: omitted attributes take their defaults. See `infra/terraform.tfvars.example` for a commented example of every common input.

| Input | Type | Default | Description |
|---|---|---|---|
| `name_prefix` | string | `"agentctl"` | Short prefix used in every resource name (e.g. agentctl). |
| `environment` | string | `"dev"` | Environment short name (dev, test, prod). |
| `location` | string | `"eastus2"` | Azure region for created resources. |
| `location_short` | string | `"eus2"` | Short region code used in names. |
| `tags` | map | `{}` | Tags applied to every resource. |
| `resource_group` | object | `{}` | Create a resource group, or use an existing one by name. |
| `log_analytics` | object | `{}` | Log Analytics workspace that holds App Insights traces and Entra diagnostics. create = true creates one; otherwise set existing_id to an existing workspace resource id. |
| `app_insights` | object | `{}` | Workspace-based Application Insights used as the agent tracing sink (connect it to Foundry projects). |
| `foundry` | object | `{}` | Foundry (AIServices) account + project that agentctl observes. - create = true: creates an account and one project (handy for a demo/sandbox). - create = false: pass existing_account_ids (one or more); projects are discovered at runtime. connect_app_insights creates an AppInsights connection on the created project so agent traces land in the workspace. |
| `app_role_assignments` | map | `{}` | Existing Entra object ids (groups or users) to assign to each agentctl app role. Roles: reader, identity_reader, requester, builder, approver, admin. |
| `role_groups` | object | `{}` | Create one Entra security group per app role (e.g. agentctl-dev-builders) and assign it to the role. members maps role -> member object ids. Leave create = false to bring your own groups via app_role_assignments. |
| `cloud` | string | `"AzureCloud"` | Azure cloud: AzureCloud, AzureUSGovernment or AzureChinaCloud. Sets the app's endpoints (AGENTCTL_CLOUD); configure the providers' environment to match in the root. |
| `observed_subscription_ids` | list | `[]` | Subscriptions agentctl discovers Foundry in (via Azure Resource Graph), in addition to the provider's subscription. Empty list + observe_all_subscriptions = true: every subscription the signed-in user can read. |
| `observe_all_subscriptions` | bool | `false` | Discover across every subscription the user can read (AGENTCTL_SUBSCRIPTION_IDS left empty). |
| `additional_log_analytics_ids` | list | `[]` | Resource ids of more Log Analytics workspaces (any subscription) queried together with the primary one, e.g. per-team App Insights workspaces. |
| `network` | object | `{}` | Private networking (see docs/ENVIRONMENTS.md). Bring your own VNet, subnets and (usually) private DNS zones from the hub. app_subnet_id               App Service VNet integration subnet (delegated to Microsoft.Web/serverFarms) private_endpoint_subnet_id  subnet for private endpoints app_private_endpoint        inbound private endpoint for the web app; disables public access foundry_private_endpoint    private endpoint for the Foundry account created by this module monitor_private_link        AMPLS with the workspace(s) + App Insights and a private endpoint private_dns_zone_ids        zone name -> zone id (e.g. privatelink.azurewebsites.net) create_private_dns_zones    create missing zones in the resource group and link them to dns_vnet_id proxy_services              override which APIs the browser reaches through the app's proxy |
| `control_attestations` | map(object) | `{}` | Human sign-offs for AI risk controls (docs/CONTROLS.md), keyed by control id ("GV-05") or control@agent / control@account ("TL-04@crm-writer"). Reviewed in your infra repo like any change. Agent evidence (impact assessment, red team, ...) belongs in the agent manifest instead. |
| `approved_mcp_hosts` | list | `[]` | MCP server hosts agents may use (control TL-02), e.g. ["mcp.contoso.com"]. |
| `access_scopes` | map(object) | `{}` | Data scopes. Members of a scope's groups see only that scope's Foundry projects (and optionally agents matching name globs). Project access is *enforced* by granting the groups Foundry User on exactly those projects; agent globs refine the UI within a project. { hr = { group_ids = ["&lt;oid>"], projects = [{ account_id = "/subscriptions/.../accounts/aif-x", project = "agents" }], agents = ["hr-*"] } } Don't also put scoped users in viewer_principal_ids (that grants account-wide Foundry access). |
| `unscoped_default` | string | `"all"` | What users in no access_scopes group see: all (simple single-team setups) or none (strict). |
| `require_app_role_assignment` | bool | `true` | Only users/groups assigned an app role can sign in to agentctl. |
| `graph_delegated_scopes` | list | `["User.Read", "Application.Read.All",…` | Microsoft Graph delegated scopes requested by the SPA. Unknown scopes in the tenant are skipped. |
| `grant_admin_consent` | bool | `false` | Grant tenant-wide admin consent for the delegated scopes (requires a privileged Entra role for the deployer). |
| `local_dev_redirect_uris` | list | `["http://localhost:5173/"]` | Extra SPA redirect URIs for local testing. |
| `viewer_principal_ids` | list | `[]` | Entra object ids (typically the same groups as app roles) that need *data* access for live mode. agentctl calls Azure with the signed-in user's own token, so users need: Reader (discovery/policy), Log Analytics Reader (traces + sign-in logs) and Azure AI User (Foundry agents). |
| `assign_subscription_reader` | bool | `false` | Grant viewer_principal_ids Reader on the whole subscription (needed for discovery and Azure Policy states). If false, Reader is scoped to the Foundry account(s). |
| `entra_diagnostics` | object | `{}` | Tenant-level Entra diagnostic setting sending sign-in and Graph activity logs to the workspace. Requires Entra ID P1/P2 and Security Administrator (or higher) for the deployer. Only one of these is needed per tenant/workspace, so leave disabled if your tenant already exports them. |
| `app_service` | object | `{}` | App Service plan/app settings for the agentctl frontend. |
| `static_web_app` | object | `{}` | Host agentctl on Azure Static Web Apps instead of (or as well as) App Service. Free tier needs no App Service quota. |
| `gitops` | object | `{}` | Metadata written into generated bundles. |
| `approver_groups` | object | `{}` | Approver group names (or object ids) per risk tier, written into change requests. |
| `bundle_storage` | object | `{}` | Optional storage account for archiving bundles / a future approval queue. Not required today: bundles are downloaded in the browser. Key access is disabled; access is via Entra RBAC only. |

## Outputs

| Output | Description |
|---|---|
| `app_url` | agentctl URL (Static Web App if enabled, else App Service). |
| `static_web_app_name` |  |
| `web_app_name` |  |
| `resource_group_name` |  |
| `client_id` | Entra application (client) id of the SPA. |
| `tenant_id` |  |
| `log_analytics_workspace_id` | Workspace customer id (GUID) used by the query API. |
| `log_analytics_resource_id` |  |
| `app_insights_id` |  |
| `foundry_account_ids` |  |
| `foundry_project_endpoint` |  |
| `graph_scopes_skipped` | Requested Graph scopes that do not exist in this tenant (e.g. preview Agent ID scopes). |
| `app_settings` | Runtime settings served to the browser via /config.js (no secrets). |
| `local_env` | Contents for app/.env.local to run the SPA locally against this environment. |
| `role_group_ids` | Object ids of the per-role groups created by this module (role_groups.create). |
| `scope_group_ids` |  |
