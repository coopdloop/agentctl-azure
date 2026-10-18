# Quickstart: subscription Owner, latest release

**Goal:** agentctl {{ version }} running on Azure Static Web Apps against your Foundry agents, signed in as Admin, in about 30 minutes.

**You need:**
- Owner on one subscription;
- the [tools](../getting-started/prerequisites.md#tools);
- for full identity views, an Entra admin to click one consent link (see [Permissions](../getting-started/permissions.md)).

## 1. Sign in and prepare

```bash
az login
az account set --subscription "<subscription>"
export SUB_ID=$(az account show --query id -o tsv)
export ME=$(az ad signed-in-user show --query id -o tsv)
```

Register resource providers if this is a new subscription ([commands](../getting-started/prerequisites.md#register-resource-providers)).

## 2. Write a minimal Terraform root

You don't need to clone the repo: Terraform pulls the module from the release tag.

```bash
mkdir agentctl-infra && cd agentctl-infra
```

=== "main.tf"

    ```hcl
    terraform {
      required_version = ">= 1.8.0"
      required_providers {
        azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
        azuread = { source = "hashicorp/azuread", version = "~> 3.0" }
        azapi   = { source = "Azure/azapi", version = "~> 2.0" }
        random  = { source = "hashicorp/random", version = "~> 3.6" }
      }
      # Recommended for anything beyond a trial: remote state (state contains secrets).
      # backend "azurerm" {}
    }

    provider "azurerm" {
      features {}
      subscription_id     = var.subscription_id
      storage_use_azuread = true
    }
    provider "azuread" {}
    provider "azapi" {}

    variable "subscription_id" { type = string }
    variable "admin_object_ids" { type = list(string) }
    variable "foundry_account_ids" {
      type    = list(string)
      default = []
    }

    module "agentctl" {
      source = "git::https://github.com/{{ repo }}.git//infra/modules/agentctl?ref={{ version }}"

      name_prefix    = "agentctl"
      environment    = "prod"
      location       = "eastus2"
      location_short = "eus2"

      # Observe existing Foundry accounts (any subscription), or create a sandbox when none are given.
      foundry = {
        create               = length(var.foundry_account_ids) == 0
        existing_account_ids = var.foundry_account_ids
        # Sandbox only: one model deployment (check quota for the model/region).
        model_deployments = {
          for k, v in { "gpt-4.1" = { model_name = "gpt-4.1", model_version = "2025-04-14", capacity = 50 } } :
          k => v if length(var.foundry_account_ids) == 0
        }
      }

      # Hosting: Static Web Apps (Free); App Service off.
      static_web_app = { enabled = true, sku_tier = "Free", location = "eastus2" }
      app_service    = { enabled = false }

      # You become Admin; viewers get Reader / Log Analytics Reader / Foundry User.
      role_groups          = { create = true, members = { admin = var.admin_object_ids } }
      viewer_principal_ids = var.admin_object_ids

      # true only if you hold Cloud Application Administrator (or higher); otherwise send the consent link.
      grant_admin_consent = false

      # Bundles reference the agent module inside your agents-gitops repo.
      gitops = { repo = "", base_path = "agents", agent_module_source = "../../../modules/foundry-agent" }
    }

    output "app_url" { value = module.agentctl.app_url }
    output "client_id" { value = module.agentctl.client_id }
    output "resource_group_name" { value = module.agentctl.resource_group_name }
    output "static_web_app_name" { value = module.agentctl.static_web_app_name }
    output "local_env" { value = module.agentctl.local_env }
    ```

=== "terraform.tfvars"

    ```hcl
    subscription_id  = "<SUB_ID>"
    admin_object_ids = ["<ME>"]
    # Existing Foundry accounts to observe; leave empty to create a sandbox account + project.
    foundry_account_ids = [
      # "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>",
    ]
    ```

!!! danger "Never commit `terraform.tfvars` or state"
    Both contain tenant-specific values, and state contains secrets such as the App Insights connection string. Add `*.tfvars`, `*.tfstate*` and `.terraform/` to `.gitignore`, and use a remote backend for shared environments.

## 3. Apply

```bash
terraform init
terraform plan -out tfplan      # review: resource group, workspace, App Insights, app registration,
                                # groups, role assignments, Static Web App (and Foundry if creating)
terraform apply tfplan
```

Takes about 3–6 minutes (longer if a Foundry account and model deployment are created).

## 4. Deploy the latest release

Download the deploy script from the release tag, read it, then run it. It downloads `agentctl-swa.zip`, verifies the checksum (and provenance if `gh` is signed in), and deploys with the Static Web Apps CLI.

```bash
curl -fsSLO https://raw.githubusercontent.com/{{ repo }}/{{ version }}/scripts/deploy.sh
less deploy.sh
bash deploy.sh --target swa --version {{ version }} \
  --resource-group "$(terraform output -raw resource_group_name)" \
  --name "$(terraform output -raw static_web_app_name)"
```

The script ends with `OK: https://<name>.azurestaticapps.net`.

## 5. Admin consent

If you set `grant_admin_consent = false`, send this to an Entra admin (Cloud Application Administrator or higher):

```bash
echo "https://login.microsoftonline.com/$(az account show --query tenantId -o tsv)/adminconsent?client_id=$(terraform output -raw client_id)"
```

## 6. Sign in and verify

1. Open `terraform output -raw app_url`, switch to **Live** (account menu), and **Sign in**.
2. Check **Data sources**: every source should be green (Graph sources stay amber until consent).
3. **Agents** lists your Foundry agents; **Risk & compliance** shows control scores.

!!! info "No activity yet?"
    Activity, tokens and the tracing control need agents to send traces to the App Insights resource (`appi-agentctl-…`). In the Foundry portal: project → **Tracing** → connect the Application Insights resource. Terraform does this automatically for a sandbox project it creates.

## What's next

- **Give others access:** add people to the role groups (`role_groups.members`) or [data scopes](../ACCESS.md).
- **Change agents through GitOps:** [Set up your agents repo](../gitops/setup.md).
- **Harden for production:** remote state, App Service with [private networking](../ENVIRONMENTS.md), Defender for AI, and the failing items on **Risk & compliance**.
