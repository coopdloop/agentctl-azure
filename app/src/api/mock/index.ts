import { config } from "../../config";
import { HARNESS_TOOLS } from "../../lib/harnessLibrary";
import { agentToManifest } from "../../lib/manifestDefaults";
import type { DefenderPosture, FoundryAccountPosture,
  Agent,
  AgentRun,
  AgentStats,
  AuthFlowObserved,
  ContentSafety,
  DataSource,
  GraphActivity,
  IdentityUsage,
  Overview,
  SourceHealth,
  Span,
  TimePoint,
  TimeRange,
} from "../types";
import {
  AGENTS,
  AGENT_IDENTITIES,
  AGENT_TOOLS_USED,
  AGENT_WEIGHT,
  APP_ONLY_AGENTS,
  DEPLOYMENTS,
  GRAPH_ACTIVITY_BASE,
  PERMISSION_GRANTS,
  POLICY_STATES,
  PROJECTS,
  RAI_POLICIES,
  ROLE_ASSIGNMENTS,
  SUB,
  USERS,
  prng,
} from "./seed";

const HOUR = 3_600_000;
const RANGE_MS: Record<TimeRange, number> = { "1h": HOUR, "24h": 24 * HOUR, "7d": 7 * 24 * HOUR, "30d": 30 * 24 * HOUR };
const BIN_MS: Record<TimeRange, number> = { "1h": 5 * 60_000, "24h": HOUR, "7d": 6 * HOUR, "30d": 24 * HOUR };

const delay = <T,>(v: T, ms = 120 + Math.random() * 180) => new Promise<T>((r) => setTimeout(() => r(v), ms));

interface MockRun extends AgentRun {
  ts: number;
}

/** 30 days of runs with business-hours seasonality, generated once per page load. */
function generateRuns(): MockRun[] {
  const rnd = prng(42);
  const now = Date.now();
  const runs: MockRun[] = [];
  const agentNames = Object.keys(AGENT_WEIGHT);
  const cumulative = agentNames.map(
    (_, i) => agentNames.slice(0, i + 1).reduce((s, n) => s + AGENT_WEIGHT[n], 0),
  );
  const pickAgent = () => {
    const r = rnd();
    return agentNames[cumulative.findIndex((c) => r <= c)] ?? agentNames[0];
  };

  for (let h = 30 * 24; h >= 0; h--) {
    const t0 = now - h * HOUR;
    const d = new Date(t0);
    const hour = d.getUTCHours();
    const weekday = d.getUTCDay() % 6 !== 0;
    const business = hour >= 13 && hour <= 23; // ~ US business hours in UTC
    const growth = 0.7 + 0.3 * (1 - h / (30 * 24)); // adoption trend
    const n = Math.round((business ? 26 : 5) * (weekday ? 1 : 0.35) * growth * (0.75 + rnd() * 0.5));
    for (let i = 0; i < n; i++) {
      const agentName = pickAgent();
      const ts = t0 + rnd() * HOUR;
      if (ts > now) continue;
      const appOnly = APP_ONLY_AGENTS.has(agentName);
      const failRate = agentName === "browser-ops-bot" ? 0.22 : agentName === "it-helpdesk-agent" ? 0.05 : 0.025;
      const toolCalls = Math.floor(rnd() * (agentName === "finance-invoice-triage" ? 5 : 3.5));
      const inputTokens = Math.round(1200 + rnd() * 5200 + toolCalls * 900);
      runs.push({
        ts,
        operationId: Math.floor(rnd() * 0xffffffff).toString(16).padStart(8, "0") + Math.floor(rnd() * 0xffffffff).toString(16).padStart(8, "0"),
        agentName,
        start: new Date(ts).toISOString(),
        durationMs: Math.round(1800 + rnd() * 9000 + toolCalls * 1400),
        success: rnd() > failRate,
        user: appOnly ? undefined : USERS[Math.floor(Math.pow(rnd(), 1.6) * USERS.length)],
        authFlow: appOnly ? "agent_identity" : agentName === "hr-benefits-assistant" || agentName === "sales-research-agent" ? "obo" : "delegated",
        inputTokens,
        outputTokens: Math.round(150 + rnd() * 900),
        toolCalls,
        threadId: `thread_${Math.floor(rnd() * 1e12).toString(36)}`,
      });
    }
  }
  return runs.sort((a, b) => b.ts - a.ts);
}

let RUNS: MockRun[] | null = null;
const allRuns = () => (RUNS ??= generateRuns());
const inRange = (range: TimeRange) => {
  const since = Date.now() - RANGE_MS[range];
  return allRuns().filter((r) => r.ts >= since);
};

function bucketize(range: TimeRange) {
  const bin = BIN_MS[range];
  const end = Math.ceil(Date.now() / bin) * bin;
  const start = end - RANGE_MS[range];
  const keys: number[] = [];
  for (let t = start; t < end; t += bin) keys.push(t);
  return { keys, bin, start };
}

const HARNESS_TOOL_NAMES = new Set(HARNESS_TOOLS.map((t) => t.tool.name));
const agentApp = (name: string) => AGENT_IDENTITIES.find((i) => i.displayName === name);
const DOWNSTREAM: Record<string, string> = {
  "hr-benefits-assistant": "Office 365 SharePoint Online",
  "it-helpdesk-agent": "Microsoft Graph",
  "sales-research-agent": "Microsoft Graph",
  "crm-writer": "Dynamics CRM",
  "dev-docs-copilot": "Azure AI Search",
};

export class MockDataSource implements DataSource {
  readonly kind = "mock" as const;

  listProjects = () => delay(PROJECTS);
  listDeployments = () => delay(DEPLOYMENTS);
  listAgents = () => delay(AGENTS);
  getAgent = (project: string, id: string) => delay(AGENTS.find((a) => a.project === project && a.id === id));

  async agentStats(range: TimeRange): Promise<AgentStats[]> {
    const runs = inRange(range);
    const by = new Map<string, MockRun[]>();
    for (const r of runs) by.set(r.agentName, [...(by.get(r.agentName) ?? []), r]);
    return delay(
      AGENTS.map((a) => {
        const rs = by.get(a.name) ?? [];
        const lat = rs.map((r) => r.durationMs).sort((x, y) => x - y);
        return {
          agentName: a.name,
          runs: rs.length,
          failedRuns: rs.filter((r) => !r.success).length,
          inputTokens: rs.reduce((s, r) => s + r.inputTokens, 0),
          outputTokens: rs.reduce((s, r) => s + r.outputTokens, 0),
          toolCalls: rs.reduce((s, r) => s + r.toolCalls, 0),
          p95LatencyMs: lat.length ? lat[Math.floor(lat.length * 0.95)] : 0,
          distinctUsers: new Set(rs.map((r) => r.user).filter(Boolean)).size,
          lastActivity: rs[0]?.start,
        };
      }),
    );
  }

  async tokenSeries(range: TimeRange): Promise<TimePoint[]> {
    const { keys, bin, start } = bucketize(range);
    const points: TimePoint[] = keys.map((k) => ({ t: new Date(k).toISOString() }));
    for (const r of inRange(range)) {
      const i = Math.floor((r.ts - start) / bin);
      if (i < 0 || i >= points.length) continue;
      points[i][r.agentName] = ((points[i][r.agentName] as number) ?? 0) + r.inputTokens + r.outputTokens;
    }
    return delay(points);
  }

  async overview(range: TimeRange): Promise<Overview> {
    const runs = inRange(range);
    const { keys, bin, start } = bucketize(range);
    const series = keys.map((k) => ({ t: new Date(k).toISOString(), succeeded: 0, failed: 0 }));
    for (const r of runs) {
      const i = Math.floor((r.ts - start) / bin);
      if (i >= 0 && i < series.length) series[i][r.success ? "succeeded" : "failed"]++;
    }
    const mix = new Map<AuthFlowObserved, number>();
    for (const r of runs) mix.set(r.authFlow!, (mix.get(r.authFlow!) ?? 0) + 1);
    mix.set("managed_identity", Math.round(runs.length * 0.04));
    mix.set("app", Math.round(runs.length * 0.03));

    const toolCounts = new Map<string, number>();
    const rnd = prng(7);
    for (const r of runs) {
      const tools = AGENT_TOOLS_USED[r.agentName] ?? [];
      for (let i = 0; i < r.toolCalls; i++) {
        const t = tools[Math.floor(rnd() * tools.length)];
        if (t) toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
      }
    }
    const allTools = AGENTS.flatMap((a) => a.tools);
    return delay({
      agents: AGENTS.length,
      projects: PROJECTS.length,
      runs: runs.length,
      failedRuns: runs.filter((r) => !r.success).length,
      tokens: runs.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
      activeUsers: new Set(runs.map((r) => r.user).filter(Boolean)).size,
      injectedTools: allTools.filter((t) => HARNESS_TOOL_NAMES.has(t.name)).length,
      approvalFreeWriteTools: allTools.filter((t) => ["mcp", "browser_automation"].includes(t.type) && t.requireApproval === "never").length,
      nonCompliantResources: new Set(POLICY_STATES.filter((p) => p.complianceState === "NonCompliant").map((p) => p.resourceId)).size,
      unfilteredDeployments: DEPLOYMENTS.filter((d) => d.raiPolicyName === "dev-relaxed").length,
      runsSeries: series,
      authFlowMix: [...mix.entries()].map(([flow, count]) => ({ flow, count })),
      topTools: [...toolCounts.entries()].map(([tool, calls]) => ({ tool, calls })).sort((a, b) => b.calls - a.calls).slice(0, 10),
    });
  }

  async listRuns(range: TimeRange, agentName?: string): Promise<AgentRun[]> {
    return delay(
      inRange(range)
        .filter((r) => !agentName || r.agentName === agentName)
        .slice(0, 300)
        .map(({ ts: _ts, ...r }) => r),
    );
  }

  async getRunSpans(operationId: string): Promise<Span[]> {
    const run = allRuns().find((r) => r.operationId === operationId);
    if (!run) return delay([]);
    const rnd = prng(parseInt(operationId.slice(0, 8), 16));
    const agent = AGENTS.find((a) => a.name === run.agentName);
    const tools = AGENT_TOOLS_USED[run.agentName] ?? [];
    const spans: Span[] = [];
    const root = `${operationId.slice(0, 8)}-root`;
    let t = run.ts;
    spans.push({ spanId: root, name: `invoke_agent ${run.agentName}`, kind: "invoke_agent", start: run.start, durationMs: run.durationMs, success: run.success });
    const chat = (n: number, last: boolean) => {
      const d = Math.round(500 + rnd() * 2200);
      spans.push({
        spanId: `${root}-chat${n}`,
        parentId: root,
        name: `chat ${agent?.model ?? "model"}`,
        kind: "chat",
        start: new Date(t).toISOString(),
        durationMs: d,
        success: last ? run.success : true,
        model: agent?.model,
        inputTokens: Math.round(run.inputTokens / (run.toolCalls + 1)),
        outputTokens: Math.round(run.outputTokens / (run.toolCalls + 1)),
      });
      t += d;
    };
    chat(0, run.toolCalls === 0);
    for (let i = 0; i < run.toolCalls; i++) {
      const tool = tools[Math.floor(rnd() * tools.length)] ?? "tool";
      const d = Math.round(200 + rnd() * 1800);
      spans.push({ spanId: `${root}-tool${i}`, parentId: root, name: `execute_tool ${tool}`, kind: "execute_tool", start: new Date(t).toISOString(), durationMs: d, success: true, toolName: tool });
      t += d;
      chat(i + 1, i === run.toolCalls - 1);
    }
    return delay(spans);
  }

  async identityUsage(range: TimeRange): Promise<IdentityUsage[]> {
    const runs = inRange(range);
    const rows = new Map<string, IdentityUsage>();
    const add = (key: string, base: Omit<IdentityUsage, "signIns" | "failures" | "lastSeen">, at: string, failed: boolean) => {
      const r = rows.get(key) ?? { ...base, signIns: 0, failures: 0, lastSeen: at };
      r.signIns++;
      if (failed) r.failures++;
      if (at > r.lastSeen) r.lastSeen = at;
      rows.set(key, r);
    };
    for (const r of runs) {
      const app = agentApp(r.agentName);
      const appId = app?.appId ?? "7e1d2f3a-0006-4b2c-8d3e-f1e2d3c4b006";
      if (r.user) {
        // user → agent (delegated)
        add(`d|${r.user}|${r.agentName}`, {
          principalId: r.user, principalName: r.user, principalType: "user", clientAppId: "teams-or-portal", clientAppName: "Microsoft Teams",
          resource: r.agentName, authFlow: "delegated", isAgent: true, conditionalAccess: "success",
        }, r.start, false);
        // agent → downstream on behalf of user (OBO)
        if (DOWNSTREAM[r.agentName])
          add(`o|${r.user}|${r.agentName}`, {
            principalId: r.user, principalName: r.user, principalType: "user", clientAppId: appId, clientAppName: r.agentName,
            resource: DOWNSTREAM[r.agentName], authFlow: "obo", isAgent: true, conditionalAccess: "success",
          }, r.start, !r.success && r.agentName === "hr-benefits-assistant");
      } else if (app) {
        add(`a|${r.agentName}`, {
          principalId: app.id, principalName: r.agentName, principalType: "agent_identity", clientAppId: app.appId, clientAppName: r.agentName,
          resource: r.agentName === "secops-triage-agent" ? "Microsoft Graph" : "Azure Storage", authFlow: "agent_identity", isAgent: true, conditionalAccess: "notApplied",
        }, r.start, false);
      } else {
        add(`m|${r.agentName}`, {
          principalId: "mi-fin", principalName: "aif-contoso-prod/enterprise-agents (project MI)", principalType: "managed_identity", clientAppId: "7e1d2f3a-0006-4b2c-8d3e-f1e2d3c4b006",
          clientAppName: "enterprise-agents project MI", resource: r.agentName === "finance-invoice-triage" ? "Azure Storage" : "Azure Resource Manager", authFlow: "managed_identity", isAgent: true, conditionalAccess: "notApplied",
        }, r.start, false);
      }
    }
    add("x|svc", {
      principalId: "sp-ci", principalName: "github-actions-deployer", principalType: "service_principal", clientAppId: "c1c1c1c1-0000-0000-0000-00000000c1c1", clientAppName: "github-actions-deployer",
      resource: "Azure Resource Manager", authFlow: "app", isAgent: false, conditionalAccess: "notApplied",
    }, new Date().toISOString(), false);
    return delay([...rows.values()].sort((a, b) => b.signIns - a.signIns));
  }

  async graphActivity(range: TimeRange): Promise<GraphActivity[]> {
    const scale = RANGE_MS[range] / RANGE_MS["24h"];
    const rnd = prng(99);
    return delay(
      GRAPH_ACTIVITY_BASE.map((g) => {
        const calls = Math.max(1, Math.round((40 + rnd() * 900) * scale));
        return { ...g, calls, errors: Math.round(calls * rnd() * 0.04), lastSeen: new Date(Date.now() - rnd() * 3 * HOUR).toISOString() };
      }).sort((a, b) => b.calls - a.calls),
    );
  }

  permissionGrants = () => delay(PERMISSION_GRANTS);
  agentIdentities = () => delay(AGENT_IDENTITIES);
  roleAssignments = () => delay(ROLE_ASSIGNMENTS);
  raiPolicies = () => delay(RAI_POLICIES);

  async contentSafety(range: TimeRange): Promise<ContentSafety> {
    const runs = inRange(range);
    const rnd = prng(11);
    const cats = ["hate", "sexual", "violence", "self_harm", "jailbreak"];
    const filters: ContentSafety["filters"] = [];
    for (const a of AGENTS) {
      const n = runs.filter((r) => r.agentName === a.name).length;
      if (!n) continue;
      for (const source of ["prompt", "completion"])
        for (const category of source === "prompt" ? cats : cats.slice(0, 4)) {
          const flagged = Math.round(n * (category === "jailbreak" ? 0.012 : 0.004) * (a.name === "browser-ops-bot" ? 6 : 1) * rnd() * 2);
          filters.push({ agentName: a.name, source, category, evaluations: n, flagged, blocked: Math.round(flagged * 0.6) });
        }
    }
    // Content capture deliberately on for two agents to exercise the finding.
    const capture = AGENTS.map((a) => {
      const spans = runs.filter((r) => r.agentName === a.name).length * 3;
      return { agentName: a.name, spans, capturedSpans: ["hr-benefits-assistant", "browser-ops-bot"].includes(a.name) ? spans : 0 };
    });
    return delay({ filters, capture });
  }
  policyStates = () => delay(POLICY_STATES);

  // Prod is hardened; dev deliberately isn't, so the controls page has failures to show.
  accountPosture = () =>
    delay<FoundryAccountPosture[]>([
      {
        id: `/subscriptions/${SUB}/resourceGroups/rg-ai-prod/providers/Microsoft.CognitiveServices/accounts/aif-contoso-prod`,
        name: "aif-contoso-prod", subscriptionId: SUB, resourceGroup: "rg-ai-prod", location: "eastus2",
        disableLocalAuth: true, publicNetworkAccess: "Disabled", networkDefaultAction: "Deny", privateEndpoints: 1,
        customerManagedKey: true, managedIdentity: true, restrictOutboundNetworkAccess: true, allowedFqdns: 4, diagnosticsToWorkspace: true,
      },
      {
        id: `/subscriptions/${SUB}/resourceGroups/rg-ai-dev/providers/Microsoft.CognitiveServices/accounts/aif-contoso-dev`,
        name: "aif-contoso-dev", subscriptionId: SUB, resourceGroup: "rg-ai-dev", location: "eastus2",
        disableLocalAuth: false, publicNetworkAccess: "Enabled", networkDefaultAction: "Allow", privateEndpoints: 0,
        customerManagedKey: false, managedIdentity: true, restrictOutboundNetworkAccess: false, allowedFqdns: 0, diagnosticsToWorkspace: false,
      },
    ]);

  defenderPosture = () => {
    const acct = (a: string) => `/subscriptions/${SUB}/resourcegroups/rg-ai-${a}/providers/microsoft.cognitiveservices/accounts/aif-contoso-${a}`;
    return delay<DefenderPosture[]>([
      {
        subscriptionId: SUB,
        aiPlan: "Standard",
        alerts: [
          { alertType: "AI.Azure_Jailbreak.ContentFiltering.BlockedAttempt", name: "Jailbreak attempt on an Azure AI model deployment was blocked by Prompt Shields", severity: "Medium", resourceId: acct("prod"), count: 7, lastSeen: new Date(Date.now() - 5 * HOUR).toISOString() },
          { alertType: "AI.Azure_AsciiSmuggling", name: "ASCII smuggling prompt injection detected", severity: "High", resourceId: acct("dev"), count: 2, lastSeen: new Date(Date.now() - 30 * HOUR).toISOString() },
        ],
        recommendations: [
          { name: "Azure AI Services resources should have key access disabled (disable local authentication)", status: "Unhealthy", resourceId: acct("dev"), severity: "Medium" },
          { name: "Azure AI Services resources should restrict network access", status: "Unhealthy", resourceId: acct("dev"), severity: "Medium" },
          { name: "Azure AI Services resources should have key access disabled (disable local authentication)", status: "Healthy", resourceId: acct("prod"), severity: "Medium" },
        ],
      },
    ]);
  };

  async manifestFor(agent: Agent) {
    return delay(agentToManifest(agent, DEPLOYMENTS, config.azure.subscriptionId || SUB));
  }

  async health(): Promise<SourceHealth[]> {
    return delay(
      [
        "Azure Resource Manager",
        "Foundry projects (ARM)",
        "Foundry Agent Service",
        "Log Analytics",
        "App Insights gen_ai traces",
        "Entra sign-in logs",
        "Graph activity logs",
        "Microsoft Graph",
        "Entra Agent ID",
        "Azure Policy",
      ].map((source) => ({ source, ok: true, detail: "mock data", latencyMs: 0 })),
    );
  }
}
