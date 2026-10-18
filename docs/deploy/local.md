# Run locally

## Mock mode (no Azure)

```bash
git clone https://github.com/{{ repo }}.git && cd agentctl-azure/app
npm ci
npm run dev        # http://localhost:5173
```

The mock tenant has 8 agents across 3 projects, 30 days of runs, identities, grants, guardrails, Defender posture and governance evidence. Use the account menu to simulate app roles and data-scope groups.

## Live mode against your Azure deployment

After `terraform apply` (any hosting, or none):

```bash
terraform output -raw local_env > /path/to/agentctl-azure/app/.env.local
cd /path/to/agentctl-azure/app && npm run dev
```

Switch to **Live** in the account menu and sign in. The app registration already includes `http://localhost:5173/` as a redirect URI. The dev server provides the same `/config.js` and `/proxy` as production.

!!! danger "`.env.local` is git-ignored: keep it that way"
    It contains tenant, subscription and resource IDs. They aren't secrets, but there's no reason to publish them.

## Build packages

```bash
cd app
npm ci --ignore-scripts
npm test && npm run typecheck
npm run package      # → ../artifacts/agentctl-app.zip and agentctl-swa.zip
npm run build:cli    # → ../artifacts/agentctl-verify.mjs (+ .sha256)
```

- **Sovereign clouds:** the Static Web Apps CSP is generated at package time, so set `AGENTCTL_CLOUD=AzureUSGovernment` (or `AzureChinaCloud`) when packaging.
- **Private Log Analytics:** set `AGENTCTL_PROXY_SERVICES=logAnalytics` to route queries through the proxy.
- **Deploy a local build:** `scripts/deploy.sh --target swa|appservice --local --resource-group <rg> --name <name>`.

## Seed demo agents

To see activity in a sandbox:

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/seed/requirements.txt
.venv/bin/python scripts/seed/seed_agents_v2.py --endpoint "<project endpoint>" \
  --appinsights "$(az monitor app-insights component show -g <rg> -a <appi-name> --query connectionString -o tsv)"
```
