// Log Analytics query API (CORS-enabled). Workspace-based Application Insights data lives in
// the same workspace (App* tables), so traces and Entra logs are queried in one place.

import { config } from "../../config";
import { apiFetch } from "./http";

interface LaResponse {
  tables: { name: string; columns: { name: string; type: string }[]; rows: unknown[][] }[];
}

export async function kql<T = Record<string, unknown>>(query: string, timespan = "P30D"): Promise<T[]> {
  if (!config.azure.logAnalyticsWorkspaceId) throw new Error("AGENTCTL_LAW_WORKSPACE_ID is not configured");
  const r = await apiFetch<LaResponse>(
    "logAnalytics",
    `https://api.loganalytics.azure.com/v1/workspaces/${config.azure.logAnalyticsWorkspaceId}/query`,
    { body: { query, timespan } },
    "logAnalytics",
  );
  const t = r.tables[0];
  if (!t) return [];
  return t.rows.map((row) => Object.fromEntries(t.columns.map((c, i) => [c.name, row[i]])) as T);
}
