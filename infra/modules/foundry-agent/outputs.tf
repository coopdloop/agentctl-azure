output "principal_id" {
  description = "Object id of the identity the agent runs as (null if an agent identity was not supplied)."
  value       = local.principal_id
}

output "user_assigned_identity_client_id" {
  value = try(azurerm_user_assigned_identity.agent[0].client_id, null)
}

output "rai_policy_id" {
  value = azapi_resource.rai_policy.id
}

output "project_endpoint" {
  value = local.project_endpoint
}

output "manifest_sha256" {
  value = local.manifest_sha256
}
