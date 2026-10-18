import {
  Badge,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Tab,
  TabList,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useSession } from "../../auth/session";
import { buildBundle, downloadBlob, zipBundle, type BundleResult } from "../../bundle/buildBundle";
import { RiskBadge, Section } from "../../components/common";
import { OpenPullRequestButton } from "../../components/GitHub";
import type { AgentManifest } from "../../schema/manifest";
import { Grid2, Hint } from "./fields";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: "16px" },
  risk: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  score: { fontSize: "28px", fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  list: { margin: 0, paddingLeft: "18px", fontSize: tokens.fontSizeBase200, lineHeight: "1.7" },
  code: { background: tokens.colorNeutralBackground3 },
  approvers: { display: "flex", gap: "6px", flexWrap: "wrap" },
  issues: { margin: "4px 0 0", paddingLeft: "18px", fontSize: tokens.fontSizeBase200 },
});

export function DiffView({ diff }: { diff: string }) {
  const s = useStyles();
  return (
    <pre className={`code ${s.code}`}>
      {diff.split("\n").map((l, i) => (
        <div key={i} className={l.startsWith("+") && !l.startsWith("+++") ? "diff-add" : l.startsWith("-") && !l.startsWith("---") ? "diff-del" : l.startsWith("@@") ? "diff-hunk" : undefined}>
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

export function BundlePanel({
  before,
  after,
  foundryAgentId,
  defaultTitle,
  defaultRationale = "",
}: {
  before: AgentManifest | null;
  after: AgentManifest;
  foundryAgentId?: string;
  defaultTitle: string;
  defaultRationale?: string;
}) {
  const s = useStyles();
  const { user, can } = useSession();
  const proposal = !can("Builder") && can("Requester");
  const [title, setTitle] = useState(defaultTitle);
  const [rationale, setRationale] = useState(defaultRationale);
  const [bundle, setBundle] = useState<BundleResult | null>(null);
  const [view, setView] = useState("diff");

  useEffect(() => setTitle(defaultTitle), [defaultTitle]);
  useEffect(() => {
    if (defaultRationale) setRationale(defaultRationale);
  }, [defaultRationale]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      buildBundle({ before, after, title: title || "Untitled change", rationale: rationale || "(missing rationale)", requestedBy: user.upn || user.name, foundryAgentId, proposal })
        .then((b) => !cancelled && setBundle(b))
        .catch((e) => console.error(e));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [before, after, title, rationale, user, foundryAgentId, proposal]);

  const noChanges = !!before && bundle?.changeRequest.spec.changes.every((c) => c.summary === "No effective changes");
  const crIssues = (bundle?.crIssues ?? []).filter((i) => !(i.path === "/spec/rationale" && rationale.length >= 10));
  const blockers = [
    ...(bundle?.agentIssues ?? []).map((i) => `agent.yaml ${i.path}: ${i.message}`),
    ...crIssues.map((i) => `change-request.yaml ${i.path}: ${i.message}`),
    ...(title.length < 5 ? ["Title must be at least 5 characters"] : []),
    ...(rationale.length < 10 ? ["Rationale must be at least 10 characters"] : []),
    ...(noChanges ? ["No changes compared to the deployed agent"] : []),
  ];

  const download = async () => {
    if (!bundle) return;
    const blob = await zipBundle(bundle);
    downloadBlob(blob, `${bundle.changeRequest.metadata.id}-${bundle.changeRequest.spec.target.agent}.zip`);
  };

  const cr = bundle?.changeRequest;
  const files = bundle?.files ?? {};

  return (
    <div className={s.stack}>
      {proposal && (
        <MessageBar intent="info">
          <MessageBarBody>
            <MessageBarTitle>Submitting as a proposal</MessageBarTitle>
            You have the Requester role: the bundle is marked as a proposal, and the agent's owners must adopt it before normal approvals apply.
          </MessageBarBody>
        </MessageBar>
      )}
      <Section title={proposal ? "Proposal" : "Change request"}>
        <Grid2>
          <Field label="Title" required>
            <Input value={title} onChange={(_, d) => setTitle(d.value)} />
          </Field>
        </Grid2>
        <Field label="Rationale" required hint="Why this change is needed; reviewers see this first.">
          <Textarea rows={3} value={rationale} onChange={(_, d) => setRationale(d.value)} />
        </Field>
      </Section>

      {cr && (
        <Section title="Risk & approvals" description="Computed from the change set; the pipeline enforces the approver list.">
          <div className={s.risk}>
            <RiskBadge tier={cr.spec.risk.tier} />
            <span className={s.score}>{cr.spec.risk.score}</span>
            <Hint>/ 100 risk score · {cr.spec.changeType}</Hint>
          </div>
          <div className={s.approvers}>
            {cr.spec.approvals.required.map((a) => (
              <Badge key={a.group} appearance="outline" title={a.reason}>
                {a.group}
              </Badge>
            ))}
            <Hint>min {cr.spec.approvals.minApprovers} approver(s)</Hint>
          </div>
          <ul className={s.list}>
            {cr.spec.changes.map((c, i) => (
              <li key={i}>
                <RiskBadge tier={c.riskTier} /> <code>{c.op}</code> {c.summary}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {blockers.length > 0 ? (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Not ready to export</MessageBarTitle>
            <ul className={s.issues}>
              {blockers.slice(0, 12).map((b) => (
                <li key={b}>{b}</li>
              ))}
              {blockers.length > 12 && <li>…and {blockers.length - 12} more</li>}
            </ul>
          </MessageBarBody>
        </MessageBar>
      ) : (
        <MessageBar intent="success">
          <MessageBarBody>Manifest and change request validate against the schemas.</MessageBarBody>
        </MessageBar>
      )}

      <Section
        title="Bundle contents"
        description={bundle ? `${Object.keys(files).length} files → ${bundle.folder}/ in the GitOps repo` : "Building…"}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <OpenPullRequestButton bundle={bundle} proposal={proposal} disabled={blockers.length > 0} />
            <Button appearance="primary" icon={<ArrowDownload20Regular />} disabled={!bundle || blockers.length > 0} onClick={download}>
              Download bundle (.zip)
            </Button>
          </div>
        }
      >
        <TabList size="small" selectedValue={view} onTabSelect={(_, d) => setView(d.value as string)}>
          <Tab value="diff">Diff</Tab>
          <Tab value="manifest/agent.yaml">agent.yaml</Tab>
          <Tab value="change-request.yaml">change-request.yaml</Tab>
          <Tab value="instructions/effective.md">Effective prompt</Tab>
          <Tab value="foundry/agent-definition.json">Foundry payload</Tab>
          <Tab value="terraform/main.tf">Terraform</Tab>
          <Tab value="README.md">README</Tab>
        </TabList>
        {view === "diff" ? <DiffView diff={files["diff/agent.yaml.diff"] ?? ""} /> : <pre className={`code ${s.code}`}>{files[view] ?? ""}</pre>}
      </Section>
    </div>
  );
}
