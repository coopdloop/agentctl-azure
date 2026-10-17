import { describe, expect, it } from "vitest";
import { MockDataSource } from "../api/mock";
import { scopeDataSource } from "../api/scoped";
import { buildBundle } from "../bundle/buildBundle";
import { verifyBundle } from "../bundle/verify";
import { agentToManifest } from "../lib/manifestDefaults";
import { AGENTS, DEPLOYMENTS, SUB } from "../api/mock/seed";
import { MOCK_ACCESS } from "../api/mock/access";
import { agentAllowed, parseAccessConfig, resolveScope } from "./scope";

describe("resolveScope", () => {
  it("admins are unscoped", () => {
    expect(resolveScope(MOCK_ACCESS, [], true).all).toBe(true);
  });

  it("users in no scope group follow unscopedDefault", () => {
    expect(resolveScope({ ...MOCK_ACCESS, unscopedDefault: "all" }, ["other"], false).all).toBe(true);
    const none = resolveScope({ ...MOCK_ACCESS, unscopedDefault: "none" }, ["other"], false);
    expect(none.all).toBe(false);
    expect(agentAllowed(none, { account: "aif-contoso-prod", project: "enterprise-agents", name: "hr-benefits-assistant" })).toBe(false);
  });

  it("project + agent glob scoping", () => {
    const s = resolveScope(MOCK_ACCESS, ["MOCK-GRP-PEOPLE"], false); // group ids are case-insensitive
    expect(agentAllowed(s, { account: "aif-contoso-prod", project: "enterprise-agents", name: "hr-benefits-assistant" })).toBe(true);
    expect(agentAllowed(s, { account: "aif-contoso-prod", project: "enterprise-agents", name: "it-helpdesk-agent" })).toBe(false);
    expect(agentAllowed(s, { account: "aif-contoso-prod", project: "security-ops", name: "secops-triage-agent" })).toBe(false);
  });

  it("multiple scopes union; a project scope without agent globs lifts agent filtering", () => {
    const s = resolveScope(MOCK_ACCESS, ["mock-grp-people", "mock-grp-secops"], false);
    expect(agentAllowed(s, { account: "aif-contoso-prod", project: "security-ops", name: "secops-triage-agent" })).toBe(true);
  });

  it("parses untrusted runtime config defensively", () => {
    expect(parseAccessConfig("nope")).toEqual({ scopes: [], unscopedDefault: "all" });
    expect(parseAccessConfig({ scopes: [{ name: "x" }, { name: "y", groups: ["g"], projects: ["a/b"] }] }).scopes).toHaveLength(1);
  });
});

describe("scoped data source", () => {
  const scope = resolveScope(MOCK_ACCESS, ["mock-grp-secops"], false);
  const ds = scopeDataSource(new MockDataSource(), scope);

  it("filters inventory, activity and identity to the scope", async () => {
    const agents = await ds.listAgents();
    expect(agents.map((a) => a.name)).toEqual(["secops-triage-agent"]);
    expect((await ds.listProjects()).map((p) => p.name)).toEqual(["security-ops"]);
    expect((await ds.agentStats("7d")).every((s) => s.agentName === "secops-triage-agent")).toBe(true);
    expect((await ds.listRuns("7d")).every((r) => r.agentName === "secops-triage-agent")).toBe(true);
    expect(await ds.listRuns("7d", "hr-benefits-assistant")).toEqual([]);
    expect((await ds.permissionGrants()).every((g) => g.clientName === "secops-triage-agent")).toBe(true);
    expect(await ds.getAgent("enterprise-agents", "asst_hrBen7Qx2LmN4")).toBeUndefined();
  });

  it("rebuilds overview numbers from scoped data", async () => {
    const o = await ds.overview("7d");
    const runs = (await ds.agentStats("7d")).reduce((s, x) => s + x.runs, 0);
    expect(o.agents).toBe(1);
    expect(o.runs).toBe(runs);
  });
});

describe("proposals", () => {
  it("adds owners as approvers and verifies", async () => {
    const before = agentToManifest(AGENTS[0], DEPLOYMENTS, SUB);
    const after = structuredClone(before);
    after.spec.instructions.system += "\nAlways answer in English.";
    after.spec.instructions.version = "2.3.1";
    const b = await buildBundle({ before, after, title: "Tweak language", rationale: "Users asked for consistent language.", requestedBy: "req@contoso.example", proposal: true });
    expect(b.changeRequest.spec.proposal).toBe(true);
    expect(b.changeRequest.metadata.title.startsWith("[Proposal]")).toBe(true);
    expect(b.changeRequest.spec.approvals.required[0].group).toBe(after.metadata.owners[0]);
    expect(b.crIssues).toEqual([]);
    expect((await verifyBundle(b.files)).ok).toBe(true);
  });
});

describe("agent globs", () => {
  const scoped = (agents: string[]) => resolveScope({ unscopedDefault: "none", scopes: [{ name: "t", groups: ["g"], projects: ["a/p"], agents }] }, ["g"], false);
  it("escapes regex metacharacters", () => {
    expect(agentAllowed(scoped(["hr.(x)*"]), { account: "a", project: "p", name: "hr.(x)-bot" })).toBe(true);
    expect(agentAllowed(scoped(["hr.(x)*"]), { account: "a", project: "p", name: "hrX(x)-bot" })).toBe(false);
  });
  it("fails closed on pathological globs", () => {
    expect(agentAllowed(scoped(["*a*a*a*a*a*"]), { account: "a", project: "p", name: "aaaaa" })).toBe(false);
  });
});
