resource "azurerm_log_analytics_workspace" "this" {
  count               = var.log_analytics.create ? 1 : 0
  name                = local.names.law
  location            = var.location
  resource_group_name = local.rg_name
  sku                 = var.log_analytics.sku
  retention_in_days   = var.log_analytics.retention_days
  tags                = local.tags
}

# Existing workspace / App Insights are read by resource id with azapi, so they can live in any
# subscription (azurerm data sources only search the provider's subscription).
data "azapi_resource" "law_existing" {
  count                  = var.log_analytics.create ? 0 : 1
  type                   = "Microsoft.OperationalInsights/workspaces@2023-09-01"
  resource_id            = var.log_analytics.existing_id
  response_export_values = ["properties.customerId"]
}

locals {
  law_id          = var.log_analytics.create ? azurerm_log_analytics_workspace.this[0].id : data.azapi_resource.law_existing[0].id
  law_customer_id = var.log_analytics.create ? azurerm_log_analytics_workspace.this[0].workspace_id : data.azapi_resource.law_existing[0].output.properties.customerId
}

# More workspaces queried together with the primary one (other subscriptions, regions, teams).
data "azapi_resource" "law_additional" {
  for_each               = toset(var.additional_log_analytics_ids)
  type                   = "Microsoft.OperationalInsights/workspaces@2023-09-01"
  resource_id            = each.value
  response_export_values = ["properties.customerId"]
}

locals {
  law_additional_customer_ids = [for id in var.additional_log_analytics_ids : data.azapi_resource.law_additional[id].output.properties.customerId]
  # Every workspace agentctl queries; viewer and scope telemetry roles are granted on all of them.
  law_all_ids = concat([local.law_id], var.additional_log_analytics_ids)
}

resource "azurerm_application_insights" "this" {
  count               = var.app_insights.create ? 1 : 0
  name                = local.names.appi
  location            = var.location
  resource_group_name = local.rg_name
  workspace_id        = local.law_id
  application_type    = "web"
  tags                = local.tags
}

data "azapi_resource" "appi_existing" {
  count                  = var.app_insights.create ? 0 : 1
  type                   = "Microsoft.Insights/components@2020-02-02"
  resource_id            = var.app_insights.existing_id
  response_export_values = ["properties.ConnectionString"]
}

locals {
  appi_id                = var.app_insights.create ? azurerm_application_insights.this[0].id : data.azapi_resource.appi_existing[0].id
  appi_connection_string = var.app_insights.create ? azurerm_application_insights.this[0].connection_string : data.azapi_resource.appi_existing[0].output.properties.ConnectionString
}
