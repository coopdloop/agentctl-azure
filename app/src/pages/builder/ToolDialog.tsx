import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import type { RiskTier } from "../../config";
import { RiskBadge } from "../../components/common";
import { TOOL_TYPE_INFO, defaultApprovalFor, inferToolRisk, maxTier } from "../../lib/manifestDefaults";
import type { ApprovalMode, ToolSpec, ToolType } from "../../schema/manifest";
import { Grid2, Hint, TagInput } from "./fields";

const useStyles = makeStyles({
  types: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "8px", marginBottom: "12px" },
  typeBtn: { justifyContent: "flex-start", textAlign: "left", height: "auto", padding: "8px 10px", flexDirection: "column", alignItems: "flex-start", gap: "2px" },
  typeDesc: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, fontWeight: 400 },
  body: { display: "flex", flexDirection: "column", gap: "12px" },
  ops: { display: "flex", flexDirection: "column", gap: "6px" },
  opRow: { display: "grid", gridTemplateColumns: "100px 1fr 1fr auto", gap: "6px" },
  risk: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium },
});

function blankTool(type: ToolType): ToolSpec {
  const base = { name: type, type, riskTier: TOOL_TYPE_INFO[type].baseRisk, requireApproval: defaultApprovalFor(TOOL_TYPE_INFO[type].baseRisk) } as const;
  switch (type) {
    case "openapi":
      return { ...base, type, name: "my_api", openapi: { specUrl: "", operations: [{ operationId: "getItem", method: "GET", path: "/items/{id}" }], auth: { type: "managed_identity", audience: "" } } };
    case "mcp":
      return { ...base, type, name: "my_mcp", mcp: { serverLabel: "my_mcp", serverUrl: "https://", allowedTools: [] } };
    case "azure_function":
      return { ...base, type, name: "my_function", azureFunction: { functionAppResourceId: "/subscriptions/", functionName: "", inputQueue: "agent-in", outputQueue: "agent-out" } };
    case "function":
      return { ...base, type, name: "my_function", function: { parametersSchema: '{"type":"object","properties":{},"additionalProperties":false}', strict: true } };
    case "connected_agent":
      return { ...base, type, name: "sub_agent", connectedAgent: { agentRef: "", delegationDescription: "" } };
    case "bing_grounding":
    case "azure_ai_search":
    case "sharepoint_grounding":
    case "fabric_dataagent":
      return { ...base, type, connection: { connectionName: "", ...(type === "azure_ai_search" ? { indexName: "", queryType: "vector_semantic_hybrid", topK: 5 } : {}) } };
    case "browser_automation":
      return { ...base, type, requireApproval: "always", builtin: { allowedDomains: [] } };
    default:
      return { ...base, type } as ToolSpec;
  }
}

export function ToolDialog({
  open,
  initial,
  existingNames,
  onCancel,
  onSave,
}: {
  open: boolean;
  initial?: ToolSpec;
  existingNames: string[];
  onCancel(): void;
  onSave(t: ToolSpec): void;
}) {
  const s = useStyles();
  const [tool, setTool] = useState<ToolSpec | null>(initial ?? null);
  useEffect(() => setTool(initial ?? null), [initial, open]);

  const inferred = tool ? inferToolRisk(tool) : "read";
  const nameTaken = tool && !initial && existingNames.includes(tool.name);
  const set = (patch: Partial<ToolSpec>) => setTool((t) => (t ? ({ ...t, ...patch } as ToolSpec) : t));

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onCancel()}>
      <DialogSurface style={{ maxWidth: 860 }}>
        <DialogBody>
          <DialogTitle>{initial ? `Edit tool ${initial.name}` : tool ? `New ${TOOL_TYPE_INFO[tool.type].label} tool` : "Add a tool"}</DialogTitle>
          <DialogContent>
            {!tool ? (
              <>
                {(["Foundry built-in", "Custom"] as const).map((g) => (
                  <div key={g}>
                    <Hint>{g}</Hint>
                    <div className={s.types}>
                      {(Object.keys(TOOL_TYPE_INFO) as ToolType[])
                        .filter((t) => TOOL_TYPE_INFO[t].group === g)
                        .map((t) => (
                          <Button key={t} className={s.typeBtn} onClick={() => setTool(blankTool(t))}>
                            <span>{TOOL_TYPE_INFO[t].label}</span>
                            <span className={s.typeDesc}>{TOOL_TYPE_INFO[t].blurb}</span>
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className={s.body}>
                <Grid2>
                  <Field label="Tool name" required validationMessage={nameTaken ? "A tool with this name already exists" : undefined}>
                    <Input value={tool.name} onChange={(_, d) => set({ name: d.value.replace(/[^a-zA-Z0-9_-]/g, "_") })} />
                  </Field>
                  <Field label="Description">
                    <Input value={tool.description ?? ""} onChange={(_, d) => set({ description: d.value })} />
                  </Field>
                </Grid2>
                <TypeFields tool={tool} setTool={setTool} />
                <Grid2>
                  <Field label="Risk tier" hint={`Inferred from capabilities: ${inferred}. You can raise it, not lower it.`}>
                    <Dropdown
                      value={tool.riskTier}
                      onOptionSelect={(_, d) => {
                        const tier = maxTier(d.optionValue as RiskTier, inferred);
                        set({ riskTier: tier, requireApproval: tier === "privileged" ? "always" : tool.requireApproval });
                      }}
                    >
                      {(["read", "write", "privileged"] as RiskTier[]).map((t) => (
                        <Option key={t} value={t}>
                          {t}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Require approval" hint="Human-in-the-loop approval before each call">
                    <Dropdown value={tool.requireApproval} onOptionSelect={(_, d) => set({ requireApproval: d.optionValue as ApprovalMode })}>
                      <Option value="always">always</Option>
                      <Option value="write_only" disabled={tool.riskTier === "privileged"}>write_only</Option>
                      <Option value="never" disabled={tool.riskTier === "privileged"}>never</Option>
                    </Dropdown>
                  </Field>
                </Grid2>
                <div className={s.risk}>
                  <RiskBadge tier={maxTier(tool.riskTier, inferred)} />
                  <span style={{ fontSize: 12 }}>
                    {tool.riskTier === "write" && tool.requireApproval === "never"
                      ? "Write tool without approval is treated as privileged in change requests."
                      : "Risk tier determines which approver groups must sign off."}
                  </span>
                </div>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            {tool && !initial && (
              <Button appearance="subtle" onClick={() => setTool(null)}>
                Back
              </Button>
            )}
            <Button onClick={onCancel}>Cancel</Button>
            <Button appearance="primary" disabled={!tool || !tool.name || !!nameTaken} onClick={() => tool && onSave({ ...tool, riskTier: maxTier(tool.riskTier, inferToolRisk(tool)) } as ToolSpec)}>
              {initial ? "Save" : "Add tool"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function TypeFields({ tool, setTool }: { tool: ToolSpec; setTool: (f: (t: ToolSpec | null) => ToolSpec | null) => void }) {
  const s = useStyles();
  const upd = <K extends keyof ToolSpec>(key: K, patch: Record<string, unknown>) =>
    setTool((t) => (t ? ({ ...t, [key]: { ...(t as unknown as Record<string, object>)[key as string], ...patch } } as ToolSpec) : t));

  switch (tool.type) {
    case "openapi": {
      const o = tool.openapi;
      return (
        <>
          <Grid2>
            <Field label="OpenAPI spec URL" hint="Or paste the spec below">
              <Input value={o.specUrl ?? ""} onChange={(_, d) => upd("openapi" as never, { specUrl: d.value })} />
            </Field>
            <Field label="Auth">
              <Dropdown value={o.auth.type} onOptionSelect={(_, d) => upd("openapi" as never, { auth: { ...o.auth, type: d.optionValue } })}>
                <Option value="managed_identity">managed_identity</Option>
                <Option value="connection">connection</Option>
                <Option value="anonymous">anonymous</Option>
              </Dropdown>
            </Field>
            {o.auth.type === "managed_identity" && (
              <Field label="Token audience">
                <Input value={o.auth.audience ?? ""} placeholder="api://my-api" onChange={(_, d) => upd("openapi" as never, { auth: { ...o.auth, audience: d.value } })} />
              </Field>
            )}
            {o.auth.type === "connection" && (
              <Field label="Project connection name">
                <Input value={o.auth.connectionName ?? ""} onChange={(_, d) => upd("openapi" as never, { auth: { ...o.auth, connectionName: d.value } })} />
              </Field>
            )}
          </Grid2>
          <Field label="Inline spec (JSON)">
            <Textarea resize="vertical" rows={3} value={o.specInline ?? ""} onChange={(_, d) => upd("openapi" as never, { specInline: d.value || undefined })} />
          </Field>
          <Field label="Operations exposed to the agent" hint="Non-GET operations raise the risk tier to write; DELETE to privileged.">
            <div className={s.ops}>
              {o.operations.map((op, i) => (
                <div key={i} className={s.opRow}>
                  <Dropdown
                    value={op.method}
                    onOptionSelect={(_, d) => upd("openapi" as never, { operations: o.operations.map((x, j) => (j === i ? { ...x, method: d.optionValue } : x)) })}
                  >
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <Option key={m} value={m}>
                        {m}
                      </Option>
                    ))}
                  </Dropdown>
                  <Input value={op.path} placeholder="/path" onChange={(_, d) => upd("openapi" as never, { operations: o.operations.map((x, j) => (j === i ? { ...x, path: d.value } : x)) })} />
                  <Input value={op.operationId} placeholder="operationId" onChange={(_, d) => upd("openapi" as never, { operations: o.operations.map((x, j) => (j === i ? { ...x, operationId: d.value } : x)) })} />
                  <Button appearance="subtle" disabled={o.operations.length === 1} onClick={() => upd("openapi" as never, { operations: o.operations.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button size="small" onClick={() => upd("openapi" as never, { operations: [...o.operations, { operationId: "", method: "GET", path: "/" }] })}>
                Add operation
              </Button>
            </div>
          </Field>
        </>
      );
    }
    case "mcp": {
      const m = tool.mcp;
      return (
        <Grid2>
          <Field label="Server label" required>
            <Input value={m.serverLabel} onChange={(_, d) => upd("mcp" as never, { serverLabel: d.value.replace(/[^a-zA-Z0-9_-]/g, "_") })} />
          </Field>
          <Field label="Server URL (https)" required validationMessage={m.serverUrl.startsWith("https://") ? undefined : "Must be https"}>
            <Input value={m.serverUrl} onChange={(_, d) => upd("mcp" as never, { serverUrl: d.value })} />
          </Field>
          <Field label="Allowed tools" hint="Empty = every tool the server exposes (privileged)">
            <TagInput value={m.allowedTools} onChange={(v) => upd("mcp" as never, { allowedTools: v })} placeholder="search_docs, get_ticket" />
          </Field>
          <Field label="Headers from project connection" hint="Optional: connection holding auth headers">
            <Input value={m.headersFromConnection ?? ""} onChange={(_, d) => upd("mcp" as never, { headersFromConnection: d.value || undefined })} />
          </Field>
        </Grid2>
      );
    }
    case "azure_function": {
      const f = tool.azureFunction;
      return (
        <Grid2>
          <Field label="Function app resource id" required>
            <Input value={f.functionAppResourceId} onChange={(_, d) => upd("azureFunction" as never, { functionAppResourceId: d.value })} />
          </Field>
          <Field label="Function name" required>
            <Input value={f.functionName} onChange={(_, d) => upd("azureFunction" as never, { functionName: d.value })} />
          </Field>
          <Field label="Input queue">
            <Input value={f.inputQueue} onChange={(_, d) => upd("azureFunction" as never, { inputQueue: d.value })} />
          </Field>
          <Field label="Output queue">
            <Input value={f.outputQueue} onChange={(_, d) => upd("azureFunction" as never, { outputQueue: d.value })} />
          </Field>
          <Field label="Parameters JSON schema">
            <Textarea rows={3} value={f.parametersSchema ?? ""} onChange={(_, d) => upd("azureFunction" as never, { parametersSchema: d.value || undefined })} />
          </Field>
        </Grid2>
      );
    }
    case "function": {
      const f = tool.function;
      return (
        <>
          <Hint>The application calling the agent executes this function and returns its output; the agent only sees the result.</Hint>
          <Field label="Parameters (JSON schema)" required>
            <Textarea rows={5} value={f.parametersSchema} onChange={(_, d) => upd("function" as never, { parametersSchema: d.value })} style={{ fontFamily: "monospace" }} />
          </Field>
        </>
      );
    }
    case "connected_agent": {
      const c = tool.connectedAgent;
      return (
        <Grid2>
          <Field label="Agent reference" required hint="Manifest name or Foundry agent id">
            <Input value={c.agentRef} onChange={(_, d) => upd("connectedAgent" as never, { agentRef: d.value })} />
          </Field>
          <Field label="When to delegate" required>
            <Textarea rows={2} value={c.delegationDescription} onChange={(_, d) => upd("connectedAgent" as never, { delegationDescription: d.value })} />
          </Field>
        </Grid2>
      );
    }
    case "bing_grounding":
    case "azure_ai_search":
    case "sharepoint_grounding":
    case "fabric_dataagent": {
      const c = tool.connection;
      return (
        <Grid2>
          <Field label="Project connection name" required>
            <Input value={c.connectionName} onChange={(_, d) => upd("connection" as never, { connectionName: d.value })} />
          </Field>
          {tool.type === "azure_ai_search" && (
            <>
              <Field label="Index name">
                <Input value={c.indexName ?? ""} onChange={(_, d) => upd("connection" as never, { indexName: d.value })} />
              </Field>
              <Field label="Query type">
                <Dropdown value={c.queryType ?? "vector_semantic_hybrid"} onOptionSelect={(_, d) => upd("connection" as never, { queryType: d.optionValue })}>
                  {["simple", "semantic", "vector", "vector_simple_hybrid", "vector_semantic_hybrid"].map((q) => (
                    <Option key={q} value={q}>
                      {q}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            </>
          )}
          {(tool.type === "azure_ai_search" || tool.type === "bing_grounding") && (
            <Field label="Top K">
              <Input type="number" value={String(c.topK ?? 5)} onChange={(_, d) => upd("connection" as never, { topK: Math.max(1, Math.min(50, Number(d.value) || 5)) })} />
            </Field>
          )}
        </Grid2>
      );
    }
    case "browser_automation":
      return (
        <Field label="Allowed domains" hint="Strongly recommended: restrict where the browser may navigate">
          <TagInput value={tool.builtin?.allowedDomains ?? []} onChange={(v) => upd("builtin" as never, { allowedDomains: v })} placeholder="portal.vendor.example" />
        </Field>
      );
    default:
      return <Hint>No additional configuration. {TOOL_TYPE_INFO[tool.type].blurb}</Hint>;
  }
}
