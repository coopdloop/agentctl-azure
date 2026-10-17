# Tenant-level export of Entra sign-in and Microsoft Graph activity logs to the workspace.
# These feed the Identity & access views (delegated / OBO / app / MI / agent identity usage).

resource "azurerm_monitor_aad_diagnostic_setting" "entra" {
  count                      = var.entra_diagnostics.enabled ? 1 : 0
  name                       = "agentctl-${var.environment}-entra"
  log_analytics_workspace_id = local.law_id

  dynamic "enabled_log" {
    for_each = toset(var.entra_diagnostics.categories)
    content {
      category = enabled_log.value
    }
  }
}
