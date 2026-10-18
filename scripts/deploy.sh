#!/usr/bin/env bash
# Deploys agentctl to the hosting created by Terraform, from a published GitHub release (default)
# or from a local build.
#
#   scripts/deploy.sh --target swa|appservice [--version vX.Y.Z|latest] [--local] [--repo OWNER/REPO]
#                     [--resource-group RG --name NAME]
#
# Resource group / app name default to `terraform output` in ./infra. Release assets are verified
# with SHA256SUMS and, if the GitHub CLI is available, `gh attestation verify` (build provenance).
# Requires: az (logged in), curl, unzip; npx for Static Web Apps; gh optional.
set -euo pipefail

target="" version="latest" local_build=false repo="${AGENTCTL_REPO:-coopdloop/agentctl-azure}" rg="" name=""
while (($#)); do
  case "$1" in
    --target) target="$2"; shift 2 ;;
    --version) version="$2"; shift 2 ;;
    --local) local_build=true; shift ;;
    --repo) repo="$2"; shift 2 ;;
    --resource-group) rg="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
[[ "$target" == "swa" || "$target" == "appservice" ]] || { echo "--target swa|appservice is required" >&2; exit 2; }
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "invalid --repo" >&2; exit 2; }

root="$(cd "$(dirname "$0")/.." && pwd)"
tf() { terraform -chdir="$root/infra" output -raw "$1" 2>/dev/null || true; }
rg="${rg:-$(tf resource_group_name)}"
if [[ "$target" == "swa" ]]; then name="${name:-$(tf static_web_app_name)}"; asset="agentctl-swa.zip"; else name="${name:-$(tf web_app_name)}"; asset="agentctl-app.zip"; fi
[[ -n "$rg" && -n "$name" ]] || { echo "resource group / app name unknown: pass --resource-group and --name, or run from a repo with infra state" >&2; exit 2; }

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT

if $local_build; then
  (cd "$root/app" && npm ci --ignore-scripts && npm run package)
  cp "$root/artifacts/$asset" "$work/"
  echo "Built $asset locally"
else
  if [[ "$version" == "latest" ]]; then
    version="$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)"
    [[ -n "$version" ]] || { echo "no published release found for $repo" >&2; exit 1; }
  fi
  [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "invalid version $version" >&2; exit 2; }
  base="https://github.com/$repo/releases/download/$version"
  echo "Downloading $asset $version from $repo"
  curl -fsSL -o "$work/$asset" "$base/$asset"
  curl -fsSL -o "$work/SHA256SUMS" "$base/SHA256SUMS"
  (cd "$work" && grep " $asset\$" SHA256SUMS | sha256sum -c - 2>/dev/null || grep " $asset\$" SHA256SUMS | shasum -a 256 -c -)
  if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    gh attestation verify "$work/$asset" --repo "$repo" --signer-workflow "$repo/.github/workflows/release.yml"
  else
    echo "note: GitHub CLI not signed in; skipped provenance verification (checksum verified)"
  fi
fi

if [[ "$target" == "appservice" ]]; then
  az webapp deploy --resource-group "$rg" --name "$name" --src-path "$work/$asset" --type zip --async false
  host="$(az webapp show -g "$rg" -n "$name" --query defaultHostName -o tsv)"
else
  (cd "$work" && unzip -q "$asset")
  token=""
  for attempt in 1 2 3; do
    token="$(az staticwebapp secrets list -g "$rg" -n "$name" --query properties.apiKey -o tsv 2>/dev/null)" && [[ -n "$token" ]] && break
    echo "retrying deployment token lookup ($attempt)…" >&2; sleep $((attempt * 5))
  done
  [[ -n "$token" ]] || { echo "could not read the Static Web App deployment token (needs Contributor on $name)" >&2; exit 1; }
  # Static Web Apps CLI uploads the prebuilt app and the dependency-free functions.
  SWA_CLI_DEPLOYMENT_TOKEN="$token" npx --yes @azure/static-web-apps-cli@2 deploy "$work/app" \
    --api-location "$work/api" --api-language node --api-version 20 --env production
  host="$(az staticwebapp show -g "$rg" -n "$name" --query defaultHostname -o tsv)"
fi

echo "Smoke test https://$host"
for i in 1 2 3 4 5 6; do curl -fsS -o /dev/null "https://$host/config.js" && break; sleep 10; done
curl -fsS "https://$host/config.js" | grep -q "__AGENTCTL_CONFIG__" && echo "OK: https://$host"
