# Prerequisites & tooling

## Accounts

- [x] An **Azure subscription** where you are **Owner**. See [Permissions](permissions.md) for exactly what is used and the alternatives.
- [x] A **Microsoft Entra ID tenant** (the subscription's directory) where you can register applications. That's the default tenant setting; see [Permissions](permissions.md#entra-id).
- [x] A **GitHub account**, needed only for the [agents GitOps repo](../gitops/setup.md) (a private repo in your org or user).
- [ ] *Optional:* **Entra ID P1/P2**, only to export sign-in and Graph activity logs (the identity usage views and control MO-03).

## Tools

Install on the machine you deploy from (macOS, Linux or WSL):

| Tool | Version | Used for | Install |
|---|---|---|---|
| Azure CLI (`az`) | 2.60+ | sign-in, Terraform auth, deployments | [aka.ms/azcli](https://aka.ms/azcli) |
| Terraform | {{ tf_version }}+ (1.8 minimum) | infrastructure | [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install) |
| Node.js | {{ node_version }} LTS | Static Web Apps deploy CLI (via `npx`); local builds | [nodejs.org](https://nodejs.org) |
| curl, unzip, jq | any | release download, scripts | your package manager |
| GitHub CLI (`gh`) | 2.50+ | *recommended:* verify release provenance, create the agents repo | [cli.github.com](https://cli.github.com) |
| Python | 3.11+ | *optional:* seed demo agents | [python.org](https://python.org) |

Check them:

```bash
az version --query '"azure-cli"' -o tsv
terraform version | head -1
node --version
gh --version | head -1
```

## Sign in and pick the subscription

```bash
az login                                  # or: az login --tenant <tenant-id>
az account set --subscription "<subscription name or id>"
az account show --query "{sub:name, id:id, tenant:tenantId, user:user.name}" -o table
```

Terraform uses this Azure CLI session; no service principal or secret is needed.

## Register resource providers

New subscriptions often have these unregistered. Registering is idempotent and needs Owner or Contributor:

```bash
for ns in Microsoft.CognitiveServices Microsoft.Web Microsoft.OperationalInsights Microsoft.Insights \
          Microsoft.ManagedIdentity Microsoft.Security Microsoft.PolicyInsights Microsoft.Storage; do
  az provider register --namespace "$ns" --wait &
done; wait
```

## Know your IDs

```bash
az account show --query tenantId -o tsv           # tenant id
az account show --query id -o tsv                 # subscription id
az ad signed-in-user show --query id -o tsv       # your user object id (for app roles)
```

!!! note "Model quota"
    If Terraform creates a sandbox Foundry account, it deploys a model (default `gpt-4.1`, GlobalStandard). Check quota in the Foundry portal → **Quota**, or pick a model and region where you have capacity.

Next: [Permissions](permissions.md).
