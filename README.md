# agentctl: Agentic Platform Control Plane

A frontend-only control plane for Azure AI Foundry agents. It shows agent activity, who uses agents and with what authority (delegated, OBO, app-only, MI, Entra Agent ID), and guardrail posture. It also lets you register new agents and inject extra tools, instructions and guardrails into existing ones as reviewable **GitOps bundles**.

- **Spec:** [`docs/SPEC.md`](docs/SPEC.md)
- **App:** [`app/`](app): React + Vite + Fluent UI v9, MSAL, mock/live data sources
- **Infra:** [`infra/`](infra): minimal `main.tf` + `terraform.tfvars.example`, calling [`modules/agentctl`](infra/modules/agentctl); bundles call [`modules/foundry-agent`](infra/modules/foundry-agent)
- **GitOps repo template:** [`templates/agents-gitops/`](templates/agents-gitops): PR gate (verify, live drift check, approval gate) and deploy workflow for GitHub Actions. Create the repo with `scripts/init-gitops-repo.sh ../agents-gitops`

## Run locally (mock data, no Azure needed)

```bash
cd app
npm install
npm run dev          # http://localhost:5173
```

The mock tenant has 8 agents across 3 Foundry projects, 30 days of runs, identities, grants, RAI policies and policy states, with deliberate findings to fix. Use the account menu (top right) to simulate app roles (Reader/Builder/Approver/Admin).

Try the full loop:
1. Open **Guardrails → Findings** and click **Fix** on a finding. Harness injection opens with the fix applied.
2. Go to **Review & export** and download the bundle zip.
3. As an Approver, open **Review bundle** and drop the zip in. The checks re-run independently.

## Run locally against Azure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # set subscription/tenant, existing Foundry accounts, groups
terraform init && terraform apply
../scripts/local-env-from-tf.sh                  # writes app/.env.local from outputs
cd ../app && npm run dev                         # switch to "Live" in the account menu
```

Or fill in `app/.env.local` by hand from `app/.env.example`.

## Deploy to App Service

```bash
scripts/deploy-app.sh    # npm ci, build, package (dist + zero-dependency server), az webapp deploy
```

## Tests and checks

```bash
cd app && npm test       # schema, risk engine, bundle build and verify, tamper detection, proxy allowlist
npm run build            # typecheck + production build
cd ../infra && terraform validate
```

## Repository layout

```
app/
  server/            config.mjs (/config.js), proxy.mjs (allowlisted /proxy), server.mjs (App Service)
  scripts/           gen-validators.mjs (precompiled JSON Schema), package-app.mjs
  src/
    api/             DataSource interface; mock/ (seeded tenant); live/ (ARM, Graph, Log Analytics/KQL, Foundry)
    auth/            MSAL (per-audience tokens), session + app roles
    schema/          agent + change-request JSON Schemas, TS types, validators
    bundle/          change detection, risk/approvals, Foundry payload, Terraform generation, zip, verify
    lib/             harness library, findings engine, manifest defaults/mapping
    pages/           Overview, Agents, AgentDetail, Activity, Identity, Guardrails, Harness, Review, Settings, builder/
infra/
  main.tf, variables.tf, terraform.tfvars.example
  modules/agentctl/        App Service, Entra app + roles, LAW/App Insights, Foundry (optional), diagnostics, RBAC
  modules/foundry-agent/   per-agent identity, RBAC, RAI policy, optional data-plane apply
app/cli/agentctl-verify.ts  bundle verifier CLI for the pipeline (npm run build:cli → artifacts/)
templates/agents-gitops/   GitOps repo template (workflows, approval mapping, platform Terraform)
scripts/                   deploy-app.sh, local-env-from-tf.sh, init-gitops-repo.sh
docs/SPEC.md
```

## Moving into your infra repo

Copy `infra/modules/agentctl` and `infra/modules/foundry-agent`, then call `agentctl` with the inputs from `terraform.tfvars.example`. Every dependency (resource group, Log Analytics, App Insights, Foundry) has a `create` / `existing_id` switch. Set `gitops.agent_module_source` to wherever `foundry-agent` ends up, so generated bundles reference it.
