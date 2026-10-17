## What and why

<!-- One paragraph. Link the issue. -->

## Security checklist (docs/SSDLC.md)

- [ ] No secrets, tokens, tenant/subscription ids or personal data in code, tests or fixtures
- [ ] Touches auth, scoping, the proxy, CSP, bundle integrity, workflows or IaC identities? → threat model reviewed (docs/THREAT_MODEL.md) and updated if the attack surface changed
- [ ] New Azure permission, Graph scope or role assignment? → least privilege justified below and docs/ACCESS.md updated
- [ ] New dependency? → needed, maintained, licence OK; pinned via lockfile
- [ ] New third-party GitHub Action? → pinned to a commit SHA (`node scripts/pin-actions.mjs`)
- [ ] Tests added/updated; `npm test`, `npm run typecheck`, `terraform validate` pass locally

## Permissions / data impact

<!-- None, or: what new access, to what data, for whom. -->
