// Live-vs-GitOps drift for agents-API agents. Every version deployed by the agents-gitops pipeline
// carries agentctl.manifest_sha256 in its metadata; versions created in the portal or by SDK
// scripts don't. Optionally compares with the desired state in the GitOps repo.

import type { AgentVersionInfo } from "../api/types";

export type DriftState = "in_sync" | "managed" | "pending" | "drifted" | "diverged" | "unmanaged";

export interface RepoState {
  /** manifestSha256 of agents/<name>/change-request.yaml on the default branch. */
  manifestSha256: string;
  /** baseManifestSha256 of that change request (what it expects to replace). */
  baseManifestSha256?: string;
  path: string;
}

export interface Drift {
  state: DriftState;
  summary: string;
  live?: AgentVersionInfo;
  lastManaged?: AgentVersionInfo;
}

const short = (s?: string) => (s ? s.slice(0, 12) : "?");

export function classifyDrift(history: AgentVersionInfo[], repo?: RepoState | null): Drift {
  const live = history[0];
  const lastManaged = history.find((h) => h.manifestSha256);
  if (!live) return { state: "unmanaged", summary: "No versions found" };
  if (!lastManaged) return { state: "unmanaged", summary: `Never deployed through GitOps (${history.length} version(s), latest v${live.version})`, live };
  if (!live.manifestSha256)
    return {
      state: "drifted",
      summary: `Changed outside GitOps: v${live.version} (${live.createdAt.slice(0, 10)}) has no manifest hash; last GitOps deploy was v${lastManaged.version}`,
      live,
      lastManaged,
    };
  if (!repo) return { state: "managed", summary: `v${live.version} deployed through GitOps (manifest ${short(live.manifestSha256)})`, live, lastManaged };
  if (repo.manifestSha256 === live.manifestSha256)
    return { state: "in_sync", summary: `In sync with ${repo.path} (manifest ${short(live.manifestSha256)})`, live, lastManaged };
  if (repo.baseManifestSha256 === live.manifestSha256)
    return { state: "pending", summary: `Merged change not deployed yet: repo ${short(repo.manifestSha256)} replaces live ${short(live.manifestSha256)}`, live, lastManaged };
  return {
    state: "diverged",
    summary: `Live manifest ${short(live.manifestSha256)} is neither the repo's desired state ${short(repo.manifestSha256)} nor its base`,
    live,
    lastManaged,
  };
}

export const DRIFT_LABEL: Record<DriftState, string> = {
  in_sync: "In sync",
  managed: "GitOps-managed",
  pending: "Pending deploy",
  drifted: "Drifted",
  diverged: "Diverged from repo",
  unmanaged: "Unmanaged",
};
