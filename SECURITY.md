# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub's
[private vulnerability reporting](../../security/advisories/new) for this repository, or email the
platform security team (replace with your address: security@YOUR-ORG.example).

Include affected component (app, server/proxy, CLI, Terraform, GitOps template), version or
commit, reproduction steps and impact. We acknowledge within 2 business days and aim to fix
critical issues within 7 days, high within 30 (docs/SSDLC.md §6).

## Supported versions

The latest release on `main`. Fixes are not backported.

## Scope highlights

- `/proxy` must never forward to a non-allowlisted host or add credentials.
- Users must not see data outside their Azure RBAC; data scopes must not widen access.
- Bundles must not be accepted when tampered, under-approved or drifted.

See docs/THREAT_MODEL.md for the full model.
