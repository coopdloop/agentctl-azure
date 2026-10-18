# Contributing

Thanks for helping. Before a large change, open an issue to agree on the approach.

## Workflow

1. Fork and branch from `main`.
2. `cd app && npm ci --ignore-scripts`.
3. Make the change with tests. Then run:
   ```bash
   npm test && npm run typecheck && npm run build
   cd ../infra && terraform fmt -recursive && terraform init -backend=false && terraform validate
   node scripts/pin-actions.mjs --check          # if you touched workflows
   python3 scripts/gen-terraform-docs.py         # if you changed module inputs
   ```
4. Open a PR and fill in the template. CI (tests, CodeQL, Semgrep, Trivy, Checkov, gitleaks) must pass.

## Guidelines

- **No secrets or tenant data**: no real tenant/subscription/object ids, emails or tokens in code, fixtures or docs. Use `contoso.example` and zero GUIDs.
- **No new credentials in the app**: all Azure access stays on the signed-in user's token.
- **New third-party GitHub Actions** must be pinned to a commit SHA (`node scripts/pin-actions.mjs`).
- **New dependencies** need a reason. The production servers (`app/server`, `app/swa/api`) stay dependency-free.
- **Security-relevant changes** (auth, scoping, proxy, CSP, bundle integrity, workflows, IaC identities) update `docs/THREAT_MODEL.md` when the attack surface changes.
- **Docs** live in `docs/` (MkDocs). Preview them with `mkdocs serve`.
