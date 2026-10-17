import {
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useDs } from "../api";
import type { AgentRun, Span } from "../api/types";
import { categorical } from "../lib/chartColors";
import { fmtInt, fmtMs, fmtTime } from "../lib/format";
import { useUi } from "../state/ui";
import { AuthFlowBadge, Mono, QueryState, StatusBadge } from "./common";

const useStyles = makeStyles({
  meta: { display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", marginBottom: "20px", fontSize: tokens.fontSizeBase300 },
  label: { color: tokens.colorNeutralForeground3 },
  row: { display: "grid", gridTemplateColumns: "220px 1fr 70px", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: tokens.fontSizeBase200 },
  track: { position: "relative", height: "14px", background: tokens.colorNeutralBackground3, borderRadius: "3px" },
  bar: { position: "absolute", top: 0, bottom: 0, borderRadius: "3px", minWidth: "3px" },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legend: { display: "flex", gap: "12px", fontSize: tokens.fontSizeBase200, margin: "8px 0 12px", color: tokens.colorNeutralForeground2 },
  dot: { width: "8px", height: "8px", borderRadius: "2px", display: "inline-block", marginRight: "4px" },
});

function Waterfall({ spans }: { spans: Span[] }) {
  const s = useStyles();
  const { dark } = useUi();
  const c = categorical(dark);
  const color: Record<Span["kind"], string> = { invoke_agent: c[0], chat: c[6], execute_tool: c[1], other: "#8a8984" };
  if (!spans.length) return <Text>No spans found for this operation.</Text>;
  const t0 = Math.min(...spans.map((x) => new Date(x.start).getTime()));
  const t1 = Math.max(...spans.map((x) => new Date(x.start).getTime() + x.durationMs));
  const total = Math.max(t1 - t0, 1);
  return (
    <>
      <div className={s.legend}>
        {(["invoke_agent", "chat", "execute_tool"] as const).map((k) => (
          <span key={k}>
            <span className={s.dot} style={{ background: color[k] }} />
            {k}
          </span>
        ))}
      </div>
      {spans.map((sp) => {
        const left = ((new Date(sp.start).getTime() - t0) / total) * 100;
        const width = (sp.durationMs / total) * 100;
        return (
          <div key={sp.spanId} className={s.row} title={`${sp.name}${sp.inputTokens ? ` · ${sp.inputTokens} in / ${sp.outputTokens} out tokens` : ""}`}>
            <span className={s.name} style={{ paddingLeft: sp.parentId ? 14 : 0 }}>
              {sp.success ? "" : "✕ "}
              {sp.name}
            </span>
            <div className={s.track}>
              <div className={s.bar} style={{ left: `${left}%`, width: `${width}%`, background: sp.success ? color[sp.kind] : dark ? "#e66767" : "#c4314b" }} />
            </div>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMs(sp.durationMs)}</span>
          </div>
        );
      })}
    </>
  );
}

export function RunDrawer({ run, onClose }: { run: AgentRun | null; onClose(): void }) {
  return (
    <OverlayDrawer open={!!run} onOpenChange={(_, d) => !d.open && onClose()} position="end" size="large">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onClose} aria-label="Close" />}>
          Run trace
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>{run && <RunDetail run={run} />}</DrawerBody>
    </OverlayDrawer>
  );
}

function RunDetail({ run }: { run: AgentRun }) {
    const s = useStyles();
    const spans = useDs("getRunSpans", run.operationId);
    return (
      <>
        <div className={s.meta}>
          <span className={s.label}>Agent</span>
          <span>{run.agentName}</span>
          <span className={s.label}>Started</span>
          <span>{fmtTime(run.start)}</span>
          <span className={s.label}>Status</span>
          <span>{run.success ? <StatusBadge level="good">succeeded</StatusBadge> : <StatusBadge level="critical">failed</StatusBadge>}</span>
          <span className={s.label}>Caller</span>
          <span>{run.user ?? <Badge appearance="outline">no user (app-only)</Badge>}</span>
          <span className={s.label}>Auth flow</span>
          <span>{run.authFlow ? <AuthFlowBadge flow={run.authFlow} /> : "—"}</span>
          <span className={s.label}>Tokens</span>
          <span>
            {fmtInt(run.inputTokens)} in · {fmtInt(run.outputTokens)} out
          </span>
          <span className={s.label}>Operation id</span>
          <Mono>{run.operationId}</Mono>
          {run.threadId && (
            <>
              <span className={s.label}>Thread</span>
              <Mono>{run.threadId}</Mono>
            </>
          )}
        </div>
        <Text weight="semibold">Span waterfall</Text>
        <QueryState q={spans} label="spans">
          {(sp) => <Waterfall spans={sp} />}
        </QueryState>
      </>
    );
  }
