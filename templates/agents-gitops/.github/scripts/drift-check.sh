#!/usr/bin/env bash
# Compares each bundle's declared base with what is live in Foundry, so a change built from a
# stale or hand-edited agent cannot silently overwrite it.
#   drift-check.sh <verify.json>
# Needs: az (logged in with read access to the projects, e.g. Foundry User), jq.
#   create  -> the agent must not exist yet
#   update  -> live versions.latest.metadata["agentctl.manifest_sha256"] == spec.baseManifestSha256
set -euo pipefail

report="$1"
api="${FOUNDRY_API_VERSION:-v1}"
fail=0
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
echo "## Live drift check" >>"$summary"

while read -r row; do
  dir=$(jq -r .dir <<<"$row")
  agent=$(jq -r .agent <<<"$row")
  type=$(jq -r .changeRequest.changeType <<<"$row")
  base=$(jq -r '.changeRequest.baseManifestSha256 // ""' <<<"$row")
  want=$(jq -r '.changeRequest.manifestSha256' <<<"$row")
  account=$(jq -r .foundry.account <<<"$row")
  project=$(jq -r .foundry.project <<<"$row")
  endpoint="https://${account}.services.ai.azure.com/api/projects/${project}"

  set +e
  live=$(az rest --method get --resource https://ai.azure.com \
    --url "${endpoint}/agents/${agent}?api-version=${api}" 2>/tmp/drift-err)
  rc=$?
  set -e
  if ((rc != 0)) && grep -qiE 'not ?found|404' /tmp/drift-err; then live=""; rc=0; fi
  if ((rc != 0)); then
    echo "::error file=${dir}/change-request.yaml,title=Drift check::cannot read ${agent} in ${endpoint}: $(head -c 300 /tmp/drift-err | tr '\n' ' ')"
    echo "- ❌ \`${agent}\`: Foundry lookup failed" >>"$summary"; fail=1; continue
  fi

  live_sha=""
  [[ -n "$live" ]] && live_sha=$(jq -r '.versions.latest.metadata["agentctl.manifest_sha256"] // ""' <<<"$live")
  if [[ -n "$live" && "$live_sha" == "$want" ]]; then
    echo "- ✅ \`${agent}\`: this bundle is already live (re-apply)" >>"$summary"
    continue
  fi

  if [[ "$type" == "create" ]]; then
    if [[ -n "$live" ]]; then
      echo "::error file=${dir}/change-request.yaml,title=Drift check::${agent} already exists in Foundry; submit an update built from the live agent"
      echo "- ❌ \`${agent}\`: create, but agent already exists" >>"$summary"; fail=1
    else
      echo "- ✅ \`${agent}\`: new agent" >>"$summary"
    fi
    continue
  fi

  if [[ -z "$live" ]]; then
    echo "::error file=${dir}/change-request.yaml,title=Drift check::update targets ${agent}, which does not exist in ${endpoint}"
    echo "- ❌ \`${agent}\`: update, but agent not found" >>"$summary"; fail=1; continue
  fi
  live_ver=$(jq -r '.versions.latest.version // "?"' <<<"$live")
  if [[ -z "$live_sha" ]]; then
    echo "::warning file=${dir}/change-request.yaml,title=Drift check::${agent} v${live_ver} was not deployed by agentctl (no manifest hash); reviewers must compare manually"
    echo "- ⚠️ \`${agent}\` v${live_ver}: not agentctl-managed yet" >>"$summary"
  elif [[ "$live_sha" != "$base" ]]; then
    echo "::error file=${dir}/change-request.yaml,title=Drift check::${agent} v${live_ver} changed since this bundle was built (live ${live_sha:0:12}, base ${base:0:12}); rebuild the change in agentctl"
    echo "- ❌ \`${agent}\` v${live_ver}: live ≠ base" >>"$summary"; fail=1
  else
    echo "- ✅ \`${agent}\` v${live_ver}: base matches live" >>"$summary"
  fi
done < <(jq -c '.[] | select(.ok and .changeRequest != null)' "$report")

exit "$fail"
