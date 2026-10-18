import { describe, expect, it } from "vitest";
import { MockDataSource } from "../api/mock";
import { SUB } from "../api/mock/seed";
import { decodeGovernance, encodeGovernance } from "../lib/governance";
import { CONTROLS } from "./catalog";
import { evaluateControls, rollup } from "./evaluate";
import { FRAMEWORKS, frameworkItems } from "./frameworks";
import { MOCK_APPROVED_MCP_HOSTS, MOCK_ATTESTATIONS } from "./mockAttestations";

async function run() {
  const ds = new MockDataSource();
  const [agents, deployments, rai, accounts, defender, identities, roles, grants, safety, stats, policy] = await Promise.all([
    ds.listAgents(), ds.listDeployments(), ds.raiPolicies(), ds.accountPosture(), ds.defenderPosture(), ds.agentIdentities(),
    ds.roleAssignments(), ds.permissionGrants(), ds.contentSafety("30d"), ds.agentStats("30d"), ds.policyStates(),
  ]);
  return evaluateControls({ agents, deployments, rai, accounts, defender, identities, roles, grants, safety, stats, policy, attestations: MOCK_ATTESTATIONS, approvedMcpHosts: MOCK_APPROVED_MCP_HOSTS, subscriptionId: SUB });
}
const find = (rs: Awaited<ReturnType<typeof run>>, control: string, name: string) => rs.find((r) => r.control === control && r.target.name === name)!;

describe("controls catalog", () => {
  it("has 50 unique controls, each mapped to at least two frameworks", () => {
    expect(CONTROLS).toHaveLength(50);
    expect(new Set(CONTROLS.map((c) => c.id)).size).toBe(50);
    for (const c of CONTROLS) expect(Object.values(c.mappings).filter((x) => x?.length).length).toBeGreaterThanOrEqual(2);
  });

  it("covers every OWASP LLM and Agentic Top 10 item", () => {
    for (const key of ["llm", "asi"] as const) for (const i of frameworkItems(key)) expect(i.controls.length, `${key} ${i.item}`).toBeGreaterThan(0);
    expect(FRAMEWORKS.map((f) => f.key).sort()).toEqual(["aia", "asi", "atlas", "iso", "llm", "mcsb", "rmf"]);
  });
});

describe("evaluation against the mock tenant", () => {
  it("produces a result for every control", async () => {
    const rs = await run();
    for (const c of CONTROLS) expect(rs.some((r) => r.control === c.id), c.id).toBe(true);
  });

  it("checks account posture", async () => {
    const rs = await run();
    expect(find(rs, "ID-02", "aif-contoso-prod").status).toBe("pass");
    expect(find(rs, "ID-02", "aif-contoso-dev").status).toBe("fail");
    expect(find(rs, "NW-01", "aif-contoso-dev").status).toBe("fail");
  });

  it("checks agent tools and approvals", async () => {
    const rs = await run();
    expect(find(rs, "TL-03", "it-helpdesk-agent").status).toBe("fail"); // MCP require_approval=never
    expect(find(rs, "TL-02", "crm-writer").status).toBe("pass"); // approved host + allowed_tools
    expect(find(rs, "TL-02", "it-helpdesk-agent").status).toBe("fail");
    expect(find(rs, "TL-01", "browser-ops-bot").status).toBe("fail");
  });

  it("uses governance evidence freshness", async () => {
    const rs = await run();
    expect(find(rs, "GV-04", "hr-benefits-assistant").status).toBe("pass");
    expect(find(rs, "GV-04", "it-helpdesk-agent").status).toBe("fail"); // 400 days old
    expect(find(rs, "TE-03", "hr-benefits-assistant").status).toBe("fail"); // 150 days > 90 for high tier
    expect(find(rs, "GV-04", "sales-research-agent").status).toBe("attest");
  });

  it("applies attestations but never over an automated failure", async () => {
    const rs = await run();
    expect(find(rs, "GV-05", "Environment").status).toBe("pass");
    expect(find(rs, "IR-02", "Environment").attestation?.expired).toBe(true);
    expect(find(rs, "DP-04", "hr-benefits-assistant").status).toBe("warn"); // risk accepted
    expect(find(rs, "TL-07", "finance-invoice-triage").status).toBe("pass");
  });

  it("rolls up a score", async () => {
    const r = rollup(await run());
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
  });
});

describe("governance metadata", () => {
  it("round-trips and stays within the 512-char metadata limit", () => {
    const g = { riskTier: "high" as const, intakeId: "INT-1", impactAssessment: { id: "IA-1", date: "2026-09-01" }, userFacing: true, disclosure: "https://x.example/notice" };
    const s = encodeGovernance(g);
    expect(s.length).toBeLessThanOrEqual(512);
    expect(decodeGovernance(s)).toEqual(g);
  });
  it("rejects malformed metadata", () => {
    expect(decodeGovernance("not json")).toBeUndefined();
    expect(decodeGovernance('{"t":"h","ia":"x|not-a-date","dl":"javascript:alert(1)"}')).toEqual({ riskTier: "high" });
  });
});

describe("governance in bundles", () => {
  it("is written to agent metadata and survives verification; lowering the tier is flagged", async () => {
    const { buildBundle } = await import("../bundle/buildBundle");
    const { verifyBundle } = await import("../bundle/verify");
    const { agentToManifest } = await import("../lib/manifestDefaults");
    const { AGENTS, DEPLOYMENTS } = await import("../api/mock/seed");
    const before = agentToManifest(AGENTS[0], DEPLOYMENTS, SUB);
    expect(before.spec.governance?.riskTier).toBe("high");
    const after = structuredClone(before);
    after.spec.governance!.riskTier = "medium";
    const b = await buildBundle({ before, after, title: "Re-tier HR agent", rationale: "Scope reduced to policy lookups only.", requestedBy: "x@contoso.example" });
    const payload = JSON.parse(b.files["foundry/agent-definition.json"]);
    expect(decodeGovernance(payload.metadata["agentctl.governance"])?.riskTier).toBe("medium");
    const change = b.changeRequest.spec.changes.find((c) => c.path === "/spec/governance")!;
    expect(change.riskTier).toBe("write");
    expect((await verifyBundle(b.files)).ok).toBe(true);
  });
});

describe("automated evidence for former sign-off controls", () => {
  it("evaluates storage, connections, retention, Conditional Access, eval and red-team runs", async () => {
    const rs = await run2();
    expect(find(rs, "DP-02", "aif-contoso-prod").status).toBe("pass"); // standard setup
    expect(find(rs, "DP-02", "aif-contoso-dev").status).toBe("fail"); // basic setup (sandbox)
    expect(find(rs, "ID-05", "dev-docs-copilot").status).toBe("fail"); // CustomKeys connection in sandbox
    expect(find(rs, "ID-05", "hr-benefits-assistant").status).toBe("warn"); // App Insights ApiKey only
    expect(find(rs, "MO-06", "Environment").status).toBe("attest"); // 365 days; immutability still attested
    expect(find(rs, "ID-04", "Environment").status).toBe("pass"); // agent-targeted CA policy
    expect(find(rs, "TE-02", "hr-benefits-assistant").status).toBe("warn"); // run with 2 failures
    expect(find(rs, "TE-03", "secops-triage-agent").evidence).toMatch(/Foundry red-team run/);
    expect(find(rs, "SC-02", "it-helpdesk-agent").status).toBe("fail"); // edited outside GitOps
    expect(find(rs, "SC-02", "it-helpdesk-agent").evidence).toMatch(/Changed outside GitOps/);
  });
});

describe("drift classification", async () => {
  const { classifyDrift } = await import("./drift");
  const sha = (s: string) => s.padEnd(64, "0");
  const h = (v: string, s?: string) => ({ version: v, createdAt: "2026-10-01T00:00:00Z", manifestSha256: s ? sha(s) : undefined });
  it("classifies live vs GitOps vs repo", () => {
    expect(classifyDrift([h("1")]).state).toBe("unmanaged");
    expect(classifyDrift([h("3"), h("2", "aa")]).state).toBe("drifted");
    expect(classifyDrift([h("2", "aa")]).state).toBe("managed");
    expect(classifyDrift([h("2", "aa")], { manifestSha256: sha("aa"), path: "agents/x" }).state).toBe("in_sync");
    expect(classifyDrift([h("2", "aa")], { manifestSha256: sha("bb"), baseManifestSha256: sha("aa"), path: "agents/x" }).state).toBe("pending");
    expect(classifyDrift([h("2", "aa")], { manifestSha256: sha("bb"), baseManifestSha256: sha("cc"), path: "agents/x" }).state).toBe("diverged");
  });
});

async function run2() {
  const ds = new MockDataSource();
  const agents = await ds.listAgents();
  const [deployments, rai, accounts, defender, identities, roles, grants, safety, stats, policy, projects, workspaces, ca, evals] = await Promise.all([
    ds.listDeployments(), ds.raiPolicies(), ds.accountPosture(), ds.defenderPosture(), ds.agentIdentities(), ds.roleAssignments(), ds.permissionGrants(),
    ds.contentSafety("30d"), ds.agentStats("30d"), ds.policyStates(), ds.projectPosture(), ds.workspacePosture(), ds.conditionalAccess(), ds.evaluationEvidence(),
  ]);
  const versions = Object.fromEntries(await Promise.all(agents.map(async (a) => [`${a.project}/${a.id}`, await ds.agentVersions(a.project, a.name)] as const)));
  return evaluateControls({ agents, deployments, rai, accounts, defender, identities, roles, grants, safety, stats, policy, projects, workspaces, ca, evals, versions, attestations: MOCK_ATTESTATIONS, approvedMcpHosts: MOCK_APPROVED_MCP_HOSTS, subscriptionId: SUB });
}

describe("secret detection in instructions", async () => {
  const { evaluateControls } = await import("./evaluate");
  const base = (await new MockDataSource().listAgents())[0];
  const check = (instructions: string) =>
    evaluateControls({ agents: [{ ...base, instructions }], deployments: [], rai: [], attestations: {}, approvedMcpHosts: [], subscriptionId: SUB }).find((r) => r.control === "ID-05")!.status;
  it("flags credential values but not safety wording", () => {
    expect(check("Never reveal secrets or passwords to the user.")).not.toBe("fail");
    expect(check("Use api_key=AbCdEf123456789 when calling the API.")).toBe("fail");
    expect(check("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x")).toBe("fail");
  });
});
