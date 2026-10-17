// KQL used by the live data source. All queries run against the Log Analytics workspace that
// backs Application Insights (AppDependencies, AppRequests) and receives Entra diagnostics
// (SigninLogs, AADNonInteractiveUserSignInLogs, AADServicePrincipalSignInLogs,
// AADManagedIdentitySignInLogs, MicrosoftGraphActivityLogs).
//
// Agent telemetry follows the OpenTelemetry GenAI semantic conventions emitted by Foundry /
// azure-ai-projects tracing: gen_ai.operation.name, gen_ai.agent.name|id, gen_ai.tool.name,
// gen_ai.usage.input_tokens|output_tokens, gen_ai.request.model, gen_ai.thread.id.

import type { TimeRange } from "../types";

export const RANGE: Record<TimeRange, { ago: string; bin: string; timespan: string }> = {
  "1h": { ago: "1h", bin: "5m", timespan: "PT1H" },
  "24h": { ago: "24h", bin: "1h", timespan: "P1D" },
  "7d": { ago: "7d", bin: "6h", timespan: "P7D" },
  "30d": { ago: "30d", bin: "1d", timespan: "P30D" },
};

/**
 * Span operation names, across SDK generations:
 * - OTel GenAI semconv: invoke_agent / execute_tool / chat
 * - azure-ai-agents SDK (observed): start_thread_run (carries final status + token usage),
 *   get_thread_run (polling), submit_tool_outputs (function tool results), create_message, ...
 */
const RUN_OPS = `dynamic(["invoke_agent", "start_thread_run", "process_thread_run", "create_run", "create_thread_and_run"])`;
const TOOL_OPS = `dynamic(["execute_tool", "submit_tool_outputs"])`;
export const RUN_OP_NAMES = ["invoke_agent", "start_thread_run", "process_thread_run", "create_run", "create_thread_and_run"];

const esc = (s?: string | null) => (s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * Normalised gen_ai spans.
 * - runKey: gen_ai.thread.run.id when present (the SDK emits each call as its own trace, so
 *   OperationId alone splits one run), else OperationId.
 * - agentKey: gen_ai.agent.name if emitted, else the agent id (asst_...) propagated across the run.
 *   The live data source maps ids to names using the Foundry agent list.
 */
function genAiSpans(range: TimeRange) {
  return `
let RunOps = ${RUN_OPS};
let ToolOps = ${TOOL_OPS};
let spans = AppDependencies
  | where TimeGenerated > ago(${RANGE[range].ago})
  | extend op = tostring(Properties["gen_ai.operation.name"])
  | where isnotempty(op)
  | extend agentId   = coalesce(tostring(Properties["gen_ai.agent.id"]), tostring(Properties["microsoft.gen_ai.main_agent.id"])),
           agentAttr = tostring(Properties["gen_ai.agent.name"]),
           runKey    = coalesce(tostring(Properties["gen_ai.thread.run.id"]), OperationId),
           runStatus = tostring(Properties["gen_ai.thread.run.status"]),
           inTok     = toint(Properties["gen_ai.usage.input_tokens"]),
           outTok    = toint(Properties["gen_ai.usage.output_tokens"]),
           tool      = coalesce(tostring(Properties["gen_ai.tool.name"]), iff(op == "submit_tool_outputs", "function_tool", "")),
           model     = coalesce(tostring(Properties["gen_ai.request.model"]), tostring(Properties["gen_ai.response.model"])),
           thread    = tostring(Properties["gen_ai.thread.id"]),
           flow      = tostring(Properties["agentctl.auth_flow"]),
           usr       = coalesce(tostring(Properties["enduser.id"]), UserAuthenticatedId, UserId);
let runAgent = spans
  | where isnotempty(agentAttr) or isnotempty(agentId)
  | summarize runAgentKey = take_any(coalesce(agentAttr, agentId)) by runKey;
// The caller is often only on the client's HTTP span (no gen_ai attributes), e.g. Responses calls
// whose gen_ai spans are emitted server-side by Foundry; look it up across the whole trace.
let opCaller = AppDependencies
  | where TimeGenerated > ago(${RANGE[range].ago})
  | extend u = coalesce(tostring(Properties["enduser.id"]), UserAuthenticatedId), f = tostring(Properties["agentctl.auth_flow"])
  | where isnotempty(u) or isnotempty(f)
  | summarize opUser = take_anyif(u, isnotempty(u)), opFlow = take_anyif(f, isnotempty(f)) by OperationId;
let gen = spans
  | join kind=leftouter runAgent on runKey
  | join kind=leftouter opCaller on OperationId
  | extend usr = coalesce(usr, opUser), flow = coalesce(flow, opFlow)
  | extend agentName = coalesce(agentAttr, agentId, runAgentKey),
           failedRun = op in (RunOps) and (Success == false or runStatus in ("failed", "cancelled", "expired"));`;
}

export function agentStatsQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where isnotempty(agentName)
| summarize runs = dcountif(runKey, op in (RunOps)),
            failedRuns = dcountif(runKey, failedRun),
            inputTokens = sum(inTok),
            outputTokens = sum(outTok),
            toolCalls = countif(op in (ToolOps)),
            p95LatencyMs = percentile(iff(op in (RunOps), DurationMs, real(null)), 95),
            distinctUsers = dcountif(usr, isnotempty(usr)),
            lastActivity = max(TimeGenerated)
  by agentName`;
}

export function runsSeriesQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where op in (RunOps)
| summarize failed = max(toint(failedRun)), t0 = min(TimeGenerated) by runKey
| summarize succeeded = countif(failed == 0), failed = countif(failed == 1) by t = bin(t0, ${RANGE[range].bin})
| order by t asc`;
}

export function tokenSeriesQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where isnotempty(agentName) and (isnotnull(inTok) or isnotnull(outTok))
| summarize tokens = sum(inTok) + sum(outTok) by t = bin(TimeGenerated, ${RANGE[range].bin}), agentName
| order by t asc`;
}

export function topToolsQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where op in (ToolOps) and isnotempty(tool)
| summarize calls = count() by tool
| top 10 by calls`;
}

export function runsQuery(range: TimeRange, agentKeys?: string[]) {
  const filter = agentKeys?.length ? `\n| where agentName in (${agentKeys.map((k) => `"${esc(k)}"`).join(", ")})` : "";
  return `${genAiSpans(range)}
gen
| summarize start = min(TimeGenerated),
            durationMs = maxif(DurationMs, op in (RunOps)),
            hasRun = countif(op in (RunOps)),
            failures = countif(failedRun),
            user = take_anyif(usr, isnotempty(usr)),
            flow = take_anyif(flow, isnotempty(flow)),
            inputTokens = sum(inTok),
            outputTokens = sum(outTok),
            toolCalls = countif(op in (ToolOps)),
            threadId = take_anyif(thread, isnotempty(thread)),
            agentName = take_anyif(agentName, isnotempty(agentName))
  by operationId = runKey
| where hasRun > 0 and isnotempty(agentName)${filter}
| extend success = failures == 0
| project-away hasRun
| top 300 by start desc`;
}

/** All gen_ai spans of one run: by run id, plus every span in the traces that touched it. */
export function runSpansQuery(runKey: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(runKey)) throw new Error("invalid run id");
  return `let ops = AppDependencies
  | where TimeGenerated > ago(30d)
  | where tostring(Properties["gen_ai.thread.run.id"]) == "${runKey}" or OperationId == "${runKey}"
  | distinct OperationId;
AppDependencies
| where TimeGenerated > ago(30d) and OperationId in (ops)
| extend op = tostring(Properties["gen_ai.operation.name"])
| where isnotempty(op)
| project spanId = Id, parentId = ParentId, name = Name, op, start = TimeGenerated, durationMs = DurationMs, success = Success,
          toolName = tostring(Properties["gen_ai.tool.name"]),
          model = coalesce(tostring(Properties["gen_ai.request.model"]), tostring(Properties["gen_ai.response.model"])),
          inputTokens = toint(Properties["gen_ai.usage.input_tokens"]),
          outputTokens = toint(Properties["gen_ai.usage.output_tokens"])
| order by start asc`;
}

/**
 * Who uses what, and how.
 * - Interactive user sign-ins (SigninLogs) → "delegated"
 * - Non-interactive user sign-ins where the *client* app is itself a resource users sign in to
 *   (a middle tier), or a known agent app → "obo"; otherwise "delegated" (token refresh)
 * - Service principal sign-ins → "app", or "agent_identity" when the SP is an Entra agent identity
 * - Managed identity sign-ins → "managed_identity"
 * The Agent column (Entra Agent ID sign-ins, preview) is used when present.
 */
export function identityUsageQuery(range: TimeRange, agentAppIds: string[]) {
  const ids = `dynamic([${agentAppIds.filter(Boolean).map((a) => `"${esc(a)}"`).join(",")}])`;
  const a = RANGE[range].ago;
  return `let AgentApps = ${ids};
let MiddleTier = union isfuzzy=true
    (SigninLogs | where TimeGenerated > ago(${a}) | distinct ResourceIdentity),
    (AADNonInteractiveUserSignInLogs | where TimeGenerated > ago(${a}) | distinct ResourceIdentity)
  | summarize make_set(ResourceIdentity, 5000);
let mt = toscalar(MiddleTier);
union isfuzzy=true
  (SigninLogs
    | where TimeGenerated > ago(${a})
    | extend flow = "delegated", ptype = "user", pid = UserId, pname = UserPrincipalName),
  (AADNonInteractiveUserSignInLogs
    | where TimeGenerated > ago(${a})
    | extend AgentInfo = column_ifexists("Agent", dynamic(null))
    | extend agentType = tostring(AgentInfo.agentType)
    | extend flow = iff(AppId in (AgentApps) or set_has_element(mt, AppId) or isnotempty(agentType), "obo", "delegated"),
             ptype = "user", pid = UserId, pname = UserPrincipalName),
  (AADServicePrincipalSignInLogs
    | where TimeGenerated > ago(${a})
    | extend AgentInfo = column_ifexists("Agent", dynamic(null))
    | extend agentType = tostring(AgentInfo.agentType)
    | extend flow = iff(AppId in (AgentApps) or isnotempty(agentType), "agent_identity", "app"),
             ptype = iff(flow == "agent_identity", "agent_identity", "service_principal"),
             pid = ServicePrincipalId, pname = ServicePrincipalName),
  (AADManagedIdentitySignInLogs
    | where TimeGenerated > ago(${a})
    | extend flow = "managed_identity", ptype = "managed_identity", pid = ServicePrincipalId, pname = ServicePrincipalName)
| extend failed = tostring(ResultType) != "0",
         ca = tostring(column_ifexists("ConditionalAccessStatus", ""))
| summarize signIns = count(), failures = countif(failed), lastSeen = max(TimeGenerated), conditionalAccess = take_any(ca)
  by principalId = pid, principalName = pname, principalType = ptype, clientAppId = AppId, clientAppName = AppDisplayName,
     resource = ResourceDisplayName, authFlow = flow
| extend isAgent = clientAppId in (AgentApps) or principalType == "agent_identity"
| top 500 by signIns desc`;
}

/** What apps and agents actually call in Microsoft Graph, by auth flow. */
export function graphActivityQuery(range: TimeRange) {
  return `MicrosoftGraphActivityLogs
| where TimeGenerated > ago(${RANGE[range].ago})
| extend authFlow = iff(isnotempty(UserId), "delegated", "app")
| extend endpoint = tostring(split(RequestUri, "?")[0])
| extend endpoint = replace_regex(endpoint, @"^https://graph\\.microsoft\\.com", "")
| extend endpoint = replace_regex(endpoint, @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "{id}")
| extend endpoint = replace_regex(endpoint, @"/[^/]+@[^/]+", "/{upn}")
| summarize calls = count(), errors = countif(ResponseStatusCode >= 400),
            scopesOrRoles = take_any(iff(authFlow == "delegated", tostring(Scopes), tostring(Roles))),
            lastSeen = max(TimeGenerated)
  by appId = AppId, authFlow, method = RequestMethod, endpoint
| top 300 by calls desc`;
}

/**
 * Content safety + content capture, from Foundry's server-side invoke_agent/chat spans.
 * microsoft.foundry.content_filter.results = [{source_type, blocked, content_filter_results:{hate:{filtered,severity},...,jailbreak:{detected,filtered}}}]
 */
export function contentFilterQuery(range: TimeRange) {
  return `AppDependencies
| where TimeGenerated > ago(${RANGE[range].ago})
| where tostring(Properties["gen_ai.operation.name"]) in ("invoke_agent", "chat")
| extend agentName = coalesce(tostring(Properties["gen_ai.agent.name"]), tostring(Properties["gen_ai.agent.id"]))
| extend cf = todynamic(tostring(Properties["microsoft.foundry.content_filter.results"]))
| where isnotempty(agentName) and array_length(cf) > 0
| mv-expand cf
| extend source = tostring(cf.source_type), r = cf.content_filter_results
| mv-apply category = bag_keys(r) to typeof(string) on (
    extend filtered = tobool(r[category].filtered), detected = tobool(r[category].detected), severity = tostring(r[category].severity)
  )
| summarize evaluations = count(),
            flagged = countif(filtered == true or detected == true or (isnotempty(severity) and severity != "safe")),
            blocked = countif(filtered == true)
  by agentName, source, category`;
}

export function contentCaptureQuery(range: TimeRange) {
  return `AppDependencies
| where TimeGenerated > ago(${RANGE[range].ago})
| where tostring(Properties["gen_ai.operation.name"]) in ("invoke_agent", "chat", "execute_tool")
| extend agentName = coalesce(tostring(Properties["gen_ai.agent.name"]), tostring(Properties["gen_ai.agent.id"]))
| where isnotempty(agentName)
| extend captured = isnotempty(tostring(Properties["gen_ai.input.messages"])) or isnotempty(tostring(Properties["gen_ai.output.messages"]))
| summarize spans = count(), capturedSpans = countif(captured) by agentName`;
}

export const PING = "print ok = 1";
