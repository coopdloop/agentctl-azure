#!/usr/bin/env bash
# Creates or updates a Foundry agent from a bundle's foundry/agent-definition.json.
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

existing_id="$(az rest --method get --resource https://ai.azure.com \
  --url "${PROJECT_ENDPOINT}/assistants?api-version=${API}&limit=100" \
  --query "data[?name=='${AGENT_NAME}'].id | [0]" -o tsv)"

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
printf '%s' "$body" > "$tmp"

if [[ -n "$existing_id" ]]; then
  echo "Updating agent ${AGENT_NAME} (${existing_id})"
  az rest --method post --resource https://ai.azure.com \
    --url "${PROJECT_ENDPOINT}/assistants/${existing_id}?api-version=${API}" --body @"$tmp" -o none
else
  echo "Creating agent ${AGENT_NAME}"
  az rest --method post --resource https://ai.azure.com \
    --url "${PROJECT_ENDPOINT}/assistants?api-version=${API}" --body @"$tmp" -o none
fi
