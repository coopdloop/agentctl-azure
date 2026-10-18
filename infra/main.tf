# agentctl — minimal root. Copy modules/agentctl (and modules/foundry-agent) into your infra
# repo and call it like this; everything environment-specific lives in terraform.tfvars.

terraform {
  required_version = ">= 1.8.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
    azuread = { source = "hashicorp/azuread", version = "~> 3.0" }
    azapi   = { source = "Azure/azapi", version = "~> 2.0" }
    random  = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # backend "azurerm" {}  # configure in your real repo
}

locals {
  # Provider environment names per cloud.
  provider_env = {
    AzureCloud        = { azurerm = "public", azuread = "global", azapi = "public" }
    AzureUSGovernment = { azurerm = "usgovernment", azuread = "usgovernment", azapi = "usgovernment" }
    AzureChinaCloud   = { azurerm = "china", azuread = "china", azapi = "china" }
  }[var.cloud]
}

provider "azurerm" {
  features {}
  subscription_id     = var.subscription_id
  environment         = local.provider_env.azurerm
  storage_use_azuread = true
}

provider "azuread" {
  tenant_id   = var.tenant_id
  environment = local.provider_env.azuread
}

provider "azapi" {
  environment = local.provider_env.azapi
}

module "agentctl" {
  source = "./modules/agentctl"

  name_prefix    = var.name_prefix
  environment    = var.environment
  location       = var.location
  location_short = var.location_short
  tags           = var.tags

  resource_group       = var.resource_group
  log_analytics        = var.log_analytics
  app_insights         = var.app_insights
  foundry              = var.foundry
  app_role_assignments = var.app_role_assignments
  viewer_principal_ids = var.viewer_principal_ids
  entra_diagnostics    = var.entra_diagnostics
  grant_admin_consent  = var.grant_admin_consent
  gitops               = var.gitops
  approver_groups      = var.approver_groups
  bundle_storage       = var.bundle_storage
  app_service          = var.app_service
  role_groups          = var.role_groups
  access_scopes        = var.access_scopes
  unscoped_default     = var.unscoped_default

  cloud                        = var.cloud
  observed_subscription_ids    = var.observed_subscription_ids
  observe_all_subscriptions    = var.observe_all_subscriptions
  additional_log_analytics_ids = var.additional_log_analytics_ids
  network                      = var.network
  control_attestations         = var.control_attestations
  approved_mcp_hosts           = var.approved_mcp_hosts
}

output "app_url" { value = module.agentctl.app_url }
output "web_app_name" { value = module.agentctl.web_app_name }
output "resource_group_name" { value = module.agentctl.resource_group_name }
output "client_id" { value = module.agentctl.client_id }
output "graph_scopes_skipped" { value = module.agentctl.graph_scopes_skipped }
output "local_env" { value = module.agentctl.local_env }
output "role_group_ids" { value = module.agentctl.role_group_ids }
