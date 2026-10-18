# Upgrade & uninstall

## Upgrade to a new release

1. Read the [release notes]({{ repo_url }}/releases).
2. Bump the module ref and re-apply:
   ```hcl
   source = "git::https://github.com/{{ repo }}.git//infra/modules/agentctl?ref=vX.Y.Z"
   ```
   ```bash
   terraform init -upgrade && terraform plan -out tfplan && terraform apply tfplan
   ```
3. Deploy the matching package:
   ```bash
   bash deploy.sh --target swa --version vX.Y.Z --resource-group <rg> --name <name>
   ```
4. Refresh your agents-gitops repo's verifier and module: download `agents-gitops-template.zip` for the new release, copy its `tools/` and `modules/` over yours on a branch, and open a PR. platform-security reviews it (CODEOWNERS).

**Roll back:** redeploy the previous tag (step 3) and revert the module ref.

## Uninstall

```bash
terraform destroy
```

This removes everything Terraform created:
- resource group contents;
- app registration and groups;
- role assignments and the custom role;
- diagnostic settings it added to existing Foundry accounts.

It doesn't touch existing Foundry accounts, agents, or an existing workspace you pointed it at.

If you enabled the Entra diagnostic export, destroy removes that tenant setting too. Coordinate with your SOC if they rely on it.
