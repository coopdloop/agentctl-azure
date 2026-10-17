# Data access for live mode. agentctl uses the *signed-in user's* token for every Azure call,
# so access is governed by Azure RBAC on the underlying resources, not by the app.

locals {
  viewers = toset(var.viewer_principal_ids)

  reader_scopes = var.assign_subscription_reader ? merge(
    { subscription = data.azurerm_subscription.current.id },
    { for id in var.observed_subscription_ids : "sub-${id}" => "/subscriptions/${id}" if id != data.azurerm_subscription.current.subscription_id },
  ) : local.foundry_accounts_by_key

  viewer_reader = merge([
    for p in local.viewers : { for k, scope in local.reader_scopes : "${p}-${k}" => { principal = p, scope = scope } }
  ]...)

  viewer_ai_user = merge([
    for p in local.viewers : { for k, scope in local.foundry_accounts_by_key : "${p}-${k}" => { principal = p, scope = scope } }
  ]...)
}

resource "azurerm_role_assignment" "viewer_reader" {
  for_each             = local.viewer_reader
  scope                = each.value.scope
  role_definition_name = "Reader"
  principal_id         = each.value.principal
}

resource "azurerm_role_assignment" "viewer_law" {
  # The primary workspace keeps the original key (principal id) so existing assignments aren't recreated.
  for_each = merge([
    for p in local.viewers : { for i, law in local.law_all_ids : (i == 0 ? p : "${p}|${law}") => { principal = p, scope = law } }
  ]...)
  scope                = each.value.scope
  role_definition_name = "Log Analytics Reader"
  principal_id         = each.value.principal
}

# Read agent definitions on the Foundry data plane. "Azure AI User" was renamed "Foundry User";
# reference the built-in role by its immutable id so renames don't break the module.
resource "azurerm_role_assignment" "viewer_ai_user" {
  for_each           = local.viewer_ai_user
  scope              = each.value.scope
  role_definition_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/53ca6127-db72-4b80-b1b0-d745d6d5456d"
  principal_id       = each.value.principal
}

# Data scopes: Foundry User on exactly the scoped projects (Azure-enforced project isolation).
resource "azuread_group" "scope" {
  for_each         = { for k, v in var.access_scopes : k => v if v.create_group }
  display_name     = "${var.role_groups.name_prefix}-${var.environment}-scope-${each.key}"
  description      = "agentctl data scope '${each.key}': ${join(", ", [for p in each.value.projects : "${basename(p.account_id)}/${p.project}"])}"
  security_enabled = true
  owners           = [data.azurerm_client_config.current.object_id]
  members          = each.value.members

  lifecycle {
    ignore_changes = [owners]
  }
}

locals {
  scope_groups = {
    for k, v in var.access_scopes : k => concat(v.group_ids, v.create_group ? [azuread_group.scope[k].object_id] : [])
  }

  scope_project_grants = merge([
    for sname, sc in var.access_scopes : merge([
      for gi, g in local.scope_groups[sname] : {
        for p in sc.projects : "${sname}|${gi}|${basename(p.account_id)}/${p.project}" => {
          principal = g
          scope     = "${p.account_id}/projects/${p.project}"
        }
      }
    ]...)
  ]...)

  access_config = jsonencode({
    unscopedDefault = var.unscoped_default
    scopes = [
      for sname, sc in var.access_scopes : merge(
        { name = sname, groups = local.scope_groups[sname], projects = [for p in sc.projects : "${basename(p.account_id)}/${p.project}"] },
        sc.agents == null ? {} : { agents = sc.agents },
      )
    ]
  })
}

resource "azurerm_role_assignment" "scope_project" {
  for_each           = local.scope_project_grants
  scope              = each.value.scope
  role_definition_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.Authorization/roleDefinitions/53ca6127-db72-4b80-b1b0-d745d6d5456d"
  principal_id       = each.value.principal
}

# Telemetry for scoped users: a custom role that can query only the App Insights trace tables in
# the workspace (table-level RBAC). Entra sign-in and Graph activity logs stay with Identity
# readers / admins. Traces in a shared workspace are not split per scope; the UI filters them.
locals {
  telemetry_tables = ["AppDependencies", "AppRequests", "AppTraces", "AppExceptions"]
  scope_telemetry_principals = merge([
    for sname, sc in var.access_scopes : {
      for gi, g in local.scope_groups[sname] : "${sname}|${gi}" => g
    } if sc.telemetry
  ]...)
  # The primary workspace keeps its original key so existing assignments aren't recreated.
  scope_telemetry_grants = merge([
    for k, g in local.scope_telemetry_principals : {
      for i, law in local.law_all_ids : (i == 0 ? k : "${k}|${law}") => { principal = g, scope = law }
    }
  ]...)
}

resource "azurerm_role_definition" "telemetry_reader" {
  count             = length(local.scope_telemetry_grants) > 0 ? 1 : 0
  name              = "${var.role_groups.name_prefix} Telemetry Reader (${var.environment})"
  scope             = local.law_id
  description       = "Query agent traces (App Insights App* tables) in the agentctl workspace; no access to other tables."
  assignable_scopes = local.law_all_ids

  permissions {
    actions = concat(
      ["Microsoft.OperationalInsights/workspaces/read", "Microsoft.OperationalInsights/workspaces/query/read"],
      [for t in local.telemetry_tables : "Microsoft.OperationalInsights/workspaces/query/${t}/read"],
    )
  }
}

resource "azurerm_role_assignment" "scope_telemetry" {
  for_each           = local.scope_telemetry_grants
  scope              = each.value.scope
  role_definition_id = azurerm_role_definition.telemetry_reader[0].role_definition_resource_id
  principal_id       = each.value.principal
}
