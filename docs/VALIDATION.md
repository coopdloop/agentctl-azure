# Tenant validation log

agentctl was validated end to end against a real tenant (one PAYG subscription, East US 2). This
file records what was deployed, what was validated, what was found, and what is still open. Use it
as the runbook for validating another environment.

**Last updated:** 2026-10-17

## 1. Deployed (Terraform, `infra/`)

| Resource | Name | Notes |
|---|---|---|
| Resource group | `rg-agentctl-dev-eus2` | |
| Log Analytics | `law-agentctl-dev-eus2` | 30-day retention |
| Application Insights | `appi-agentctl-dev-eus2` | workspace-based; the Foundry project's tracing sink |
| Foundry account + project | `aif-agentctl-dev-eus2-<suffix>` / `agents` | `gpt-4.1` (2025-04-14) GlobalStandard, 50K TPM |
| Entra app registration | `agentctl-dev` | 6 app roles, SPA redirect `http://localhost:5173/`, admin consent for Graph, ARM, Log Analytics and Foundry |
| Role groups | `agentctl-dev-{admins,readers,requesters,builders,approvers,identity-readers}` | admin: platform owner; reader + requester: test user |
| Scope group | `agentctl-dev-scope-hr-team` | test user; Foundry User on project `agents`; agents `hr-*` |
| Custom role | `agentctl Telemetry Reader (dev)` | App* tables only, assigned to the scope group |
| App Service | **not deployed** | `app_service.enabled = false`: the subscription has 0 App Service quota (B1 and F1) |

The app runs locally (`npm run dev`) in live mode, with `.env.local` written by `scripts/local-env-from-tf.sh`.

## 2. Seeded agents

`scripts/seed/seed_agents_v2.py` (agents API) creates three agents and drives conversations through
the OpenAI Responses API with `agent_reference`, so traces, tool calls and content-filter results
reach App Insights:

| Agent | Tools | Purpose in validation |
|---|---|---|
| `it-helpdesk` | function tools (read) | baseline activity |
| `hr-benefits` | function tools | created **without** the mandatory harness, so the findings engine flags it; later fixed through a bundle (v2) |
| `finance-report` | function tools (write verbs) | write-tier tool inference |

`scripts/seed/seed_agents.py` is the older Assistants-API variant (classic agents). Its agents were
deleted after the move to the agents API.

## 3. What was validated

| Area | Result |
|---|---|
| Discovery (ARM) | Foundry account, project, deployments and RAI policies listed |
| Agents API | New-style agents listed with version, kind, model, tools, instance identity (Entra Agent ID) and blueprint |
| Telemetry KQL | Rewritten against real data: Foundry emits server-side `invoke_agent` / `chat` spans with `gen_ai.agent.name`, usage, `microsoft.foundry.content_filter.results` and content. The caller (`UserAuthenticatedId`) sits on the client HTTP span in the same operation and is joined in |
| Content safety | Content-filter results and content-capture detection on the Guardrails page |
| Identity | Graph agent identities (`appId` is null for agent identities; object id used instead), grants, RBAC |
| Bundle round trip | Live `hr-benefits` → harness injection → bundle → verify → `apply-agent.sh` → **version 2** with both mandatory instructions; the live `agentctl.manifest_sha256` matches the bundle |
| GitOps checks | `agentctl-verify`, change detection, `terraform validate` (repo layout), drift check (6 scenarios against live `hr-benefits`), approval gate (5 scenarios against a fake GitHub API) |
| Access model | Admin (unscoped) vs scoped test user (Reader + Requester, `hr-team`): see §4 |

## 4. Access-model test

| Check | Admin | Scoped test user |
|---|---|---|
| Scope badge | none | "Scope: hr-team" |
| Agents | all 3 | `hr-benefits` only |
| Identity page / tab | yes | blocked (needs IdentityReader) |
| Builder / Harness | yes | yes; bundles are **[Proposal]** |
| Review bundle | yes | blocked (needs Approver) |
| Activity / Overview telemetry | yes | yes, after the Telemetry Reader role (filtered to `hr-*`) |
| Sign-in / Graph logs | yes | denied by Azure ("Not available with your access") |

**Issues found and fixed during this test**
1. **Scoped user saw 0 agents.** ARM discovery lists accounts first, and a project-scoped user can't read the account. Fixed: fall back to the configured project endpoints.
2. **Every page showed an error.** The user had no workspace access. Fixed: the table-scoped Telemetry Reader role, and 403s now render as an informational note rather than an error.

## 5. Phase 3: environments (multi-subscription, private networking, clouds)

| Check | Result |
|---|---|
| Resource Graph discovery | Returns the Foundry account and project (endpoint, managed identity) in one call |
| Proxy routing (dev server with `AGENTCTL_PROXY_SERVICES=logAnalytics,arm,graph`) | Log Analytics query, Resource Graph query and Graph `/me` all succeed through `/proxy` with real tokens; non-allowlisted hosts are still refused; the normal dev server still refuses ARM |
| Terraform with current settings | No resource changes; four new app settings (`AGENTCTL_CLOUD`, `AGENTCTL_SUBSCRIPTION_IDS`, `AGENTCTL_PROXY_SERVICES`, `AGENTCTL_LAW_ADDITIONAL_WORKSPACE_IDS`) |
| Private networking plan (not applied) | Foundry private endpoint, AMPLS (App Insights + workspace) with private endpoint, 8 private DNS zones + VNet links (22 resources). With App Service on: VNet integration, route-all, private inbound endpoint, public access off, `AGENTCTL_PROXY_SERVICES=logAnalytics` (28 resources). Missing DNS zones fail the plan with the zone names |
| Unit tests | Cloud profiles, endpoint overrides (https only), subscription union, proxy allowlist (exact vs suffix), CSP `connect-src` |

Not validated: an applied private deployment (needs App Service quota and a VNet), sovereign clouds, and more than one subscription (the tenant has one).

## 5a. AI risk controls against the tenant

Evaluated read-only with the controls engine on 2026-10-17. The 3 agents carry no governance metadata yet, so most sign-off items are open.

| Scope | Score | Fail | Needs sign-off |
|---|---|---|---|
| Overall | 33% | 16 | 43 |
| hr-benefits | 38% | 6 | 12 |
| finance-report | 36% | 7 | 13 |
| it-helpdesk | 33% | 7 | 14 |

**Failing controls:**
- **Every agent:**
  - GV-01 no risk tier recorded;
  - DP-04 traces store prompt and response content (F1);
  - GR-03 no indirect prompt-injection filter (Microsoft.DefaultV2).
- **Account:**
  - NW-01 public network access;
  - NW-02 unrestricted outbound traffic;
  - DP-01 no customer-managed key while hosting confidential agents.
- **Environment:**
  - MO-04 Defender for AI Services is Free (off);
  - GV-01 traces contain the deleted `probe-agent`.
- **GitOps:** SC-02: `finance-report` and `it-helpdesk` were not deployed through GitOps.

**Passing** checks include:
- ID-01 an Entra agent identity per agent;
- ID-02 local auth disabled;
- GR-01 and GR-02 harm filters and jailbreak shield (DefaultV2);
- MO-01 diagnostics to the workspace;
- MO-02 tracing.

**Evaluator fixes from this run:**
- TL-03 no longer counts the sandboxed code interpreter as an unapproved write tool;
- client-executed function tools need a sign-off rather than passing on an assumed approval.

## 5b. Static Web Apps deployment (live)

The Free-tier Static Web App was deployed with `scripts/deploy.sh --target swa`.

| Check | Result |
|---|---|
| `/` | 200, with CSP, `X-Frame-Options: DENY`, `nosniff` and referrer policy from `staticwebapp.config.json` |
| `/config.js` | rendered by the `config` function: live mode, client id, redirect URI = site URL, `proxyBase=/api/proxy` |
| Deep link `/agents` | 200 `index.html` (navigation fallback) |
| `/assets/*` | `cache-control: public, max-age=31536000, immutable` |
| `/api/proxy` to a non-allowlisted host | 403 `HostNotAllowed` |
| `/api/proxy` to the Foundry project with a user token | 200, returns `hr-benefits v2`, `finance-report v1`, `it-helpdesk v1` |
| `/api/proxy` without a token | 401 from Foundry (the proxy adds no credentials) |

**Found and fixed:** Static Web Apps replaces the `Authorization` header on managed-function requests, so the first deploy got 401 from Foundry. The proxy now prefers the SPA's explicit `x-agentctl-authorization` header.

## 5c. Automated evidence for former sign-off controls (live)

Read-only against the tenant on 2026-10-18:

| Control | Signal | Result |
|---|---|---|
| DP-02 | account and project `capabilityHosts` both empty | **fail**: basic agent setup (Microsoft-managed thread/file/vector storage) |
| ID-05 | project connection `appinsights` uses `ApiKey` | **warning**: the App Insights connection supports no other auth type |
| MO-06 | workspace `retentionInDays = 30` | **fail**: below 180 days |
| ID-04 | 0 Conditional Access policies | **fail** |
| SC-02 | version history: `hr-benefits` v2 has the manifest hash; `finance-report` and `it-helpdesk` never have | pass / **fail** / **fail** |
| TE-02 / TE-03 | `openai/evals` and `redTeams/runs` (preview header) reachable, no runs yet | needs sign-off (no runs) |
| GR-02 / GR-03 | the agent object has no guardrail field (confirmed); no agent-specific Defender/Policy verdicts | deployment guardrail used |

**Overall:** 31% (25 pass, 19 fail, 6 warnings, 40 sign-offs). The new checks replaced sign-offs with real failures.

**GitHub integration:**
- through the dev-server proxy, the public repo and its contents load;
- the device-flow endpoint is reachable;
- non-allowlisted GitHub hosts are refused;
- an end-to-end PR needs a GitHub App (not created).

**Fixed during this work:** the instruction secret scan flagged safety wording ("don't repeat … secrets"). It now matches only credential-shaped values.

## 6. Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | Foundry server-side tracing stores **full prompt and response content** in App Insights when content capture is on | High (data protection) | Flagged on the Guardrails page; trace access limited to the Telemetry Reader / Log Analytics Reader roles. Decide per agent whether capture stays on |
| F2 | Telemetry in a shared workspace isn't isolated per scope | Medium | Documented (ACCESS.md §4); use per-team App Insights + workspace for hard isolation |
| F3 | App Insights accepts ingestion with the connection string (local auth on) | Medium | Open: disable local auth and use Entra ingestion once the seed and agents use it |
| F4 | `hr-benefits` v1 lacked the mandatory harness | Low | Fixed through the bundle pipeline (v2) |

## 7. Blockers and open items

| Item | Owner | Notes |
|---|---|---|
| Entra ID P2 trial | tenant admin | The tenant's admin is a personal Microsoft account (guest UPN `…#EXT#…`), and commerce pages block MSA-backed admins. Create a native `admin@<tenant>.onmicrosoft.com` Global Administrator and start the trial at admin.microsoft.com. Then set `entra_diagnostics = { enabled = true }` and re-seed, to populate sign-in and Graph activity logs |
| App Service quota | subscription owner | Support request → Service and subscription limits → App Service, East US 2, B1. Then `app_service.enabled = true` and `scripts/deploy-app.sh` |
| agents-gitops repo | platform | `scripts/init-gitops-repo.sh`, then the setup in `templates/agents-gitops/README.md` |
| SSDLC (CI, scanning, threat model) | agentctl | Phase 4 |

## 8. Re-running this validation elsewhere

1. `cp infra/terraform.tfvars.example infra/terraform.tfvars`; fill in subscription, tenant, Foundry, role groups and one scope with a test user.
2. `terraform -chdir=infra apply`, then `scripts/local-env-from-tf.sh`.
3. Seed agents (needs `az login`):
   ```bash
   python3 -m venv .venv && .venv/bin/pip install -r scripts/seed/requirements.txt
   .venv/bin/python scripts/seed/seed_agents_v2.py --endpoint "<project endpoint>" \
     --appinsights "$(az monitor app-insights component show -g <rg> -a <appi> --query connectionString -o tsv)"
   ```
   Edit the `agentctl.owners` metadata in the script first. The seed turns off client-side content recording, but Foundry's server-side spans still capture content (finding F1).
4. `cd app && npm run dev`, switch to Live, and work through §3 and §4 as an admin and as the test user.
