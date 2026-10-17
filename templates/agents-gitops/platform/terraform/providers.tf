# Copied into each agent's terraform/ folder by deploy-agents.yml (as zz_platform_providers.tf).
# Bundles contain only the module call; backend and providers are owned by the platform.
terraform {
  required_version = ">= 1.8.0"
  backend "azurerm" {}

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.0"
    }
  }
}

variable "target_subscription_id" {
  description = "Subscription of the agent's Foundry account (from the manifest)."
  type        = string
}

provider "azurerm" {
  features {}
  subscription_id     = var.target_subscription_id
  use_oidc            = true
  storage_use_azuread = true
}

provider "azapi" {
  use_oidc = true
}
