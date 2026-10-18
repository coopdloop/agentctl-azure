# Your first change

1. **In agentctl**, open an agent → **Propose change** (Builders) or **Suggest change** (Requesters). For example, inject the mandatory platform instructions, or require approval on a write tool.
2. **Review & export** shows the diff, computed risk tier and required approvers. Fill in a title and rationale, then **Download bundle (.zip)**.
3. **With the GitHub App configured** ([setup step 9](setup.md#9-open-pull-requests-from-agentctl-optional)), click **Open pull request**, approve the one-time code, and skip to step 4. **Without it**, add the bundle by hand:
   ```bash
   git switch -c change/hr-benefits-harness
   rm -rf agents/hr-benefits && mkdir -p agents/hr-benefits
   unzip -q ~/Downloads/cr-*-hr-benefits.zip -d /tmp/bundle && cp -R /tmp/bundle/*/. agents/hr-benefits/
   git add agents/hr-benefits && git commit -m "hr-benefits: inject mandatory harness" && git push -u origin HEAD
   gh pr create --fill
   ```
4. **The PR checks run:**
   - **verify**: all checks pass, with the summary in the run;
   - **drift**: base matches live;
   - **gate**: waits for the computed approvers.
5. **The approvers** (mapped GitHub teams) approve the latest commit, and **gate** turns green.
6. **Merge.** **deploy-agents** runs Terraform in `agents-<env>`, waiting for reviewers in prod. The module creates the new agent version, and the workflow confirms the live manifest hash.
7. **Back in agentctl**, the agent shows the new version. **Risk & compliance** shows the change (for example GR-06 passing, and SC-02 *GitOps-managed*).

!!! note "Proposals"
    Bundles exported by **Requesters** are marked `[Proposal]`. The gate also requires an approval from one of the agent's **current owners**.

## Common failures

| Check | Message | Fix |
|---|---|---|
| verify | `Checksums: mismatch` | A file was edited after export: re-export from agentctl |
| verify | `Declared risk … recomputed …` | The bundle was hand-edited, or agentctl's approver policy differs from `platform/policy.json` |
| verify | `PR changes agent bundles and platform files together` | Split the PR |
| drift | `changed since this bundle was built` | Someone changed the agent in the portal or merged another change: rebuild from the live agent |
| gate | `not mapped in platform/approvers.json` | Add the group/owner mapping (platform PR) |
| deploy | `live … has manifest …, expected …` | `apply_agent_definition = false` in that environment's tfvars, or the apply script failed: check the Terraform log |
