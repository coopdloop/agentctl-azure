import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { BranchFork20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useSession } from "../auth/session";
import type { BundleResult } from "../bundle/buildBundle";
import { config } from "../config";
import {
  getGithubToken,
  githubConfigured,
  openPullRequest,
  parseRepo,
  pollDeviceFlow,
  readRepoAgentState,
  startDeviceFlow,
  type DeviceCode,
} from "../api/live/github";

const useStyles = makeStyles({
  code: { fontFamily: tokens.fontFamilyMonospace, fontSize: "28px", letterSpacing: "4px", fontWeight: tokens.fontWeightSemibold, margin: "8px 0" },
  stack: { display: "flex", flexDirection: "column", gap: "10px" },
});

/** Desired state of an agent in the agents-gitops repo (live mode, repo configured). */
export function useRepoAgentState(agent: string | undefined) {
  const { mode } = useSession();
  const enabled = mode === "live" && Boolean(agent) && Boolean(parseRepo(config.gitops.repo));
  return useQuery({
    queryKey: ["github", "agentState", config.gitops.repo, agent, Boolean(getGithubToken())],
    queryFn: () => readRepoAgentState(agent!),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

type Phase = { kind: "idle" } | { kind: "code"; code: DeviceCode } | { kind: "working"; step: string } | { kind: "done"; url: string; number: number } | { kind: "error"; message: string };

/** Opens a pull request with the bundle in the agents-gitops repo (GitHub device-flow sign-in). */
export function OpenPullRequestButton({ bundle, proposal, disabled }: { bundle: BundleResult | null; proposal: boolean; disabled?: boolean }) {
  const s = useStyles();
  const { mode } = useSession();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  const repo = parseRepo(config.gitops.repo);
  const available = mode === "live" && githubConfigured();

  const create = async () => {
    if (!bundle || !repo) return;
    const cr = bundle.changeRequest;
    setPhase({ kind: "working", step: "Committing the bundle and opening the pull request…" });
    const body = [
      `**Change request:** \`${cr.metadata.id}\`  `,
      `**Agent:** \`${cr.spec.target.agent}\` · **change:** ${cr.spec.changeType} · **risk:** ${cr.spec.risk.tier} (${cr.spec.risk.score})  `,
      `**Required approvers:** ${cr.spec.approvals.required.map((a) => `\`${a.group}\``).join(", ")} (min ${cr.spec.approvals.minApprovers})`,
      proposal ? "\n> **Proposal** from a Requester: the agent's current owners must approve." : "",
      "",
      "### Rationale",
      cr.spec.rationale,
      "",
      "### Changes",
      ...cr.spec.changes.map((c) => `- \`${c.riskTier}\` ${c.summary}`),
      "",
      "_Opened by agentctl. The agent-bundle workflow verifies checksums, schemas, recomputed risk/approvers and live drift._",
    ].join("\n");
    try {
      const pr = await openPullRequest({
        folder: bundle.folder,
        files: bundle.files,
        title: cr.metadata.title,
        body,
        branch: `agentctl/${cr.metadata.id}`,
        draft: proposal,
        labels: ["agentctl", ...(proposal ? ["proposal"] : []), `risk:${cr.spec.risk.tier}`],
      });
      setPhase({ kind: "done", url: pr.url, number: pr.number });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const start = async () => {
    setOpen(true);
    if (getGithubToken()) return void create();
    try {
      setPhase({ kind: "working", step: "Requesting a GitHub sign-in code…" });
      const code = await startDeviceFlow();
      setPhase({ kind: "code", code });
      abort.current = new AbortController();
      await pollDeviceFlow(code, abort.current.signal);
      await create();
    } catch (e) {
      if ((e as Error).message !== "cancelled") setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const close = () => {
    abort.current?.abort();
    setOpen(false);
    setPhase({ kind: "idle" });
  };

  return (
    <>
      <Button
        icon={<BranchFork20Regular />}
        disabled={disabled || !bundle || !available}
        title={available ? `Open a pull request in ${repo?.owner}/${repo?.name}` : "Configure the agents repo and a GitHub App client id (docs: Agents GitOps repo → Open PRs from agentctl)"}
        onClick={() => void start()}
      >
        Open pull request
      </Button>
      <Dialog open={open} onOpenChange={(_, d) => !d.open && close()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Open pull request in {repo ? `${repo.owner}/${repo.name}` : "the agents repo"}</DialogTitle>
            <DialogContent className={s.stack}>
              {phase.kind === "working" && <Spinner size="small" label={phase.step} />}
              {phase.kind === "code" && (
                <>
                  <Text>Sign in to GitHub to authorise agentctl for this repo. Open the link and enter the code:</Text>
                  <div className={s.code}>{phase.code.user_code}</div>
                  <Link href={phase.code.verification_uri} target="_blank" rel="noreferrer">
                    {phase.code.verification_uri}
                  </Link>
                  <Spinner size="tiny" label="Waiting for approval…" />
                </>
              )}
              {phase.kind === "done" && (
                <MessageBar intent="success">
                  <MessageBarBody>
                    Pull request <Link href={phase.url} target="_blank" rel="noreferrer">#{phase.number}</Link> opened{proposal ? " as a draft proposal" : ""}. The agent-bundle workflow now verifies it.
                  </MessageBarBody>
                </MessageBar>
              )}
              {phase.kind === "error" && (
                <MessageBar intent="error">
                  <MessageBarBody>{phase.message}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={close}>{phase.kind === "done" ? "Close" : "Cancel"}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
