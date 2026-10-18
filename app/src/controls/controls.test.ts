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
