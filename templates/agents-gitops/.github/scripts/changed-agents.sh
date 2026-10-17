#!/usr/bin/env bash
# Lists the agent folders a diff touches and classifies the change.
#   changed-agents.sh <base-sha> <head-sha> [repo-dir]
# Writes to $GITHUB_OUTPUT (or stdout):
#   agents=<json array of existing agent dirs>   deleted=<json array>   platform=<true|false>
# "platform" is true when files outside agents/ change; such PRs must not also change agents
# (the gate enforces this so platform changes always get platform-team review on their own).
set -euo pipefail

base="$1" head="$2" dir="${3:-.}"
cd "$dir"
base_path="${AGENTCTL_GITOPS_BASE_PATH:-agents}"

mapfile -t changed < <(git diff --name-only --no-renames "$base...$head")

agents=() deleted=() platform=false
declare -A seen=()
for f in "${changed[@]}"; do
  if [[ "$f" == "$base_path"/*/* ]]; then
    name="${f#"$base_path"/}"; name="${name%%/*}"
    [[ -n "${seen[$name]:-}" ]] && continue
    seen[$name]=1
    if [[ ! "$name" =~ ^[a-z][a-z0-9-]{2,62}$ ]]; then
      echo "::error::invalid agent folder name: $name" >&2; exit 1
    fi
    if [[ -d "$base_path/$name" ]]; then agents+=("$base_path/$name"); else deleted+=("$base_path/$name"); fi
  elif [[ "$f" != "$base_path/.gitkeep" ]]; then
    platform=true
  fi
done

json() { if (($#)); then printf '%s\n' "$@" | jq -R . | jq -cs .; else echo '[]'; fi; }
out="${GITHUB_OUTPUT:-/dev/stdout}"
{
  echo "agents=$(json "${agents[@]+"${agents[@]}"}")"
  echo "deleted=$(json "${deleted[@]+"${deleted[@]}"}")"
  echo "platform=$platform"
} >>"$out"
