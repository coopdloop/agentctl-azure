# Entra app registration for the agentctl SPA (MSAL, auth code + PKCE, no client secret).

locals {
  # Well-known first-party application (client) ids.
  graph_app_id = "00000003-0000-0000-c000-000000000000"
  arm_app_id   = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Service Management
  la_app_id    = "ca7f3f0b-7d91-482c-8e09-c5d840d0eac5" # Log Analytics API
  ai_app_id    = "18a66f5f-dbdf-4c17-9dd7-1634712a9cbe" # Azure Machine Learning Services (audience https://ai.azure.com, Foundry data plane)

  app_roles = {
    reader          = { value = "AgentCtl.Reader", display = "Reader", description = "View agents, activity and guardrail posture (within the user's data scope)." }
    identity_reader = { value = "AgentCtl.IdentityReader", display = "Identity Reader", description = "View identity & access: sign-ins, permission grants, Azure RBAC, agent identities." }
    requester       = { value = "AgentCtl.Requester", display = "Requester", description = "Propose new agents and changes; bundles are marked as proposals that owners must adopt." }
    builder         = { value = "AgentCtl.Builder", display = "Builder", description = "Create agent bundles and harness change requests." }
    approver        = { value = "AgentCtl.Approver", display = "Approver", description = "Review and verify change-request bundles." }
    admin           = { value = "AgentCtl.Admin", display = "Admin", description = "Everything, unscoped; bulk remediation and platform guardrail baselines." }
  }

  redirect_uris = concat(["https://${local.names.app}.azurewebsites.net/"], var.local_dev_redirect_uris)
}

data "azuread_service_principal" "graph" {
  client_id = local.graph_app_id
}

data "azuread_service_principal" "arm" {
  client_id = local.arm_app_id
}

data "azuread_service_principal" "log_analytics" {
  client_id = local.la_app_id
}

data "azuread_service_principal" "foundry" {
  client_id = local.ai_app_id
}

locals {
  # Skip scopes that don't exist in this tenant (e.g. preview Agent ID scopes) instead of failing.
  graph_scopes_available = [for s in var.graph_delegated_scopes : s if contains(keys(data.azuread_service_principal.graph.oauth2_permission_scope_ids), s)]
  graph_scopes_missing   = setsubtract(var.graph_delegated_scopes, local.graph_scopes_available)
}

resource "random_uuid" "app_role" {
  for_each = local.app_roles
}

resource "azuread_application" "this" {
  display_name     = "agentctl-${var.environment}"
  sign_in_audience = "AzureADMyOrg"
  owners           = [data.azurerm_client_config.current.object_id]
  notes            = "Agent control plane SPA. Managed by Terraform (modules/agentctl)."

  # Group object ids in the ID token drive data scoping (access_scopes). Users in >200 groups
  # get an overage marker instead; the SPA then reads memberships from Graph.
  group_membership_claims = ["SecurityGroup"]
  optional_claims {
    id_token {
      name = "groups"
    }
  }

  single_page_application {
    redirect_uris = local.redirect_uris
  }

  dynamic "app_role" {
    for_each = local.app_roles
    content {
      allowed_member_types = ["User"]
      description          = app_role.value.description
      display_name         = app_role.value.display
      enabled              = true
      id                   = random_uuid.app_role[app_role.key].result
      value                = app_role.value.value
    }
  }

  required_resource_access {
    resource_app_id = local.graph_app_id
    dynamic "resource_access" {
      for_each = toset(local.graph_scopes_available)
      content {
        id   = data.azuread_service_principal.graph.oauth2_permission_scope_ids[resource_access.value]
        type = "Scope"
      }
    }
  }

  required_resource_access {
    resource_app_id = local.arm_app_id
    resource_access {
      id   = data.azuread_service_principal.arm.oauth2_permission_scope_ids["user_impersonation"]
      type = "Scope"
    }
  }

  required_resource_access {
    resource_app_id = local.la_app_id
    resource_access {
      id   = data.azuread_service_principal.log_analytics.oauth2_permission_scope_ids["Data.Read"]
      type = "Scope"
    }
  }

  required_resource_access {
    resource_app_id = local.ai_app_id
    resource_access {
      id   = data.azuread_service_principal.foundry.oauth2_permission_scope_ids["user_impersonation"]
      type = "Scope"
    }
  }

  lifecycle {
    ignore_changes = [owners]
  }
}

resource "azuread_service_principal" "this" {
  client_id                    = azuread_application.this.client_id
  app_role_assignment_required = var.require_app_role_assignment
  owners                       = [data.azurerm_client_config.current.object_id]
  tags                         = ["agentctl", "WindowsAzureActiveDirectoryIntegratedApp"]

  lifecycle {
    ignore_changes = [owners]
  }
}

locals {
  role_keys = keys(local.app_roles)

  # Directly assigned principals (bring-your-own groups or users) ...
  direct_role_assignments = merge([
    for role in local.role_keys : { for id in lookup(var.app_role_assignments, role, []) : "${role}-${id}" => { role = role, principal = id } }
  ]...)

  # ... plus the optional groups created by this module, one per role.
  group_role_assignments = var.role_groups.create ? {
    for role in local.role_keys : "${role}-group" => { role = role, principal = azuread_group.role[role].object_id }
  } : {}

  role_assignments = merge(local.direct_role_assignments, local.group_role_assignments)
}

resource "azuread_group" "role" {
  for_each         = var.role_groups.create ? local.app_roles : {}
  display_name     = "${var.role_groups.name_prefix}-${var.environment}-${replace(each.key, "_", "-")}s"
  description      = "agentctl ${each.value.display}: ${each.value.description}"
  security_enabled = true
  owners           = [data.azurerm_client_config.current.object_id]
  members          = lookup(var.role_groups.members, each.key, [])

  lifecycle {
    ignore_changes = [owners]
  }
}

resource "azuread_app_role_assignment" "this" {
  for_each            = local.role_assignments
  app_role_id         = random_uuid.app_role[each.value.role].result
  principal_object_id = each.value.principal
  resource_object_id  = azuread_service_principal.this.object_id
}

# Optional tenant-wide admin consent so users aren't prompted per scope.
resource "azuread_service_principal_delegated_permission_grant" "graph" {
  count                                = var.grant_admin_consent ? 1 : 0
  service_principal_object_id          = azuread_service_principal.this.object_id
  resource_service_principal_object_id = data.azuread_service_principal.graph.object_id
  claim_values                         = local.graph_scopes_available
}

resource "azuread_service_principal_delegated_permission_grant" "arm" {
  count                                = var.grant_admin_consent ? 1 : 0
  service_principal_object_id          = azuread_service_principal.this.object_id
  resource_service_principal_object_id = data.azuread_service_principal.arm.object_id
  claim_values                         = ["user_impersonation"]
}

resource "azuread_service_principal_delegated_permission_grant" "log_analytics" {
  count                                = var.grant_admin_consent ? 1 : 0
  service_principal_object_id          = azuread_service_principal.this.object_id
  resource_service_principal_object_id = data.azuread_service_principal.log_analytics.object_id
  claim_values                         = ["Data.Read"]
}

resource "azuread_service_principal_delegated_permission_grant" "foundry" {
  count                                = var.grant_admin_consent ? 1 : 0
  service_principal_object_id          = azuread_service_principal.this.object_id
  resource_service_principal_object_id = data.azuread_service_principal.foundry.object_id
  claim_values                         = ["user_impersonation"]
}
