# Set up your private agents repo

About 45 minutes. You need:
- Owner on the subscription that holds your Foundry project(s);
- admin on a GitHub org or user account (to create a private repo, environments and a GitHub App);
- the [tools](../getting-started/prerequisites.md#tools), including `gh` signed in with `gh auth login`.

The Azure identities are **user-assigned managed identities with GitHub federated credentials**. They need no Entra admin role, no client secrets, and no app registrations.

## 1. Create the repo from the release template

```bash
VERSION={{ version }}
curl -fsSLO https://github.com/{{ repo }}/releases/download/$VERSION/agents-gitops-template.zip
curl -fsSLO https://github.com/{{ repo }}/releases/download/$VERSION/SHA256SUMS
grep agents-gitops-template.zip SHA256SUMS | sha256sum -c -        # macOS: shasum -a 256 -c -
gh attestation verify agents-gitops-template.zip --repo {{ repo }}

unzip -q agents-gitops-template.zip && cd agents-gitops
git init -b main && git add -A && git commit -m "agents-gitops from agentctl $VERSION"
gh repo create <org>/agents-gitops --private --source . --push
export REPO=<org>/agents-gitops
```

The template contains:

```
.github/workflows/agent-bundle.yml   PR gate: verify → drift → gate
.github/workflows/deploy.yml         merge → Terraform + agent version
.github/scripts/                     change detection, drift check, approval gate
.github/CODEOWNERS                   platform files owned by platform-security
platform/policy.json                 approver groups per risk tier (must match agentctl)
platform/approvers.json              approver group / owner → GitHub team / user
platform/terraform/                  backend, providers, per-environment inputs
tools/agentctl-verify.mjs            verifier (pinned by sha256)
modules/foundry-agent/               Terraform module the bundles call
agents/                              one folder per agent (bundles)
```

## 2. Terraform state storage

One storage account per environment (or one with a container per environment). It uses Entra auth only, with no shared keys:

```bash
LOC=eastus2; RG=rg-agentctl-state
az group create -n $RG -l $LOC
for ENV in dev prod; do
  SA=stagentsstate$ENV$RANDOM
  az storage account create -n $SA -g $RG -l $LOC --sku Standard_ZRS --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access false
  az storage container create --account-name $SA -n agents --auth-mode login
  echo "$ENV → $SA"
done
```

Put the names into `platform/terraform/backend-<env>.hcl` (`resource_group_name`, `storage_account_name`, `container_name = "agents"`). Delete the `backend-test.hcl` / `test.tfvars` files, and the `agents-test` environment below, if you don't use a test environment.

## 3. Azure identities for GitHub OIDC

```bash
SUB=$(az account show --query id -o tsv)
FOUNDRY_RG=<resource group of your Foundry account>
PROJECT_ID=$(az resource list -g $FOUNDRY_RG --resource-type Microsoft.CognitiveServices/accounts/projects --query "[0].id" -o tsv)
FOUNDRY_USER=53ca6127-db72-4b80-b1b0-d745d6d5456d     # "Foundry User" built-in role (by id; the name changed over time)

az identity create -g $RG -n id-agents-read
for ENV in dev prod; do az identity create -g $RG -n id-agents-deploy-$ENV; done

# Federated credentials: GitHub environment → identity (no secrets)
fic() { az identity federated-credential create -g $RG --identity-name "$1" -n "github-$2" \
          --issuer https://token.actions.githubusercontent.com --audiences api://AzureADTokenExchange \
          --subject "repo:$REPO:environment:$2"; }
fic id-agents-read agents-read
for ENV in dev prod; do fic id-agents-deploy-$ENV agents-$ENV; done

pid() { az identity show -g $RG -n "$1" --query principalId -o tsv; }
# Read identity (drift check): read agents in the project
az role assignment create --assignee-object-id $(pid id-agents-read) --assignee-principal-type ServicePrincipal \
  --role $FOUNDRY_USER --scope $PROJECT_ID
# Deploy identities: create agent versions, RAI policies, agent identities and their roles, write state
for ENV in dev prod; do
  P=$(pid id-agents-deploy-$ENV)
  az role assignment create --assignee-object-id $P --assignee-principal-type ServicePrincipal --role $FOUNDRY_USER --scope $PROJECT_ID
  az role assignment create --assignee-object-id $P --assignee-principal-type ServicePrincipal --role Contributor \
    --scope /subscriptions/$SUB/resourceGroups/$FOUNDRY_RG
  az role assignment create --assignee-object-id $P --assignee-principal-type ServicePrincipal \
    --role "Role Based Access Control Administrator" --scope /subscriptions/$SUB/resourceGroups/$FOUNDRY_RG
  az role assignment create --assignee-object-id $P --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Contributor" --scope $(az storage account list -g $RG --query "[?contains(name,'$ENV')].id | [0]" -o tsv)
done
```

| Identity | Roles | Scope | Why |
|---|---|---|---|
| `id-agents-read` | Foundry User | project | drift check reads the live agent |
| `id-agents-deploy-<env>` | Foundry User | project | create agent versions (data plane) |
| | Contributor | Foundry resource group | per-agent managed identities, RAI policies |
| | Role Based Access Control Administrator | Foundry resource group | role assignments for agent identities from the manifest |
| | Storage Blob Data Contributor | state storage account | Terraform state |

!!! tip "Tighten for production"
    - Add a **condition** to the RBAC Administrator assignment so it can only assign the roles your agents may receive (portal → role assignment → **Conditions** → *Constrain roles*).
    - Foundry User includes data-plane write. The read identity only runs base-branch code on PRs, but you can scope it to a dedicated project per environment.

## 4. GitHub App for the approval gate

`GITHUB_TOKEN` can't read team membership, so the gate uses a small GitHub App:

1. **Settings → Developer settings → GitHub Apps → New GitHub App** (in your org).
2. Name `agents-gate-<org>`. Turn off the webhook.
3. Permissions:
   - Repository → **Pull requests: Read**;
   - Organization → **Members: Read**.
4. Create, then **Generate a private key** (downloads a `.pem`). Note the **Client ID**.
5. **Install App** → only `agents-gitops`.

```bash
gh variable set GATE_APP_CLIENT_ID --repo $REPO --body "<client id>"
gh secret   set GATE_APP_PRIVATE_KEY --repo $REPO < agents-gate.private-key.pem
rm agents-gate.private-key.pem     # don't keep it on disk
```

## 5. GitHub environments and variables

```bash
TENANT=$(az account show --query tenantId -o tsv)
cid() { az identity show -g $RG -n "$1" --query clientId -o tsv; }
gh variable set AZURE_TENANT_ID      --repo $REPO --body "$TENANT"
gh variable set AZURE_READ_CLIENT_ID --repo $REPO --body "$(cid id-agents-read)"
for E in agents-read agents-dev agents-prod; do gh api -X PUT "repos/$REPO/environments/$E" >/dev/null; done
for ENV in dev prod; do gh variable set AZURE_DEPLOY_CLIENT_ID --repo $REPO --env agents-$ENV --body "$(cid id-agents-deploy-$ENV)"; done
```

Then in **Settings → Environments → agents-prod**:
- add **required reviewers** (your release approvers);
- turn on **prevent self-review**;
- limit deployment branches to `main`.

## 6. Placeholders and policy

| File | Set |
|---|---|
| `.github/CODEOWNERS` | replace `YOUR-ORG` teams (e.g. `@<org>/agent-platform-security`) |
| `platform/approvers.json` | map approver groups and agent owners to GitHub teams / users |
| `platform/policy.json` | approver groups per risk tier. **Must equal** agentctl's `approver_groups` Terraform input |
| `platform/terraform/<env>.tfvars` | `placeholder_values` for `${...}` placeholders in agent definitions (connection ids) |

Commit these on a branch and merge them (they're platform files, so CODEOWNERS applies).

## 7. Branch protection

**Settings → Rules → Rulesets → New branch ruleset** for `main`:
- require a pull request with **1+ approvals**, **dismiss stale approvals**, and **require review from Code Owners**;
- require status check **`agent-bundle / gate`**;
- block force pushes and deletions; no bypass list.

## 8. Point agentctl at the repo

In your agentctl Terraform:

```hcl
gitops = {
  repo                = "https://github.com/<org>/agents-gitops"
  base_path           = "agents"
  agent_module_source = "../../../modules/foundry-agent"
}
approver_groups = {   # must match platform/policy.json
  read       = ["agent-owners"]
  write      = ["agent-owners", "platform-security"]
  privileged = ["agent-owners", "platform-security", "identity-admins"]
}
```

Re-apply. Bundles now name your repo, and the module path matches the template layout.

Next: [Your first change](first-change.md).
