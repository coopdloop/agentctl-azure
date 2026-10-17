resource "azurerm_log_analytics_workspace" "this" {
  count               = var.log_analytics.create ? 1 : 0
  name                = local.names.law
  location            = var.location
  resource_group_name = local.rg_name
  sku                 = var.log_analytics.sku
  retention_in_days   = var.log_analytics.retention_days
  tags                = local.tags
}

locals {
  law_existing = var.log_analytics.create ? null : provider::azurerm::parse_resource_id(var.log_analytics.existing_id)
}

data "azurerm_log_analytics_workspace" "existing" {
  count               = var.log_analytics.create ? 0 : 1
  name                = local.law_existing.resource_name
  resource_group_name = local.law_existing.resource_group_name
}

locals {
  law_id          = var.log_analytics.create ? azurerm_log_analytics_workspace.this[0].id : data.azurerm_log_analytics_workspace.existing[0].id
  law_customer_id = var.log_analytics.create ? azurerm_log_analytics_workspace.this[0].workspace_id : data.azurerm_log_analytics_workspace.existing[0].workspace_id
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

locals {
  appi_existing = var.app_insights.create ? null : provider::azurerm::parse_resource_id(var.app_insights.existing_id)
}

data "azurerm_application_insights" "existing" {
  count               = var.app_insights.create ? 0 : 1
  name                = local.appi_existing.resource_name
  resource_group_name = local.appi_existing.resource_group_name
}

locals {
  appi_id                = var.app_insights.create ? azurerm_application_insights.this[0].id : data.azurerm_application_insights.existing[0].id
  appi_connection_string = var.app_insights.create ? azurerm_application_insights.this[0].connection_string : data.azurerm_application_insights.existing[0].connection_string
}
