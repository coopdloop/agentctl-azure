# Deploying agentctl in any Azure environment

agentctl adapts to an environment through configuration only: one build and one Terraform module.
This page covers clouds, multiple subscriptions, multiple workspaces and private networking.

| Need | Terraform (module `agentctl`) | App setting |
|---|---|---|
| Sovereign cloud | `cloud` (+ root provider `environment`) | `AGENTCTL_CLOUD`, `AGENTCTL_ENDPOINT_*` |
| More subscriptions | `observed_subscription_ids` / `observe_all_subscriptions` | `AGENTCTL_SUBSCRIPTION_IDS` |
| Workspace in another subscription | `log_analytics = { create = false, existing_id = … }` | `AGENTCTL_LAW_WORKSPACE_ID` |
| More workspaces | `additional_log_analytics_ids` | `AGENTCTL_LAW_ADDITIONAL_WORKSPACE_IDS` |
| Existing Foundry in other subscriptions | `foundry.existing_account_ids` | discovered automatically |
| Private endpoints | `network` | `AGENTCTL_PROXY_SERVICES` |

## 1. Clouds

`cloud = "AzureCloud" | "AzureUSGovernment" | "AzureChinaCloud"` selects an endpoint profile (`app/server/clouds.mjs`). That profile drives:
- the MSAL authority;
- the ARM, Graph and Log Analytics base URLs and token scopes;
- the Foundry token audience and host suffixes;
- the proxy allowlist and the CSP `connect-src`.

The root `infra/main.tf` maps the same value to the azurerm, azuread and azapi provider environments.

Override single values when a profile doesn't match your cloud: `AGENTCTL_ENDPOINT_AUTHORITY`, `_ARM`, `_GRAPH`, `_LOG_ANALYTICS`, `_LOG_ANALYTICS_AUDIENCE`, `_FOUNDRY_AUDIENCE`, `_FOUNDRY_HOST_SUFFIXES`. Overrides must be `https`, and the app refuses to start otherwise.

**Verify before use.** The US Gov and China profiles use the published endpoints for ARM, Graph, Log Analytics and Cognitive Services. Foundry Agent Service availability, its token audience, and the Entra app ids in `entra.tf` (notably the Foundry resource app) may differ by cloud. Only the public cloud has been validated end to end.

## 2. Multiple subscriptions

Discovery uses **Azure Resource Graph**: one query returns Foundry accounts and projects across every observed subscription, including each project's endpoint and managed identity. Resource Graph filters results by the caller's RBAC, so a user with Foundry User on a single project still finds that project.

- `observed_subscription_ids`: extra subscriptions. The provider's subscription is always included.
- `observe_all_subscriptions = true`: leaves `AGENTCTL_SUBSCRIPTION_IDS` empty, so each user sees every subscription they can read.
- **Per-subscription calls** (Azure Policy states, role assignments) run in parallel. One failing subscription is logged and skipped.
- **If Resource Graph fails**, the app falls back to per-subscription ARM listing.
- **Access:** with `assign_subscription_reader = true`, viewers get Reader on every observed subscription. Otherwise, grant Reader per Foundry account through `foundry.existing_account_ids`, which can sit in any subscription.
- **Agent manifests** record the subscription of the project they came from, so bundles target the right subscription.

## 3. Multiple Log Analytics workspaces

The primary workspace (`log_analytics`) can be created or existing, in **any subscription** (it is looked up by resource id). `additional_log_analytics_ids` adds more workspaces: every query is sent with the Log Analytics `workspaces` parameter, so results are unioned. Use this for:
- per-region or per-subscription App Insights;
- **per-team workspaces**, the only way to get hard telemetry isolation between scopes (ACCESS.md §4).

Viewer roles and the scoped Telemetry Reader role are granted on every workspace.

## 4. Private networking

```
 browser ──HTTPS──► App Service  (public, or private inbound endpoint)
                       │  VNet integration, route-all
                       ├──► Foundry project      (private endpoint)  ← /proxy, always
                       ├──► Log Analytics query  (AMPLS endpoint)    ← /proxy when query access is private-only
                       └──► ARM / Graph          (optional /proxy)
 browser ───────────► Entra ID sign-in (always public)
```

agentctl is a browser app, so the **browser** must reach every API it calls. Private endpoints are reachable only from the VNet, so private services are reached through the app's same-origin **`/proxy`**:
- It forwards the user's own bearer token and holds no credentials.
- Only allowlisted hosts are proxied: Foundry suffixes always, plus the exact hosts of services listed in `AGENTCTL_PROXY_SERVICES`.
- Paging links (`nextLink`) are rewritten through the proxy automatically.
- The CSP drops proxied services from `connect-src`, so the browser can't bypass the proxy.

### Terraform

```hcl
network = {
  enabled                    = true
  app_subnet_id              = "/subscriptions/…/subnets/snet-agentctl-app"  # delegated to Microsoft.Web/serverFarms
  private_endpoint_subnet_id = "/subscriptions/…/subnets/snet-pe"
  app_private_endpoint       = true   # web app only via private endpoint (public access off)
  foundry_private_endpoint   = true   # for the Foundry account this module creates
  monitor_private_link       = { enabled = true, query_access_mode = "PrivateOnly", ingestion_access_mode = "PrivateOnly" }
  private_dns_zone_ids = {            # usually from the hub
    "privatelink.azurewebsites.net"         = "/subscriptions/…/privateDnsZones/privatelink.azurewebsites.net"
    "privatelink.cognitiveservices.azure.com" = "…"
    # …
  }
  # create_private_dns_zones = true, dns_vnet_id = "…"   # sandboxes without a hub
  # proxy_services = ["logAnalytics", "arm"]              # override the derived list
}
```

What it creates:

| Setting | Resources | Private DNS zones (public cloud) |
|---|---|---|
| `enabled` | Web app VNet integration, `vnet_route_all_enabled` | none |
| `app_private_endpoint` | Private endpoint (`sites`), public network access off | `privatelink.azurewebsites.net` |
| `foundry_private_endpoint` | Private endpoint (`account`) on the created Foundry account | `privatelink.cognitiveservices.azure.com`, `privatelink.openai.azure.com`, `privatelink.services.ai.azure.com` |
| `monitor_private_link` | AMPLS with App Insights + all workspaces, private endpoint (`azuremonitor`) | `privatelink.monitor.azure.com`, `privatelink.oms.opinsights.azure.com`, `privatelink.ods.opinsights.azure.com`, `privatelink.agentsvc.azure-automation.net`, `privatelink.blob.core.windows.net` |

`proxy_services` defaults to `["logAnalytics"]` when AMPLS query access is `PrivateOnly`, otherwise `[]`. A precondition fails the plan if a needed DNS zone is neither supplied nor created.

**Existing Foundry accounts** keep their own networking. Give them private endpoints in your landing zone; the proxy reaches them as long as the app's VNet resolves their private DNS.

### Requirements and caveats

- **Egress from the app subnet** (route-all sends everything through the VNet). The app needs the private endpoints, plus ARM and Graph only if they're in `proxy_services`. It never calls Entra ID itself; the browser signs in.
- **Sign-in stays public.** Browsers must reach `login.microsoftonline.com` (or the cloud's authority).
- **ARM Private Link** (Resource Management Private Link) and Graph are normally public. Proxy them only if your network blocks direct browser access to them.
- **Local development** against a private environment needs network line of sight (VPN or a dev box in the VNet). From a laptop without it, Foundry and private-only Log Analytics calls fail.
- **Agents and the seed script** must reach App Insights ingestion. With AMPLS `ingestion_access_mode = "PrivateOnly"`, they must run inside the network.
- **Entra diagnostic export** to the workspace isn't affected by AMPLS.

## 5. Validating a new environment

1. `terraform plan`: check discovery inputs, role assignments, and (with `network`) the private endpoints and DNS zones.
2. Apply, then `scripts/local-env-from-tf.sh` (or deploy the app).
3. Open **Data sources**: the health checks show the subscriptions found, Resource Graph and Foundry reachability, Log Analytics, and the routing (`via /proxy`) for each source. The runtime configuration panel shows the resolved cloud profile.
4. Sign in as a scoped user and confirm their project appears (Resource Graph) and telemetry loads.

What was validated in the reference tenant is recorded in [VALIDATION.md](VALIDATION.md).
