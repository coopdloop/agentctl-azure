import { Badge, Button, MessageBar, MessageBarBody, MessageBarTitle, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowUpload20Regular } from "@fluentui/react-icons";
import JSZip from "jszip";
import { useRef, useState } from "react";
import { verifyBundle, type Verification } from "../bundle/verify";
import { DataTable, PageHeader, RiskBadge, Section, StatusBadge } from "../components/common";
import type { RiskTier } from "../config";
import { DiffView } from "./builder/BundlePanel";

const useStyles = makeStyles({
  drop: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: "32px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    background: tokens.colorNeutralBackground1,
  },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)", gap: "16px", marginTop: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  list: { margin: 0, paddingLeft: "18px", fontSize: tokens.fontSizeBase200, lineHeight: "1.7" },
  kv: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", fontSize: tokens.fontSizeBase300 },
  muted: { color: tokens.colorNeutralForeground3 },
});

async function readZip(file: File): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  // strip the single top-level folder
  const prefix = entries.length && entries.every((e) => e.name.split("/")[0] === entries[0].name.split("/")[0]) ? entries[0].name.split("/")[0] + "/" : "";
  const out: Record<string, string> = {};
  for (const e of entries) out[e.name.slice(prefix.length)] = await e.async("string");
  return out;
}

export function ReviewPage() {
  const s = useStyles();
  const input = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<Verification | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = async (f: File) => {
    setErr(null);
    try {
      const fs = await readZip(f);
      setFiles(fs);
      setName(f.name);
      setV(await verifyBundle(fs));
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Review bundle"
        subtitle="Approvers: load a bundle to verify integrity, re-validate schemas and independently recompute risk and required approvers. The same checks belong in the pipeline's first stage."
      />
      <div
        className={s.drop}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) load(f);
        }}
      >
        <ArrowUpload20Regular />
        <Text>Drop a bundle .zip here</Text>
        <Button onClick={() => input.current?.click()}>Choose file</Button>
        <input ref={input} type="file" accept=".zip" hidden onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        {name && <Text size={200} className={s.muted}>{name}</Text>}
      </div>
      {err && (
        <MessageBar intent="error" style={{ marginTop: 12 }}>
          <MessageBarBody>{err}</MessageBarBody>
        </MessageBar>
      )}
      {v && (
        <>
          <MessageBar intent={v.ok ? "success" : "error"} style={{ marginTop: 16 }}>
            <MessageBarBody>
              <MessageBarTitle>{v.ok ? "Bundle verified" : "Verification failed"}</MessageBarTitle>
              {v.ok ? "Integrity, schemas and declared risk check out. Review the diff before approving." : "Do not approve. See failed checks below."}
            </MessageBarBody>
          </MessageBar>
          <div className={s.grid}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {v.cr && (
                <Section title={v.cr.metadata.title} description={`${v.cr.metadata.id} · ${v.cr.spec.changeType} · by ${v.cr.metadata.requestedBy}`}>
                  <div className={s.kv}>
                    <span className={s.muted}>Target</span>
                    <span>
                      {v.cr.spec.target.agent} ({v.cr.spec.target.account}/{v.cr.spec.target.project})
                    </span>
                    <span className={s.muted}>Declared risk</span>
                    <span>
                      <RiskBadge tier={v.cr.spec.risk.tier} /> {v.cr.spec.risk.score}/100
                    </span>
                    {v.recomputed && (
                      <>
                        <span className={s.muted}>Recomputed</span>
                        <span>
                          <RiskBadge tier={v.recomputed.tier as RiskTier} /> {v.recomputed.score}/100
                        </span>
                      </>
                    )}
                    <span className={s.muted}>Approvers</span>
                    <span>
                      {v.cr.spec.approvals.required.map((a) => (
                        <Badge key={a.group} appearance="outline" style={{ marginRight: 4 }}>
                          {a.group}
                        </Badge>
                      ))}
                    </span>
                  </div>
                  <Text size={200}>{v.cr.spec.rationale}</Text>
                  <ul className={s.list}>
                    {v.cr.spec.changes.map((c, i) => (
                      <li key={i}>
                        <RiskBadge tier={c.riskTier} /> {c.summary}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <Section title="Checks">
                <DataTable
                  rows={v.checks}
                  rowKey={(c) => c.name}
                  columns={[
                    { key: "s", header: "", render: (c) => <StatusBadge level={c.status === "pass" ? "good" : c.status === "warn" ? "warning" : "critical"}>{c.status}</StatusBadge> },
                    { key: "n", header: "Check", render: (c) => c.name },
                    { key: "d", header: "Detail", render: (c) => <span style={{ fontSize: 12 }}>{c.detail}</span> },
                  ]}
                />
              </Section>
            </div>
            <Section title="Diff">
              <DiffView diff={files["diff/agent.yaml.diff"] ?? "(no diff in bundle)"} />
            </Section>
          </div>
        </>
      )}
    </>
  );
}
