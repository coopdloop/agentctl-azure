# agentctl threat model

STRIDE analysis of agentctl and its GitOps pipeline. Update it when the attack surface changes
(see SSDLC.md §9). **Last reviewed:** 2026-10-17.

## 1. System and assets

```
                    ┌──────────────────────── Entra ID (sign-in, tokens per audience) ───────────────┐
                    │                                                                                │
 User browser ──(1)─┤  SPA (React, MSAL)                                                             │
   │                │    │ tokens in sessionStorage                                                  │
   │                │    ├─(2)──► ARM / Resource Graph / Graph / Log Analytics   (direct, CORS)      │
   │                │    └─(3)──► App Service: server.mjs ──(4)──► Foundry projects (and any service │
   │                │              /config.js, /proxy, static         in AGENTCTL_PROXY_SERVICES)    │
   │                │                                                                                │
   └── downloads bundle ──(5)──► agents-gitops PR ──(6) gate: verify, drift, approvals ──(7) deploy ──► Foundry / Azure
                                                                                 (OIDC, Terraform, apply-agent.sh)
```

| Asset | Why it matters |
|---|---|
| User access tokens (ARM, Graph, Log Analytics, Foundry) | They act as the user against Azure, scoped by the user's RBAC |
| Agent definitions (instructions, tools, identities) | Changing them changes what agents can do |
| Telemetry (traces with prompts and responses, sign-in logs) | Sensitive data; prompts may contain personal data |
| Bundles and the GitOps repo | The path to production agent changes |
| Deploy identities (OIDC) | Can modify Foundry, RBAC and RAI policies |
| Runtime config (`/config.js`) | Decides which tenant, endpoints and scopes the SPA uses |

## 2. Trust boundaries

1. **Browser ↔ App Service:** the user and network are untrusted, and HTTPS terminates at App Service.
2. **Browser ↔ Azure APIs:** each request carries the user's token. Azure is the authority for data access.
3. **App Service proxy ↔ Foundry and private endpoints:** the proxy forwards the caller's token, and the upstream enforces RBAC.
4. **PR author ↔ GitOps gate:** PR content is untrusted data, and the gate's code comes from the base branch.
5. **CI/CD ↔ Azure:** OIDC tokens scoped to GitHub environments.

## 3. Threats and mitigations

### Spoofing

| # | Threat | Mitigations | Residual risk |
|---|---|---|---|
| S1 | Attacker signs in as a non-authorised user | Entra sign-in; `app_role_assignment_required`; app roles via groups; Conditional Access (tenant) | Depends on tenant CA and MFA policy |
| S2 | Phishing page imitates agentctl to harvest tokens | Fixed redirect URIs on the app registration; PKCE; no implicit flow | Users trained to check the domain |
| S3 | Forged or modified `/config.js` points the SPA at an attacker's tenant or endpoints | Served same-origin over HTTPS; CSP `connect-src` limited to the cloud profile; endpoint overrides must be https; no secrets in config | Compromise of App Service settings (see E3) |
| S4 | Approver impersonation in GitOps | GitHub identities; gate maps groups to teams and counts only reviews on the head SHA; author can't self-approve; owners taken from `base.yaml` for updates | Compromised GitHub account; mitigated by signed commits, 2FA, SSO |

### Tampering

| # | Threat | Mitigations | Residual risk |
|---|---|---|---|
| T1 | Bundle edited after export (e.g. a removed harness or added tool) | sha256 checksums; change request bound to manifest hashes; verifier recomputes risk and approvers; Foundry payload must match manifest | An attacker who regenerates a consistent bundle still faces recomputed approvals |
| T2 | Stale bundle overwrites a newer live agent | Drift check: live `agentctl.manifest_sha256` must equal `baseManifestSha256` (PR and deploy) | Agents changed outside agentctl show "not agentctl-managed" (warning, manual compare) |
| T3 | PR modifies the gate itself (workflow or verifier) | `pull_request_target` runs base-branch code; verifier pinned by sha256; CODEOWNERS on `.github/`, `tools/`, `platform/`; mixed PRs rejected | `pull_request_review` runs the PR's workflow copy; mitigated by code-owner review of `.github/` |
| T4 | Supply-chain compromise of a dependency or action | Lockfile, `--ignore-scripts`, Dependabot cooldown, SHA-pinned actions, dependency review, SBOM | Zero-days in pinned versions |
| T5 | Tampered release artifact deployed | Provenance attestation verified before deploy; SHA256SUMS | Compromise of the release workflow itself (protected by CODEOWNERS and tag rules) |
| T6 | KQL injection through agent names or ids | All interpolated values escaped (`esc`), operation ids validated against a strict pattern, read-only query API | Query cost; bounded by time range and `take` |

### Repudiation

| # | Threat | Mitigations | Residual risk |
|---|---|---|---|
| R1 | Unattributable agent changes | Every change is a PR with author, approvers and rationale; manifest hash in agent metadata; deploy logs | Changes made directly in the Foundry portal; detected as drift |
| R2 | Unattributable data access through agentctl | Every Azure call uses the user's token, so Azure activity logs, Log Analytics query audit and Graph activity logs attribute it | The proxy adds no attribution of its own; App Service HTTP logs record source IPs |

### Information disclosure

| # | Threat | Mitigations | Residual risk |
|---|---|---|---|
| I1 | Scoped user sees other teams' agents or telemetry | Foundry User per project (Azure-enforced); table-scoped Telemetry Reader (App* only); UI scoping; Resource Graph is RBAC-filtered | Telemetry in a shared workspace isn't split per scope (UI-filtered only); use per-team workspaces for hard isolation |
| I2 | Prompts and responses exposed via traces | Content-capture finding in Guardrails; trace access limited to the two roles above | Foundry server-side capture is on by default for some flows; decide per agent |
| I3 | Token theft through XSS | React escaping; strict CSP (`script-src 'self'`, no eval, `frame-ancestors 'none'`); no third-party scripts; tokens in sessionStorage (not localStorage) | Any XSS still reaches sessionStorage; dependency review and CodeQL lower the likelihood |
| I4 | Proxy leaks tokens to arbitrary hosts (SSRF / open proxy) | Host allowlist: Foundry suffixes plus exact hosts for proxied services, and `api.github.com` / `github.com` only when the GitHub integration is configured; bare suffix rejected; no redirects followed; fixed request-header allowlist; no cookies | Allowlisted hosts are Microsoft- or GitHub-owned; tokens are audience-bound |
| I5 | Secrets in Terraform state | State in a remote, Entra-auth backend; never committed (gitleaks, `.gitignore`) | Local state during development (SSDLC open item) |
| I7 | GitHub user token (PRs from agentctl) stolen | GitHub App user-to-server token: limited to repos the app is installed on and to the user's own access, typically expiring; kept in sessionStorage; sent only to GitHub via the proxy; device flow needs no client secret | Same XSS exposure as Azure tokens (I3) |
| I6 | Sensitive data in bundles | Bundles contain configuration, not data; `${…}` placeholders for connection ids; the verifier rejects unresolved placeholders at apply | Owners may paste sensitive text into instructions; reviewers see the diff |

### Denial of service

| # | Threat | Mitigations | Residual risk |
|---|---|---|---|
| D1 | Proxy abused as an anonymous relay to Foundry | Upstream requires a valid token (401 otherwise); allowlist; App Service platform limits | Add access restrictions, Front Door WAF or rate limits for internet-facing deployments |
| D2 | Expensive KQL from the UI | Fixed queries; time-bounded; `take`/`top N`; Log Analytics throttling | |
| D3 | ReDoS through agent-name globs in config | Globs escaped, capped at 64 chars and 4 wildcards; invalid globs fail closed | |

### Elevation of privilege

| # | Threat | Mitigations | Residual risk |
|---|---|---|---|
| E1 | UI role bypass (editing app state in devtools) | UI gates are convenience only; data and changes are enforced by Azure RBAC and the GitOps gate | A user can build a bundle UI-side, but it still needs approvals |
| E6 | PRs opened from agentctl skip review | They go through the same branch protection and `agent-bundle / gate` as manual PRs (verify, drift, approvals on the head commit); proposals open as drafts | Users can only open PRs on repos they can already write to |
| E2 | Requester escalates by adding themselves as owner | Gate uses base owners for updates; proposals require existing owners | Creates: the creator becomes owner, but platform approvers still apply per tier |
| E3 | Compromise of App Service settings changes runtime config or the proxy allowlist | App Service RBAC (deploy identity only); settings managed by Terraform; diagnostic logs | Contributor on the web app is effectively admin of agentctl; keep that role narrow |
| E4 | Deploy identity misuse | OIDC subject bound to a GitHub environment; prod requires reviewers; least-privilege roles per environment (agents-gitops README) | RBAC Administrator needed to grant agent roles; constrain it with role-assignment conditions |
| E5 | Agent granted excessive permissions through a bundle | Risk tiers: privileged RBAC, app permissions and write tools without approval need identity-admins / platform-security; schema rules | Approver judgement |

## 4. Security assumptions

- Entra ID, Azure RBAC and the Azure APIs enforce authorization correctly.
- The tenant enforces MFA and Conditional Access for agentctl users and GitHub SSO for maintainers.
- App Service platform security (TLS, isolation) holds.
- GitHub branch protection and environment rules are configured as in SSDLC.md §3.

## 5. Out of scope

- Runtime safety of the agents themselves (prompt injection against agents and so on). That is governed through the bundle and guardrail model and the AI risk controls catalog.
- Security of Microsoft-hosted models and services.

## 6. Review log

| Date | Change | Reviewer |
|---|---|---|
| 2026-10-17 | Initial model: proxy routing for private networks, data scopes, telemetry role, GitOps gate | platform-security |
| 2026-10-18 | Static Web Apps hosting (token header precedence), GitHub integration (device flow, PRs, drift), new Azure evidence reads | platform-security |
