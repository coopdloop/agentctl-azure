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

/** Span operation names that represent one agent run (differs between SDK generations). */
const RUN_OPS = `dynamic(["invoke_agent", "process_thread_run", "start_thread_run", "create_run"])`;

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Normalised gen_ai spans with the agent name propagated from the run span to its children. */
function genAiSpans(range: TimeRange) {
  return `
let RunOps = ${RUN_OPS};
let spans = AppDependencies
  | where TimeGenerated > ago(${RANGE[range].ago})
  | extend op = tostring(Properties["gen_ai.operation.name"])
  | where isnotempty(op)
  | extend agent  = coalesce(tostring(Properties["gen_ai.agent.name"]), tostring(Properties["gen_ai.agent.id"])),
           inTok  = toint(Properties["gen_ai.usage.input_tokens"]),
           outTok = toint(Properties["gen_ai.usage.output_tokens"]),
           tool   = tostring(Properties["gen_ai.tool.name"]),
           model  = tostring(Properties["gen_ai.request.model"]),
           thread = tostring(Properties["gen_ai.thread.id"]),
           flow   = tostring(Properties["agentctl.auth_flow"]),
           usr    = coalesce(tostring(Properties["enduser.id"]), UserAuthenticatedId, UserId);
let runAgent = spans | where op in (RunOps) and isnotempty(agent) | summarize runAgentName = take_any(agent) by OperationId;
let gen = spans
  | join kind=leftouter runAgent on OperationId
  | extend agentName = coalesce(agent, runAgentName);`;
}

export function agentStatsQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where isnotempty(agentName)
| summarize runs = dcountif(OperationId, op in (RunOps)),
            failedRuns = dcountif(OperationId, op in (RunOps) and Success == false),
            inputTokens = sum(inTok),
            outputTokens = sum(outTok),
            toolCalls = countif(op == "execute_tool"),
            p95LatencyMs = percentile(iff(op in (RunOps), DurationMs, real(null)), 95),
            distinctUsers = dcountif(usr, isnotempty(usr)),
            lastActivity = max(TimeGenerated)
  by agentName`;
}

export function runsSeriesQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where op in (RunOps)
| summarize succeeded = countif(Success == true), failed = countif(Success == false) by t = bin(TimeGenerated, ${RANGE[range].bin})
| order by t asc`;
}

export function tokenSeriesQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where isnotempty(agentName)
| summarize tokens = sum(inTok) + sum(outTok) by t = bin(TimeGenerated, ${RANGE[range].bin}), agentName
| order by t asc`;
}

export function topToolsQuery(range: TimeRange) {
  return `${genAiSpans(range)}
gen
| where op == "execute_tool" and isnotempty(tool)
| summarize calls = count() by tool
| top 10 by calls`;
}

export function runsQuery(range: TimeRange, agentName?: string) {
  return `${genAiSpans(range)}
gen
| summarize start = min(TimeGenerated),
            durationMs = maxif(DurationMs, op in (RunOps)),
            failures = countif(Success == false and op in (RunOps)),
            user = take_anyif(usr, isnotempty(usr)),
            flow = take_anyif(flow, isnotempty(flow)),
            inputTokens = sum(inTok),
            outputTokens = sum(outTok),
            toolCalls = countif(op == "execute_tool"),
            threadId = take_anyif(thread, isnotempty(thread)),
            agentName = take_anyif(agentName, isnotempty(agentName))
  by OperationId
| where isnotempty(agentName)${agentName ? `\n| where agentName == "${esc(agentName)}"` : ""}
| extend success = failures == 0
| top 300 by start desc`;
}

export function runSpansQuery(operationId: string) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(operationId)) throw new Error("invalid operation id");
  return `AppDependencies
| where TimeGenerated > ago(30d) and OperationId == "${operationId}"
| extend op = tostring(Properties["gen_ai.operation.name"])
| project spanId = Id, parentId = ParentId, name = Name, op, start = TimeGenerated, durationMs = DurationMs, success = Success,
          toolName = tostring(Properties["gen_ai.tool.name"]),
          model = tostring(Properties["gen_ai.request.model"]),
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
  const ids = `dynamic([${agentAppIds.map((a) => `"${esc(a)}"`).join(",")}])`;
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

export const PING = "print ok = 1";
