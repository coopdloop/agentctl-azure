import { Dropdown, Input, Option, makeStyles } from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useDs } from "../api";
import type { AgentRun } from "../api/types";
import { AuthFlowBadge, DataTable, Mono, PageHeader, QueryState, Section, StatusBadge } from "../components/common";
import { RunDrawer } from "../components/RunDrawer";
import { fmtInt, fmtMs, fmtTime } from "../lib/format";
import { useUi } from "../state/ui";

const useStyles = makeStyles({ filters: { display: "flex", gap: "8px", flexWrap: "wrap" } });

export function RunsTable({ runs, onOpen, hideAgent }: { runs: AgentRun[]; onOpen(r: AgentRun): void; hideAgent?: boolean }) {
  return (
    <DataTable
      rows={runs}
      rowKey={(r) => r.operationId}
      onRowClick={onOpen}
      initialSort={{ key: "start", dir: "desc" }}
      columns={[
        { key: "start", header: "Started", sort: (r) => r.start, render: (r) => fmtTime(r.start) },
        ...(hideAgent ? [] : [{ key: "agent", header: "Agent", sort: (r: AgentRun) => r.agentName, render: (r: AgentRun) => r.agentName }]),
        { key: "user", header: "Caller", sort: (r) => r.user ?? "", render: (r) => r.user ?? <i>app-only</i> },
        { key: "flow", header: "Auth flow", sort: (r) => r.authFlow ?? "", render: (r) => (r.authFlow ? <AuthFlowBadge flow={r.authFlow} /> : "—") },
        { key: "status", header: "Status", sort: (r) => Number(r.success), render: (r) => (r.success ? <StatusBadge level="good">ok</StatusBadge> : <StatusBadge level="critical">failed</StatusBadge>) },
        { key: "tools", header: "Tool calls", numeric: true, sort: (r) => r.toolCalls, render: (r) => r.toolCalls },
        { key: "tok", header: "Tokens", numeric: true, sort: (r) => r.inputTokens + r.outputTokens, render: (r) => fmtInt(r.inputTokens + r.outputTokens) },
        { key: "dur", header: "Duration", numeric: true, sort: (r) => r.durationMs, render: (r) => fmtMs(r.durationMs) },
        { key: "op", header: "Operation", render: (r) => <Mono>{r.operationId.slice(0, 12)}…</Mono> },
      ]}
    />
  );
}

export function ActivityPage() {
  const s = useStyles();
  const { range } = useUi();
  const agents = useDs("listAgents");
  const [agent, setAgent] = useState<string>("");
  const [status, setStatus] = useState<"all" | "ok" | "failed">("all");
  const [user, setUser] = useState("");
  const runs = useDs("listRuns", range, agent || undefined);
  const [open, setOpen] = useState<AgentRun | null>(null);

  return (
    <>
      <PageHeader
        title="Activity & traces"
        subtitle="Agent runs reconstructed from OpenTelemetry gen_ai spans in Application Insights. Select a run to see its tool calls and model turns."
      />
      <Section
        title="Runs"
        description="Newest 300 in the selected range"
        actions={
          <div className={s.filters}>
            <Dropdown placeholder="All agents" value={agent || "All agents"} onOptionSelect={(_, d) => setAgent(d.optionValue === "*" ? "" : (d.optionValue ?? ""))}>
              <Option value="*">All agents</Option>
              {(agents.data ?? []).map((a) => (
                <Option key={a.id} value={a.name}>
                  {a.name}
                </Option>
              ))}
            </Dropdown>
            <Dropdown value={status === "all" ? "Any status" : status} onOptionSelect={(_, d) => setStatus((d.optionValue as typeof status) ?? "all")}>
              <Option value="all">Any status</Option>
              <Option value="ok">ok</Option>
              <Option value="failed">failed</Option>
            </Dropdown>
            <Input contentBefore={<Search20Regular />} placeholder="Caller UPN" value={user} onChange={(_, d) => setUser(d.value)} />
          </div>
        }
      >
        <QueryState q={runs} label="runs">
          {(rows) => (
            <RunsTable
              runs={rows.filter(
                (r) => (status === "all" || (status === "ok") === r.success) && (!user || (r.user ?? "").toLowerCase().includes(user.toLowerCase())),
              )}
              onOpen={setOpen}
            />
          )}
        </QueryState>
      </Section>
      <RunDrawer run={open} onClose={() => setOpen(null)} />
    </>
  );
}
