# agents-gitops

Desired state for every agent managed by [agentctl](https://github.com/YOUR-ORG/agentctl). Each
folder under `agents/` is one agent, exactly as agentctl exported it. Merging to `main` deploys it.

```
agents/<name>/                 one bundle per agent (replace the whole folder on each change)
  manifest/agent.yaml          desired state
  manifest/base.yaml           state the change was built from (updates only)
  change-request.yaml          rationale, risk tier, required approvers, hashes
  foundry/agent-definition.json  body for POST /agents/<name>/versions
  terraform/main.tf            module call: identity, RBAC, RAI policy, agent version
  checksums.sha256
platform/                      owned by platform-security
  policy.json                  approver groups per risk tier (must match the app's AGENTCTL_APPROVERS_*)
  approvers.json               approver group / owner -> GitHub team / user
  terraform/                   backend, providers and per-environment inputs
tools/agentctl-verify.mjs      verifier built from agentctl (pinned by sha256)
modules/foundry-agent/         Terraform module the bundles call
```

## How a change flows

1. A Builder (or a Requester, as a **proposal**) exports a bundle in agentctl.
2. They push a branch with the bundle unzipped into `agents/<name>/` and open a PR.
3. **agent-bundle** workflow:
   - **verify**: checksums, schemas, manifest/base hashes, recomputed risk and approvers (a bundle
     cannot understate them), payload matches manifest, mandatory harness, and PR shape (no
     deletions, no mixing with platform files).
   - **drift**: the agent in Foundry must still match `base.yaml` (or not exist, for creates).
   - **gate**: the approvers computed by the verifier, mapped through `platform/approvers.json`,
     must have approved the latest commit. Proposals also need an approval from a current owner.
4. Merge → **deploy-agents**: re-verify, drift check, `terraform plan/apply` in the agent's
   GitHub environment (creates the new agent version), then confirm the live manifest hash.

## One-time setup

1. **Create the repo** from agentctl: `scripts/init-gitops-repo.sh ../agents-gitops`, then push
   it to GitHub (private).
2. **Replace placeholders**: `YOUR-ORG` in `.github/CODEOWNERS`; team/user mappings in
   `platform/approvers.json`; state storage in `platform/terraform/backend-*.hcl`.
3. **Azure identities** (federated credentials, no secrets):

   | Identity | Federated subject | Roles |
   |---|---|---|
   | read (`AZURE_READ_CLIENT_ID`) | `repo:ORG/agents-gitops:environment:agents-read` | Foundry User on each Foundry project |
   | deploy per env (`AZURE_DEPLOY_CLIENT_ID` in each `agents-<env>` environment) | `repo:ORG/agents-gitops:environment:agents-<env>` | Azure AI Project Manager on the project, Contributor on the agents' resource group (UAMIs, RAI policies), Role Based Access Control Administrator (constrained to the roles agents may get), Storage Blob Data Contributor on the state container |

4. **GitHub environments**: `agents-read` (no reviewers), `agents-dev`, `agents-test`,
   `agents-prod` (required reviewers, deployment branch `main` only). Set
   `AZURE_DEPLOY_CLIENT_ID` per environment; set `AZURE_TENANT_ID` and `AZURE_READ_CLIENT_ID` as
   repo variables.
5. **Gate app**: create a GitHub App with *Organization → Members: read* and *Pull requests: read*,
   install it on the repo, and set `GATE_APP_ID` (variable) and `GATE_APP_PRIVATE_KEY` (secret).
6. **Branch protection on `main`**: require PRs, require the `agent-bundle / gate` check,
   require code-owner review, dismiss stale approvals, block force pushes, and include
   administrators.
7. **agentctl app settings**: `AGENTCTL_GITOPS_REPO=ORG/agents-gitops`,
   `AGENTCTL_GITOPS_BASE_PATH=agents`, `AGENTCTL_AGENT_MODULE_SOURCE=../../../modules/foundry-agent`.

## Updating the verifier and module

Run `scripts/init-gitops-repo.sh --update <path-to-this-repo>` from agentctl, commit on a branch and
open a PR. It touches `tools/` and `modules/`, so platform-security must review it.

## Known limits

- `pull_request_review` runs the PR's copy of the workflow; CODEOWNERS on `.github/` plus the
  "no mixed PRs" rule is what stops a PR from editing its own gate.
- Decommissioning an agent (deleting its folder) is rejected by the gate. Do it as a separate,
  platform-reviewed change that runs `terraform destroy` and deletes the agent in Foundry.
- OpenAPI tools referenced by URL must be inlined before apply (`apply-agent.sh` refuses them).
