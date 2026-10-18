# Azure Static Web Apps

The default hosting: the SPA as static content, plus two **managed functions** with no npm dependencies:

| Route | Function | Does |
|---|---|---|
| `/config.js` → `/api/config` | `config` | Renders runtime configuration from the Static Web App's application settings (no secrets) |
| `/api/proxy/<host>/<path>` | `proxy` | Allowlisted pass-through to Foundry (no browser CORS). Forwards the user's bearer token and adds none |

The SPA calls `/api/proxy` automatically: the config function sets `AGENTCTL_PROXY_BASE=/api/proxy`. Security headers (CSP, `X-Frame-Options`, `nosniff`, referrer policy) come from `staticwebapp.config.json` inside the package.

## Terraform

```hcl
module "agentctl" {
  # ...
  static_web_app = {
    enabled  = true
    sku_tier = "Free"     # or "Standard" (custom domains with SLA, private endpoint, larger limits)
    location = "eastus2"  # Static Web Apps regions: westus2, centralus, eastus2, westeurope, eastasia
  }
  app_service = { enabled = false }
}
```

Terraform creates the Static Web App, applies the app settings (separately, so the app registration can use the generated hostname as a redirect URI), and adds `https://<name>.azurestaticapps.net/` to the app registration.

## Deploy a release

```bash
curl -fsSLO https://raw.githubusercontent.com/{{ repo }}/{{ version }}/scripts/deploy.sh
bash deploy.sh --target swa --version {{ version }} \
  --resource-group <rg> --name <static-web-app-name>
```

The script:
1. downloads `agentctl-swa.zip` and `SHA256SUMS` from the release, and verifies the checksum;
2. verifies the build provenance with `gh attestation verify` (when the GitHub CLI is signed in);
3. reads the deployment token with `az staticwebapp secrets list` (needs Contributor on the Static Web App);
4. deploys `app/` and `api/` with `npx @azure/static-web-apps-cli@2 deploy --env production`;
5. smoke-tests `/config.js`.

??? note "Manual deploy (without the script)"
    ```bash
    curl -fsSLO https://github.com/{{ repo }}/releases/download/{{ version }}/agentctl-swa.zip
    curl -fsSLO https://github.com/{{ repo }}/releases/download/{{ version }}/SHA256SUMS
    grep agentctl-swa.zip SHA256SUMS | sha256sum -c -
    unzip agentctl-swa.zip -d agentctl-swa
    TOKEN=$(az staticwebapp secrets list -g <rg> -n <name> --query properties.apiKey -o tsv)
    SWA_CLI_DEPLOYMENT_TOKEN=$TOKEN npx --yes @azure/static-web-apps-cli@2 deploy agentctl-swa/app \
      --api-location agentctl-swa/api --api-language node --api-version 20 --env production
    ```

## Custom domain

Add it on the Static Web App (portal → **Custom domains**, or `az staticwebapp hostname set`). Then add `https://<your-domain>/` to the app registration's SPA redirect URIs, via `local_dev_redirect_uris` or the portal.

## Limits and caveats

- **No VNet integration** for managed functions: Foundry and Log Analytics must be reachable publicly. Use [App Service](app-service.md) for private endpoints.
- **Request limits** of managed functions (about 45 s timeout, modest body sizes) are far above what agentctl's proxy calls need.
- **Sovereign clouds:** the CSP is static. Build the package yourself with `AGENTCTL_CLOUD=AzureUSGovernment npm run package` ([Run locally](local.md#build-packages)).
- **The deployment token** is a secret. The script reads it on the fly and never writes it to disk. Rotate it with `az staticwebapp secrets reset-api-key` if it leaks.
