# agentctl secure software development lifecycle (SSDLC)

How agentctl is built, tested, released and operated securely. It is aligned to the **NIST Secure
Software Development Framework (SSDF, SP 800-218)** practice groups (§10). agentctl governs AI
agents, so it is itself a high-value target: it shapes agent instructions, tools and identities,
and its users can read sensitive telemetry.

Threats and mitigations: [THREAT_MODEL.md](THREAT_MODEL.md). Reporting: [SECURITY.md](../SECURITY.md).

## 1. Principles

1. **No credentials in agentctl.** Every Azure call uses the signed-in user's token, CI/CD uses OIDC federation, and the app holds no secrets.
2. **Azure enforces data access; the UI only narrows it.** UI role and scope checks are a convenience, never the only control.
3. **Changes to agents go through GitOps.** agentctl produces bundles; the agents-gitops pipeline verifies, approves and applies them.
4. **Everything is pinned and verifiable:** lockfile, action SHAs, Terraform provider constraints, build provenance.
5. **Exceptions are explicit, justified and reviewed:** inline `nosemgrep` / `checkov:skip` with a reason, owned by platform-security in CODEOWNERS.

## 2. Roles

| Role | Responsibilities |
|---|---|
| Maintainers (`agentctl-maintainers`) | Code review, triage, releases |
| Platform security (`platform-security`) | Review of security-sensitive paths (CODEOWNERS), exceptions, threat model, incident handling |
| Release approvers | Approve the `agentctl-prod` deployment environment |
| Agent owners / approvers | Approve agent bundles in agents-gitops (separate repo, separate gate) |

## 3. Repository controls (GitHub settings)

Set these on the agentctl repo. They can't be expressed in code, so the checklist is the evidence.

- [ ] **Branch protection on `main`:**
  - require PRs;
  - require 1 approval (2 for paths owned by platform-security) and code-owner review;
  - dismiss stale approvals;
  - require conversation resolution;
  - require linear history;
  - block force pushes and deletions;
  - include administrators.
- [ ] **Required status checks:**
  - `ci / app`, `ci / terraform`, `ci / iac scan`, `ci / sast`, `ci / secrets`, `ci / supply chain`, `ci / dependency review`;
  - `codeql / analyze (javascript-typescript)` and `codeql / analyze (actions)`.
- [ ] **Signed commits** required (SSH or gitsign).
- [ ] **Security features:**
  - secret scanning and push protection;
  - Dependabot alerts and security updates;
  - private vulnerability reporting;
  - code scanning default alerts.
- [ ] **Actions:**
  - allow only GitHub-owned and verified actions plus this list: `aquasecurity/*`, `bridgecrewio/*`, `anchore/*`, `hashicorp/*`, `terraform-linters/*`, `azure/*`, `ossf/*`;
  - require SHA pinning;
  - default `GITHUB_TOKEN` permission **read**;
  - don't let Actions approve PRs.
- [ ] **Environments:**
  - `agentctl-dev`: deployment branches `main` and tags;
  - `agentctl-prod`: tags only, 1+ required reviewers, prevent self-review, wait timer optional.
- [ ] **Tag protection / rulesets:** only release approvers create `v*` tags.

## 4. CI gates (`.github/workflows/ci.yml`, `codeql.yml`)

| Job | Tools | Blocks merge on |
|---|---|---|
| app | `npm ci --ignore-scripts`, `npm audit`, `tsc`, vitest, vite build, verifier CLI build, generated-code drift check | high/critical advisories, any type or test failure, stale generated validators |
| terraform | `terraform fmt`, `validate` (all 4 roots), tflint + azurerm ruleset | formatting, invalid config, lint errors |
| iac scan | Trivy (vuln, misconfig, secret), Checkov (Terraform + Actions) → code scanning | HIGH/CRITICAL (Trivy); failed Checkov checks |
| sast | Semgrep (default, TypeScript, React, Node, Terraform, GitHub Actions, secrets) → code scanning | ERROR severity |
| codeql | CodeQL `security-extended` for JS/TS and Actions | code scanning alerts per repo settings |
| secrets | gitleaks over the full git history | any finding |
| supply chain | `scripts/pin-actions.mjs --check`, SBOM (CycloneDX via Syft) | unpinned third-party actions |
| dependency review | GitHub dependency review | moderate+ advisories, AGPL/GPL-3.0 licences in new deps |
| scorecard (weekly) | OpenSSF Scorecard → code scanning | report only |

**Local equivalents:**
- `cd app && npm test && npm run typecheck && npm run build`;
- `terraform -chdir=infra validate`;
- `node scripts/pin-actions.mjs --check`;
- optional `pre-commit install` (gitleaks, terraform fmt, action pinning).

## 5. Dependencies and supply chain

- **npm:**
  - lockfile committed;
  - `npm ci --ignore-scripts` in CI (no dependency install hooks run);
  - `allowScripts` in `package.json` documents the only package allowed to run install scripts locally.
- **The SPA bundles every dependency**, so dev dependencies count: `npm audit` runs without `--omit=dev`.
- **The production server has zero npm dependencies** (`app/server/*.mjs`), which keeps the App Service runtime surface minimal.
- **Dependabot:** weekly, with a **7-day cooldown** so new releases age before adoption (limits exposure to compromised or malicious releases), grouped updates, and coverage of npm, GitHub Actions, Terraform and pip.
- **GitHub Actions:**
  - every third-party action is pinned to a full commit SHA with the version in a comment (`scripts/pin-actions.mjs`), and CI fails on unpinned actions;
  - jobs declare least-privilege `permissions` and `persist-credentials: false`.
- **Terraform:** provider version constraints in every root; `.terraform.lock.hcl` is committed in real infra repos.
- **SBOM:** CycloneDX on every CI run and attached to each release.
- **Provenance:**
  - releases are attested with `actions/attest-build-provenance` (SLSA build level 2) plus an SBOM attestation;
  - `deploy.yml` runs `gh attestation verify` against `release.yml` before deploying;
  - the agents-gitops repo pins `agentctl-verify.mjs` by sha256.

## 6. Vulnerability management

| Severity | Fix SLA (from triage) | Notes |
|---|---|---|
| Critical | 7 days | Hotfix release; consider rolling back or disabling the affected feature |
| High | 30 days | |
| Medium | 90 days | |
| Low | Best effort | |

- **Sources:** Dependabot, code scanning (CodeQL, Semgrep, Checkov, Trivy), private vulnerability reports, the OpenSSF Scorecard, pen tests.
- **Exceptions:** inline suppressions must state the reason. platform-security owns them via CODEOWNERS and reviews them quarterly (`git grep -nE "nosemgrep|checkov:skip"`).
- **Dev-only advisories** (dev server, test runner) are still fixed within SLA, because developers run them against live tenants.

## 7. Secrets

- **The app has none.** `/config.js` contains only public identifiers (tenant, client and resource ids).
- **CI/CD:**
  - Azure via OIDC federated credentials scoped to GitHub environments;
  - the GitOps gate uses a GitHub App private key in a repo secret;
  - no PATs.
- **Detection:** gitleaks in CI (full history), GitHub secret scanning and push protection, Trivy secret scanning.
- **Terraform state contains secrets** (e.g. the App Insights connection string, connection credentials). Keep state in a remote backend (Azure Storage with Entra auth, `use_azuread_auth`, no shared keys, versioning, private endpoint in production), never on laptops or in git. `*.tfstate` is git-ignored as a backstop.

## 8. Build, release and deploy

1. **PR:** all CI gates green, plus code-owner review.
2. **Merge to `main`.**
3. **Tag `vX.Y.Z`** (release approvers only). `release.yml` then:
   - builds once;
   - runs `npm audit` and the tests;
   - packages `agentctl-app.zip` and `agentctl-verify.mjs`;
   - generates the SBOM;
   - attests provenance and the SBOM;
   - publishes a GitHub release with `SHA256SUMS`.
4. **Deploy** (`deploy.yml`): on release (dev), or dispatched for prod, gated by environment reviewers. It:
   - downloads the release asset;
   - checks the sha256 and verifies the provenance attestation;
   - signs in to Azure with OIDC;
   - runs `az webapp deploy`;
   - smoke-tests `/healthz` and that the CSP header is present.
5. **Infrastructure:** the Terraform module is consumed from your infra repo, which runs its own plan/apply pipeline (plan on PR, apply on merge with environment approval). This repo runs `validate` / lint / scan only.

**Rollback:** redeploy the previous tag (`deploy.yml`, input `tag`).

## 9. Threat modeling and security testing

- **Threat model:** [THREAT_MODEL.md](THREAT_MODEL.md) (STRIDE per component and trust boundary). Update it when a PR changes:
  - authentication, scoping or the proxy;
  - CSP or runtime config;
  - bundle integrity or GitOps gates;
  - workflows or IaC identities.

  The PR template asks for this. Review the whole model at least every 6 months.
- **Security unit tests:**
  - proxy allowlist (exact host vs suffix, bare suffix rejected);
  - cloud endpoint overrides (https only);
  - CSP `connect-src` derivation;
  - scoped data source;
  - glob escaping and fail-closed;
  - bundle tamper detection and under-declared risk;
  - KQL escaping.
- **Before each major release:** a manual review of the proxy and scoping, plus a DAST baseline (e.g. OWASP ZAP baseline against a dev deployment).
- **Annually:** an independent pen test of the deployed app and the GitOps pipeline.

## 10. NIST SSDF mapping

| SSDF practice | Implementation |
|---|---|
| PO.1 Define security requirements | THREAT_MODEL.md, ACCESS.md, SECURITY.md scope; agent bundle policy (`platform/policy.json`) |
| PO.2 Roles and responsibilities | §2, CODEOWNERS |
| PO.3 Supporting toolchains | CI gates (§4), pre-commit, pinned toolchain versions |
| PO.4 Security check criteria | Gating policy (§4), SLAs (§6) |
| PO.5 Secure environments | OIDC, environments with reviewers, least-privilege workflow permissions |
| PS.1 Protect code | Branch protection, signed commits, CODEOWNERS, secret scanning (§3, §7) |
| PS.2 Release integrity | Provenance + SBOM attestations, SHA256SUMS, verify-before-deploy (§5, §8) |
| PS.3 Archive releases | GitHub releases with SBOM |
| PW.1 Secure design | Threat model; credential-less architecture; strict CSP; allowlisted proxy |
| PW.4 Reuse well-secured software | Dependency review, Dependabot cooldown, zero-dependency server |
| PW.5 Secure coding | TypeScript strict, schema validation (Ajv precompiled, no eval), KQL escaping |
| PW.6 Build configuration | Reproducible `npm ci`, `--ignore-scripts`, pinned actions |
| PW.7 / PW.8 Review and test | Code review + CodeQL/Semgrep; unit/security tests; DAST; pen test |
| PW.9 Secure defaults | Mock mode by default; `app_role_assignment_required`; `unscoped_default` option; public access off in private mode |
| RV.1 Identify vulnerabilities | Dependabot, code scanning, Scorecard, private reporting |
| RV.2 Assess and remediate | SLAs, triage, exceptions with reasons (§6) |
| RV.3 Root cause | Post-incident review; add a regression test and threat-model entry |

## 11. Current status

Run locally against the repo on 2026-10-17:

| Check | Result |
|---|---|
| npm audit (all deps) | 0 vulnerabilities after upgrading Vite 8, Vitest 5, React Router 7 and @vitejs/plugin-react 6 (fixed the react-router open redirect in the SPA bundle, plus dev-server and test-runner advisories) |
| Typecheck / tests / build / CLI build | pass (45 tests) |
| Semgrep | 0 findings after fixes: proxy header copy, glob → regex hardening (escape, cap, fail closed), and 4 reviewed `pull_request_target` checkouts annotated |
| Trivy (vuln, misconfig, secret) | no HIGH/CRITICAL in tracked files |
| Checkov | `modules/agentctl`: 26 passed, 0 failed, 12 justified skips; GitHub Actions: 288 passed, 0 failed |
| tflint (azurerm ruleset) | 0 issues across 4 roots |
| actionlint | 0 issues |
| gitleaks | no leaks in git history. The working tree's **local `terraform.tfstate` holds secrets** (git-ignored, never committed): move state to a remote backend (§7) |
| Actions pinning | 18 actions pinned to SHAs at their latest releases |

**Open items:**
- configure the GitHub settings in §3 once the repo is on GitHub;
- move Terraform state to a remote backend;
- first CI run on GitHub (not yet executed);
- set up DAST once App Service is deployed.
