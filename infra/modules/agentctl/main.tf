data "azurerm_client_config" "current" {}
data "azurerm_subscription" "current" {}

resource "random_string" "suffix" {
  length  = 4
  special = false
  upper   = false
}

locals {
  base    = "${var.name_prefix}-${var.environment}-${var.location_short}"
  flat    = "${var.name_prefix}${var.environment}${random_string.suffix.result}"
  tags    = merge({ "app" = "agentctl", "environment" = var.environment, "managed-by" = "terraform" }, var.tags)
  rg_name = var.resource_group.create ? azurerm_resource_group.this[0].name : var.resource_group.name

  names = {
    rg      = coalesce(var.resource_group.name, "rg-${local.base}")
    law     = "law-${local.base}"
    appi    = "appi-${local.base}"
    plan    = "asp-${local.base}"
    app     = "app-${local.base}-${random_string.suffix.result}"
    foundry = coalesce(var.foundry.account_name, "aif-${local.base}-${random_string.suffix.result}")
    st      = substr("st${local.flat}", 0, 24)
  }
}

resource "azurerm_resource_group" "this" {
  count    = var.resource_group.create ? 1 : 0
  name     = local.names.rg
  location = var.location
  tags     = local.tags
}
