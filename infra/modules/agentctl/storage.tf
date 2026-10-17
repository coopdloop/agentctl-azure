# Optional: bundle archive / future approval queue. Disabled by default because bundles are
# downloaded in the browser today. Entra-only access (no shared keys), CORS for the SPA origin.

resource "azurerm_storage_account" "bundles" {
  count                           = var.bundle_storage.enabled ? 1 : 0
  name                            = local.names.st
  resource_group_name             = local.rg_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
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
