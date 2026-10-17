import { Button, Link, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowRight16Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useDs } from "../api";
import { HBarChart, RunsChart, TokensByAgentChart } from "../components/charts";
import { DataTable, PageHeader, QueryState, Section, StatTile, StatusBadge, TileGrid, flowLabel } from "../components/common";
import { fmtCompact, fmtInt, fmtMs, fmtPct, fmtAgo } from "../lib/format";
import { useFindings } from "../lib/useFindings";
import { useUi } from "../state/ui";

const useStyles = makeStyles({
  grid2: { display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: "16px", marginBottom: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  grid2even: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px", "@media (max-width: 1100px)": { gridTemplateColumns: "1fr" } },
  findingRow: { display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  findingText: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function OverviewPage() {
  const s = useStyles();
  const { range } = useUi();
  const nav = useNavigate();
  const overview = useDs("overview", range);
  const stats = useDs("agentStats", range);
  const tokens_ = useDs("tokenSeries", range);
  const agents = useDs("listAgents");
  const { findings } = useFindings();

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Live agent activity, identity usage and guardrail posture across your Foundry projects."
      />
      <QueryState q={overview} label="overview">
        {(o) => (
          <>
            <TileGrid>
              <StatTile label="Agents" value={o.agents} hint={`${o.projects} Foundry projects`} />
              <StatTile label={`Runs · ${range}`} value={fmtCompact(o.runs)} hint={`${fmtPct(o.failedRuns, o.runs)} failed`} status={o.failedRuns / Math.max(o.runs, 1) > 0.05 ? "warning" : "good"} />
              <StatTile label={`Tokens · ${range}`} value={fmtCompact(o.tokens)} hint="input + output" />
              <StatTile label="Active users" value={fmtInt(o.activeUsers)} hint="distinct signed-in callers" />
              <StatTile
                label="Unapproved write tools"
                value={o.approvalFreeWriteTools}
                hint={o.approvalFreeWriteTools ? "run without human approval" : "all gated"}
                status={o.approvalFreeWriteTools ? "serious" : "good"}
              />
              <StatTile
                label="Open findings"
                value={findings.length}
                hint={`${findings.filter((f) => f.severity === "critical").length} critical`}
                status={findings.some((f) => f.severity === "critical") ? "critical" : findings.length ? "warning" : "good"}
              />
            </TileGrid>

            <div className={s.grid2}>
              <Section title="Agent runs" description="Runs from gen_ai traces in Application Insights">
                <RunsChart data={o.runsSeries} range={range} />
              </Section>
              <Section title="How agents are called" description="Auth flow mix from Entra sign-in logs">
                <HBarChart
                  data={o.authFlowMix.map((m) => ({ flow: flowLabel(m.flow), count: m.count })).sort((a, b) => b.count - a.count)}
                  labelKey="flow"
                  valueKey="count"
                  name="Sign-ins / runs"
                />
              </Section>
            </div>
          </>
        )}
      </QueryState>

      <div className={s.grid2}>
        <Section title="Token consumption by agent" description="Stacked by agent; colour stays with the agent across views">
          <QueryState q={tokens_}>
            {(series) => <TokensByAgentChart data={series} agents={(agents.data ?? []).map((a) => a.name)} range={range} />}
          </QueryState>
        </Section>
        <Section
          title="Top guardrail findings"
          actions={
            <Button appearance="subtle" size="small" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => nav("/guardrails")}>
              All findings
            </Button>
          }
        >
          {findings.slice(0, 6).map((f) => (
            <div key={f.id} className={s.findingRow}>
              <StatusBadge level={f.severity}>{f.severity}</StatusBadge>
              <div className={s.findingText}>
                <span>{f.title}</span>
                <span className={s.muted}>{f.resource}</span>
              </div>
            </div>
          ))}
          {!findings.length && <span className={s.muted}>No findings 🎉</span>}
        </Section>
      </div>

      <div className={s.grid2even}>
        <Section title="Agents by activity">
          <QueryState q={stats}>
            {(rows) => (
              <DataTable
                rows={rows.filter((r) => r.runs > 0)}
                rowKey={(r) => r.agentName}
                initialSort={{ key: "runs", dir: "desc" }}
                onRowClick={(r) => {
                  const a = agents.data?.find((x) => x.name === r.agentName);
                  if (a) nav(`/agents/${a.project}/${a.id}`);
                }}
                columns={[
                  { key: "agent", header: "Agent", render: (r) => <Link>{r.agentName}</Link>, sort: (r) => r.agentName },
                  { key: "runs", header: "Runs", render: (r) => fmtInt(r.runs), sort: (r) => r.runs, numeric: true },
                  { key: "fail", header: "Failed", render: (r) => fmtPct(r.failedRuns, r.runs), sort: (r) => r.failedRuns / Math.max(r.runs, 1), numeric: true },
                  { key: "users", header: "Users", render: (r) => fmtInt(r.distinctUsers), sort: (r) => r.distinctUsers, numeric: true },
                  { key: "p95", header: "p95", render: (r) => fmtMs(r.p95LatencyMs), sort: (r) => r.p95LatencyMs, numeric: true },
                  { key: "last", header: "Last run", render: (r) => fmtAgo(r.lastActivity), sort: (r) => r.lastActivity ?? "" },
                ]}
              />
            )}
          </QueryState>
        </Section>
        <Section title="Most-used tools" description="execute_tool spans">
          <QueryState q={overview}>
            {(o) => <HBarChart data={o.topTools} labelKey="tool" valueKey="calls" name="Calls" />}
          </QueryState>
        </Section>
      </div>
    </>
  );
}
