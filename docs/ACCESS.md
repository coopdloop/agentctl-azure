# agentctl access model

Who can see and do what in agentctl, what enforces it, and how to configure it.

**Summary:** app roles decide which **features** a user gets. Azure RBAC decides which **data** they
can read, because every Azure call uses the signed-in user's own token. Data scopes connect the two:
a scope group gets Azure access to specific Foundry projects, and the UI narrows to those projects
(and optionally to agent name patterns).

## 1. Layers

| Layer | Decides | Enforced by | Bypassable from the browser? |
|---|---|---|---|
| App role (`AgentCtl.*` in the ID token) | Which pages and actions appear | agentctl UI | Yes. It is a UI convenience; never the only control for data |
| Data scope (`AGENTCTL_ACCESS_SCOPES`) | Which projects and agents are listed | agentctl UI (scoped data source) | Agent-name filtering yes; project access no (see next row) |
| Azure RBAC on Foundry projects | Which agent definitions a user can read | Foundry data plane | **No** |
| Azure RBAC on the Log Analytics workspace | Which telemetry tables a user can query | Log Analytics | **No** |
| Microsoft Graph permissions + directory roles | Grants, app role assignments, agent identities | Microsoft Graph | **No** |
| GitOps approval gate | Which changes reach Foundry | GitHub branch protection + `agent-bundle / gate` | **No** (see `templates/agents-gitops/README.md`) |

agentctl never holds credentials, and it cannot show a user anything they couldn't read with their own token.

## 2. App roles

Defined on the agentctl app registration by `infra/modules/agentctl/entra.tf`. `app_role_assignment_required = true`, so users with no role can't sign in; if a token has no role anyway, the app shows "No agentctl role assigned".

| Role | Token value | UI access |
|---|---|---|
| Reader | `AgentCtl.Reader` | Overview, Agents, Activity, Guardrails, Data sources, all within the user's scope |
| Identity Reader | `AgentCtl.IdentityReader` | Identity & access page and the agent Identity tab (sign-ins, grants, RBAC, agent identities) |
| Requester | `AgentCtl.Requester` | Builder and Harness injection; exported bundles are **proposals** (`spec.proposal: true`, title prefixed `[Proposal]`, the agent's owners added as required approvers) |
| Builder | `AgentCtl.Builder` | Builder, Harness injection and "Fix" on findings; exports normal change requests |
| Approver | `AgentCtl.Approver` | Review bundle (independent verification) |
| Admin | `AgentCtl.Admin` | Everything, **never scoped**, plus bulk remediation |

Roles are additive. A typical requester has Reader + Requester.

## 3. Data scopes

A scope maps Entra groups to Foundry projects and, optionally, agent name globs.

```hcl
access_scopes = {
  hr-team = {
    create_group = true                       # creates agentctl-<env>-scope-hr-team
    members      = ["<user or group object id>"]
    # group_ids  = ["<existing group object id>"]   # or bring your own groups
    projects = [{
      account_id = "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>"
      project    = "agents"
    }]
    agents    = ["hr-*"]                      # optional; omit to show every agent in the projects
    telemetry = true                          # default; see section 4
  }
}
unscoped_default = "none"                     # users in no scope see nothing ("all" = see everything)
```

Terraform then:
1. creates the scope group (when `create_group = true`),
2. grants each scope group **Foundry User** (`53ca6127-db72-4b80-b1b0-d745d6d5456d`) on exactly those projects,
3. grants the **agentctl Telemetry Reader** role on the workspace (when `telemetry = true`),
4. writes the scope list to `AGENTCTL_ACCESS_SCOPES` (an app setting, also in `terraform output local_env`).

**How the app resolves a user's scope** (`app/src/auth/scope.ts`)
- **Admin** → unscoped.
- Otherwise, every scope whose groups appear in the token's `groups` claim applies, and they **union**.
- A matching scope **without** `agents` shows every agent in its projects.
- **No matching scope** → `unscoped_default`.
- **Groups claim overage:** with more than 200 groups, Entra omits the claim and the app calls `POST /me/getMemberGroups` instead.

The scoped data source (`app/src/api/scoped.ts`) filters inventory, runs, stats, identity rows, grants and overview numbers. The top bar shows a "Scope: …" badge for scoped users.

**Group ids are object ids.** Scope matching uses the groups claim, which carries object ids (not names) for security groups.

## 4. Telemetry access

Agent traces live in the `App*` tables of the Log Analytics workspace, next to Entra sign-in logs and Graph activity logs. Those logs are sensitive, so scoped users must not get *Log Analytics Reader*.

When any scope has `telemetry = true`, Terraform creates a custom role, **agentctl Telemetry Reader (`<env>`)**, assignable only on the workspace:

```
Microsoft.OperationalInsights/workspaces/read
Microsoft.OperationalInsights/workspaces/query/read
Microsoft.OperationalInsights/workspaces/query/AppDependencies/read
Microsoft.OperationalInsights/workspaces/query/AppRequests/read
Microsoft.OperationalInsights/workspaces/query/AppTraces/read
Microsoft.OperationalInsights/workspaces/query/AppExceptions/read
```

| Data | Scoped user (Telemetry Reader) | Identity Reader / Admin (Log Analytics Reader via `viewer_principal_ids`) |
|---|---|---|
| Agent runs, tool calls, tokens, content-filter results | ✅ | ✅ |
| Entra sign-in logs (`SigninLogs`, `AAD*SignInLogs`) | ❌ | ✅ |
| Graph activity logs | ❌ | ✅ |

**Limits**
- **Telemetry isn't isolated per scope.** Everyone with Telemetry Reader can query every agent's traces in that workspace; the UI filters to the user's agents. For hard isolation between teams, give each team its own App Insights resource **and** workspace.
- **Traces can include prompts and responses.** Foundry server-side tracing records full prompt and response content (`gen_ai.input.messages` / `gen_ai.output.messages`) when content capture is on. Anyone with trace access can read it. The Guardrails page flags agents with content capture enabled.
- **Workspace access mode.** The workspace must allow resource or workspace permissions (`enableLogAccessUsingOnlyResourcePermissions = true`, the default for new workspaces).

## 5. Azure permissions per persona

| Persona | App roles | Azure access (Terraform input) |
|---|---|---|
| Platform admin | Admin | `viewer_principal_ids`: Reader + Log Analytics Reader + Foundry User on the accounts; Graph consent |
| Security / identity analyst | Reader + IdentityReader | `viewer_principal_ids` (needs the sign-in tables) |
| Team member (observe) | Reader | a data scope |
| Team member (suggest changes) | Reader + Requester | a data scope |
| Agent builder | Reader + Builder | a data scope (or `viewer_principal_ids` for platform builders) |
| Approver | Approver (+ Reader) | as needed for review; bundle verification itself needs no Azure access |

Don't put scoped users in `viewer_principal_ids`: that grants account-wide Foundry User and workspace-wide Log Analytics Reader, which defeats the scope.

## 6. Configuring role groups

```hcl
app_role_assignments = {}            # direct assignments (user or group object ids), optional
role_groups = {
  create = true                      # one group per role: agentctl-<env>-admins, -readers, -requesters, ...
  members = {
    admin     = ["<object id>"]
    reader    = ["<object id>"]
    requester = ["<object id>"]
  }
}
```

Bring your own groups instead by leaving `role_groups.create = false` and listing their object ids in `app_role_assignments`.

## 7. Onboarding a team (checklist)

1. **Add a scope** to `access_scopes`: the team's projects, optional `agents` globs, and the team group (`group_ids`) or `create_group` + `members`.
2. **Add the team to role groups:** `reader`, plus `requester` or `builder`.
3. **Map approvals:** add the team's owners to `platform/approvers.json` in the agents-gitops repo (GitHub team or user mapping), or the approval gate fails closed.
4. **Plan and apply.** For local dev, run `scripts/local-env-from-tf.sh` and restart the dev server so `/config.js` picks up the new scopes.
5. **Re-sign-in:** users sign out and back in to get a token with the new groups and roles. Azure role assignments can take a few minutes to take effect.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No agentctl role assigned" | No app role in the token | Add the user to a role group; sign out and in |
| Scoped user sees **0 agents** | No matching scope (with `unscoped_default = "none"`), or the token predates group membership | Check the "Scope" badge; sign out and in; confirm `AGENTCTL_ACCESS_SCOPES` contains the group's object id |
| "Not available with your access" | Azure returned 403 for that source (e.g. a scoped user on Identity data) | Expected for scoped users; grant the Azure role if intended |
| Activity is empty for a scoped user | Missing Telemetry Reader, or role propagation still pending | Check `scope_telemetry` in state; wait a few minutes; sign in again |
| "Consent required for foundry" | No admin consent for `https://ai.azure.com/user_impersonation` | `grant_admin_consent = true`, or click "Grant access" |

**Project discovery for scoped users.** A user with Foundry User on a project only can't list the parent account in ARM. When `AGENTCTL_FOUNDRY_PROJECT_ENDPOINTS` is set, the app falls back to those endpoints for projects it can't discover (`projectFromEndpoint` in `app/src/api/live/index.ts`). Keep that setting populated in environments with scoped users. Multi-subscription discovery (roadmap) will use Azure Resource Graph.
