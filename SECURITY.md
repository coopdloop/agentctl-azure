# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's
[private vulnerability reporting](https://github.com/coopdloop/agentctl-azure/security/advisories/new).

Include:
- the affected component (SPA, server/proxy, Static Web Apps functions, CLI, Terraform, GitOps template);
- the version or commit;
- reproduction steps and impact.

We acknowledge within 2 business days and aim to fix critical issues within 7 days and high within 30
(see the [SSDLC](https://coopdloop.github.io/agentctl-azure/SSDLC/)).

## Supported versions

The latest release. Fixes are not backported before 1.0.

## Scope highlights

- The proxy (`/proxy`, `/api/proxy`) must never forward to a non-allowlisted host or add credentials.
- Users must not see data outside their Azure RBAC; data scopes must not widen access.
- Bundles must not be accepted when tampered with, under-approved or drifted.
- Release artifacts must verify against their build-provenance attestation.

See the [threat model](https://coopdloop.github.io/agentctl-azure/THREAT_MODEL/).

## Never commit secrets

- `terraform.tfstate*` and `*.tfvars` contain tenant data and secrets.
- `.env*` files hold local configuration.
- Static Web Apps deployment tokens are credentials.

`.gitignore`, gitleaks (CI and pre-commit) and GitHub push protection guard against these; keep them enabled.
