# Add to existing Terraform

agentctl is a single Terraform module, `infra/modules/agentctl`. It has no provider blocks, no backend and no required inputs, so it drops into an infra repo you already have. Point it at the resource group, workspace, App Insights, Foundry accounts, groups, network and DNS you already manage, and it creates only what's missing.

!!! tip "When to use this page"
    - **New to agentctl, existing platform Terraform:** follow this page instead of the [Quickstart](quickstart.md).
    - **Already ran the Quickstart and want it in your infra repo:** see [Move an existing deployment](#move-an-existing-deployment).

## 1. Check compatibility

| Requirement | Module needs | Notes |
|---|---|---|
| Terraform | **≥ 1.8** | |
| `hashicorp/azurerm` | `~> 4.0` | the same provider instance your root already configures |
| `hashicorp/azuread` | `~> 3.0` | app registration, groups, consent |
| `Azure/azapi` | `~> 2.0` | Foundry and Static Web Apps settings |
| `hashicorp/random` | `~> 3.6` | name suffix |
| Deploying identity | Owner (or Contributor + RBAC Administrator) on the target subscription, plus on any subscription whose Foundry accounts or workspace you pass in | see [Permissions](../getting-started/permissions.md) |

If your repo pins `azurerm` 3.x, upgrade first, or put agentctl in its own root (option B below).

## 2. Choose where it lives

=== "A. A module call in your existing root"

    Simplest: agentctl shares your root's providers and state, and references your resources directly.

    - **Good for:** platform roots that already own the workspace, Foundry and network.
    - **Watch:** a bigger plan, and the blast radius is shared with everything in that root.

=== "B. Its own root, reading your platform"

    agentctl gets a small root and state of its own (e.g. `platform/agentctl/<env>`). It reads IDs from your platform state with `terraform_remote_state` (or data sources).

    - **Good for:** large estates, separate change cadence, separate approvers.
    - **Watch:** the platform root must expose the IDs as outputs.

Both use the same module block; only where the IDs come from differs.

## 3. Get the module

=== "Git reference (recommended)"

    ```hcl
    source = "git::https://github.com/{{ repo }}.git//infra/modules/agentctl?ref={{ version }}"
    ```
    Pin to a release tag. Upgrading is a one-line ref change ([Upgrade](upgrade.md)).

=== "Vendored copy"

    ```bash
    git clone --depth 1 --branch {{ version }} https://github.com/{{ repo }}.git /tmp/agentctl
    cp -R /tmp/agentctl/infra/modules/agentctl  ./modules/agentctl
    ```
    ```hcl
    source = "./modules/agentctl"
    ```
    Use this when your CI can't reach GitHub, or when you mirror modules into a private registry.

## 4. Add the module block

The example assumes a typical landing zone that your Terraform already manages:
- a monitoring workspace and App Insights;
- a Foundry (AI Services) account;
- an "AI platform admins" Entra group;
- a spoke VNet with subnets, and private DNS zones from the hub.

Each `# ←` comment marks a reference to something you already have.

```hcl
# ── Already in your repo (abbreviated) ─────────────────────────────────────────
# resource "azurerm_resource_group"            "ai"        { ... }
# resource "azurerm_log_analytics_workspace"   "central"   { ... }
# resource "azurerm_application_insights"      "agents"    { ... }
# resource "azurerm_cognitive_account"         "foundry"   { kind = "AIServices" ... }
# resource "azuread_group"                     "ai_admins" { ... }
# module   "spoke"                                         { ... }   # outputs subnet ids
# module   "hub_dns"                                       { ... }   # outputs private DNS zone ids

module "agentctl" {
  source = "git::https://github.com/{{ repo }}.git//infra/modules/agentctl?ref={{ version }}"

  name_prefix    = "agentctl"
  environment    = "prod"
  location       = azurerm_resource_group.ai.location
  location_short = "eus2"
  tags           = local.tags # ← your standard tags

  # Use what exists; create nothing new for these.
  resource_group = { create = false, name = azurerm_resource_group.ai.name }                    # ←
  log_analytics  = { create = false, existing_id = azurerm_log_analytics_workspace.central.id } # ←
  app_insights   = { create = false, existing_id = azurerm_application_insights.agents.id }     # ←
  foundry = {
    create               = false
    existing_account_ids = [azurerm_cognitive_account.foundry.id] # ← any subscription
    diagnostic_settings  = false                                  # set true only if your platform doesn't already send Foundry logs
  }

  # Access: your existing groups get the app roles (no new groups).
  role_groups = { create = false }
  app_role_assignments = {
    admin  = [azuread_group.ai_admins.object_id]    # ←
    reader = [azuread_group.ai_engineers.object_id] # ←
  }
  viewer_principal_ids = [azuread_group.ai_admins.object_id] # ←
  grant_admin_consent  = false                               # true only if the pipeline identity is a Cloud Application Administrator

  # Hosting: App Service for private networking (Static Web Apps can't join a VNet).
  app_service    = { enabled = true, sku_name = "P0v3" }
  static_web_app = { enabled = false }
  network = {
    enabled                    = true
    app_subnet_id              = module.spoke.subnet_ids["snet-agentctl-app"]      # ←
    private_endpoint_subnet_id = module.spoke.subnet_ids["snet-private-endpoints"] # ←
    app_private_endpoint       = true
    private_dns_zone_ids = {
      "privatelink.azurewebsites.net" = module.hub_dns.zone_ids["privatelink.azurewebsites.net"] # ←
    }
  }

  # The tenant's sign-in log export usually already exists (one per tenant per destination).
  entra_diagnostics = { enabled = false }

  gitops = {
    repo                = "contoso/agents-gitops"
    base_path           = "agents"
    agent_module_source = "../../../modules/foundry-agent"
  }
}

output "agentctl_url" { value = module.agentctl.app_url }
output "agentctl_web_app_name" { value = module.agentctl.web_app_name }
output "agentctl_client_id" { value = module.agentctl.client_id }
output "agentctl_resource_group_name" { value = module.agentctl.resource_group_name }
```

For option B, swap each `# ←` reference for a remote-state output:

```hcl
data "terraform_remote_state" "platform" {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "sttfstateplatform"
    container_name       = "tfstate"
    key                  = "platform/prod.tfstate"
    use_azuread_auth     = true
  }
}

locals { p = data.terraform_remote_state.platform.outputs }

module "agentctl" {
  # ...
  log_analytics = { create = false, existing_id = local.p.log_analytics_workspace_id }
  foundry       = { create = false, existing_account_ids = local.p.foundry_account_ids }
  # ...
}
```

## 5. Providers

The module uses the default (unaliased) `azurerm`, `azuread`, `azapi` and `random` providers of the calling root. Their subscription is where agentctl's own resources go (hosting, app settings, custom role). Foundry accounts and workspaces in **other subscriptions** are referenced by ID and work as long as the deploying identity has rights there.

If your root uses **aliased providers**, for example a platform subscription, pass them explicitly:

```hcl
module "agentctl" {
  source = "..."
  providers = {
    azurerm = azurerm.platform
    azapi   = azapi.platform
    azuread = azuread
    random  = random
  }
  # ...
}
```

Sovereign clouds: configure the providers' `environment` as you already do, and set `cloud = "AzureUSGovernment"` (or `"AzureChinaCloud"`) on the module ([other clouds](../ENVIRONMENTS.md#1-clouds)).

## 6. What it adds to your plan

With every dependency reused, the plan contains only agentctl's own pieces:

| Always | Depending on inputs |
|---|---|
| App registration + service principal, 6 app roles, delegated permissions | admin consent grant (`grant_admin_consent`) |
| App role assignments to your groups | role / scope groups (`role_groups.create`, `access_scopes.*.create_group`) |
| `random_string` name suffix | Static Web App or App Service plan + web app |
| | viewer and scope role assignments; custom Telemetry Reader role |
| | Foundry diagnostic settings; private endpoints; AMPLS; DNS zones (only if `create_private_dns_zones`) |

**It never modifies your existing resources' configuration.** The only things it adds *to* them are role assignments, diagnostic settings (opt-in, as above) and private endpoints you asked for.

## 7. Pitfalls in existing estates

| Situation | What happens | What to do |
|---|---|---|
| Your platform already sends Foundry logs to a workspace | a second diagnostic setting (allowed, but double ingestion) | `foundry.diagnostic_settings = false` |
| A viewer already holds Reader / Log Analytics Reader at that scope (e.g. assigned in the portal) | `RoleAssignmentExists` (409) on apply | drop them from `viewer_principal_ids`, or `import` the existing assignment |
| The tenant already has an Entra diagnostic setting to your SIEM workspace | creating another fails or duplicates | keep `entra_diagnostics.enabled = false`; point `log_analytics.existing_id` at that workspace |
| Azure Policy denies public network access / requires tags | apply denied | set `network` / `tags` to match; Static Web Apps Free can't be private, so use App Service |
| Your CI identity can't register apps | `Insufficient privileges` on `azuread_application` | have an Entra admin run the first apply, or grant Application Developer to the pipeline identity |
| Several environments in one root | name collisions | one module block per environment with a different `environment`, or one root/state per environment |
| `azurerm` provider `features` blocks with `prevent_deletion_if_contains_resources` | `destroy` of a shared resource group is refused | expected; agentctl never creates the resource group when `create = false` |

## 8. Deploy the app

Terraform creates the hosting; the app package is deployed separately, from your pipeline or a terminal:

```bash
curl -fsSLO https://raw.githubusercontent.com/{{ repo }}/{{ version }}/scripts/deploy.sh
bash deploy.sh --target appservice --version {{ version }} \
  --resource-group "$(terraform output -raw agentctl_resource_group_name)" \
  --name "$(terraform output -raw agentctl_web_app_name)"
```

In GitHub Actions, use the [deploy workflow](app-service.md) pattern:
- OIDC `azure/login`;
- then `deploy.sh --version <tag>`, which verifies the checksum and provenance first.

## Move an existing deployment

If you ran the Quickstart (or this repo's `infra/`) and now want agentctl managed in your infra repo, without recreating the app registration and losing its client ID:

1. **Add the same module block** to the target root. Keep the address `module.agentctl` if you can, and keep the inputs identical (`name_prefix`, `environment`, `location_short`); names derive from them.
2. **Move the state entries** of `module.agentctl` from the old state into the target state:
   ```bash
   # in the old root
   terraform state pull > /tmp/agentctl-old.tfstate
   # in the target root
   terraform state pull > /tmp/target.tfstate
   terraform state mv -state=/tmp/agentctl-old.tfstate -state-out=/tmp/target.tfstate \
     module.agentctl module.agentctl          # or: module.agentctl module.agentctl_prod
   terraform state push /tmp/target.tfstate
   ```
   If the target address differs, also add a `moved` block, so the history is documented in code:
   ```hcl
   moved {
     from = module.agentctl
     to   = module.agentctl_prod
   }
   ```
3. **Run `terraform plan` in the target root.** It should show **no changes**, or only input differences you intend. If it wants to *replace* `azuread_application.this`, stop: the inputs differ, and replacing it would change the client ID.
4. **Remove agentctl from the old root's state** (`terraform state rm module.agentctl`) and delete the old root.
5. **Delete the local state files** in `/tmp`; they contain secrets.

!!! danger "State contains secrets"
    State holds the App Insights connection string and other sensitive values. Keep it in a remote backend with Entra auth (`use_azuread_auth = true`, no shared keys), and never commit it.

## Checklist

- [ ] Provider versions compatible (or a separate root)
- [ ] Module pinned to a release tag
- [ ] Every dependency reused (`create = false` / `existing_*`), and nothing duplicated
- [ ] `foundry.diagnostic_settings` and `entra_diagnostics` match what your platform already does
- [ ] Viewers / scope groups don't already hold the same role assignments
- [ ] Plan reviewed: only agentctl's own resources are created
- [ ] App deployed with `deploy.sh`, and the admin consent link sent if `grant_admin_consent = false`
