# Troubleshooting

## Deployment

| Symptom | Cause | Fix |
|---|---|---|
| `terraform apply`: `Insufficient privileges to complete the operation` on the app registration | tenant blocks user app registration | get **Application Developer**, or have an admin run that step |
| `… consent …` / `Authorization_RequestDenied` on `azuread_service_principal_delegated_permission_grant` | `grant_admin_consent = true` without an admin role | set `false` and send the [consent link](../getting-started/permissions.md#admin-consent) |
| `azuread_group` creation denied | tenant blocks group creation | `role_groups.create = false`; assign users in `app_role_assignments` |
| App Service: `quota … 0` / `SubscriptionIsOverQuotaForSku` | no App Service VM quota | request quota, or use Static Web Apps |
| `MissingSubscriptionRegistration` | resource provider not registered | [register providers](../getting-started/prerequisites.md#register-resource-providers) |
| `RoleDefinitionDoesNotExist: Azure AI User` | role renamed to *Foundry User* | agentctl uses the role id `53ca6127-…`; update custom code the same way |
| `deploy.sh`: `no published release found` | wrong `--repo` or no release yet | `--repo {{ repo }}` / pass `--version` |
| `deploy.sh`: provenance verification fails | asset not from this repo's release workflow | don't deploy it; re-download from the release page |
| Static Web App deploy: `Unauthorized` | stale deployment token | `az staticwebapp secrets reset-api-key`, then re-run |

## Signing in

| Symptom | Cause | Fix |
|---|---|---|
| `AADSTS50105: … not assigned to a role` | `app_role_assignment_required` and the user has no role | add them to a role group (`role_groups.members`) |
| `AADSTS50011: redirect URI mismatch` | custom domain or new host not in the app registration | add `https://<host>/` (Terraform `local_dev_redirect_uris` or portal) |
| "No agentctl role assigned" | token has no `AgentCtl.*` role | sign out and in after adding the user to a role group |
| "Consent required for foundry" | Foundry audience not consented | admin consent link, or click **Grant access** |

## Data

| Symptom | Cause | Fix |
|---|---|---|
| **0 agents** | no Foundry read access, project-scoped user, or wrong subscriptions | Data sources page; check `AGENTCTL_SUBSCRIPTION_IDS` and the user's scope; Resource Graph finds projects readable by the user |
| Activity empty | agents don't send traces to the agentctl App Insights | connect App Insights in the Foundry project (**Tracing**); check `AppDependencies` in the workspace |
| "Not available with your access" | Azure returned 403 for that source | expected for scoped users; grant the role if intended ([Access model](../ACCESS.md)) |
| Identity views empty | no admin consent, or no Entra diagnostic export | consent link; `entra_diagnostics` (needs P1/P2) |
| Controls show *Unknown* | source unreadable (Defender, identities, policy) | grant Reader on the subscription / admin consent; see the banner on Risk & compliance |
| Static Web Apps: Foundry calls 401 | `Authorization` stripped by the platform | fixed in the packaged proxy (`x-agentctl-authorization`). Make sure you deployed `agentctl-swa.zip`, not the App Service package |

## Diagnostics

- **Data sources** page: per-source health with the exact error.
- Browser devtools → Network: failing calls show the Azure error code.
- App Service: **Log stream**. Static Web Apps: **Application Insights** for functions (Standard tier) or the CLI deploy output.
