# Agents GitOps repo

agentctl never writes to Foundry. Every agent creation or change is a **bundle**: manifest, change request, Foundry payload, Terraform and checksums. A bundle is merged into your **private agents-gitops repo**, which verifies and deploys it.

```mermaid
sequenceDiagram
  autonumber
  actor B as Builder / Requester
  participant A as agentctl
  participant R as agents-gitops (PR)
  participant G as agent-bundle workflow
  participant Z as Azure (Foundry)
  B->>A: build or change an agent
  A-->>B: bundle .zip
  B->>R: PR with agents/NAME/
  R->>G: pull_request_target (base-branch code only)
  G->>G: verify: checksums, schemas, recomputed risk & approvers
  G->>Z: drift: live manifest hash == base (read identity)
  G->>G: gate: required GitHub teams approved the head commit
  R->>Z: merge → deploy-agents: Terraform + new agent version (OIDC, environment approval)
  Z-->>R: live manifest hash confirmed
```

| Check | Fails when |
|---|---|
| **verify** | a file was edited after export; schema invalid; declared risk or approvers lower than recomputed; payload doesn't match the manifest; PR deletes an agent or mixes platform files with bundles |
| **drift** | the live agent changed since the bundle was built (or a "create" targets an existing agent) |
| **gate** | a required approver group (owners, platform-security, identity-admins) hasn't approved the **latest commit**. For updates, owners come from the *current* manifest, so nobody can add themselves as owner and approve their own change |
| **deploy** | Terraform or the agent apply fails, or the live manifest hash doesn't match after deploy |

Next: [Set up your private repo](setup.md).
