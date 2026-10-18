#!/usr/bin/env bash
# Kept for compatibility: builds locally and deploys to App Service. Prefer scripts/deploy.sh.
exec "$(dirname "$0")/deploy.sh" --target appservice --local "$@"
