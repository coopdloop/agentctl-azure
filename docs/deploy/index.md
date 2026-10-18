# Deploy

agentctl ships as a **GitHub release** containing prebuilt, attested packages. Terraform builds the Azure side from the module at the same release tag. You never build from source unless you want to.

## Hosting options

| | Azure Static Web Apps | Azure App Service | Local |
|---|---|---|---|
| Package | `agentctl-swa.zip` | `agentctl-app.zip` | source (`npm run dev`) |
| Runtime | static SPA + 2 managed functions (`/api/config`, `/api/proxy`) | Linux, Node 22, zero-dependency server | Vite dev server |
| Cost | **Free** tier $0 (Standard ~$9/month) | B1 ~$13/month and up | $0 |
| Quota | none | needs App Service VM quota (often 0 on new PAYG subscriptions) | none |
| Private Foundry / Log Analytics | ✗ (managed functions can't join a VNet) | ✓ VNet integration, private inbound endpoint | needs VPN line of sight |
| Sovereign clouds | ✓ (package built per cloud) | ✓ | ✓ |
| Terraform switch | `static_web_app = { enabled = true }` | `app_service = { enabled = true }` | both off |
| Guide | [Static Web Apps](static-web-app.md) | [App Service](app-service.md) | [Run locally](local.md) |

!!! tip "Which one?"
    Start with **Static Web Apps**. Move to App Service when Foundry or Log Analytics goes behind private endpoints ([Private networking](../ENVIRONMENTS.md)). Both run the same app and proxy code; only the hosting differs.

## Release assets

Each release `vX.Y.Z` on [GitHub Releases]({{ repo_url }}/releases) contains:

| Asset | What |
|---|---|
| `agentctl-swa.zip` | Static Web Apps package: `app/` (SPA + `staticwebapp.config.json` with CSP) and `api/` (managed functions) |
| `agentctl-app.zip` | App Service package: SPA + `server/` |
| `agents-gitops-template.zip` | Ready-to-push template for your private agents repo (workflows, verifier, agent module) |
| `agentctl-verify.mjs` (+ `.sha256`) | Bundle verifier CLI used by the agents pipeline |
| `agentctl-sbom.cdx.json` | CycloneDX SBOM |
| `SHA256SUMS` | Checksums of all assets |

Every package carries a **build provenance attestation** (SLSA). `scripts/deploy.sh` verifies the checksum and, when the GitHub CLI is signed in, the attestation:

```bash
gh attestation verify agentctl-swa.zip --repo {{ repo }}
```

Next:
- the [Quickstart](quickstart.md) for a new standalone deployment; or
- [Add to existing Terraform](existing-terraform.md) to wire agentctl into an infra repo you already have.
