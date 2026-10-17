import { tokens } from "@fluentui/react-components";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { TimePoint } from "../api/types";
import { categorical, chartInk, colorForEntity } from "../lib/chartColors";
import { fmtAxisTime, fmtCompact, fmtInt, fmtTime } from "../lib/format";
import { useUi } from "../state/ui";

function ChartTooltip({ active, payload, label, isTime }: TooltipProps<number, string> & { isTime?: boolean }) {
  const { dark } = useUi();
  const ink = chartInk(dark);
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0);
  return (
    <div
      style={{
        background: ink.tooltipBg,
        border: `1px solid ${ink.tooltipBorder}`,
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: tokens.shadow8,
        fontSize: 12,
        color: ink.text,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{isTime ? fmtTime(String(label)) : label}</div>
      {rows.map((p) => (
        <div key={p.dataKey as string} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
            {p.name}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtInt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const legendStyle = { fontSize: 12, paddingTop: 8 };

/** Runs over time: succeeded vs failed (failed uses the reserved critical status colour). */
export function RunsChart({ data, range }: { data: TimePoint[]; range: string }) {
  const { dark } = useUi();
  const ink = chartInk(dark);
  const ok = categorical(dark)[0];
  const bad = dark ? "#e66767" : "#c4314b";
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={ink.grid} />
        <XAxis dataKey="t" tickFormatter={(v) => fmtAxisTime(v, range)} stroke={ink.axis} fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis stroke={ink.axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
        <Tooltip content={<ChartTooltip isTime />} cursor={{ fill: ink.grid, opacity: 0.5 }} />
        <Legend wrapperStyle={legendStyle} iconType="square" iconSize={8} />
        <Bar dataKey="succeeded" name="Succeeded" stackId="r" fill={ok} stroke={ink.surface} strokeWidth={1} />
        <Bar dataKey="failed" name="Failed" stackId="r" fill={bad} stroke={ink.surface} strokeWidth={1} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tokens by agent over time; colour follows the agent, not its rank. */
export function TokensByAgentChart({ data, agents, range }: { data: TimePoint[]; agents: string[]; range: string }) {
  const { dark } = useUi();
  const ink = chartInk(dark);
  const present = agents.filter((a) => data.some((d) => (d[a] as number) > 0));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={ink.grid} />
        <XAxis dataKey="t" tickFormatter={(v) => fmtAxisTime(v, range)} stroke={ink.axis} fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis stroke={ink.axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
        <Tooltip content={<ChartTooltip isTime />} cursor={{ fill: ink.grid, opacity: 0.5 }} />
        <Legend wrapperStyle={legendStyle} iconType="square" iconSize={8} />
        {present.map((a, i) => (
          <Bar
            key={a}
            dataKey={a}
            name={a}
            stackId="t"
            fill={colorForEntity(agents, a, dark)}
            stroke={ink.surface}
            strokeWidth={1}
            radius={i === present.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-series horizontal bars with direct value labels (no legend needed). */
export function HBarChart({ data, labelKey, valueKey, name, height }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string; name: string; height?: number }) {
  const { dark } = useUi();
  const ink = chartInk(dark);
  const h = height ?? Math.max(120, data.length * 30 + 24);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={labelKey} width={170} stroke={ink.axis} fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: ink.grid, opacity: 0.5 }} />
        <Bar dataKey={valueKey} name={name} fill={categorical(dark)[0]} radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList dataKey={valueKey} position="right" formatter={(v: number) => fmtCompact(v)} style={{ fill: ink.text, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
