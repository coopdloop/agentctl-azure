import {
  Badge,
  Button,
  Card,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
  type BadgeProps,
} from "@fluentui/react-components";
import {
  ArrowSortDown16Regular,
  ArrowSortUp16Regular,
  CheckmarkCircle16Filled,
  ErrorCircle16Filled,
  Info16Filled,
  ShieldError16Filled,
  Warning16Filled,
} from "@fluentui/react-icons";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AuthRequiredError, consent } from "../auth/msal";
import type { RiskTier } from "../config";
import type { AuthFlowObserved } from "../api/types";

const useStyles = makeStyles({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", marginBottom: "20px", flexWrap: "wrap" },
  headerText: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  subtitle: { color: tokens.colorNeutralForeground3, maxWidth: "80ch" },
  tileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" },
  tile: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "2px", minHeight: "92px" },
  tileLabel: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, textTransform: "uppercase", letterSpacing: "0.04em" },
  tileValue: { fontSize: "28px", lineHeight: "36px", fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  tileHint: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, display: "flex", alignItems: "center", gap: "4px" },
  section: { padding: "16px", display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  sectionTitle: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  sectionDesc: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  center: { display: "flex", justifyContent: "center", padding: "32px" },
  tableWrap: { overflowX: "auto", width: "100%" },
  th: { cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  empty: { padding: "24px", textAlign: "center", color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
});

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const s = useStyles();
  return (
    <div className={s.header}>
      <div className={s.headerText}>
        <Text as="h1" size={700} weight="semibold">
          {title}
        </Text>
        {subtitle && <Text className={s.subtitle}>{subtitle}</Text>}
      </div>
      {actions}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className={useStyles().tileGrid}>{children}</div>;
}

export function StatTile({ label, value, hint, status }: { label: string; value: ReactNode; hint?: ReactNode; status?: StatusLevel }) {
  const s = useStyles();
  return (
    <Card className={s.tile}>
      <span className={s.tileLabel}>{label}</span>
      <span className={s.tileValue}>{value}</span>
      {hint && (
        <span className={s.tileHint}>
          {status && <StatusIcon level={status} />}
          {hint}
        </span>
      )}
    </Card>
  );
}

export function Section({ title, description, actions, children, className }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  const s = useStyles();
  return (
    <Card className={mergeClasses(s.section, className)}>
      <div className={s.sectionHead}>
        <div>
          <div className={s.sectionTitle}>{title}</div>
          {description && <div className={s.sectionDesc}>{description}</div>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

/** Loading / error (with consent prompt for missing scopes) wrapper around a query. */
export function QueryState<T>({ q, children, label }: { q: UseQueryResult<T>; children: (data: T) => ReactNode; label?: string }) {
  const s = useStyles();
  if (q.isPending) return <div className={s.center}><Spinner size="small" label={label ? `Loading ${label}…` : "Loading…"} /></div>;
  if (q.isError) return <ErrorBar error={q.error} retry={() => q.refetch()} />;
  return <>{children(q.data as T)}</>;
}

export function ErrorBar({ error, retry }: { error: unknown; retry?: () => void }) {
  if (error instanceof AuthRequiredError) {
    return (
      <MessageBar intent="warning">
        <MessageBarBody>
          <MessageBarTitle>Consent required</MessageBarTitle>
          This view needs a token for <b>{error.scopeKey}</b>. Sign in or grant consent to continue.
        </MessageBarBody>
        <MessageBarActions>
          <Button size="small" onClick={() => consent(error.scopeKey).then(() => retry?.())}>
            Grant access
          </Button>
        </MessageBarActions>
      </MessageBar>
    );
  }
  return (
    <MessageBar intent="error">
      <MessageBarBody>
        <MessageBarTitle>Could not load data</MessageBarTitle>
        {error instanceof Error ? error.message : String(error)}
      </MessageBarBody>
      {retry && (
        <MessageBarActions>
          <Button size="small" onClick={retry}>
            Retry
          </Button>
        </MessageBarActions>
      )}
    </MessageBar>
  );
}

export type StatusLevel = "good" | "info" | "warning" | "serious" | "critical";

export function StatusIcon({ level }: { level: StatusLevel }) {
  const color = {
    good: tokens.colorPaletteGreenForeground1,
    info: tokens.colorBrandForeground1,
    warning: tokens.colorPaletteMarigoldForeground1,
    serious: tokens.colorPaletteDarkOrangeForeground1,
    critical: tokens.colorPaletteRedForeground1,
  }[level];
  const Icon = { good: CheckmarkCircle16Filled, info: Info16Filled, warning: Warning16Filled, serious: ShieldError16Filled, critical: ErrorCircle16Filled }[level];
  return <Icon style={{ color, flexShrink: 0 }} aria-hidden />;
}

export function StatusBadge({ level, children }: { level: StatusLevel; children: ReactNode }) {
  const color: BadgeProps["color"] = { good: "success", info: "brand", warning: "warning", serious: "severe", critical: "danger" }[level] as BadgeProps["color"];
  return (
    <Badge appearance="tint" color={color} icon={<StatusIcon level={level} />}>
      {children}
    </Badge>
  );
}

export function RiskBadge({ tier }: { tier: RiskTier }) {
  const level: StatusLevel = tier === "read" ? "good" : tier === "write" ? "warning" : "critical";
  return <StatusBadge level={level}>{tier}</StatusBadge>;
}

const FLOW_LABEL: Record<AuthFlowObserved, string> = {
  delegated: "Delegated",
  obo: "On-behalf-of",
  app: "App-only",
  managed_identity: "Managed identity",
  agent_identity: "Agent identity",
};
export const flowLabel = (f: AuthFlowObserved) => FLOW_LABEL[f] ?? f;

export function AuthFlowBadge({ flow }: { flow: AuthFlowObserved }) {
  const color: BadgeProps["color"] =
    flow === "delegated" ? "brand" : flow === "obo" ? "informative" : flow === "app" ? "warning" : flow === "agent_identity" ? "important" : "subtle";
  return (
    <Badge appearance="outline" color={color}>
      {flowLabel(flow)}
    </Badge>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className={useStyles().mono}>{children}</span>;
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  numeric?: boolean;
  width?: string;
}

/** Lightweight sortable table (Fluent Table primitives). */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty = "No data",
  onRowClick,
  initialSort,
  maxRows = 500,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  empty?: string;
  onRowClick?: (r: T) => void;
  initialSort?: { key: string; dir: "asc" | "desc" };
  maxRows?: number;
}) {
  const s = useStyles();
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort!.dir === "asc" ? c : -c;
    });
  }, [rows, columns, sort]);

  if (!rows.length) return <div className={s.empty}>{empty}</div>;
  return (
    <div className={s.tableWrap}>
      <Table size="small" aria-label="data table">
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHeaderCell
                key={c.key}
                className={mergeClasses(c.sort && s.th, c.numeric && s.num)}
                style={c.width ? { width: c.width } : undefined}
                onClick={() => c.sort && setSort((p) => ({ key: c.key, dir: p?.key === c.key && p.dir === "desc" ? "asc" : "desc" }))}
                sortDirection={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
              >
                {c.header}
                {sort?.key === c.key && (sort.dir === "asc" ? <ArrowSortUp16Regular /> : <ArrowSortDown16Regular />)}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.slice(0, maxRows).map((r) => (
            <TableRow key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: "pointer" } : undefined}>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.numeric ? s.num : undefined}>
                  {c.render(r)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
