variable "name_prefix" {
  description = "Short prefix used in every resource name (e.g. agentctl)."
  type        = string
  default     = "agentctl"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.name_prefix))
    error_message = "name_prefix must be 3-12 lowercase alphanumerics starting with a letter."
  }
}

variable "environment" {
  description = "Environment short name (dev, test, prod)."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for created resources."
  type        = string
  default     = "eastus2"
}

variable "location_short" {
  description = "Short region code used in names."
  type        = string
  default     = "eus2"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}

variable "resource_group" {
  description = "Create a resource group, or use an existing one by name."
  type = object({
    create = optional(bool, true)
    name   = optional(string)
  })
  default = {}
}

# --- Monitoring -------------------------------------------------------------------------------

variable "log_analytics" {
  description = <<-EOT
    Log Analytics workspace that holds App Insights traces and Entra diagnostics.
    create = true creates one; otherwise set existing_id to an existing workspace resource id.
  EOT
  type = object({
    create         = optional(bool, true)
    existing_id    = optional(string)
    retention_days = optional(number, 90)
    sku            = optional(string, "PerGB2018")
  })
  default = {}
  validation {
    condition     = var.log_analytics.create || var.log_analytics.existing_id != null
    error_message = "Set log_analytics.existing_id when log_analytics.create = false."
  }
}

variable "app_insights" {
  description = "Workspace-based Application Insights used as the agent tracing sink (connect it to Foundry projects)."
  type = object({
    create      = optional(bool, true)
    existing_id = optional(string)
  })
  default = {}
  validation {
    condition     = var.app_insights.create || var.app_insights.existing_id != null
    error_message = "Set app_insights.existing_id when app_insights.create = false."
  }
}

# --- Foundry ----------------------------------------------------------------------------------

variable "foundry" {
  description = <<-EOT
    Foundry (AIServices) account + project that agentctl observes.
    - create = true: creates an account and one project (handy for a demo/sandbox).
    - create = false: pass existing_account_ids (one or more); projects are discovered at runtime.
    connect_app_insights creates an AppInsights connection on the created project so agent traces land in the workspace.
  EOT
  type = object({
    create               = optional(bool, false)
    account_name         = optional(string)
    project_name         = optional(string, "agents")
    existing_account_ids = optional(list(string), [])
    connect_app_insights = optional(bool, true)
    disable_local_auth   = optional(bool, true)
    public_network       = optional(bool, true)
    model_deployments = optional(map(object({
      model_name    = string
      model_version = string
      sku_name      = optional(string, "GlobalStandard")
      capacity      = optional(number, 50)
      rai_policy    = optional(string, "Microsoft.DefaultV2")
    })), {})
    diagnostic_settings = optional(bool, true)
  })
  default = {}
}

# --- Identity / access ------------------------------------------------------------------------

variable "app_role_assignments" {
  description = <<-EOT
    Existing Entra object ids (groups or users) to assign to each agentctl app role.
    Roles: reader, identity_reader, requester, builder, approver, admin.
  EOT
  type        = map(list(string))
  default     = {}
  validation {
    condition     = alltrue([for k in keys(var.app_role_assignments) : contains(["reader", "identity_reader", "requester", "builder", "approver", "admin"], k)])
    error_message = "app_role_assignments keys must be reader, identity_reader, requester, builder, approver or admin."
  }
}

variable "role_groups" {
  description = <<-EOT
    Create one Entra security group per app role (e.g. agentctl-dev-builders) and assign it to the
    role. members maps role -> member object ids. Leave create = false to bring your own groups via
    app_role_assignments.
  EOT
  type = object({
    create      = optional(bool, false)
    name_prefix = optional(string, "agentctl")
    members     = optional(map(list(string)), {})
  })
  default = {}
}

variable "access_scopes" {
  description = <<-EOT
    Data scopes. Members of a scope's groups see only that scope's Foundry projects (and optionally
    agents matching name globs). Project access is *enforced* by granting the groups Foundry User on
    exactly those projects; agent globs refine the UI within a project.
      { hr = { group_ids = ["<oid>"], projects = [{ account_id = "/subscriptions/.../accounts/aif-x", project = "agents" }], agents = ["hr-*"] } }
    Don't also put scoped users in viewer_principal_ids (that grants account-wide Foundry access).
  EOT
  type = map(object({
    group_ids    = optional(list(string), [])
    create_group = optional(bool, false) # creates agentctl-<env>-scope-<name> with `members`
    members      = optional(list(string), [])
    projects = list(object({
      account_id = string
      project    = string
    }))
    agents = optional(list(string))
    # Query agent traces (App* tables only, never sign-in/Graph logs) via a table-scoped custom role.
    telemetry = optional(bool, true)
  }))
  default = {}
}

variable "unscoped_default" {
  description = "What users in no access_scopes group see: all (simple single-team setups) or none (strict)."
  type        = string
  default     = "all"
  validation {
    condition     = contains(["all", "none"], var.unscoped_default)
    error_message = "unscoped_default must be all or none."
  }
}

variable "require_app_role_assignment" {
  description = "Only users/groups assigned an app role can sign in to agentctl."
  type        = bool
  default     = true
}

variable "graph_delegated_scopes" {
  description = "Microsoft Graph delegated scopes requested by the SPA. Unknown scopes in the tenant are skipped."
  type        = list(string)
  default     = ["User.Read", "Application.Read.All", "Directory.Read.All", "DelegatedPermissionGrant.Read.All", "AgentIdentity.Read.All"]
}

variable "grant_admin_consent" {
  description = "Grant tenant-wide admin consent for the delegated scopes (requires a privileged Entra role for the deployer)."
  type        = bool
  default     = false
}

variable "local_dev_redirect_uris" {
  description = "Extra SPA redirect URIs for local testing."
  type        = list(string)
  default     = ["http://localhost:5173/"]
}

variable "viewer_principal_ids" {
  description = <<-EOT
    Entra object ids (typically the same groups as app roles) that need *data* access for live mode.
    agentctl calls Azure with the signed-in user's own token, so users need: Reader (discovery/policy),
    Log Analytics Reader (traces + sign-in logs) and Azure AI User (Foundry agents).
  EOT
  type        = list(string)
  default     = []
}

variable "assign_subscription_reader" {
  description = "Grant viewer_principal_ids Reader on the whole subscription (needed for discovery and Azure Policy states). If false, Reader is scoped to the Foundry account(s)."
  type        = bool
  default     = false
}

# --- Diagnostics ------------------------------------------------------------------------------

variable "entra_diagnostics" {
  description = <<-EOT
    Tenant-level Entra diagnostic setting sending sign-in and Graph activity logs to the workspace.
    Requires Entra ID P1/P2 and Security Administrator (or higher) for the deployer. Only one of these
    is needed per tenant/workspace, so leave disabled if your tenant already exports them.
  EOT
  type = object({
    enabled    = optional(bool, false)
    categories = optional(list(string), ["SignInLogs", "NonInteractiveUserSignInLogs", "ServicePrincipalSignInLogs", "ManagedIdentitySignInLogs", "MicrosoftGraphActivityLogs", "AuditLogs"])
  })
  default = {}
}

# --- Hosting ----------------------------------------------------------------------------------

variable "app_service" {
  description = "App Service plan/app settings for the agentctl frontend."
  type = object({
    enabled      = optional(bool, true)
    sku_name     = optional(string, "B1")
    node_version = optional(string, "22-lts")
    always_on    = optional(bool, true)
    mode         = optional(string, "live")
  })
  default = {}
}

variable "gitops" {
  description = "Metadata written into generated bundles."
  type = object({
    repo                = optional(string, "")
    base_path           = optional(string, "agents")
    agent_module_source = optional(string, "../../../modules/foundry-agent")
  })
  default = {}
}

variable "approver_groups" {
  description = "Approver group names (or object ids) per risk tier, written into change requests."
  type = object({
    read       = optional(list(string), ["agent-owners"])
    write      = optional(list(string), ["agent-owners", "platform-security"])
    privileged = optional(list(string), ["agent-owners", "platform-security", "identity-admins"])
  })
  default = {}
}

# --- Optional ---------------------------------------------------------------------------------

variable "bundle_storage" {
  description = <<-EOT
    Optional storage account for archiving bundles / a future approval queue. Not required today:
    bundles are downloaded in the browser. Key access is disabled; access is via Entra RBAC only.
  EOT
  type = object({
    enabled          = optional(bool, false)
    writer_group_ids = optional(list(string), [])
  })
  default = {}
}
