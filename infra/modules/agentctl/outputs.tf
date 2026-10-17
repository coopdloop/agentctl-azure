output "app_url" {
  description = "agentctl URL."
  value       = var.app_service.enabled ? "https://${azurerm_linux_web_app.this[0].default_hostname}" : "(app_service disabled)"
}

output "web_app_name" {
  value = var.app_service.enabled ? azurerm_linux_web_app.this[0].name : ""
}

output "resource_group_name" {
  value = local.rg_name
}

output "client_id" {
  description = "Entra application (client) id of the SPA."
  value       = azuread_application.this.client_id
}

output "tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}

output "log_analytics_workspace_id" {
  description = "Workspace customer id (GUID) used by the query API."
  value       = local.law_customer_id
}

output "log_analytics_resource_id" {
  value = local.law_id
}

output "app_insights_id" {
  value = local.appi_id
}

output "foundry_account_ids" {
  value = local.foundry_account_ids
}

output "foundry_project_endpoint" {
  value = local.foundry_project_endpoint
}

output "graph_scopes_skipped" {
  description = "Requested Graph scopes that do not exist in this tenant (e.g. preview Agent ID scopes)."
  value       = local.graph_scopes_missing
}

output "app_settings" {
  description = "Runtime settings served to the browser via /config.js (no secrets)."
  value       = local.app_settings
}

output "local_env" {
  description = "Contents for app/.env.local to run the SPA locally against this environment."
  value = join("\n", concat(
    [for k, v in merge(local.app_settings, { AGENTCTL_REDIRECT_URI = try(var.local_dev_redirect_uris[0], "http://localhost:5173/"), AGENTCTL_ENVIRONMENT = "${var.environment}-local" }) : "${k}=${v}"],
    [""],
  ))
}
