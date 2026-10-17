#!/usr/bin/env bash
# Creates a new Foundry agent version from a bundle's foundry/agent-definition.json (agents API).
# Requires: az (logged in as an identity with Azure AI User/Project Manager on the project), jq.
set -euo pipefail

: "${PROJECT_ENDPOINT:?}" "${DEFINITION_PATH:?}" "${AGENT_NAME:?}"
API="${FOUNDRY_API_VERSION:-v1}"
PLACEHOLDERS_JSON="${PLACEHOLDERS_JSON:-{\}}"

body="$(cat "$DEFINITION_PATH")"

# Substitute ${key} placeholders from PLACEHOLDERS_JSON.
for key in $(jq -r 'keys[]' <<<"$PLACEHOLDERS_JSON"); do
  val="$(jq -r --arg k "$key" '.[$k]' <<<"$PLACEHOLDERS_JSON")"
  body="${body//\$\{$key\}/$val}"
done

if grep -q '\${' <<<"$body"; then
  echo "Unresolved placeholders remain in $DEFINITION_PATH:" >&2
  grep -o '\${[^}]*}' <<<"$body" | sort -u >&2
  exit 1
fi
if jq -e '.. | objects | select(has("$resolve"))' <<<"$body" >/dev/null; then
  echo "OpenAPI specs referenced by URL must be resolved inline by the pipeline before apply." >&2
  exit 1
fi

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
printf '%s' "$body" > "$tmp"

# Agents API: every apply creates a new immutable version (the agent is created on first version).
echo "Creating new version of agent ${AGENT_NAME}"
az rest --method post --resource https://ai.azure.com \
  --url "${PROJECT_ENDPOINT}/agents/${AGENT_NAME}/versions?api-version=${API}" --body @"$tmp" \
  --query "{name:name,version:version,status:status}" -o json
