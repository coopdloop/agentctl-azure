# Private networking (docs/ENVIRONMENTS.md). Off by default. Bring your own VNet and subnets; DNS
# zones usually come from the hub (private_dns_zone_ids) but can be created for sandboxes.
#
#   browser ──HTTPS──► App Service (optionally private inbound endpoint)
#                         │  VNet integration, route all
#                         ├─► Foundry private endpoint            (/proxy, always)
#                         └─► AMPLS private endpoint → Log Analytics query  (/proxy when private)
#   browser ──────────► Entra ID, ARM, Graph (public; or via /proxy with proxy_services)

locals {
  net = var.network

  cloud_suffixes = {
    AzureCloud        = { web = "azurewebsites.net", foundry = "services.ai.azure.com", cs = "cognitiveservices.azure.com", openai = "openai.azure.com", monitor = "monitor.azure.com", oms = "oms.opinsights.azure.com", ods = "ods.opinsights.azure.com", agentsvc = "agentsvc.azure-automation.net", blob = "blob.core.windows.net" }
    AzureUSGovernment = { web = "azurewebsites.us", foundry = "services.ai.azure.us", cs = "cognitiveservices.azure.us", openai = "openai.azure.us", monitor = "monitor.azure.us", oms = "oms.opinsights.azure.us", ods = "ods.opinsights.azure.us", agentsvc = "agentsvc.azure-automation.us", blob = "blob.core.usgovcloudapi.net" }
    AzureChinaCloud   = { web = "chinacloudsites.cn", foundry = "services.ai.azure.cn", cs = "cognitiveservices.azure.cn", openai = "openai.azure.cn", monitor = "monitor.azure.cn", oms = "oms.opinsights.azure.cn", ods = "ods.opinsights.azure.cn", agentsvc = "agentsvc.azure-automation.cn", blob = "blob.core.chinacloudapi.cn" }
  }
  sfx = local.cloud_suffixes[var.cloud]

  ampls_enabled = local.net.enabled && try(local.net.monitor_private_link.enabled, false)

  zones = {
    web      = "privatelink.${local.sfx.web}"
    cs       = "privatelink.${local.sfx.cs}"
    openai   = "privatelink.${local.sfx.openai}"
    foundry  = "privatelink.${local.sfx.foundry}"
    monitor  = "privatelink.${local.sfx.monitor}"
    oms      = "privatelink.${local.sfx.oms}"
    ods      = "privatelink.${local.sfx.ods}"
    agentsvc = "privatelink.${local.sfx.agentsvc}"
    blob     = "privatelink.${local.sfx.blob}"
  }
  needed_zone_keys = toset(concat(
    local.net.enabled && local.net.app_private_endpoint && var.app_service.enabled ? ["web"] : [],
    local.net.enabled && local.net.foundry_private_endpoint && var.foundry.create ? ["cs", "openai", "foundry"] : [],
    local.ampls_enabled ? ["monitor", "oms", "ods", "agentsvc", "blob"] : [],
    local.net.enabled && var.bundle_storage.enabled ? ["blob"] : [],
  ))
  zones_to_create = local.net.create_private_dns_zones ? toset([for k in local.needed_zone_keys : k if !contains(keys(local.net.private_dns_zone_ids), local.zones[k])]) : toset([])
  zone_id = merge(
    { for k in local.needed_zone_keys : k => lookup(local.net.private_dns_zone_ids, local.zones[k], null) },
    { for k in local.zones_to_create : k => azurerm_private_dns_zone.this[k].id },
  )

  # The browser reaches Log Analytics through the app's proxy when queries are private-only.
  proxy_services = coalesce(
    local.net.proxy_services,
    local.ampls_enabled && try(local.net.monitor_private_link.query_access_mode, "PrivateOnly") == "PrivateOnly" ? ["logAnalytics"] : [],
  )
}

resource "terraform_data" "dns_zones_check" {
  count = length(local.needed_zone_keys) > 0 ? 1 : 0
  lifecycle {
    precondition {
      condition     = alltrue([for k in local.needed_zone_keys : local.zone_id[k] != null])
      error_message = "Private DNS zones missing: ${join(", ", [for k in local.needed_zone_keys : local.zones[k] if local.zone_id[k] == null])}. Pass them in network.private_dns_zone_ids or set create_private_dns_zones = true."
    }
  }
}

resource "azurerm_private_dns_zone" "this" {
  for_each            = local.zones_to_create
  name                = local.zones[each.key]
  resource_group_name = local.rg_name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "this" {
  for_each              = local.zones_to_create
  name                  = "link-${var.name_prefix}-${var.environment}"
  resource_group_name   = local.rg_name
  private_dns_zone_name = azurerm_private_dns_zone.this[each.key].name
  virtual_network_id    = local.net.dns_vnet_id
  tags                  = local.tags
}

# Inbound: the agentctl web app reachable only through its private endpoint.
resource "azurerm_private_endpoint" "app" {
  count               = local.net.enabled && local.net.app_private_endpoint && var.app_service.enabled ? 1 : 0
  name                = "pe-${local.names.app}"
  location            = var.location
  resource_group_name = local.rg_name
  subnet_id           = local.net.private_endpoint_subnet_id
  tags                = local.tags

  private_service_connection {
    name                           = "sites"
    private_connection_resource_id = azurerm_linux_web_app.this[0].id
    subresource_names              = ["sites"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [local.zone_id["web"]]
  }

  depends_on = [terraform_data.dns_zones_check]
}

# Foundry account created by this module (existing accounts keep their own networking).
resource "azurerm_private_endpoint" "foundry" {
  count               = local.net.enabled && local.net.foundry_private_endpoint && var.foundry.create ? 1 : 0
  name                = "pe-${local.names.foundry}"
  location            = var.location
  resource_group_name = local.rg_name
  subnet_id           = local.net.private_endpoint_subnet_id
  tags                = local.tags

  private_service_connection {
    name                           = "account"
    private_connection_resource_id = azapi_resource.foundry_account[0].id
    subresource_names              = ["account"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [local.zone_id["cs"], local.zone_id["openai"], local.zone_id["foundry"]]
  }

  depends_on = [terraform_data.dns_zones_check]
}

# Azure Monitor Private Link Scope: the workspace(s) and App Insights behind one private endpoint.
resource "azurerm_monitor_private_link_scope" "this" {
  count                 = local.ampls_enabled ? 1 : 0
  name                  = "ampls-${var.name_prefix}-${var.environment}-${var.location_short}"
  resource_group_name   = local.rg_name
  ingestion_access_mode = var.network.monitor_private_link.ingestion_access_mode
  query_access_mode     = var.network.monitor_private_link.query_access_mode
  tags                  = local.tags
}

resource "azurerm_monitor_private_link_scoped_service" "this" {
  for_each            = local.ampls_enabled ? merge({ appi = local.appi_id }, { for i, id in local.law_all_ids : "law${i}" => id }) : {}
  name                = "amplsrs-${each.key}"
  resource_group_name = local.rg_name
  scope_name          = azurerm_monitor_private_link_scope.this[0].name
  linked_resource_id  = each.value
}

resource "azurerm_private_endpoint" "monitor" {
  count               = local.ampls_enabled ? 1 : 0
  name                = "pe-ampls-${var.name_prefix}-${var.environment}"
  location            = var.location
  resource_group_name = local.rg_name
  subnet_id           = local.net.private_endpoint_subnet_id
  tags                = local.tags

  private_service_connection {
    name                           = "azuremonitor"
    private_connection_resource_id = azurerm_monitor_private_link_scope.this[0].id
    subresource_names              = ["azuremonitor"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [for k in ["monitor", "oms", "ods", "agentsvc", "blob"] : local.zone_id[k]]
  }

  depends_on = [terraform_data.dns_zones_check, azurerm_monitor_private_link_scoped_service.this]
}

# Bundle archive (optional) behind a private endpoint when networking is on.
resource "azurerm_private_endpoint" "bundles" {
  count               = local.net.enabled && var.bundle_storage.enabled ? 1 : 0
  name                = "pe-${local.names.st}-blob"
  location            = var.location
  resource_group_name = local.rg_name
  subnet_id           = local.net.private_endpoint_subnet_id
  tags                = local.tags

  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.bundles[0].id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [local.zone_id["blob"]]
  }

  depends_on = [terraform_data.dns_zones_check]
}
