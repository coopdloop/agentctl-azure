#!/usr/bin/env bash
# Builds the SPA and zip-deploys it to the App Service created by Terraform.
# Usage: scripts/deploy-app.sh   (reads names from `terraform output` in infra/)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

rg="$(terraform -chdir="$root/infra" output -raw resource_group_name)"
app="$(terraform -chdir="$root/infra" output -raw web_app_name)"

(cd "$root/app" && npm ci && npm run package)
az webapp deploy --resource-group "$rg" --name "$app" --src-path "$root/artifacts/agentctl-app.zip" --type zip
echo "Deployed: $(terraform -chdir="$root/infra" output -raw app_url)"
