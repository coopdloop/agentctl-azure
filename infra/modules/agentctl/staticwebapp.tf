# Azure Static Web Apps hosting (alternative to App Service): the SPA as static content plus two
# managed functions (/api/config, /api/proxy) from the release package agentctl-swa.zip.
# Free tier needs no App Service quota. Managed functions can't use VNet integration, so private
# Foundry endpoints need App Service hosting (docs: Hosting options).

resource "azurerm_static_web_app" "this" {
  count               = var.static_web_app.enabled ? 1 : 0
  name                = "swa-${local.base}-${random_string.suffix.result}"
  resource_group_name = local.rg_name
  location            = var.static_web_app.location
  sku_tier            = var.static_web_app.sku_tier
  sku_size            = var.static_web_app.sku_tier
  tags                = local.tags

  # Deployments come from the release package via the deployment token (scripts/deploy.sh).
  # App settings are owned by azapi_resource_action.swa_app_settings below; without ignoring them
  # here this resource would wipe them on every apply.
  lifecycle {
    ignore_changes = [repository_url, repository_branch, app_settings]
  }
}

# App settings are applied separately so the app registration can reference the SWA hostname
# (redirect URI) without a dependency cycle (settings need the app's client id).
resource "azapi_resource_action" "swa_app_settings" {
  count       = var.static_web_app.enabled ? 1 : 0
  type        = "Microsoft.Web/staticSites@2023-12-01"
  resource_id = azurerm_static_web_app.this[0].id
  action      = "config/appsettings"
  method      = "PUT"
  body = {
    properties = merge(local.app_settings, {
      AGENTCTL_REDIRECT_URI = "https://${azurerm_static_web_app.this[0].default_host_name}/"
      AGENTCTL_PROXY_BASE   = "/api/proxy"
    })
  }
}
