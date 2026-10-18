#!/usr/bin/env bash
# Creates (or refreshes) the agents-gitops repo from templates/agents-gitops.
#   scripts/init-gitops-repo.sh <dest-dir>            new repo: template + verifier + agent module, git init
#   scripts/init-gitops-repo.sh --update <dest-dir>   refresh tools/ and modules/ only (open a PR with the result)
set -euo pipefail

update=false git_init=true
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --update) update=true ;;
    --no-git) git_init=false ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
dest="${1:?usage: init-gitops-repo.sh [--update] <dest-dir>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

(cd "$root/app" && npm run --silent build:cli)

if ! $update; then
  if [[ -e "$dest" && -n "$(ls -A "$dest" 2>/dev/null)" ]]; then echo "$dest exists and is not empty (use --update)" >&2; exit 1; fi
  mkdir -p "$dest"
  cp -R "$root/templates/agents-gitops/." "$dest/"
fi

mkdir -p "$dest/tools" "$dest/modules"
cp "$root/artifacts/agentctl-verify.mjs" "$root/artifacts/agentctl-verify.mjs.sha256" "$dest/tools/"
rm -rf "$dest/modules/foundry-agent"
cp -R "$root/infra/modules/foundry-agent" "$dest/modules/foundry-agent"
rm -rf "$dest/modules/foundry-agent/.terraform"
src_rev="$(git -C "$root" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "agentctl@${src_rev}" > "$dest/tools/SOURCE"

if ! $update && $git_init; then
  git -C "$dest" init -q -b main
  git -C "$dest" add -A
  echo "Initialised $dest from agentctl@${src_rev}. Review, commit, then push to GitHub (see README.md)."
elif $update; then
  echo "Refreshed tools/ and modules/ from agentctl@${src_rev}. Commit on a branch and open a PR."
else
  echo "Wrote template to $dest (no git repo)."
fi
