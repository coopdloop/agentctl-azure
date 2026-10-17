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

# Read agent definitions on the Foundry data plane.
resource "azurerm_role_assignment" "viewer_ai_user" {
  for_each             = local.viewer_ai_user
  scope                = each.value.scope
  role_definition_name = "Azure AI User"
  principal_id         = each.value.principal
}
