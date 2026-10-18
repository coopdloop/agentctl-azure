# Azure App Service

A Linux App Service (Node 22) running the dependency-free server `server/server.mjs`. It serves the SPA, `/config.js` and `/proxy`. Choose it when you need **private networking** (VNet integration, private endpoints for Foundry and Log Analytics, a private inbound endpoint).

## Terraform

```hcl
module "agentctl" {
  # ...
  app_service    = { enabled = true, sku_name = "B1" }   # P0v3+ for zone redundancy
  static_web_app = { enabled = false }
  # Optional, see Private networking:
  # network = { enabled = true, app_subnet_id = "...", private_endpoint_subnet_id = "...", app_private_endpoint = true, ... }
}
```

Creates an App Service plan and web app with:
- HTTPS only, TLS 1.2, FTPS disabled, health check `/healthz`;
- HTTP logs, plus diagnostics to the workspace;
- app settings that hold the runtime configuration.

!!! warning "Quota"
    New pay-as-you-go subscriptions often have **0** App Service VM quota (`B1` and even `F1`), and the apply fails with a quota error. Request quota: portal → **Help + support** → **Service and subscription limits (quotas)** → App Service → region → SKU. Or use [Static Web Apps](static-web-app.md) meanwhile.

## Deploy a release

```bash
curl -fsSLO https://raw.githubusercontent.com/{{ repo }}/{{ version }}/scripts/deploy.sh
bash deploy.sh --target appservice --version {{ version }} --resource-group <rg> --name <web-app-name>
```

This downloads `agentctl-app.zip`, verifies it, runs `az webapp deploy --type zip`, and smoke-tests the site.

## Private networking

App Service is the hosting option that can reach private endpoints: the browser talks to the app, and the app's proxy reaches Foundry (and Log Analytics through AMPLS) inside your VNet. See [Private networking & other clouds](../ENVIRONMENTS.md) for the `network` input, DNS zones and egress requirements.
