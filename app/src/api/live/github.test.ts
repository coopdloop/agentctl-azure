// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

describe("github integration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses repo references", async () => {
    const { parseRepo } = await import("./github");
    expect(parseRepo("contoso/agents-gitops")).toEqual({ owner: "contoso", name: "agents-gitops" });
    expect(parseRepo("https://github.com/contoso/agents-gitops.git")).toEqual({ owner: "contoso", name: "agents-gitops" });
    expect(parseRepo("not a repo")).toBeNull();
  });

  it("commits the bundle on a branch, deletes stale files and opens a draft PR for proposals", async () => {
    (globalThis as Record<string, unknown>).__AGENTCTL_CONFIG__ = { gitops: { repo: "contoso/agents-gitops", basePath: "agents" }, github: { clientId: "Iv1.abcdef123" } };
    vi.resetModules();
    const { openPullRequest } = await import("./github");
    const calls: { method: string; url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/proxy\/api\.github\.com/, "");
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method ?? "GET", url: path, body });
      const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
      if (path === "/repos/contoso/agents-gitops") return json({ default_branch: "main" });
      if (path === "/repos/contoso/agents-gitops/git/ref/heads/main") return json({ object: { sha: "c0" } });
      if (path === "/repos/contoso/agents-gitops/git/commits/c0") return json({ tree: { sha: "t0" } });
      if (path.startsWith("/repos/contoso/agents-gitops/git/trees/t0")) return json({ tree: [{ path: "agents/hr/manifest/agent.yaml", type: "blob" }, { path: "agents/hr/old.txt", type: "blob" }, { path: "agents/other/x", type: "blob" }] });
      if (path === "/repos/contoso/agents-gitops/git/trees") return json({ sha: "t1" });
      if (path === "/repos/contoso/agents-gitops/git/commits") return json({ sha: "c1" });
      if (path === "/repos/contoso/agents-gitops/git/refs") return json({}, 201);
      if (path === "/repos/contoso/agents-gitops/pulls") return json({ number: 7, html_url: "https://github.com/contoso/agents-gitops/pull/7" });
      if (path.endsWith("/labels")) return json([]);
      return json({ message: "unexpected" }, 500);
    });
    sessionStorage.setItem("agentctl.github.token", "ghu_test123");
    const pr = await openPullRequest({ folder: "agents/hr", files: { "manifest/agent.yaml": "a: 1\n", "checksums.sha256": "x\n" }, title: "[Proposal] change", body: "b", branch: "agentctl/cr-1", draft: true, labels: ["agentctl", "proposal"] });
    expect(pr).toEqual({ number: 7, url: "https://github.com/contoso/agents-gitops/pull/7" });
    const tree = calls.find((c) => c.url.endsWith("/git/trees") && c.method === "POST")!.body as { tree: { path: string; sha?: null; content?: string }[] };
    expect(tree.tree.map((t) => t.path).sort()).toEqual(["agents/hr/checksums.sha256", "agents/hr/manifest/agent.yaml", "agents/hr/old.txt"]);
    expect(tree.tree.find((t) => t.path === "agents/hr/old.txt")!.sha).toBeNull(); // stale file deleted
    expect(calls.find((c) => c.url.endsWith("/pulls"))!.body).toMatchObject({ head: "agentctl/cr-1", base: "main", draft: true });
  });

  it("rejects path traversal in the bundle folder", async () => {
    const { openPullRequest } = await import("./github");
    await expect(openPullRequest({ folder: "../x", files: {}, title: "t", body: "", branch: "b", draft: false, labels: [] })).rejects.toThrow(/invalid bundle folder|not set/);
  });
});
