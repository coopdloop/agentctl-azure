# Thin pass-through of the module's inputs. See modules/agentctl/variables.tf for docs.

variable "subscription_id" { type = string }
variable "tenant_id" { type = string }

variable "name_prefix" {
  type    = string
  default = "agentctl"
}
variable "environment" {
  type    = string
  default = "dev"
}
variable "location" {
  type    = string
  default = "eastus2"
}
variable "location_short" {
  type    = string
  default = "eus2"
}
variable "tags" {
  type    = map(string)
  default = {}
}

variable "resource_group" {
  type    = any
  default = {}
}
variable "log_analytics" {
  type    = any
  default = {}
}
variable "app_insights" {
  type    = any
  default = {}
}
variable "foundry" {
  type    = any
  default = {}
}
variable "app_role_assignments" {
  type    = any
  default = {}
}
variable "viewer_principal_ids" {
  type    = list(string)
  default = []
}
variable "entra_diagnostics" {
  type    = any
  default = {}
}
variable "grant_admin_consent" {
  type    = bool
  default = false
}
variable "gitops" {
  type    = any
  default = {}
}
variable "approver_groups" {
  type    = any
  default = {}
}
variable "bundle_storage" {
  type    = any
  default = {}
}
variable "app_service" {
  type    = any
  default = {}
}
variable "cloud" {
  description = "AzureCloud, AzureUSGovernment or AzureChinaCloud (providers and app endpoints)."
  type        = string
  default     = "AzureCloud"
}
variable "observed_subscription_ids" {
  type    = list(string)
  default = []
}
variable "observe_all_subscriptions" {
  type    = bool
  default = false
}
variable "additional_log_analytics_ids" {
  type    = list(string)
  default = []
}
variable "network" {
  type    = any
  default = {}
}

variable "control_attestations" {
  type    = any
  default = {}
}
variable "approved_mcp_hosts" {
  type    = list(string)
  default = []
}

variable "role_groups" {
  type    = any
  default = {}
}
variable "access_scopes" {
  type    = any
  default = {}
}
variable "unscoped_default" {
  type    = string
  default = "all"
}
