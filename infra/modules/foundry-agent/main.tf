# Per-agent infrastructure applied by the GitOps pipeline from a bundle's terraform/main.tf:
#   - identity (dedicated user-assigned MI, Entra Agent ID principal, or the project MI)
#   - Azure RBAC for that identity
#   - RAI (content-safety) policy on the Foundry account
#   - optionally, the agent definition itself on the Foundry data plane

locals {
  account_id = "/subscriptions/${var.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.CognitiveServices/accounts/${var.foundry_account_name}"
  project_id = "${local.account_id}/projects/${var.foundry_project_name}"
  tags       = merge({ "agentctl-agent" = var.name, "environment" = var.environment, "managed-by" = "agentctl" }, var.tags)

  manifest_sha256   = filesha256(var.manifest_path)
  definition_sha256 = filesha256(var.agent_definition_path)
}

data "azapi_resource" "project" {
  type                   = "Microsoft.CognitiveServices/accounts/projects@2025-06-01"
  resource_id            = local.project_id
  response_export_values = ["identity.principalId", "properties.endpoints"]
}

resource "azurerm_user_assigned_identity" "agent" {
  count               = var.identity_type == "user_assigned_mi" ? 1 : 0
  name                = "id-agent-${var.name}"
  resource_group_name = var.resource_group_name
  location            = data.azapi_resource.project.location
  tags                = local.tags
}

locals {
  principal_id = (
    var.identity_type == "user_assigned_mi" ? azurerm_user_assigned_identity.agent[0].principal_id :
    var.identity_type == "agent_identity" ? var.agent_identity_principal_id :
    try(data.azapi_resource.project.output.identity.principalId, null)
  )
  project_endpoint = try(
    data.azapi_resource.project.output.properties.endpoints["AI Foundry API"],
    "https://${var.foundry_account_name}.services.ai.azure.com/api/projects/${var.foundry_project_name}",
  )
}

resource "azurerm_role_assignment" "agent" {
  for_each                         = local.principal_id == null ? {} : { for r in var.azure_role_assignments : "${r.role}|${r.scope}" => r }
  scope                            = each.value.scope
  role_definition_name             = each.value.role
  principal_id                     = local.principal_id
  skip_service_principal_aad_check = true
}

locals {
  severity = { Low = "Low", Medium = "Medium", High = "High" }
  rai_filters = concat(
    flatten([
      for name, f in var.rai_policy.filters : [
        for source in ["Prompt", "Completion"] : {
          name              = name
          enabled           = f.enabled
          blocking          = f.blocking
          severityThreshold = local.severity[f.severity_threshold]
          source            = source
        }
      ]
    ]),
    [
      { name = "jailbreak", enabled = var.rai_policy.jailbreak, blocking = var.rai_policy.jailbreak, source = "Prompt" },
      { name = "indirect_attack", enabled = var.rai_policy.indirect_attack, blocking = var.rai_policy.indirect_attack, source = "Prompt" },
      { name = "protected_material_text", enabled = var.rai_policy.protected_material_text, blocking = var.rai_policy.protected_material_text, source = "Completion" },
      { name = "protected_material_code", enabled = var.rai_policy.protected_material_code, blocking = false, source = "Completion" },
    ],
  )
}

resource "azapi_resource" "rai_policy" {
  type      = "Microsoft.CognitiveServices/accounts/raiPolicies@2025-06-01"
  name      = var.rai_policy.name
  parent_id = local.account_id

  body = {
    properties = {
      basePolicyName = var.rai_policy.base_policy_name
      mode           = var.rai_policy.mode
      contentFilters = local.rai_filters
    }
  }
}

resource "azapi_update_resource" "deployment_rai" {
  count       = var.attach_rai_policy_to_deployment ? 1 : 0
  type        = "Microsoft.CognitiveServices/accounts/deployments@2025-06-01"
  resource_id = "${local.account_id}/deployments/${var.model_deployment_name}"

  body = {
    properties = { raiPolicyName = azapi_resource.rai_policy.name }
  }
}

# Data-plane apply. Re-runs whenever the definition file changes.
resource "terraform_data" "agent_definition" {
  count            = var.apply_agent_definition ? 1 : 0
  triggers_replace = [local.definition_sha256, local.project_endpoint]

  provisioner "local-exec" {
    command = "${path.module}/scripts/apply-agent.sh"
    environment = {
      PROJECT_ENDPOINT    = local.project_endpoint
      DEFINITION_PATH     = var.agent_definition_path
      AGENT_NAME          = var.name
      PLACEHOLDERS_JSON   = jsonencode(var.placeholder_values)
      FOUNDRY_API_VERSION = "v1"
    }
  }

  depends_on = [azapi_resource.rai_policy, azurerm_role_assignment.agent]
}
