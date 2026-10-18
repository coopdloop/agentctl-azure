import { Badge, makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import type { Agent, DataSource } from "../api/types";
import { sha256 } from "../bundle/buildBundle";
import { StatusBadge, type StatusLevel } from "../components/common";
import type { Rollup, Status } from "./evaluate";

export const STATUS_LABEL: Record<Status, string> = {
  pass: "Pass",
  fail: "Fail",
  warn: "Warning",
  attest: "Needs sign-off",
  unknown: "Unknown",
  na: "N/A",
};

const LEVEL: Partial<Record<Status, StatusLevel>> = { pass: "good", fail: "critical", warn: "warning", attest: "info" };

/** Status always carries an icon and a label, never colour alone. */
export function ControlStatus({ status }: { status: Status }) {
  const level = LEVEL[status];
  if (level) return <StatusBadge level={level}>{STATUS_LABEL[status]}</StatusBadge>;
  return (
    <Badge appearance="outline" color="subtle">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const useStyles = makeStyles({
  bar: { display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden", gap: "2px", background: tokens.colorNeutralBackground3, minWidth: "120px" },
  legend: { display: "flex", gap: "12px", flexWrap: "wrap", fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  swatch: { display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", marginRight: "4px", verticalAlign: "middle" },
});

// Status palette (reserved for state, never reused for series): good / warning / critical, plus brand for sign-off.
const SEG: { key: keyof Rollup; label: string; color: string }[] = [
  { key: "pass", label: "Pass", color: tokens.colorPaletteGreenBackground3 },
  { key: "warn", label: "Warning", color: tokens.colorPaletteMarigoldBackground3 },
  { key: "attest", label: "Needs sign-off", color: tokens.colorBrandBackground },
  { key: "fail", label: "Fail", color: tokens.colorPaletteRedBackground3 },
];

/** Stacked pass/warn/sign-off/fail bar with a text alternative in the tooltip. */
export function RollupBar({ r }: { r: Rollup }) {
  const s = useStyles();
  const total = r.pass + r.warn + r.attest + r.fail;
  const text = SEG.map((x) => `${x.label} ${r[x.key]}`).join(" · ");
  return (
    <Tooltip content={total ? text : "Nothing evaluated"} relationship="description">
      <div className={s.bar} role="img" aria-label={text}>
        {total > 0 && SEG.map((x) => (r[x.key] as number) > 0 && <div key={x.key} style={{ flex: r[x.key] as number, background: x.color }} />)}
      </div>
    </Tooltip>
  );
}

export function RollupLegend() {
  const s = useStyles();
  return (
    <div className={s.legend}>
      {SEG.map((x) => (
        <span key={x.key}>
          <span className={s.swatch} style={{ background: x.color }} />
          {x.label}
        </span>
      ))}
    </div>
  );
}

export function scoreLevel(score: number | null): StatusLevel {
  if (score === null) return "info";
  return score >= 85 ? "good" : score >= 65 ? "warning" : score >= 40 ? "serious" : "critical";
}

/** CycloneDX 1.6 ML-BOM style bill of materials for one agent version (control SC-03). */
export async function agentBom(agent: Agent, ds: DataSource) {
  const [deps, rai] = await Promise.all([ds.listDeployments().catch(() => []), ds.raiPolicies().catch(() => [])]);
  const dep = deps.find((d) => d.name === agent.model && d.account === agent.account);
  const policy = rai.find((p) => p.account === agent.account && p.name === dep?.raiPolicyName);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ name: "agentctl" }],
      component: { type: "application", name: agent.name, version: agent.version ?? "classic", "bom-ref": `agent:${agent.account}/${agent.project}/${agent.name}` },
      properties: [
        { name: "agentctl:foundry.project", value: `${agent.account}/${agent.project}` },
        { name: "agentctl:risk_tier", value: agent.governance?.riskTier ?? "unset" },
        { name: "agentctl:instructions.sha256", value: await sha256(agent.instructions) },
        ...(agent.agentIdentityId ? [{ name: "agentctl:entra.agent_identity", value: agent.agentIdentityId }] : []),
      ],
    },
    components: [
      {
        type: "machine-learning-model",
        name: dep?.model ?? agent.model,
        version: dep?.modelVersion ?? "unknown",
        "bom-ref": `model:${agent.model}`,
        properties: [
          { name: "agentctl:deployment", value: agent.model },
          { name: "agentctl:sku", value: dep?.sku ?? "unknown" },
          { name: "agentctl:guardrail", value: dep?.raiPolicyName ?? "unknown" },
          ...(policy ? [{ name: "agentctl:guardrail.filters", value: policy.contentFilters.filter((f) => f.enabled).map((f) => `${f.name}/${f.source}`).join(",") }] : []),
        ],
      },
      ...agent.tools.map((t) => ({
        type: "service",
        name: t.name,
        "bom-ref": `tool:${t.type}:${t.name}`,
        properties: [
          { name: "agentctl:tool.type", value: t.type },
          ...(t.detail ? [{ name: "agentctl:tool.endpoint", value: t.detail }] : []),
          ...(t.requireApproval ? [{ name: "agentctl:tool.require_approval", value: t.requireApproval }] : []),
          ...(t.allowedTools?.length ? [{ name: "agentctl:tool.allowed_tools", value: t.allowedTools.join(",") }] : []),
        ],
      })),
    ],
    dependencies: [{ ref: `agent:${agent.account}/${agent.project}/${agent.name}`, dependsOn: [`model:${agent.model}`, ...agent.tools.map((t) => `tool:${t.type}:${t.name}`)] }],
  };
}
