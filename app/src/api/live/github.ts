// GitHub integration for the agents-gitops repo:
//   - sign-in with the OAuth device flow of a GitHub App (no client secret; user-to-server token
//     limited to the repos the app is installed on and the user can access)
//   - read the desired state of an agent (agents/<name>/change-request.yaml) for drift
//   - open a pull request with a bundle (one commit on a new branch; draft for proposals)
// Calls go through the same-origin proxy: github.com's device-flow endpoints don't support CORS.
// The token lives in sessionStorage (like MSAL tokens) and is only sent to GitHub.

import YAML from "yaml";
import { config } from "../../config";

const TOKEN_KEY = "agentctl.github.token";

export const githubConfigured = () => Boolean(config.github.clientId && parseRepo(config.gitops.repo));

/** Accepts "owner/repo" or a github URL. */
export function parseRepo(repo: string): { owner: string; name: string } | null {
  const m = repo.trim().match(/^(?:https?:\/\/[^/]+\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

const via = (base: string, path: string) => {
  const u = new URL(base);
  return `${window.location.origin}${config.network.proxyBase}/${u.host}${u.pathname.replace(/\/$/, "")}${path}`;
};

export function getGithubToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function signOutGithub() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function gh<T>(method: string, path: string, body?: unknown, token = getGithubToken()): Promise<T> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (body) headers["content-type"] = "application/json";
  if (token) headers.authorization = headers["x-agentctl-authorization"] = `Bearer ${token}`;
  const res = await fetch(via(config.github.apiUrl, path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) throw Object.assign(new Error(`GitHub: not found (${path})`), { status: 404 });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/** Step 1 of the device flow: show user_code and send the user to verification_uri. */
export async function startDeviceFlow(): Promise<DeviceCode> {
  const res = await fetch(via(config.github.webUrl, "/login/device/code"), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: config.github.clientId }),
  });
  if (!res.ok) throw new Error(`GitHub device flow: ${res.status}`);
  const d = (await res.json()) as DeviceCode & { error?: string; error_description?: string };
  if (d.error) throw new Error(`GitHub device flow: ${d.error_description ?? d.error} (is device flow enabled on the GitHub App?)`);
  return d;
}

/** Step 2: poll until the user approves (or the code expires / is denied). Stores the token. */
export async function pollDeviceFlow(code: DeviceCode, signal?: AbortSignal): Promise<string> {
  let interval = Math.max(code.interval, 5) * 1000;
  const deadline = Date.now() + code.expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    if (signal?.aborted) throw new Error("cancelled");
    const res = await fetch(via(config.github.webUrl, "/login/oauth/access_token"), {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: config.github.clientId, device_code: code.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    const d = (await res.json()) as { access_token?: string; error?: string; interval?: number };
    if (d.access_token) {
      try {
        sessionStorage.setItem(TOKEN_KEY, d.access_token);
      } catch {
        /* keep in memory only */
      }
      return d.access_token;
    }
    if (d.error === "slow_down") interval = (d.interval ?? interval / 1000 + 5) * 1000;
    else if (d.error && d.error !== "authorization_pending") throw new Error(`GitHub sign-in: ${d.error}`);
  }
  throw new Error("GitHub sign-in expired");
}

export async function githubUser(): Promise<string | null> {
  if (!getGithubToken()) return null;
  return (await gh<{ login: string }>("GET", "/user").catch(() => null))?.login ?? null;
}

/** Desired state of an agent in the repo's default branch (null if the agent isn't in the repo). */
export async function readRepoAgentState(agent: string): Promise<{ manifestSha256: string; baseManifestSha256?: string; path: string } | null> {
  const repo = parseRepo(config.gitops.repo);
  if (!repo) return null;
  const path = `${config.gitops.basePath}/${agent}/change-request.yaml`;
  try {
    const f = await gh<{ content: string; encoding: string }>("GET", `/repos/${repo.owner}/${repo.name}/contents/${path}`);
    const text = new TextDecoder().decode(Uint8Array.from(atob(f.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
    const cr = YAML.parse(text) as { spec?: { manifestSha256?: string; baseManifestSha256?: string } };
    return cr.spec?.manifestSha256 ? { manifestSha256: cr.spec.manifestSha256, baseManifestSha256: cr.spec.baseManifestSha256, path: `${config.gitops.basePath}/${agent}` } : null;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

export interface PullRequestInput {
  folder: string; // agents/<name>
  files: Record<string, string>;
  title: string;
  body: string;
  branch: string; // agentctl/<cr-id>
  draft: boolean;
  labels: string[];
}

/** Commits the bundle (replacing the agent folder) on a new branch and opens a PR. */
export async function openPullRequest(input: PullRequestInput): Promise<{ number: number; url: string }> {
  const repo = parseRepo(config.gitops.repo);
  if (!repo) throw new Error("AGENTCTL_GITOPS_REPO is not set");
  const R = `/repos/${repo.owner}/${repo.name}`;
  if (!/^[A-Za-z0-9._/-]+$/.test(input.folder) || input.folder.includes("..")) throw new Error("invalid bundle folder");
  const meta = await gh<{ default_branch: string }>("GET", R);
  const head = await gh<{ object: { sha: string } }>("GET", `${R}/git/ref/heads/${encodeURIComponent(meta.default_branch)}`);
  const commit = await gh<{ tree: { sha: string } }>("GET", `${R}/git/commits/${head.object.sha}`);
  // Files currently in the agent folder that the bundle no longer contains are deleted.
  const tree = await gh<{ tree: { path: string; type: string }[] }>("GET", `${R}/git/trees/${commit.tree.sha}?recursive=1`);
  const prefix = `${input.folder}/`;
  const stale = tree.tree.filter((t) => t.type === "blob" && t.path.startsWith(prefix) && !(t.path.slice(prefix.length) in input.files));
  const entries = [
    ...Object.entries(input.files).map(([p, content]) => ({ path: `${prefix}${p}`, mode: "100644", type: "blob", content })),
    ...stale.map((t) => ({ path: t.path, mode: "100644", type: "blob", sha: null })),
  ];
  const newTree = await gh<{ sha: string }>("POST", `${R}/git/trees`, { base_tree: commit.tree.sha, tree: entries });
  const newCommit = await gh<{ sha: string }>("POST", `${R}/git/commits`, { message: input.title, tree: newTree.sha, parents: [head.object.sha] });
  await gh("POST", `${R}/git/refs`, { ref: `refs/heads/${input.branch}`, sha: newCommit.sha });
  const pr = await gh<{ number: number; html_url: string }>("POST", `${R}/pulls`, { title: input.title, head: input.branch, base: meta.default_branch, body: input.body, draft: input.draft });
  if (input.labels.length) await gh("POST", `${R}/issues/${pr.number}/labels`, { labels: input.labels }).catch(() => undefined);
  return { number: pr.number, url: pr.html_url };
}
