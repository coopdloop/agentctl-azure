# Optional: bundle archive / future approval queue. Disabled by default because bundles are
# downloaded in the browser today. Entra-only access (no shared keys), CORS for the SPA origin.

# Only blob storage is used; queue/table services carry no data (semgrep queue-logging rule n/a).
resource "azurerm_storage_account" "bundles" { # nosemgrep: storage-queue-services-logging
  #checkov:skip=CKV_AZURE_33:Only blob storage is used; queue service holds no data
  #checkov:skip=CKV_AZURE_43:Name is computed from the naming convention (lowercase, <= 24 chars)
  #checkov:skip=CKV_AZURE_206:ZRS replication is configured
  #checkov:skip=CKV2_AZURE_1:Microsoft-managed keys; bundles are integrity-checked and contain no secrets. Add CMK if policy requires
  #checkov:skip=CKV_AZURE_59:Public access is disabled when network.enabled (conditional); otherwise the browser uploads directly with Entra tokens and CORS
  count                           = var.bundle_storage.enabled ? 1 : 0
  name                            = local.names.st
  resource_group_name             = local.rg_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  public_network_access_enabled   = !var.network.enabled
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  default_to_oauth_authentication = true
  tags                            = local.tags

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
    cors_rule {
      allowed_origins    = concat(["https://${local.names.app}.azurewebsites.net"], [for u in var.local_dev_redirect_uris : trimsuffix(u, "/")])
      allowed_methods    = ["GET", "PUT", "HEAD", "OPTIONS"]
      allowed_headers    = ["*"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }
}

resource "azurerm_storage_container" "bundles" {
  #checkov:skip=CKV2_AZURE_21:Blob read/write/delete logs go to the workspace via azurerm_monitor_diagnostic_setting.bundles_blob (checkov can't resolve the blobServices target)
  count              = var.bundle_storage.enabled ? 1 : 0
  name               = "bundles"
  storage_account_id = azurerm_storage_account.bundles[0].id
}

resource "azurerm_role_assignment" "bundle_writers" {
  for_each             = var.bundle_storage.enabled ? toset(var.bundle_storage.writer_group_ids) : toset([])
  scope                = azurerm_storage_container.bundles[0].id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}

# Blob read/write/delete logs to the workspace (audit trail of bundle access).
resource "azurerm_monitor_diagnostic_setting" "bundles_blob" {
  count                      = var.bundle_storage.enabled ? 1 : 0
  name                       = "agentctl-to-law"
  target_resource_id         = "${azurerm_storage_account.bundles[0].id}/blobServices/default"
  log_analytics_workspace_id = local.law_id

  enabled_log {
    category = "StorageRead"
  }
  enabled_log {
    category = "StorageWrite"
  }
  enabled_log {
    category = "StorageDelete"
  }
}
