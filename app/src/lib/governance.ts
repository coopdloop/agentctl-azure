// Agent governance attestations: the human judgements the AI risk controls need (risk tier,
// intake, impact assessment, threat model, evaluation, red team, kill-switch drill, disclosure).
// They live in the manifest (spec.governance), so they are reviewed in GitOps, and travel with
// every deployed agent version as one compact metadata value ("agentctl.governance", <= 512 chars).
// A new version deployed without them shows up as stale/missing on the controls page.

export type AgentRiskTier = "low" | "medium" | "high";

export interface EvidenceRef {
  /** Document / run identifier or short link (e.g. IA-2026-014, eval run id). */
  id: string;
  /** ISO date (yyyy-mm-dd) the evidence was produced or approved. */
  date: string;
}

export interface AgentGovernance {
  riskTier: AgentRiskTier;
  intakeId?: string;
  impactAssessment?: EvidenceRef;
  threatModel?: EvidenceRef;
  evaluation?: EvidenceRef;
  redTeam?: EvidenceRef;
  killSwitchDrill?: EvidenceRef;
  /** Interacts directly with people (EU AI Act Art. 50 disclosure applies). */
  userFacing?: boolean;
  /** Link to the AI-interaction disclosure / user notice. */
  disclosure?: string;
}

export const GOVERNANCE_METADATA_KEY = "agentctl.governance";

const REFS = { ia: "impactAssessment", tm: "threatModel", ev: "evaluation", rt: "redTeam", ks: "killSwitchDrill" } as const;
const TIERS: Record<string, AgentRiskTier> = { l: "low", m: "medium", h: "high" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Compact encoding: {"t":"h","in":"INT-7","ia":"IA-14|2026-09-01",...}. Truncates long ids to fit 512 chars. */
export function encodeGovernance(g: AgentGovernance): string {
  const o: Record<string, string | number> = { t: g.riskTier[0] };
  if (g.intakeId) o.in = g.intakeId.slice(0, 40);
  for (const [k, field] of Object.entries(REFS)) {
    const r = g[field];
    if (r?.id && DATE.test(r.date)) o[k] = `${r.id.slice(0, 60)}|${r.date}`;
  }
  if (g.userFacing !== undefined) o.uf = g.userFacing ? 1 : 0;
  if (g.disclosure) o.dl = g.disclosure.slice(0, 120);
  let s = JSON.stringify(o);
  if (s.length > 512) {
    delete o.dl;
    s = JSON.stringify(o).slice(0, 512);
  }
  return s;
}

/** Defensive decode of agent metadata (untrusted: anyone with project write access can set it). */
export function decodeGovernance(raw: string | undefined): AgentGovernance | undefined {
  if (!raw) return undefined;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!o || typeof o !== "object") return undefined;
  const g: AgentGovernance = { riskTier: TIERS[String(o.t)] ?? "medium" };
  if (typeof o.in === "string") g.intakeId = o.in;
  for (const [k, field] of Object.entries(REFS)) {
    const v = o[k];
    if (typeof v !== "string") continue;
    const [id, date] = v.split("|");
    if (id && DATE.test(date ?? "")) g[field] = { id, date };
  }
  if (o.uf !== undefined) g.userFacing = o.uf === 1 || o.uf === true;
  if (typeof o.dl === "string" && /^https:\/\//.test(o.dl)) g.disclosure = o.dl;
  return g;
}

/** Days since an ISO date (Infinity when missing or invalid). */
export function ageDays(date: string | undefined, now = Date.now()): number {
  if (!date) return Infinity;
  const t = Date.parse(date);
  return Number.isNaN(t) ? Infinity : Math.floor((now - t) / 86_400_000);
}
