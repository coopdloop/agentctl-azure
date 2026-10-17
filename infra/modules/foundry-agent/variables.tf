variable "name" {
  description = "Agent manifest name (slug)."
  type        = string
}

variable "environment" {
  type = string
}

variable "subscription_id" {
  type = string
}

variable "resource_group_name" {
  description = "Resource group of the Foundry account."
  type        = string
}

variable "foundry_account_name" {
  type = string
}

variable "foundry_project_name" {
  type = string
}

variable "model_deployment_name" {
  type = string
}

variable "identity_type" {
  description = "agent_identity | user_assigned_mi | project_mi"
  type        = string
  validation {
    condition     = contains(["agent_identity", "user_assigned_mi", "project_mi"], var.identity_type)
    error_message = "identity_type must be agent_identity, user_assigned_mi or project_mi."
  }
}

variable "agent_identity_principal_id" {
  description = <<-EOT
    Object id of the Entra Agent ID identity when identity_type = agent_identity. Agent identities
    are created through Microsoft Graph (not ARM), so the pipeline creates/looks it up and passes it in.
    When null, RBAC is skipped for agent_identity agents.
  EOT
  type        = string
  default     = null
}

variable "azure_role_assignments" {
  type = list(object({
    scope = string
    role  = string
  }))
  default = []
}

variable "rai_policy" {
  description = "Content-safety policy created on the Foundry account."
  type = object({
    name             = string
    base_policy_name = string
    mode             = string
    filters = map(object({
      enabled            = bool
      blocking           = bool
      severity_threshold = string
    }))
    jailbreak               = bool
    indirect_attack         = bool
    protected_material_text = bool
    protected_material_code = bool
  })
}

variable "attach_rai_policy_to_deployment" {
  description = "Point the model deployment at this RAI policy. Off by default because deployments are usually shared between agents."
  type        = bool
  default     = false
}

variable "agent_definition_path" {
  description = "Path to foundry/agent-definition.json from the bundle."
  type        = string
}

variable "manifest_path" {
  description = "Path to manifest/agent.yaml from the bundle."
  type        = string
}

variable "apply_agent_definition" {
  description = "Create/update the agent on the Foundry data plane via scripts/apply-agent.sh (needs az CLI + jq on the runner)."
  type        = bool
  default     = false
}

variable "placeholder_values" {
  description = "Values substituted for $${...} placeholders in the agent definition (e.g. function_queue_service_endpoint)."
  type        = map(string)
  default     = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
