# Linux App Service hosting the built SPA + the dependency-free Node server (server/server.mjs),
# which serves /config.js from these app settings and the allowlisted /proxy route.

resource "azurerm_service_plan" "this" {
  count               = var.app_service.enabled ? 1 : 0
  name                = local.names.plan
  location            = var.location
  resource_group_name = local.rg_name
  os_type             = "Linux"
  sku_name            = var.app_service.sku_name
  tags                = local.tags
}

locals {
  app_settings = {
    AGENTCTL_MODE                      = var.app_service.mode
    AGENTCTL_ENVIRONMENT               = var.environment
    AGENTCTL_TENANT_ID                 = data.azurerm_client_config.current.tenant_id
    AGENTCTL_CLIENT_ID                 = azuread_application.this.client_id
    AGENTCTL_REDIRECT_URI              = "https://${local.names.app}.azurewebsites.net/"
    AGENTCTL_SUBSCRIPTION_ID           = data.azurerm_client_config.current.subscription_id
    AGENTCTL_RESOURCE_GROUPS           = ""
    AGENTCTL_LAW_WORKSPACE_ID          = local.law_customer_id
    AGENTCTL_LAW_RESOURCE_ID           = local.law_id
    AGENTCTL_APPINSIGHTS_RESOURCE_ID   = local.appi_id
    AGENTCTL_FOUNDRY_PROJECT_ENDPOINTS = local.foundry_project_endpoint
    AGENTCTL_FOUNDRY_API_VERSION       = "v1"
    AGENTCTL_GITOPS_REPO               = var.gitops.repo
    AGENTCTL_GITOPS_BASE_PATH          = var.gitops.base_path
    AGENTCTL_AGENT_MODULE_SOURCE       = var.gitops.agent_module_source
    AGENTCTL_APPROVERS_READ            = join(",", var.approver_groups.read)
    AGENTCTL_APPROVERS_WRITE           = join(",", var.approver_groups.write)
    AGENTCTL_APPROVERS_PRIVILEGED      = join(",", var.approver_groups.privileged)
    AGENTCTL_ACCESS_SCOPES             = local.access_config
  }
}

resource "azurerm_linux_web_app" "this" {
  count               = var.app_service.enabled ? 1 : 0
  name                = local.names.app
  location            = var.location
  resource_group_name = local.rg_name
  service_plan_id     = azurerm_service_plan.this[0].id
  https_only          = true
  tags                = local.tags

  # Not used by the app today; ready for future server-side calls with managed identity.
  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on                         = var.app_service.always_on && !contains(["F1", "FREE", "D1"], upper(var.app_service.sku_name))
    ftps_state                        = "Disabled"
    minimum_tls_version               = "1.2"
    http2_enabled                     = true
    health_check_path                 = "/healthz"
    health_check_eviction_time_in_min = 5
    app_command_line                  = "node server/server.mjs"

    application_stack {
      node_version = var.app_service.node_version
    }
  }

  app_settings = merge(local.app_settings, {
    SCM_DO_BUILD_DURING_DEPLOYMENT        = "false" # the package ships prebuilt; the server has no npm deps
    APPLICATIONINSIGHTS_CONNECTION_STRING = local.appi_connection_string
  })

  logs {
    http_logs {
      file_system {
        retention_in_days = 3
        retention_in_mb   = 35
      }
    }
  }
}

resource "azurerm_monitor_diagnostic_setting" "app" {
  count                      = var.app_service.enabled ? 1 : 0
  name                       = "agentctl-to-law"
  target_resource_id         = azurerm_linux_web_app.this[0].id
  log_analytics_workspace_id = local.law_id

  enabled_log {
    category_group = "allLogs"
  }
}
