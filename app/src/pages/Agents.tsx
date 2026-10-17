import { Badge, Dropdown, Input, Link, Option, makeStyles, tokens } from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDs } from "../api";
import { DataTable, PageHeader, QueryState, Section, StatusIcon } from "../components/common";
import { extractInjections } from "../lib/manifestDefaults";
import { MANDATORY_INJECTIONS } from "../lib/harnessLibrary";
import { fmtAgo, fmtCompact, fmtInt, fmtPct } from "../lib/format";
import { useUi } from "../state/ui";

const useStyles = makeStyles({
  filters: { display: "flex", gap: "8px", flexWrap: "wrap" },
  tools: { display: "flex", gap: "4px", flexWrap: "wrap" },
  sub: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  name: { display: "flex", flexDirection: "column" },
});

export function AgentsPage() {
  const s = useStyles();
  const nav = useNavigate();
  const { range } = useUi();
  const agents = useDs("listAgents");
  const stats = useDs("agentStats", range);
  const [q, setQ] = useState("");
  const [project, setProject] = useState("all");

  const statsBy = useMemo(() => new Map((stats.data ?? []).map((x) => [x.agentName, x])), [stats.data]);
  const projects = [...new Set((agents.data ?? []).map((a) => `${a.account}/${a.project}`))];

  return (
    <>
      <PageHeader title="Agents" subtitle="Every agent defined in the Foundry Agent Service across discovered projects." />
      <Section
        title={`${agents.data?.length ?? "…"} agents`}
        actions={
          <div className={s.filters}>
            <Input contentBefore={<Search20Regular />} placeholder="Filter by name, owner, tool" value={q} onChange={(_, d) => setQ(d.value)} />
            <Dropdown value={project === "all" ? "All projects" : project} onOptionSelect={(_, d) => setProject(d.optionValue ?? "all")}>
              <Option value="all">All projects</Option>
              {projects.map((p) => (
                <Option key={p} value={p}>
                  {p}
                </Option>
              ))}
            </Dropdown>
          </div>
        }
      >
        <QueryState q={agents} label="agents">
          {(rows) => {
            const ql = q.toLowerCase();
            const filtered = rows.filter(
              (a) =>
                (project === "all" || `${a.account}/${a.project}` === project) &&
                (!ql || [a.name, a.owner ?? "", a.description, ...a.tools.map((t) => t.name)].join(" ").toLowerCase().includes(ql)),
            );
            return (
              <DataTable
                rows={filtered}
                rowKey={(a) => `${a.project}/${a.id}`}
                onRowClick={(a) => nav(`/agents/${a.project}/${a.id}`)}
                initialSort={{ key: "runs", dir: "desc" }}
                columns={[
                  {
                    key: "name",
                    header: "Agent",
                    sort: (a) => a.name,
                    render: (a) => (
                      <div className={s.name}>
                        <Link>{a.name}</Link>
                        <span className={s.sub}>
                          {a.account}/{a.project}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "api",
                    header: "API",
                    sort: (a) => a.api ?? "",
                    render: (a) =>
                      a.api === "assistants" ? (
                        <Badge appearance="outline" title="Classic Assistants API — not shown in the new Foundry portal">classic</Badge>
                      ) : a.api === "agents" ? (
                        <Badge appearance="tint" color="brand">v{a.version ?? "?"}{a.kind && a.kind !== "prompt" ? ` · ${a.kind}` : ""}</Badge>
                      ) : (
                        "—"
                      ),
                  },
                  { key: "env", header: "Env", sort: (a) => a.metadata.environment ?? "", render: (a) => <Badge appearance="tint" color={a.metadata.environment === "prod" ? "danger" : "informative"}>{a.metadata.environment ?? "?"}</Badge> },
                  { key: "model", header: "Model", sort: (a) => a.model, render: (a) => a.model },
                  {
                    key: "tools",
                    header: "Tools",
                    sort: (a) => a.tools.length,
                    render: (a) => (
                      <div className={s.tools}>
                        {a.tools.map((t) => (
                          <Badge key={t.name + t.type} appearance="outline" size="small" color={t.requireApproval === "never" && ["mcp", "browser_automation"].includes(t.type) ? "danger" : "informative"}>
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "harness",
                    header: "Harness",
                    sort: (a) => extractInjections(a.instructions).injections.length,
                    render: (a) => {
                      const inj = extractInjections(a.instructions).injections;
                      const ok = MANDATORY_INJECTIONS.every((m) => inj.some((i) => i.id === m.id));
                      return (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }} title={inj.map((i) => i.id).join("\n") || "none"}>
                          <StatusIcon level={ok ? "good" : "serious"} />
                          {inj.length}
                        </span>
                      );
                    },
                  },
                  { key: "owner", header: "Owner", sort: (a) => a.owner ?? "", render: (a) => <span className={s.sub}>{a.owner ?? "—"}</span> },
                  { key: "runs", header: `Runs ${range}`, numeric: true, sort: (a) => statsBy.get(a.name)?.runs ?? 0, render: (a) => fmtInt(statsBy.get(a.name)?.runs) },
                  {
                    key: "err",
                    header: "Failed",
                    numeric: true,
                    sort: (a) => (statsBy.get(a.name)?.failedRuns ?? 0) / Math.max(statsBy.get(a.name)?.runs ?? 1, 1),
                    render: (a) => fmtPct(statsBy.get(a.name)?.failedRuns ?? 0, statsBy.get(a.name)?.runs ?? 0),
                  },
                  {
                    key: "tok",
                    header: "Tokens",
                    numeric: true,
                    sort: (a) => (statsBy.get(a.name)?.inputTokens ?? 0) + (statsBy.get(a.name)?.outputTokens ?? 0),
                    render: (a) => fmtCompact((statsBy.get(a.name)?.inputTokens ?? 0) + (statsBy.get(a.name)?.outputTokens ?? 0)),
                  },
                  { key: "last", header: "Last run", sort: (a) => statsBy.get(a.name)?.lastActivity ?? "", render: (a) => fmtAgo(statsBy.get(a.name)?.lastActivity) },
                ]}
              />
            );
          }}
        </QueryState>
      </Section>
    </>
  );
}
