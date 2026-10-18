import {
  Badge,
  Button,
  Dropdown,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Link,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  OverlayDrawer,
  Spinner,
  Tab,
  TabList,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, Dismiss24Regular, Open16Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadBlob } from "../bundle/buildBundle";
import { DataTable, ErrorBar, Mono, PageHeader, Section, StatTile, TileGrid } from "../components/common";
import { CONTROL_BY_ID, DOMAINS, type Control, type ControlDomain } from "../controls/catalog";
import { rollup, worst, type Result, type Status } from "../controls/evaluate";
import { FRAMEWORKS, frameworkItems, itemKey, type FrameworkKey } from "../controls/frameworks";
import { ControlStatus, RollupBar, RollupLegend, STATUS_LABEL, scoreLevel } from "../controls/ui";
import { useCompliance } from "../controls/useCompliance";
import type { Agent } from "../api/types";

const useStyles = makeStyles({
  tabs: { marginBottom: "16px" },
  stack: { display: "flex", flexDirection: "column", gap: "16px" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  fwRow: { display: "grid", gridTemplateColumns: "minmax(140px, 1.2fr) 2fr 56px", gap: "12px", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  fwName: { display: "flex", flexDirection: "column" },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  score: { fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: tokens.fontWeightSemibold },
  chips: { display: "flex", gap: "4px", flexWrap: "wrap" },
  filters: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" },
  kv: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 14px", fontSize: tokens.fontSizeBase300, marginBottom: "12px" },
  para: { margin: "0 0 12px", fontSize: tokens.fontSizeBase300, lineHeight: tokens.lineHeightBase300 },
  cellCenter: { textAlign: "center" },
});

const STATUS_SORT: Record<Status, number> = { fail: 0, attest: 1, warn: 2, unknown: 3, pass: 4, na: 5 };

export function CompliancePage() {
  const s = useStyles();
  const { results, loading, error, unavailable, agents } = useCompliance();
  const [tab, setTab] = useState("overview");
  const [open, setOpen] = useState<string | null>(null);
  const nav = useNavigate();

  const byControl = useMemo(() => {
    const m = new Map<string, Result[]>();
    for (const r of results) m.set(r.control, [...(m.get(r.control) ?? []), r]);
    return m;
  }, [results]);

  if (error) return <ErrorBar error={error} />;
  if (loading) return <Spinner label="Evaluating controls…" />;

  const total = rollup(results);
  const controlStatus = [...byControl.entries()].map(([id, rs]) => ({ id, status: worst(rs) }));
  const failing = controlStatus.filter((c) => c.status === "fail");
  const signoff = controlStatus.filter((c) => c.status === "attest");
  const agentsAtRisk = agents.filter((a) => results.some((r) => r.target.kind === "agent" && r.target.name === a.name && r.status === "fail" && CONTROL_BY_ID.get(r.control)?.severity === "high"));

  return (
    <>
      <PageHeader
        title="Risk & compliance"
        subtitle="50 AI risk controls cross-walked to OWASP LLM and Agentic Top 10, NIST AI RMF, ISO/IEC 42001, the EU AI Act, MITRE ATLAS and the Microsoft AI security benchmark, evaluated against your Azure environment and Foundry agents."
        actions={<ExportMenu results={results} />}
      />
      {unavailable.length > 0 && (
        <MessageBar intent="info" style={{ marginBottom: 12 }}>
          <MessageBarBody>
            <MessageBarTitle>Some evidence isn't readable with your access</MessageBarTitle>
            {unavailable.join(", ")}. Controls that depend on them show as Unknown.
          </MessageBarBody>
        </MessageBar>
      )}
      <TileGrid>
        <StatTile label="Control score" value={total.score === null ? "–" : `${total.score}%`} hint={`${total.pass} pass · ${total.fail} fail across ${results.length} checks`} status={scoreLevel(total.score)} />
        <StatTile label="Failing controls" value={failing.length} hint={failing.slice(0, 4).map((c) => c.id).join(", ") || "none"} status={failing.length ? "critical" : "good"} />
        <StatTile label="Need sign-off" value={signoff.length} hint="manual or partially automated" status={signoff.length ? "info" : "good"} />
        <StatTile label="Agents with high-severity failures" value={`${agentsAtRisk.length}/${agents.length}`} hint={agentsAtRisk.slice(0, 3).map((a) => a.name).join(", ") || "none"} status={agentsAtRisk.length ? "serious" : "good"} />
      </TileGrid>
      <TabList className={s.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
        <Tab value="overview">Overview</Tab>
        <Tab value="controls">Controls</Tab>
        <Tab value="frameworks">Frameworks</Tab>
        <Tab value="agents">Agents</Tab>
      </TabList>
      {tab === "overview" && <OverviewTab results={results} byControl={byControl} onFramework={() => setTab("frameworks")} />}
      {tab === "controls" && <ControlsTab byControl={byControl} onOpen={setOpen} />}
      {tab === "frameworks" && <FrameworksTab byControl={byControl} onOpen={setOpen} />}
      {tab === "agents" && <AgentsTab agents={agents} results={results} onAgent={(a) => nav(`/agents/${encodeURIComponent(a.project)}/${encodeURIComponent(a.id)}?tab=compliance`)} />}
      <ControlDrawer id={open} results={open ? byControl.get(open) ?? [] : []} onClose={() => setOpen(null)} />
    </>
  );
}

function OverviewTab({ results, byControl, onFramework }: { results: Result[]; byControl: Map<string, Result[]>; onFramework(): void }) {
  const s = useStyles();
  const fwRows = FRAMEWORKS.map((fw) => {
    const items = frameworkItems(fw.key);
    const itemResults = items.flatMap((i) => i.controls.flatMap((c) => byControl.get(c) ?? []));
    const covered = items.filter((i) => i.controls.length).length;
    return { fw, r: rollup(itemResults), covered, items: items.length };
  });
  const domains = (Object.keys(DOMAINS) as ControlDomain[]).map((d) => ({ d, r: rollup(results.filter((x) => x.control.startsWith(`${d}-`))) }));
  return (
    <div className={s.grid2}>
      <Section title="By framework" description="Results of every control mapped to the framework's items." actions={<Button size="small" onClick={onFramework}>Details</Button>}>
        <RollupLegend />
        {fwRows.map(({ fw, r, covered, items }) => (
          <div key={fw.key} className={s.fwRow}>
            <div className={s.fwName}>
              <Text weight="semibold">{fw.short}</Text>
              <span className={s.muted}>
                {fw.version}
                {fw.binding ? " · binding" : ""} · {covered}/{items} items mapped
              </span>
            </div>
            <RollupBar r={r} />
            <span className={s.score}>{r.score ?? "–"}%</span>
          </div>
        ))}
      </Section>
      <Section title="By domain">
        <RollupLegend />
        {domains.map(({ d, r }) => (
          <div key={d} className={s.fwRow}>
            <div className={s.fwName}>
              <Text weight="semibold">{DOMAINS[d]}</Text>
              <span className={s.muted}>{d}</span>
            </div>
            <RollupBar r={r} />
            <span className={s.score}>{r.score ?? "–"}%</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function ControlsTab({ byControl, onOpen }: { byControl: Map<string, Result[]>; onOpen(id: string): void }) {
  const s = useStyles();
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("all");
  const rows = [...CONTROL_BY_ID.values()]
    .map((c) => ({ c, rs: byControl.get(c.id) ?? [] }))
    .map((x) => ({ ...x, status: worst(x.rs), r: rollup(x.rs) }))
    .filter((x) => (domain === "all" || x.c.domain === domain) && (status === "all" || x.status === status));
  return (
    <Section
      title={`${rows.length} controls`}
      actions={
        <div className={s.filters}>
          <Dropdown value={domain === "all" ? "All domains" : DOMAINS[domain as ControlDomain]} onOptionSelect={(_, d) => setDomain(d.optionValue ?? "all")}>
            <Option value="all">All domains</Option>
            {(Object.entries(DOMAINS) as [ControlDomain, string][]).map(([k, v]) => (
              <Option key={k} value={k}>
                {v}
              </Option>
            ))}
          </Dropdown>
          <Dropdown value={status === "all" ? "Any status" : STATUS_LABEL[status as Status]} onOptionSelect={(_, d) => setStatus(d.optionValue ?? "all")}>
            <Option value="all">Any status</Option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((k) => (
              <Option key={k} value={k}>
                {STATUS_LABEL[k]}
              </Option>
            ))}
          </Dropdown>
        </div>
      }
    >
      <DataTable
        rows={rows}
        rowKey={(x) => x.c.id}
        onRowClick={(x) => onOpen(x.c.id)}
        initialSort={{ key: "status", dir: "asc" }}
        columns={[
          { key: "id", header: "ID", sort: (x) => x.c.id, render: (x) => <Mono>{x.c.id}</Mono>, width: "72px" },
          { key: "title", header: "Control", sort: (x) => x.c.title, render: (x) => x.c.title },
          { key: "domain", header: "Domain", sort: (x) => x.c.domain, render: (x) => DOMAINS[x.c.domain] },
          { key: "evidence", header: "Evidence", sort: (x) => x.c.evidence, render: (x) => <EvidenceBadge c={x.c} /> },
          { key: "sev", header: "Severity", sort: (x) => ({ high: 0, medium: 1, low: 2 })[x.c.severity], render: (x) => x.c.severity },
          { key: "status", header: "Status", sort: (x) => STATUS_SORT[x.status], render: (x) => <ControlStatus status={x.status} /> },
          { key: "targets", header: "Results", render: (x) => <RollupBar r={x.r} /> },
          { key: "fw", header: "Frameworks", render: (x) => <FrameworkChips c={x.c} /> },
        ]}
      />
    </Section>
  );
}

function EvidenceBadge({ c }: { c: Control }) {
  const label = { auto: "Automated", partial: "Partial", manual: "Attestation" }[c.evidence];
  return (
    <Tooltip content={c.caveat ? `${c.signals} Caveat: ${c.caveat}` : c.signals} relationship="description">
      <Badge appearance="tint" color={c.evidence === "auto" ? "brand" : c.evidence === "partial" ? "informative" : "subtle"}>
        {label}
        {c.caveat ? " *" : ""}
      </Badge>
    </Tooltip>
  );
}

function FrameworkChips({ c }: { c: Control }) {
  const s = useStyles();
  return (
    <div className={s.chips}>
      {FRAMEWORKS.filter((f) => c.mappings[f.key]?.length).map((f) => (
        <Tooltip key={f.key} content={`${f.short}: ${c.mappings[f.key]!.join(", ")}`} relationship="description">
          <Badge appearance="outline" size="small">
            {f.short}
          </Badge>
        </Tooltip>
      ))}
    </div>
  );
}

function FrameworksTab({ byControl, onOpen }: { byControl: Map<string, Result[]>; onOpen(id: string): void }) {
  const s = useStyles();
  const [key, setKey] = useState<FrameworkKey>("asi");
  const fw = FRAMEWORKS.find((f) => f.key === key)!;
  const rows = frameworkItems(key).map((i) => {
    const rs = i.controls.flatMap((c) => byControl.get(c) ?? []);
    return { ...i, status: i.controls.length ? worst(rs) : ("unmapped" as const), r: rollup(rs) };
  });
  const gaps = rows.filter((r) => r.status === "unmapped");
  return (
    <Section
      title={fw.name}
      description={
        <>
          Version {fw.version} · published {fw.published} · {fw.kind}
          {fw.binding ? " · legally binding" : ""} ·{" "}
          <Link href={fw.url} target="_blank" rel="noreferrer">
            source <Open16Regular />
          </Link>
        </>
      }
      actions={
        <Dropdown value={fw.short} onOptionSelect={(_, d) => setKey(d.optionValue as FrameworkKey)}>
          {FRAMEWORKS.map((f) => (
            <Option key={f.key} value={f.key}>
              {f.short}
            </Option>
          ))}
        </Dropdown>
      }
    >
      {gaps.length > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>No control maps to: {gaps.map((g) => g.item).join(", ")}</MessageBarBody>
        </MessageBar>
      )}
      <DataTable
        rows={rows}
        rowKey={(r) => r.item}
        maxRows={1000}
        columns={[
          { key: "item", header: "Item", sort: (r) => r.item, render: (r) => <Mono>{r.item}</Mono>, width: "120px" },
          { key: "title", header: "Title", render: (r) => fw.titles[r.item] ?? (fw.group ? <span className={s.muted}>{fw.group(r.item)}</span> : "") },
          { key: "status", header: "Status", sort: (r) => (r.status === "unmapped" ? -1 : STATUS_SORT[r.status]), render: (r) => (r.status === "unmapped" ? <Badge color="danger" appearance="outline">Not covered</Badge> : <ControlStatus status={r.status} />) },
          { key: "bar", header: "Results", render: (r) => <RollupBar r={r.r} /> },
          {
            key: "controls",
            header: "Controls",
            render: (r) => (
              <div className={s.chips}>
                {r.controls.map((c) => (
                  <Tooltip key={c} content={`${CONTROL_BY_ID.get(c)?.title}: ${STATUS_LABEL[worst(byControl.get(c) ?? [])]}`} relationship="description">
                    <Button size="small" appearance="subtle" onClick={() => onOpen(c)}>
                      {c}
                    </Button>
                  </Tooltip>
                ))}
              </div>
            ),
          },
        ]}
      />
    </Section>
  );
}

function AgentsTab({ agents, results, onAgent }: { agents: Agent[]; results: Result[]; onAgent(a: Agent): void }) {
  const s = useStyles();
  const domains = Object.keys(DOMAINS) as ControlDomain[];
  const rows = agents.map((a) => {
    const mine = results.filter((r) => r.target.kind === "agent" && r.target.name === a.name);
    // Account-level controls apply to the agents hosted on that account.
    const acct = results.filter((r) => r.target.kind === "account" && r.target.name === a.account);
    const all = [...mine, ...acct];
    return { a, r: rollup(all), byDomain: Object.fromEntries(domains.map((d) => [d, worst(all.filter((x) => x.control.startsWith(`${d}-`)))])) as Record<ControlDomain, Status> };
  });
  return (
    <Section title="Agents" description="Agent-level controls plus the account-level controls of the Foundry account each agent runs on. Click an agent for its evidence.">
      <DataTable
        rows={rows}
        rowKey={(x) => `${x.a.project}/${x.a.id}`}
        onRowClick={(x) => onAgent(x.a)}
        initialSort={{ key: "score", dir: "asc" }}
        columns={[
          { key: "name", header: "Agent", sort: (x) => x.a.name, render: (x) => <Link>{x.a.name}</Link> },
          { key: "tier", header: "Tier", sort: (x) => x.a.governance?.riskTier ?? "", render: (x) => x.a.governance?.riskTier ?? <span className={s.muted}>unset</span> },
          { key: "score", header: "Score", numeric: true, sort: (x) => x.r.score ?? -1, render: (x) => (x.r.score === null ? "–" : `${x.r.score}%`) },
          { key: "bar", header: "Results", render: (x) => <RollupBar r={x.r} /> },
          ...domains.map((d) => ({
            key: d,
            header: d,
            render: (x: (typeof rows)[number]) => (
              <Tooltip content={`${DOMAINS[d]}: ${STATUS_LABEL[x.byDomain[d]]}`} relationship="label">
                <span className={s.cellCenter}>
                  <DomainDot status={x.byDomain[d]} />
                </span>
              </Tooltip>
            ),
          })),
        ]}
      />
    </Section>
  );
}

/** Compact status glyph with a distinct shape per status (not colour alone). */
function DomainDot({ status }: { status: Status }) {
  const glyph: Record<Status, [string, string]> = {
    pass: ["✓", tokens.colorPaletteGreenForeground1],
    fail: ["✕", tokens.colorPaletteRedForeground1],
    warn: ["!", tokens.colorPaletteMarigoldForeground1],
    attest: ["✎", tokens.colorBrandForeground1],
    unknown: ["?", tokens.colorNeutralForeground3],
    na: ["–", tokens.colorNeutralForeground4],
  };
  const [g, color] = glyph[status];
  return <span style={{ color, fontWeight: 700 }}>{g}</span>;
}

export function ControlDrawer({ id, results, onClose }: { id: string | null; results: Result[]; onClose(): void }) {
  const s = useStyles();
  const c = id ? CONTROL_BY_ID.get(id) : undefined;
  return (
    <OverlayDrawer open={Boolean(c)} onOpenChange={(_, d) => !d.open && onClose()} position="end" size="large">
      {c && (
        <>
          <DrawerHeader>
            <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
              {c.id} · {c.title}
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            <p className={s.para}>{c.description}</p>
            <div className={s.kv}>
              <span className={s.muted}>Domain</span>
              <span>{DOMAINS[c.domain]}</span>
              <span className={s.muted}>Scope</span>
              <span>{c.scope.join(", ")}</span>
              <span className={s.muted}>Severity</span>
              <span>{c.severity}</span>
              <span className={s.muted}>Evidence</span>
              <span>
                <EvidenceBadge c={c} /> {c.signals}
              </span>
              {c.attest && (
                <>
                  <span className={s.muted}>Sign-off captures</span>
                  <span>{c.attest}</span>
                </>
              )}
              {c.caveat && (
                <>
                  <span className={s.muted}>Caveat</span>
                  <span>{c.caveat}</span>
                </>
              )}
              {FRAMEWORKS.filter((f) => c.mappings[f.key]?.length).map((f) => (
                <MappingRow key={f.key} label={f.short} items={c.mappings[f.key]!} fw={f.key} />
              ))}
            </div>
            <Section title="Results">
              <DataTable
                rows={results}
                rowKey={(r) => `${r.target.kind}:${r.target.id}`}
                initialSort={{ key: "status", dir: "asc" }}
                columns={[
                  { key: "target", header: "Target", sort: (r) => r.target.name, render: (r) => <span>{r.target.name} <span className={s.muted}>({r.target.kind})</span></span> },
                  { key: "status", header: "Status", sort: (r) => STATUS_SORT[r.status], render: (r) => <ControlStatus status={r.status} /> },
                  {
                    key: "evidence",
                    header: "Evidence",
                    render: (r) => (
                      <span>
                        {r.evidence}
                        {r.attestation && (
                          <span className={s.muted}>
                            {" "}
                            [sign-off <Mono>{r.attestation.key}</Mono>
                            {r.attestation.expired ? ", expired" : ""}]
                          </span>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </Section>
          </DrawerBody>
        </>
      )}
    </OverlayDrawer>
  );
}

function MappingRow({ label, items, fw }: { label: string; items: string[]; fw: FrameworkKey }) {
  const s = useStyles();
  const def = FRAMEWORKS.find((f) => f.key === fw)!;
  return (
    <>
      <span className={s.muted}>{label}</span>
      <span className={s.chips}>
        {items.map((i) => (
          <Tooltip key={i} content={def.titles[itemKey(fw, i)] ?? i} relationship="description">
            <Badge appearance="outline" size="small">
              {i}
            </Badge>
          </Tooltip>
        ))}
      </span>
    </>
  );
}

function ExportMenu({ results }: { results: Result[] }) {
  const evidence = () => ({
    generatedAt: new Date().toISOString(),
    catalog: "agentctl AI risk controls v1 (50 controls)",
    frameworks: FRAMEWORKS.map(({ key, name, version, url }) => ({ key, name, version, url })),
    controls: [...CONTROL_BY_ID.values()].map((c) => ({ ...c, results: results.filter((r) => r.control === c.id) })),
  });
  const csv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = results.map((r) => {
      const c = CONTROL_BY_ID.get(r.control)!;
      return [r.control, c.title, DOMAINS[c.domain], c.severity, c.evidence, r.target.kind, r.target.name, r.status, r.evidence, r.attestation?.key ?? "", r.attestation?.expired ? "expired" : ""].map((x) => esc(String(x))).join(",");
    });
    return ["control,title,domain,severity,evidence_type,target_kind,target,status,evidence,attestation,attestation_state", ...rows].join("\n");
  };
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button icon={<ArrowDownload20Regular />}>Export evidence</Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => downloadBlob(new Blob([JSON.stringify(evidence(), null, 2)], { type: "application/json" }), `agentctl-controls-${stamp}.json`)}>Evidence pack (JSON)</MenuItem>
          <MenuItem onClick={() => downloadBlob(new Blob([csv()], { type: "text/csv" }), `agentctl-controls-${stamp}.csv`)}>Results (CSV)</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
