# agentctl for Azure

[![ci](https://github.com/coopdloop/agentctl-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/coopdloop/agentctl-azure/actions/workflows/ci.yml)
[![codeql](https://github.com/coopdloop/agentctl-azure/actions/workflows/codeql.yml/badge.svg)](https://github.com/coopdloop/agentctl-azure/actions/workflows/codeql.yml)
[![docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://coopdloop.github.io/agentctl-azure/)

**An agent control plane for Azure AI Foundry.**
- **See** every agent, who uses it and with what authority.
- **Check** every agent against 50 AI risk controls (OWASP LLM & Agentic Top 10, NIST AI RMF, ISO/IEC 42001, EU AI Act, MITRE ATLAS, Microsoft Cloud Security Benchmark).
- **Change** agents safely through GitOps.

**Documentation:** [coopdloop.github.io/agentctl-azure](https://coopdloop.github.io/agentctl-azure/)
- [Quickstart: deploy the latest release with Owner on one subscription](https://coopdloop.github.io/agentctl-azure/deploy/quickstart/)
- [Permissions](https://coopdloop.github.io/agentctl-azure/getting-started/permissions/) · [Azure components](https://coopdloop.github.io/agentctl-azure/getting-started/azure-components/)
- [Set up your private agents GitOps repo](https://coopdloop.github.io/agentctl-azure/gitops/setup/)

## Highlights

- **Credential-less.** The browser calls Azure with the signed-in user's own token. The host only serves files, runtime config, and an allowlisted pass-through for Foundry (which has no CORS).
- **Observe:**
  - agents across subscriptions (Resource Graph);
  - runs, tools and tokens from App Insights;
  - auth flows (delegated, on-behalf-of, app-only, managed identity, Entra Agent ID).
- **Govern:**
  - guardrails, Azure Policy and Defender for AI;
  - findings with fixes;
  - **Risk & compliance** scores per framework and per agent, with an evidence export and an AI bill of materials.
- **Change through GitOps:**
  - the builder and *harness injection* produce verifiable bundles;
  - a private agents repo (from the release template) verifies, drift-checks, approval-gates and deploys them with OIDC.
- **Scoped access:** app roles plus data scopes enforced by Azure RBAC.
- **Deploy anywhere:**
  - Azure Static Web Apps (free) or App Service;
  - multiple subscriptions, private networking (VNet, private endpoints, AMPLS), sovereign cloud profiles.

## Quick look (no Azure needed)

```bash
git clone https://github.com/coopdloop/agentctl-azure.git
cd agentctl-azure/app && npm ci && npm run dev    # http://localhost:5173, mock tenant
```

## Repository layout

```
app/                       SPA (React, Fluent UI), server/ (App Service), swa/api/ (Static Web Apps functions), cli/ (bundle verifier)
infra/                     Terraform root + modules/agentctl (platform) and modules/foundry-agent (per agent)
templates/agents-gitops/   template for your private agents repo (published as a release asset)
docs/                      documentation site (MkDocs Material → GitHub Pages)
reports/, research_notes/  AI risk frameworks research behind the controls catalog
scripts/                   deploy.sh, init-gitops-repo.sh, pin-actions.mjs, gen-terraform-docs.py, seed/ (demo agents)
.github/                   CI, CodeQL, release (attested), deploy, docs, scorecard
```

## Development

```bash
cd app && npm ci --ignore-scripts
npm test && npm run typecheck && npm run build
npm run package             # ../artifacts/agentctl-app.zip + agentctl-swa.zip
cd ../infra && terraform init -backend=false && terraform validate
pip install -r docs/requirements.txt && mkdocs serve     # docs at http://localhost:8000
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md) and the [SSDLC](https://coopdloop.github.io/agentctl-azure/SSDLC/).

## Status

Pre-1.0. Validated end to end on the public Azure cloud. Foundry agent APIs and several Microsoft signals used by the controls are preview (marked in the docs). Not an official Microsoft product.
