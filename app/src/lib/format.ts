export const fmtInt = (n: number | undefined) => (n ?? 0).toLocaleString("en-US");

export function fmtCompact(n: number | undefined): string {
  const v = n ?? 0;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

export const fmtPct = (num: number, den: number) => (den ? `${((num / den) * 100).toFixed(1)}%` : "—");

export function fmtMs(ms: number | undefined): string {
  const v = ms ?? 0;
  if (v < 1000) return `${Math.round(v)} ms`;
  if (v < 60_000) return `${(v / 1000).toFixed(1)} s`;
  return `${(v / 60_000).toFixed(1)} min`;
}

export function fmtAgo(iso?: string): string {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtAxisTime = (iso: string, range: string) =>
  range === "1h" || range === "24h"
    ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const shortScope = (scope: string) => {
  const parts = scope.split("/");
  return parts.length > 4 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : scope;
};
