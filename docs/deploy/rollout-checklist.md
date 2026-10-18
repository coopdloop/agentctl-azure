# Rollout checklist

Gotchas found while deploying and validating agentctl in real tenants. Read this before you deploy into another subscription or hand agentctl to teams.

## Before you deploy into another subscription

| # | Gotcha | Why it bites | Do this |
|---|---|---|---|
| 1 | **Entra objects are tenant-wide** | The app registration (`agentctl-<env>`), role groups (`agentctl-<env>-admins` …) and scope groups are created in the *tenant*, not the subscription. Same `environment` in two subscriptions means two look-alike app registrations and duplicate group names | give each deployment a distinct `environment` (e.g. `test2`) or `name_prefix` |
| 2 | **Custom role names are unique per tenant** | Before v0.2.3 the Telemetry Reader role was named per environment only, so a second deployment failed with `RoleDefinitionWithSameNameExists` | use **≥ v0.2.3** (adds the deployment suffix) or a distinct `environment` |
| 3 | **One Entra diagnostic setting per tenant per destination** | `entra_diagnostics.enabled = true` in a second deployment collides with the first (or your SOC's) | keep it on in one place only; point other deployments' `log_analytics.existing_id` at that workspace |
| 4 | **Admin consent** | Graph permissions (`Application.Read.All`, `Directory.Read.All`, `DelegatedPermissionGrant.Read.All`, `AgentIdentity.Read.All`, `Policy.Read.All`) need tenant admin consent. Without it, identity views and several controls show *Unknown* | `grant_admin_consent = true` with a Cloud Application Administrator, or send the [consent link](../getting-started/permissions.md#admin-consent) |
| 5 | **Upgrading adds permissions** | v0.2.0 added `Policy.Read.All`. With `grant_admin_consent = false`, consent doesn't follow on its own | re-send the consent link after upgrades that add scopes (release notes say so) |
| 6 | **App Service quota is 0 on many new subscriptions** | B1 and even F1 fail with a quota error | use Static Web Apps (Free) or request quota first |
| 7 | **Static Web Apps limits** | Free tier is only in a few regions and can't use private endpoints; managed functions can't reach VNets | private Foundry or Log Analytics means App Service hosting |
| 8 | **Model quota (sandbox Foundry)** | `foundry.create = true` deploys `gpt-4.1` GlobalStandard; quota varies by subscription and region | check quota, or pick another model/region in `model_deployments` |
| 9 | **Resource providers** | new subscriptions often lack `Microsoft.CognitiveServices`, `Microsoft.Web`, `Microsoft.Insights`, `Microsoft.Security`… | [register them](../getting-started/prerequisites.md#register-resource-providers) before `apply` |
| 10 | **Personal-account tenant admins** | if the tenant admin is a personal Microsoft account, trials such as Entra ID P2 can't be started | create a native `admin@<tenant>.onmicrosoft.com` Global Administrator |
| 11 | **`localhost` redirect URI** | `local_dev_redirect_uris` defaults to `http://localhost:5173/` on every app registration, including prod. Any local app on a user's machine could receive sign-in redirects for it | set `local_dev_redirect_uris = []` for shared and prod deployments |
| 12 | **Terraform state holds secrets** | the App Insights connection string and other values land in state | remote backend with Entra auth, no shared keys; never commit `*.tfstate` / `*.tfvars` |

## Before you hand it to teams

| # | Gotcha | Why it bites | Do this |
|---|---|---|---|
| 13 | **Prompts end up in traces** | Foundry's server-side tracing stores full prompts and responses when content capture is on. Everyone with trace access can read them | decide per agent; the Risk & compliance page flags it (DP-04). Check data classification before connecting App Insights |
| 14 | **Telemetry isn't isolated per team** | the Telemetry Reader role reads *all* agents' traces in the workspace; the UI only filters | separate App Insights + workspace per team for hard isolation ([ACCESS](../ACCESS.md#4-telemetry-access)) |
| 15 | **Agent globs are UI-only** | `access_scopes.*.agents = ["hr-*"]` hides other agents in the UI, but Foundry permissions are per project | put teams that must not see each other's agents in different **projects** |
| 16 | **Scoped users in `viewer_principal_ids`** | that grants account-wide Foundry User and workspace-wide Log Analytics Reader, which defeats the scope | keep scoped users only in `access_scopes` |
| 17 | **`unscoped_default = "all"`** | users with an app role but in no scope see everything their Azure RBAC allows | set `"none"` when you roll out scopes |
| 18 | **Changes need a fresh sign-in** | new roles, groups or consent don't reach existing tokens; RBAC takes minutes to propagate | tell users to sign out and back in after changes |
| 19 | **Requesters vs Builders** | Requesters' bundles are proposals (owners must approve). Builders' aren't | grant Builder sparingly; most teams start with Reader + Requester |
| 20 | **Approver policy must match** | `approver_groups` in agentctl and `platform/policy.json` in the agents repo must be identical, or every PR fails *Declared risk/Approvers* | change both together |
| 21 | **The gate needs an organization** | the approval gate maps approver groups to GitHub *teams*; personal accounts have no teams | use a GitHub org, or map owners to users in `approvers.json` |
| 22 | **Branch protection makes the gate binding** | without the required `agent-bundle / gate` check and code-owner review, the gate is advisory | apply the [branch ruleset](../gitops/setup.md#7-branch-protection) before teams open PRs |
| 23 | **Agents edited in the portal** | portal or SDK edits create versions without a manifest hash: drift, and the next bundle fails the drift check | treat the portal as read-only for GitOps-managed agents; rebuild changes from the live agent |
| 24 | **Imported tools are assumptions** | when agentctl imports an existing agent, client-executed **function** tools get an assumed approval mode and MCP tools may have no `allowed_tools`. OpenAPI specs referenced by URL must be inlined before apply | review the Tools step before exporting the first bundle of an existing agent |
| 25 | **`${…}` placeholders** | connection IDs in agent definitions are placeholders filled per environment from `platform/terraform/<env>.tfvars` | fill `placeholder_values` per environment, or apply fails with "unresolved placeholders" |
| 26 | **Preview signals** | red-team runs (preview API), agent Conditional Access targeting, Defender AI recommendations and Foundry guardrails at tool level are preview; some controls show *Unknown* or approximate | read controls marked with `*` as indicative; [known limits](../CONTROLS.md#known-limits) |
| 27 | **Verify what you deploy** | `deploy.sh` skips provenance verification when the GitHub CLI isn't signed in (the checksum is still verified) | `gh auth login` on machines that deploy |
| 28 | **Use a current release** | v0.2.0 with Static Web Apps reset the app settings on each apply (fixed in v0.2.1); cross-subscription Foundry roles fixed in v0.2.2; tenant-unique role names fixed in v0.2.3 | deploy **≥ v0.2.3** |
| 29 | **Don't seed shared environments** | `scripts/seed/*` creates demo agents and traffic | only in sandboxes |
| 30 | **`terraform destroy` changes identities** | destroying removes the app registration (new client ID next time) and the groups Terraform created, so members lose access | destroy only throwaway environments; for real ones, upgrade in place |

## Smoke test after each new deployment

1. **Data sources** page: every source is green, or amber only where expected (Graph before consent, P2 sign-in logs).
2. **Agents:** the expected agents appear, with a GitOps state.
3. Sign in as a **scoped test user**: they see only their project and agents, and the Identity page is blocked.
4. **Risk & compliance:** no unexpected *Unknown* banner beyond the sources you knowingly left out.
5. Export a bundle; if the agents repo is set up, open a PR and watch **verify → drift → gate**.
