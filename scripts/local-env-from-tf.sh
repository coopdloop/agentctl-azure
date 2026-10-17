#!/usr/bin/env bash
# Writes app/.env.local from Terraform outputs so `npm run dev` talks to the real environment.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
terraform -chdir="$root/infra" output -raw local_env > "$root/app/.env.local"
echo "Wrote app/.env.local — run: cd app && npm run dev"
