# Getting started

Deploying agentctl takes three decisions and about 30 minutes.

```mermaid
flowchart TD
  A[Owner on an Azure subscription] --> B{Existing Foundry<br/>account?}
  B -- yes --> C[Observe existing accounts]
  B -- no --> D[Create a sandbox Foundry<br/>account + project]
  C --> E{Hosting}
  D --> E
  E -- "default, no quota needed" --> F[Azure Static Web Apps]
  E -- "private endpoints / VNet" --> G[Azure App Service]
  E -- "just evaluating" --> H[Run locally]
  F --> I{Entra admin available?}
  G --> I
  H --> I
  I -- yes --> J[Grant admin consent: all views work]
  I -- no --> K[Ask an admin to consent later:<br/>Graph identity views stay empty]
```

| Decision | Recommendation |
|---|---|
| **Foundry** | Point at your existing Foundry accounts (`foundry.existing_account_ids`). To try agentctl in an empty subscription, let Terraform create a sandbox account and project. |
| **Hosting** | **Static Web Apps (Free)** unless you need private networking. App Service needs VM quota (new pay-as-you-go subscriptions often have none) but supports VNet integration. See [Deploy](../deploy/index.md). |
| **Admin consent** | agentctl reads directory data (app registrations, grants, agent identities) through delegated Graph permissions that need tenant admin consent. Without it, everything else works. See [Permissions](permissions.md#entra-id). |

Next: [Prerequisites & tooling](prerequisites.md). If your Azure platform is already managed in Terraform, read [Add to existing Terraform](../deploy/existing-terraform.md) next.
