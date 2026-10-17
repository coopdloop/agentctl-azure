# State for agents-dev. The deploy identity needs Storage Blob Data Contributor on the container.
resource_group_name  = "rg-agentctl-state"
storage_account_name = "stagentctlstatedev"
container_name       = "agents"
use_azuread_auth     = true
use_oidc             = true
