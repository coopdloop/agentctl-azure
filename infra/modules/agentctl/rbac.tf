# Data access for live mode. agentctl uses the *signed-in user's* token for every Azure call,
# so access is governed by Azure RBAC on the underlying resources, not by the app.

locals {
  viewers = toset(var.viewer_principal_ids)

  reader_scopes = var.assign_subscription_reader ? { subscription = data.azurerm_subscription.current.id } : local.foundry_accounts_by_key

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
  for_each             = local.viewers
  scope                = local.law_id
  role_definition_name = "Log Analytics Reader"
  principal_id         = each.value
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
