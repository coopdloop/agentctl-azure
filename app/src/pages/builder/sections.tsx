// Manifest editor sections shared by the Agent builder (create) and Harness injection (update).

import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular, Edit16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useDs } from "../../api";
import { RiskBadge, Section, StatusBadge } from "../../components/common";
import { HARNESS_INJECTIONS, HARNESS_TOOLS } from "../../lib/harnessLibrary";
import { TOOL_TYPE_INFO, composeInstructions } from "../../lib/manifestDefaults";
import type { AgentManifest, AuthFlow, ContentFilterSetting, ToolSpec } from "../../schema/manifest";
import { Grid2, Hint, TagInput } from "./fields";
import { ToolDialog } from "./ToolDialog";

export type Update = (fn: (draft: AgentManifest) => void) => void;
export interface SectionProps {
  m: AgentManifest;
  update: Update;
  /** Set on the harness page: the deployed state, used to mark platform-injected items. */
  base?: AgentManifest | null;
  injectedBy?: string;
}

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: "16px" },
  inj: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" },
  injHead: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  spacer: { flex: 1 },
  preview: { background: tokens.colorNeutralBackground3 },
  catalog: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "8px" },
  catItem: { border: `1px dashed ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, padding: "8px 10px", display: "flex", flexDirection: "column", gap: "4px" },
  row: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  rbacRow: { display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: "6px", alignItems: "start" },
});

const SLUG = /^[a-z][a-z0-9-]{2,62}$/;
const UPN = /^[^@\s]+@[^@\s]+\.[^@\s]+$|^[a-z0-9-]+$/i;

export function BasicsSection({ m, update }: SectionProps) {
  const md = m.metadata;
  return (
    <Section title="Basics & ownership" description="Identity of the agent in the GitOps repo and who is accountable for it.">
      <Grid2>
        <Field label="Name (slug)" required validationMessage={md.name && !SLUG.test(md.name) ? "lowercase letters, digits and dashes; 3-63 chars; starts with a letter" : undefined}>
          <Input value={md.name} placeholder="claims-intake-agent" onChange={(_, d) => update((x) => void (x.metadata.name = d.value.toLowerCase()))} />
        </Field>
        <Field label="Display name" required>
          <Input value={md.displayName} onChange={(_, d) => update((x) => void (x.metadata.displayName = d.value))} />
        </Field>
        <Field label="Team" required>
          <Input value={md.team} onChange={(_, d) => update((x) => void (x.metadata.team = d.value))} />
        </Field>
        <Field label="Cost center">
          <Input value={md.costCenter ?? ""} onChange={(_, d) => update((x) => void (x.metadata.costCenter = d.value || undefined))} />
        </Field>
      </Grid2>
      <Field label="Description" required hint="What the agent does and for whom. Shown to approvers.">
        <Textarea rows={3} value={md.description} onChange={(_, d) => update((x) => void (x.metadata.description = d.value))} />
      </Field>
      <Field label="Owners" required hint="UPNs or group names accountable for the agent. Become CODEOWNERS.">
        <TagInput value={md.owners} onChange={(v) => update((x) => void (x.metadata.owners = v))} placeholder="jane.doe@contoso.com" validate={(v) => (UPN.test(v) ? null : "Not a UPN or group name")} />
      </Field>
      <Grid2>
        <Field label="Environment">
          <Dropdown value={md.environment} onOptionSelect={(_, d) => update((x) => void (x.metadata.environment = d.optionValue as typeof md.environment))}>
            {["dev", "test", "prod"].map((e) => (
              <Option key={e} value={e}>
                {e}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Data classification" hint="Highest classification of data the agent can see">
          <Dropdown value={md.dataClassification} onOptionSelect={(_, d) => update((x) => void (x.metadata.dataClassification = d.optionValue as typeof md.dataClassification))}>
            {["public", "internal", "confidential", "highly_confidential"].map((e) => (
              <Option key={e} value={e}>
                {e}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </Grid2>
    </Section>
  );
}

export function PlacementSection({ m, update }: SectionProps) {
  const projects = useDs("listProjects");
  const deps = useDs("listDeployments");
  const f = m.spec.foundry;
  const accountDeps = (deps.data ?? []).filter((d) => d.account === f.account);
  return (
    <Section title="Foundry project & model" description="Where the agent runs and which model deployment it uses (the deployment's RAI policy applies).">
      <Grid2>
        <Field label="Foundry project" required>
          <Dropdown
            placeholder="Select a project"
            value={f.project ? `${f.account}/${f.project}` : ""}
            onOptionSelect={(_, d) => {
              const p = projects.data?.find((x) => x.id === d.optionValue);
              if (p)
                update((x) => {
                  x.spec.foundry = { ...x.spec.foundry, account: p.account, project: p.name, resourceGroup: p.resourceGroup };
                  x.spec.model.deployment = "";
                });
            }}
          >
            {(projects.data ?? []).map((p) => (
              <Option key={p.id} value={p.id} text={`${p.account}/${p.name}`}>
                {p.account}/{p.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Model deployment" required>
          <Dropdown
            placeholder={f.account ? "Select a deployment" : "Pick a project first"}
            disabled={!f.account}
            value={m.spec.model.deployment}
            onOptionSelect={(_, d) => {
              const dep = accountDeps.find((x) => x.name === d.optionValue);
              if (dep)
                update((x) => {
                  x.spec.model.deployment = dep.name;
                  x.spec.model.modelName = dep.model;
                });
            }}
          >
            {accountDeps.map((d) => (
              <Option key={d.id} value={d.name} text={d.name}>
                {d.name} · {d.model} · RAI: {d.raiPolicyName || "none"}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Temperature" hint="0 = deterministic">
          <Input type="number" step={0.1} min={0} max={2} value={String(m.spec.model.temperature ?? 1)} onChange={(_, d) => update((x) => void (x.spec.model.temperature = clamp(Number(d.value), 0, 2)))} />
        </Field>
        <Field label="Top P">
          <Input type="number" step={0.05} min={0} max={1} value={String(m.spec.model.topP ?? 1)} onChange={(_, d) => update((x) => void (x.spec.model.topP = clamp(Number(d.value), 0, 1)))} />
        </Field>
        <Field label="Response format">
          <Dropdown value={m.spec.model.responseFormat ?? "auto"} onOptionSelect={(_, d) => update((x) => void (x.spec.model.responseFormat = d.optionValue as "auto"))}>
            {["auto", "text", "json_object"].map((r) => (
              <Option key={r} value={r}>
                {r}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </Grid2>
    </Section>
  );
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export function InstructionsSection({ m, update, base }: SectionProps) {
  const s = useStyles();
  const [showEffective, setShowEffective] = useState(false);
  const inj = m.spec.harness.injections;
  const available = HARNESS_INJECTIONS.filter((h) => !inj.some((i) => i.id === h.id));
  return (
    <div className={s.stack}>
      <Section title="System instructions" description="Owned by the agent team. Platform harness instructions are composed around them at deploy time.">
        <Grid2>
          <Field label="Instructions version" hint="Semver; bump on every change">
            <Input value={m.spec.instructions.version} onChange={(_, d) => update((x) => void (x.spec.instructions.version = d.value))} />
          </Field>
        </Grid2>
        <Field label="Instructions" required>
          <Textarea
            rows={12}
            resize="vertical"
            value={m.spec.instructions.system}
            placeholder="You are …"
            onChange={(_, d) => update((x) => void (x.spec.instructions.system = d.value))}
            style={{ fontFamily: tokens.fontFamilyMonospace }}
          />
        </Field>
        {base && base.spec.instructions.system !== m.spec.instructions.system && base.spec.instructions.version === m.spec.instructions.version && (
          <MessageBar intent="warning">
            <MessageBarBody>Instructions changed but the version was not bumped.</MessageBarBody>
          </MessageBar>
        )}
      </Section>
      <Section
        title={`Harness injections (${inj.length})`}
        description="Platform-owned instruction fragments. Removing a mandatory one is a privileged change."
        actions={<Switch label="Show effective prompt" checked={showEffective} onChange={(_, d) => setShowEffective(d.checked)} />}
      >
        {showEffective && <pre className={`code ${s.preview}`}>{composeInstructions(m)}</pre>}
        {inj.map((i, idx) => (
          <div key={i.id} className={s.inj}>
            <div className={s.injHead}>
              <Text weight="semibold">{i.id}</Text>
              <Badge appearance="outline">{i.position}</Badge>
              {i.mandatory && <Badge appearance="tint" color="danger">mandatory</Badge>}
              {base && !base.spec.harness.injections.some((b) => b.id === i.id) && <Badge appearance="tint" color="brand">new</Badge>}
              <span className={s.spacer} />
              <Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => update((x) => void x.spec.harness.injections.splice(idx, 1))}>
                Remove
              </Button>
            </div>
            <Text size={200}>{i.text}</Text>
            <Hint>{i.reason}</Hint>
          </div>
        ))}
        {available.length > 0 && (
          <>
            <Hint>Add from the harness library</Hint>
            <div className={s.catalog}>
              {available.map((h) => (
                <div key={h.id} className={s.catItem}>
                  <div className={s.row}>
                    <Text weight="semibold" size={200}>
                      {h.title}
                    </Text>
                    {h.mandatory && <Badge size="small" color="danger" appearance="tint">mandatory</Badge>}
                  </div>
                  <Hint>{h.reason}</Hint>
                  <Button
                    size="small"
                    icon={<Add16Regular />}
                    onClick={() => update((x) => void x.spec.harness.injections.push({ id: h.id, position: h.position, text: h.text, reason: h.reason, mandatory: h.mandatory }))}
                  >
                    Inject
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

export function ToolsSection({ m, update, base, injectedBy }: SectionProps) {
  const s = useStyles();
  const [editing, setEditing] = useState<{ index: number; tool?: ToolSpec } | null>(null);
  const tools = m.spec.tools;
  const markInjected = (t: ToolSpec): ToolSpec =>
    base && injectedBy ? { ...t, injected: t.injected ?? { by: injectedBy, reason: "Added via agentctl harness injection" } } : t;

  return (
    <div className={s.stack}>
      <Section
        title={`Tools (${tools.length})`}
        description="Every tool carries a risk tier and an approval mode; both drive the approvers required in the change request."
        actions={
          <Button appearance="primary" icon={<Add16Regular />} onClick={() => setEditing({ index: -1 })}>
            Add tool
          </Button>
        }
      >
        {tools.length === 0 ? (
          <Hint>No tools yet. Agents without tools can only answer from the model and instructions.</Hint>
        ) : (
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Tool</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Risk</TableHeaderCell>
                <TableHeaderCell>Approval</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((t, i) => (
                <TableRow key={t.name}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{TOOL_TYPE_INFO[t.type].label}</TableCell>
                  <TableCell>
                    <RiskBadge tier={t.riskTier} />
                  </TableCell>
                  <TableCell>{t.riskTier !== "read" && t.requireApproval === "never" ? <StatusBadge level="serious">never</StatusBadge> : t.requireApproval}</TableCell>
                  <TableCell>
                    {t.injected ? <Badge appearance="tint" color="brand">platform</Badge> : base && !base.spec.tools.some((b) => b.name === t.name) ? <Badge appearance="tint">new</Badge> : "owner"}
                  </TableCell>
                  <TableCell>
                    <div className={s.row}>
                      <Button size="small" appearance="subtle" icon={<Edit16Regular />} aria-label="Edit" onClick={() => setEditing({ index: i, tool: t })} />
                      <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Remove" onClick={() => update((x) => void x.spec.tools.splice(i, 1))} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section title="Pre-vetted tools from the harness catalog" description="Platform-maintained tools that can be injected into any agent.">
        <div className={s.catalog}>
          {HARNESS_TOOLS.filter((h) => !tools.some((t) => t.name === h.tool.name)).map((h) => (
            <div key={h.tool.name} className={s.catItem}>
              <div className={s.row}>
                <Text weight="semibold" size={200}>
                  {h.title}
                </Text>
                <RiskBadge tier={h.tool.riskTier} />
              </div>
              <Hint>{h.summary}</Hint>
              <Button size="small" icon={<Add16Regular />} onClick={() => update((x) => void x.spec.tools.push(markInjected(structuredClone(h.tool))))}>
                Inject tool
              </Button>
            </div>
          ))}
        </div>
      </Section>
      <ToolDialog
        open={!!editing}
        initial={editing?.tool}
        existingNames={tools.map((t) => t.name)}
        onCancel={() => setEditing(null)}
        onSave={(t) => {
          update((x) => {
            if (editing && editing.index >= 0) x.spec.tools[editing.index] = t;
            else x.spec.tools.push(markInjected(t));
          });
          setEditing(null);
        }}
      />
    </div>
  );
}

export function KnowledgeSection({ m, update }: SectionProps) {
  const s = useStyles();
  const k = m.spec.knowledge;
  return (
    <Section title="Knowledge" description="Vector stores (file search) and Azure AI Search indexes the agent may retrieve from.">
      <Field label="Vector stores" hint="name=source (e.g. hr-policies=sharepoint://hr/policies)">
        <TagInput
          value={k.vectorStores.map((v) => `${v.name}=${v.source}`)}
          onChange={(vals) => update((x) => void (x.spec.knowledge.vectorStores = vals.map((v) => ({ name: v.split("=")[0], source: v.split("=").slice(1).join("=") || "upload" }))))}
          placeholder="name=source"
        />
      </Field>
      <Field label="Search indexes" hint="connection/index">
        <TagInput
          value={k.searchIndexes.map((v) => `${v.connectionName}/${v.indexName}`)}
          onChange={(vals) => update((x) => void (x.spec.knowledge.searchIndexes = vals.map((v) => ({ connectionName: v.split("/")[0], indexName: v.split("/")[1] ?? "" }))))}
          validate={(v) => (v.includes("/") ? null : "Use connection/index")}
          placeholder="search-conn/my-index"
        />
      </Field>
      <div className={s.row} />
    </Section>
  );
}

export function IdentitySection({ m, update }: SectionProps) {
  const s = useStyles();
  const id = m.spec.identity;
  const toggleFlow = (f: AuthFlow, on: boolean) =>
    update((x) => void (x.spec.identity.allowedAuthFlows = on ? [...new Set([...x.spec.identity.allowedAuthFlows, f])] : x.spec.identity.allowedAuthFlows.filter((y) => y !== f)));
  return (
    <div className={s.stack}>
      <Section title="Agent identity" description="Which identity the agent uses and the authority it may exercise.">
        <Field label="Identity type">
          <RadioGroup value={id.type} onChange={(_, d) => update((x) => void (x.spec.identity.type = d.value as typeof id.type))}>
            <Radio value="agent_identity" label="Entra Agent ID (recommended): first-class agent identity with sponsor and lifecycle" />
            <Radio value="user_assigned_mi" label="User-assigned managed identity dedicated to this agent" />
            <Radio value="project_mi" label="Shared Foundry project managed identity (not recommended for prod)" />
          </RadioGroup>
        </Field>
        <Field label="Allowed auth flows">
          <div className={s.row}>
            <Checkbox label="Delegated: users call the agent with their own token" checked={id.allowedAuthFlows.includes("delegated")} onChange={(_, d) => toggleFlow("delegated", !!d.checked)} />
            <Checkbox label="OBO: agent calls downstream APIs as the user" checked={id.allowedAuthFlows.includes("obo")} onChange={(_, d) => toggleFlow("obo", !!d.checked)} />
            <Checkbox label="App-only: agent acts with its own permissions" checked={id.allowedAuthFlows.includes("app")} onChange={(_, d) => toggleFlow("app", !!d.checked)} />
          </div>
        </Field>
        {id.allowedAuthFlows.includes("app") && (
          <MessageBar intent="warning">
            <MessageBarBody>App-only access lets the agent act without a user in the loop; application permissions are always privileged-tier changes.</MessageBarBody>
          </MessageBar>
        )}
        <Grid2>
          <Field label="Delegated scopes (OBO)" hint="e.g. Sites.Read.All, User.Read">
            <TagInput value={id.delegatedScopes} onChange={(v) => update((x) => void (x.spec.identity.delegatedScopes = v))} />
          </Field>
          <Field label="Application permissions (app roles)" hint="e.g. SecurityIncident.Read.All">
            <TagInput value={id.appRoles} onChange={(v) => update((x) => void (x.spec.identity.appRoles = v))} />
          </Field>
        </Grid2>
      </Section>
      <Section
        title="Azure RBAC"
        description="Role assignments for the agent identity. Prefer data-plane roles scoped to single resources."
        actions={
          <Button size="small" icon={<Add16Regular />} onClick={() => update((x) => void x.spec.identity.azureRoleAssignments.push({ scope: "/subscriptions/", role: "Reader", justification: "" }))}>
            Add assignment
          </Button>
        }
      >
        {id.azureRoleAssignments.map((r, i) => (
          <div key={i} className={s.rbacRow}>
            <Input value={r.scope} placeholder="/subscriptions/…/resourceGroups/…" onChange={(_, d) => update((x) => void (x.spec.identity.azureRoleAssignments[i].scope = d.value))} />
            <Input value={r.role} placeholder="Role name" onChange={(_, d) => update((x) => void (x.spec.identity.azureRoleAssignments[i].role = d.value))} />
            <Input value={r.justification} placeholder="Justification" onChange={(_, d) => update((x) => void (x.spec.identity.azureRoleAssignments[i].justification = d.value))} />
            <Button appearance="subtle" icon={<Delete16Regular />} aria-label="Remove" onClick={() => update((x) => void x.spec.identity.azureRoleAssignments.splice(i, 1))} />
          </div>
        ))}
        {!id.azureRoleAssignments.length && <Hint>None.</Hint>}
      </Section>
      <Section title="Access" description="Who may call the agent, and where it is exposed.">
        <Grid2>
          <Field label="Allowed Entra groups">
            <TagInput value={m.spec.access.allowedGroups} onChange={(v) => update((x) => void (x.spec.access.allowedGroups = v))} placeholder="sg-hr-all" />
          </Field>
          <Field label="Allowed client apps" hint="App ids that may call the agent">
            <TagInput value={m.spec.access.allowedClientApps} onChange={(v) => update((x) => void (x.spec.access.allowedClientApps = v))} />
          </Field>
          <Field label="Exposure">
            <Dropdown value={m.spec.access.exposure} onOptionSelect={(_, d) => update((x) => void (x.spec.access.exposure = d.optionValue as typeof x.spec.access.exposure))}>
              <Option value="internal">internal (portal / playground)</Option>
              <Option value="teams">Microsoft Teams</Option>
              <Option value="m365_copilot">Microsoft 365 Copilot</Option>
              <Option value="api">public API</Option>
            </Dropdown>
          </Field>
        </Grid2>
      </Section>
    </div>
  );
}

function FilterRow({ name, f, onChange }: { name: string; f: ContentFilterSetting; onChange(f: ContentFilterSetting): void }) {
  return (
    <TableRow>
      <TableCell>{name}</TableCell>
      <TableCell>
        <Switch checked={f.enabled} onChange={(_, d) => onChange({ ...f, enabled: d.checked })} />
      </TableCell>
      <TableCell>
        <Switch checked={f.blocking} disabled={!f.enabled} onChange={(_, d) => onChange({ ...f, blocking: d.checked })} />
      </TableCell>
      <TableCell>
        <Dropdown size="small" value={f.severityThreshold} disabled={!f.enabled} onOptionSelect={(_, d) => onChange({ ...f, severityThreshold: d.optionValue as ContentFilterSetting["severityThreshold"] })}>
          <Option value="Low">Low (strictest)</Option>
          <Option value="Medium">Medium</Option>
          <Option value="High">High (most permissive)</Option>
        </Dropdown>
      </TableCell>
    </TableRow>
  );
}

export function GuardrailsSection({ m, update }: SectionProps) {
  const s = useStyles();
  const g = m.spec.guardrails;
  return (
    <div className={s.stack}>
      <Section title="Content safety (RAI policy)" description="Created or updated on the Foundry account by Terraform; attached to the agent's model deployment.">
        <Grid2>
          <Field label="Policy name">
            <Input value={g.raiPolicy.name} onChange={(_, d) => update((x) => void (x.spec.guardrails.raiPolicy.name = d.value))} />
          </Field>
          <Field label="Mode">
            <Dropdown value={g.raiPolicy.mode} onOptionSelect={(_, d) => update((x) => void (x.spec.guardrails.raiPolicy.mode = d.optionValue as typeof g.raiPolicy.mode))}>
              <Option value="Blocking">Blocking</Option>
              <Option value="Asynchronous_filter">Asynchronous filter (stream first, filter after)</Option>
              <Option value="Deferred">Deferred</Option>
            </Dropdown>
          </Field>
        </Grid2>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Enabled</TableHeaderCell>
              <TableHeaderCell>Blocking</TableHeaderCell>
              <TableHeaderCell>Block at severity ≥</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(["hate", "sexual", "violence", "selfharm"] as const).map((k) => (
              <FilterRow key={k} name={k} f={g.raiPolicy.filters[k]} onChange={(f) => update((x) => void (x.spec.guardrails.raiPolicy.filters[k] = f))} />
            ))}
          </TableBody>
        </Table>
        <div className={s.row}>
          <Switch label="Prompt shield: jailbreak" checked={g.raiPolicy.promptShields.jailbreak} onChange={(_, d) => update((x) => void (x.spec.guardrails.raiPolicy.promptShields.jailbreak = d.checked))} />
          <Switch label="Prompt shield: indirect attack (XPIA)" checked={g.raiPolicy.promptShields.indirectAttack} onChange={(_, d) => update((x) => void (x.spec.guardrails.raiPolicy.promptShields.indirectAttack = d.checked))} />
          <Switch label="Protected material: text" checked={g.raiPolicy.protectedMaterial.text} onChange={(_, d) => update((x) => void (x.spec.guardrails.raiPolicy.protectedMaterial.text = d.checked))} />
          <Switch label="Protected material: code" checked={g.raiPolicy.protectedMaterial.code} onChange={(_, d) => update((x) => void (x.spec.guardrails.raiPolicy.protectedMaterial.code = d.checked))} />
        </div>
      </Section>
      <Section title="Runtime limits" description="Recorded in agent metadata; enforce at the gateway (APIM) or in the agent host.">
        <Grid2>
          <Field label="Max tokens per run">
            <Input type="number" value={String(g.limits.maxTokensPerRun)} onChange={(_, d) => update((x) => void (x.spec.guardrails.limits.maxTokensPerRun = Math.round(Number(d.value) || 0)))} />
          </Field>
          <Field label="Max tool calls per run">
            <Input type="number" value={String(g.limits.maxToolCallsPerRun)} onChange={(_, d) => update((x) => void (x.spec.guardrails.limits.maxToolCallsPerRun = Math.round(Number(d.value) || 0)))} />
          </Field>
          <Field label="Max run duration (s)">
            <Input type="number" value={String(g.limits.maxRunSeconds)} onChange={(_, d) => update((x) => void (x.spec.guardrails.limits.maxRunSeconds = Math.round(Number(d.value) || 0)))} />
          </Field>
        </Grid2>
        <Switch label="Redact PII in traces" checked={g.piiRedactionInTraces} onChange={(_, d) => update((x) => void (x.spec.guardrails.piiRedactionInTraces = d.checked))} />
      </Section>
    </div>
  );
}

export function OpsSection({ m, update }: SectionProps) {
  const o = m.spec.observability;
  return (
    <Section title="Observability & lifecycle">
      <Grid2>
        <Switch label="OpenTelemetry tracing to App Insights" checked={o.tracing} onChange={(_, d) => update((x) => void (x.spec.observability.tracing = d.checked))} />
        <Switch label="Capture prompt/response content in traces" checked={o.captureContent} onChange={(_, d) => update((x) => void (x.spec.observability.captureContent = d.checked))} />
        <Field label="Trace sample rate">
          <Input type="number" step={0.1} value={String(o.sampleRate)} onChange={(_, d) => update((x) => void (x.spec.observability.sampleRate = clamp(Number(d.value), 0, 1)))} />
        </Field>
        <Field label="Access review cadence (days)">
          <Input type="number" value={String(m.spec.lifecycle.reviewCadenceDays)} onChange={(_, d) => update((x) => void (x.spec.lifecycle.reviewCadenceDays = Math.round(Number(d.value) || 90)))} />
        </Field>
        <Field label="Expires on" hint="Optional sunset date">
          <Input type="date" value={m.spec.lifecycle.expiresOn ?? ""} onChange={(_, d) => update((x) => void (x.spec.lifecycle.expiresOn = d.value || undefined))} />
        </Field>
      </Grid2>
      {o.captureContent && (
        <MessageBar intent="warning">
          <MessageBarBody>Content capture stores prompts and responses in Log Analytics; check data classification and retention.</MessageBarBody>
        </MessageBar>
      )}
    </Section>
  );
}

const EVIDENCE: { key: "impactAssessment" | "threatModel" | "evaluation" | "redTeam" | "killSwitchDrill"; label: string; hint: string; control: string }[] = [
  { key: "impactAssessment", label: "Impact assessment", hint: "ISO 42005 / FRIA / DPIA id; refresh yearly", control: "GV-04" },
  { key: "threatModel", label: "Threat model", hint: "Required for medium and high tier", control: "TE-01" },
  { key: "evaluation", label: "Pre-release evaluation", hint: "Foundry evaluation run id; 180-day freshness", control: "TE-02" },
  { key: "redTeam", label: "Red-team test", hint: "AI Red Teaming Agent / PyRIT run; 90 days for high tier", control: "TE-03" },
  { key: "killSwitchDrill", label: "Kill-switch drill", hint: "Last deactivation drill; 180 days for high tier", control: "IR-01" },
];

/** Risk tier and attestations for the AI risk controls; deployed as agentctl.governance metadata. */
export function GovernanceSection({ m, update }: SectionProps) {
  const g = m.spec.governance ?? { riskTier: "medium" as const };
  const set = (fn: (g: NonNullable<AgentManifest["spec"]["governance"]>) => void) =>
    update((x) => {
      x.spec.governance ??= { riskTier: "medium" };
      fn(x.spec.governance);
    });
  return (
    <Section title="Risk & governance" description="Evidence the AI risk controls check (Risk & compliance page). It travels with every deployed version, so a new version without fresh evidence shows up as stale.">
      <Grid2>
        <Field label="Agent risk tier" hint="Drives tool allowlists and evidence freshness. Lowering it needs review.">
          <RadioGroup layout="horizontal" value={g.riskTier} onChange={(_, d) => set((x) => void (x.riskTier = d.value as typeof g.riskTier))}>
            <Radio value="low" label="Low" />
            <Radio value="medium" label="Medium" />
            <Radio value="high" label="High" />
          </RadioGroup>
        </Field>
        <Field label="Intake / risk register id" hint="GV-03: purpose screened against EU AI Act Art. 5 and Annex III">
          <Input value={g.intakeId ?? ""} onChange={(_, d) => set((x) => void (x.intakeId = d.value || undefined))} />
        </Field>
      </Grid2>
      {EVIDENCE.map((e) => (
        <Grid2 key={e.key}>
          <Field label={`${e.label} (${e.control})`} hint={e.hint}>
            <Input
              placeholder="Document or run id"
              value={g[e.key]?.id ?? ""}
              onChange={(_, d) => set((x) => void (x[e.key] = d.value ? { id: d.value, date: x[e.key]?.date ?? new Date().toISOString().slice(0, 10) } : undefined))}
            />
          </Field>
          <Field label="Date">
            <Input type="date" disabled={!g[e.key]} value={g[e.key]?.date ?? ""} onChange={(_, d) => set((x) => void (x[e.key] && d.value && (x[e.key]!.date = d.value)))} />
          </Field>
        </Grid2>
      ))}
      <Grid2>
        <Switch label="Interacts directly with people (EU AI Act Art. 50)" checked={Boolean(g.userFacing)} onChange={(_, d) => set((x) => void (x.userFacing = d.checked))} />
        <Field label="AI-interaction disclosure link (TR-01)" hint="https:// link to the user notice">
          <Input disabled={!g.userFacing} value={g.disclosure ?? ""} onChange={(_, d) => set((x) => void (x.disclosure = d.value || undefined))} />
        </Field>
      </Grid2>
      <Hint>Evidence ids are references, not documents: keep the documents in your GRC system. Values are visible to anyone who can read the agent.</Hint>
    </Section>
  );
}
