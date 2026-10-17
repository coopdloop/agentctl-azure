# Optional Foundry account + project (new Foundry resource model: AIServices account with
# allowProjectManagement and child projects). Uses azapi because azurerm lags these APIs.

locals {
  cs_api = "2025-06-01"
}

resource "azapi_resource" "foundry_account" {
  count     = var.foundry.create ? 1 : 0
  type      = "Microsoft.CognitiveServices/accounts@${local.cs_api}"
  name      = local.names.foundry
  parent_id = var.resource_group.create ? azurerm_resource_group.this[0].id : "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${local.rg_name}"
  location  = var.location
  tags      = local.tags

  identity {
    type = "SystemAssigned"
  }

  body = {
    kind = "AIServices"
    sku  = { name = "S0" }
    properties = {
      allowProjectManagement = true
      customSubDomainName    = local.names.foundry
      disableLocalAuth       = var.foundry.disable_local_auth
      publicNetworkAccess    = var.foundry.public_network ? "Enabled" : "Disabled"
    }
  }

  response_export_values = ["properties.endpoint", "properties.endpoints"]
}

resource "azapi_resource" "foundry_project" {
  count     = var.foundry.create ? 1 : 0
  type      = "Microsoft.CognitiveServices/accounts/projects@${local.cs_api}"
  name      = var.foundry.project_name
  parent_id = azapi_resource.foundry_account[0].id
  location  = var.location
  tags      = local.tags

  identity {
    type = "SystemAssigned"
  }

  body = {
    properties = {
      displayName = var.foundry.project_name
      description = "Agents observed and governed by agentctl"
    }
  }

  response_export_values = ["identity.principalId", "properties.endpoints"]
}

resource "azapi_resource" "model_deployment" {
  for_each  = var.foundry.create ? var.foundry.model_deployments : {}
  type      = "Microsoft.CognitiveServices/accounts/deployments@${local.cs_api}"
  name      = each.key
  parent_id = azapi_resource.foundry_account[0].id

  body = {
    sku = { name = each.value.sku_name, capacity = each.value.capacity }
    properties = {
      model         = { format = "OpenAI", name = each.value.model_name, version = each.value.model_version }
      raiPolicyName = each.value.rai_policy
    }
  }
}

# Sends agent traces (OpenTelemetry gen_ai spans) from the project to Application Insights.
resource "azapi_resource" "project_appinsights_connection" {
  count     = var.foundry.create && var.foundry.connect_app_insights ? 1 : 0
  type      = "Microsoft.CognitiveServices/accounts/projects/connections@${local.cs_api}"
  name      = "appinsights"
  parent_id = azapi_resource.foundry_project[0].id

  body = {
    properties = {
      category      = "AppInsights"
      target        = local.appi_id
      authType      = "ApiKey"
      isSharedToAll = true
      # connection_string is a sensitive value, so plans mask the whole body.
      credentials = { key = local.appi_connection_string }
      metadata    = { ApiType = "Azure", ResourceId = local.appi_id }
    }
  }
}

locals {
  foundry_account_ids = concat(
    var.foundry.create ? [azapi_resource.foundry_account[0].id] : [],
    var.foundry.existing_account_ids,
  )
  # Static keys so for_each works before the created account's id is known.
  foundry_accounts_by_key = merge(
    var.foundry.create ? { created = azapi_resource.foundry_account[0].id } : {},
    { for id in var.foundry.existing_account_ids : basename(id) => id },
  )
  foundry_project_endpoint = var.foundry.create ? "https://${local.names.foundry}.services.ai.azure.com/api/projects/${var.foundry.project_name}" : ""
}

resource "azurerm_monitor_diagnostic_setting" "foundry" {
  for_each                   = var.foundry.diagnostic_settings ? local.foundry_accounts_by_key : {}
  name                       = "agentctl-to-law"
  target_resource_id         = each.value
  log_analytics_workspace_id = local.law_id

  enabled_log {
    category_group = "allLogs"
  }
}
