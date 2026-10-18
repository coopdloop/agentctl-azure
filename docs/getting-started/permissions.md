# Permissions

agentctl is designed so that a **subscription Owner can deploy it alone**. Two tenant-level steps may need an Entra admin, and both are optional or deferrable. This page lists every permission used, by whom, and why.

## Summary

| Step | Who | Azure RBAC | Entra ID |
|---|---|---|---|
| Terraform: resource group, Log Analytics, App Insights, Foundry (optional), hosting | Deployer | **Owner** (or Contributor + RBAC Administrator) on the subscription | none |
| Terraform: role assignments and the custom Telemetry Reader role | Deployer | **Owner** (or User Access Administrator / RBAC Administrator) | none |
| Terraform: app registration + app roles | Deployer | none | "Users can register applications" = **Yes** (tenant default), *or* Application Developer |
| Terraform: role and scope **groups** | Deployer | none | "Users can create security groups" = **Yes** (tenant default), *or* Groups Administrator. Skip with `role_groups.create = false` |
| Terraform: **admin consent** for Graph delegated permissions (`grant_admin_consent = true`) | Deployer | none | **Cloud Application Administrator**, Application Administrator, Privileged Role Administrator or Global Administrator. *Deferrable* |
| Terraform: Entra diagnostic export (`entra_diagnostics.enabled = true`) | Deployer | none | **Security Administrator** or Global Administrator, plus Entra ID **P1/P2**. *Optional* |
| Deploy the release to the host | Deployer | Contributor on the Static Web App / web app | none |
| Use agentctl | Every user | Reader-type roles that Terraform grants (below) | An agentctl app role (Terraform assigns it) |
| agents-gitops pipeline | GitHub OIDC identities | Roles listed in [Set up your agents repo](../gitops/setup.md#3-azure-identities-for-github-oidc) | none (uses user-assigned managed identities) |

!!! success "Owner-only path"
    With tenant defaults (users can register apps and create groups), an Owner runs everything with `grant_admin_consent = false`. Then send the [admin consent link](#admin-consent) to an Entra admin. Until they approve it, only the Graph-based identity views are empty.

## Azure RBAC

### Deployer

**Owner on the subscription** covers everything Terraform does:
- creating resources;
- registering resource providers;
- creating role assignments for viewers and scope groups;
- creating the custom role *agentctl Telemetry Reader*, scoped to the workspace.

Least-privilege alternative: **Contributor** plus **Role Based Access Control Administrator**, constrained to the roles Terraform assigns (Reader, Log Analytics Reader, Foundry User and the custom Telemetry Reader).

If existing Foundry accounts or workspaces are in **other subscriptions**, you need the same rights there (role assignments are created on them).

### Users of agentctl

Every Azure call is made **with the user's own token**. Terraform grants:

| Persona | Grant | Scope | Purpose |
|---|---|---|---|
| Unscoped viewers / admins (`viewer_principal_ids`) | Reader | Foundry accounts (or subscription with `assign_subscription_reader`) | discovery, deployments, RAI policies, RBAC, policy |
| | Log Analytics Reader | agentctl workspace(s) | traces, sign-in and Graph activity logs |
| | Foundry User (`53ca6127-…`) | Foundry accounts | read agent definitions |
| Data-scope groups (`access_scopes`) | Foundry User | **only the scoped projects** | read their agents |
| | agentctl Telemetry Reader (custom) | workspace(s) | query `AppDependencies`, `AppRequests`, `AppTraces`, `AppExceptions` only |

Defender for Cloud posture (`Microsoft.Security/pricings`, alerts and assessments) is readable with Reader on the subscription. Without it, the related controls show *Unknown*.

## Entra ID

### App registration and roles

Terraform creates one **single-page application** registration (`agentctl-<env>`). It has:
- redirect URIs for the host and `http://localhost:5173/`;
- six app roles: `AgentCtl.Reader`, `IdentityReader`, `Requester`, `Builder`, `Approver`, `Admin`;
- `app_role_assignment_required = true`, so only assigned users and groups can sign in.

The deployer becomes the app's owner. No client secret or certificate is ever created: the SPA uses auth code + PKCE.

If your tenant disables *Users can register applications*, ask for the **Application Developer** role (or have an admin run the Terraform step).

### Delegated API permissions

These are requested by the SPA and appear on the consent screen. All are delegated: the app only ever acts as the signed-in user.

| API | Permission | Admin consent? | Used for |
|---|---|---|---|
| Azure Service Management | `user_impersonation` | no | ARM, Resource Graph, Defender, Policy |
| Log Analytics API | `Data.Read` | no | traces, sign-in logs (KQL) |
| Azure AI Services (Foundry) | `user_impersonation` | no | agent definitions via the proxy |
| Microsoft Graph | `User.Read` | no | sign-in, your groups |
| Microsoft Graph | `Application.Read.All` | **yes** | app registrations, app role assignments |
| Microsoft Graph | `Directory.Read.All` | **yes** | name resolution, groups overage |
| Microsoft Graph | `DelegatedPermissionGrant.Read.All` | **yes** | OAuth2 grants held by agents |
| Microsoft Graph (beta) | `AgentIdentity.Read.All` | **yes** | Entra Agent ID identities, blueprints, sponsors (skipped if the tenant doesn't expose it) |
| Microsoft Graph | `Policy.Read.All` | **yes** | Conditional Access policies (control ID-04); requested only by that check |

### Admin consent

- With `grant_admin_consent = true`, Terraform grants tenant-wide consent. The deployer must hold one of: **Cloud Application Administrator**, **Application Administrator**, **Privileged Role Administrator** or **Global Administrator**.
- Otherwise, after `terraform apply`, send this link to an admin. `client_id` comes from `terraform output client_id`:

```text
https://login.microsoftonline.com/<tenant-id>/adminconsent?client_id=<client-id>
```

Until consent is granted:
- ARM, Log Analytics and Foundry views work (users consent for themselves on first sign-in, if the tenant allows user consent);
- the Identity views and identity-based controls show *Not available* / *Unknown*.

### Groups

- With `role_groups.create = true` and `access_scopes.<name>.create_group = true`, Terraform creates security groups and makes the deployer their owner. That needs the *Users can create security groups* tenant setting (default Yes) or **Groups Administrator**.
- Otherwise, set `role_groups.create = false` and put user or existing group object IDs in `app_role_assignments` and `access_scopes.<name>.group_ids`.

### Entra diagnostic export (optional)

`entra_diagnostics.enabled = true` creates the tenant diagnostic setting that sends `SigninLogs`, the non-interactive / service-principal / managed-identity sign-in logs and `MicrosoftGraphActivityLogs` to the workspace. It requires:
- **Security Administrator** (or Global Administrator);
- **Entra ID P1/P2**;
- only **one per tenant per destination**: reuse your SOC's workspace via `log_analytics.existing_id` if one already exists.

!!! warning "Personal Microsoft accounts as tenant admins"
    If the tenant was created with a personal Microsoft account (your UPN looks like `you_outlook.com#EXT#@tenant.onmicrosoft.com`), the Microsoft 365 admin center blocks starting trials such as P2. Create a native admin (`admin@<tenant>.onmicrosoft.com`) with Global Administrator, and use it for commerce and tenant-level settings.

## GitHub

| Repo | Who | Needs |
|---|---|---|
| agentctl (public) | you | nothing: download releases |
| agents-gitops (your private repo) | repo admin | create environments, variables, secrets, branch protection; install the gate GitHub App (org owner or app manager) |
| agents-gitops, from agentctl (optional) | each user | write access to the repo; approves the *agentctl* GitHub App via device flow to open PRs |

## Checklist

- [ ] Owner on the target subscription (and on any subscription that holds existing Foundry accounts or workspaces)
- [ ] Can register applications (tenant default) or have Application Developer
- [ ] Can create security groups, or will use `role_groups.create = false`
- [ ] Entra admin available for consent now (`grant_admin_consent = true`) or later (link above)
- [ ] *Optional:* Security Administrator + P1/P2 for sign-in log export
