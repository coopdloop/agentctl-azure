import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { AGENTS, DEPLOYMENTS, SUB } from "../api/mock/seed";
import { HARNESS_TOOLS, MANDATORY_INJECTIONS } from "../lib/harnessLibrary";
import { agentToManifest, composeInstructions, emptyManifest, extractInjections, inferToolRisk } from "../lib/manifestDefaults";
import type { AgentManifest } from "../schema/manifest";
import { validateAgent, validateChangeRequest } from "../schema/validate";
import { buildBundle, sha256 } from "./buildBundle";
import { assessRisk, computeChanges, guardrailWeakenings } from "./risk";
import { verifyBundle } from "./verify";
// @ts-expect-error plain ESM module shared with the server
import { isAllowedHost } from "../../server/proxy.mjs";

function sampleManifest(): AgentManifest {
  const m = emptyManifest();
  m.metadata = {
    ...m.metadata,
    name: "claims-intake-agent",
    displayName: "Claims intake agent",
    description: "Collects first notice of loss details from policyholders.",
    owners: ["jane.doe@contoso.example"],
    team: "Claims",
    environment: "prod",
    dataClassification: "confidential",
  };
  m.spec.foundry = { subscriptionId: SUB, resourceGroup: "rg-ai-prod", account: "aif-contoso-prod", project: "enterprise-agents" };
  m.spec.model = { deployment: "gpt-4.1", modelName: "gpt-4.1", temperature: 0.2, topP: 1, responseFormat: "auto" };
  m.spec.instructions.system = "You help policyholders file a claim. Ask for policy number, date and description of loss.";
  return m;
}

const ROOT_OF = (files: Record<string, string>) => files;

describe("schema", () => {
  it("accepts a complete sample manifest", () => {
    expect(validateAgent(sampleManifest())).toEqual([]);
  });

  it("rejects bad slugs and missing owners", () => {
    const m = sampleManifest();
    m.metadata.name = "Bad Name";
    m.metadata.owners = [];
    const paths = validateAgent(m).map((i) => i.path);
    expect(paths).toContain("/metadata/name");
    expect(paths).toContain("/metadata/owners");
  });

  it("forces privileged tools to always require approval", () => {
    const m = sampleManifest();
    m.spec.tools.push({ name: "browser", type: "browser_automation", riskTier: "privileged", requireApproval: "never" });
    expect(validateAgent(m).length).toBeGreaterThan(0);
  });

  it("requires app auth flow when app roles are requested", () => {
    const m = sampleManifest();
    m.spec.identity.appRoles = ["User.Read.All"];
    m.spec.identity.allowedAuthFlows = ["obo"];
    expect(validateAgent(m).length).toBeGreaterThan(0);
    m.spec.identity.allowedAuthFlows = ["obo", "app"];
    expect(validateAgent(m)).toEqual([]);
  });

  it("every harness catalog tool validates inside a manifest", () => {
    const m = sampleManifest();
    m.spec.tools = HARNESS_TOOLS.map((h) => h.tool);
    expect(validateAgent(m)).toEqual([]);
  });

  it("every mock Foundry agent maps to a valid manifest", () => {
    for (const a of AGENTS) {
      const issues = validateAgent(agentToManifest(a, DEPLOYMENTS, SUB));
      expect({ agent: a.name, issues }).toEqual({ agent: a.name, issues: [] });
    }
  });
});

describe("harness composition", () => {
  it("round-trips injections through the composed prompt", () => {
    const m = sampleManifest();
    const composed = composeInstructions(m);
    const { ownerText, injections } = extractInjections(composed);
    expect(ownerText).toBe(m.spec.instructions.system);
    expect(injections.map((i) => i.id)).toEqual(m.spec.harness.injections.map((i) => i.id));
  });
});

describe("risk", () => {
  it("infers OpenAPI and MCP risk from capabilities", () => {
    expect(inferToolRisk({ name: "a", type: "openapi", riskTier: "read", requireApproval: "never", openapi: { operations: [{ operationId: "x", method: "GET", path: "/" }], auth: { type: "anonymous" } } })).toBe("read");
    expect(inferToolRisk({ name: "a", type: "openapi", riskTier: "read", requireApproval: "never", openapi: { operations: [{ operationId: "x", method: "DELETE", path: "/" }], auth: { type: "anonymous" } } })).toBe("privileged");
    expect(inferToolRisk({ name: "m", type: "mcp", riskTier: "read", requireApproval: "always", mcp: { serverLabel: "m", serverUrl: "https://x", allowedTools: [] } })).toBe("privileged");
    expect(inferToolRisk({ name: "m", type: "mcp", riskTier: "read", requireApproval: "always", mcp: { serverLabel: "m", serverUrl: "https://x", allowedTools: ["get_item"] } })).toBe("read");
  });

  it("removing a mandatory injection is privileged", () => {
    const before = sampleManifest();
    const after = structuredClone(before);
    after.spec.harness.injections = after.spec.harness.injections.filter((i) => i.id !== MANDATORY_INJECTIONS[0].id);
    const changes = computeChanges(before, after);
    expect(changes.find((c) => c.op === "remove_injection")?.riskTier).toBe("privileged");
  });

  it("detects guardrail weakening", () => {
    const before = sampleManifest();
    const after = structuredClone(before);
    after.spec.guardrails.raiPolicy.promptShields.jailbreak = false;
    after.spec.guardrails.raiPolicy.filters.hate.severityThreshold = "High";
    expect(guardrailWeakenings(before.spec.guardrails, after.spec.guardrails)).toHaveLength(2);
    expect(assessRisk(computeChanges(before, after), after).tier).toBe("privileged");
  });

  it("injecting a read-only harness tool into prod is low risk but still needs owners", () => {
    const before = sampleManifest();
    const after = structuredClone(before);
    after.spec.tools.push(HARNESS_TOOLS.find((t) => t.tool.name === "check_kill_switch")!.tool);
    const risk = assessRisk(computeChanges(before, after), after);
    expect(risk.tier).toBe("read");
    expect(risk.reasons).toContain("targets production");
  });
});

describe("bundle", () => {
  it("builds a valid, verifiable update bundle", async () => {
    const before = sampleManifest();
    const after = structuredClone(before);
    after.spec.tools.push(HARNESS_TOOLS.find((t) => t.tool.name === "servicenow_incidents")!.tool);
    const b = await buildBundle({ before, after, title: "Add ServiceNow", rationale: "Agents need to raise incidents.", requestedBy: "me@contoso.example" });
    expect(b.agentIssues).toEqual([]);
    expect(b.crIssues).toEqual([]);
    expect(Object.keys(b.files)).toEqual(expect.arrayContaining(["manifest/agent.yaml", "manifest/base.yaml", "terraform/main.tf", "foundry/agent-definition.json", "checksums.sha256"]));
    expect(b.changeRequest.spec.manifestSha256).toBe(await sha256(b.files["manifest/agent.yaml"]));
    expect(validateChangeRequest(YAML.parse(b.files["change-request.yaml"]))).toEqual([]);
    expect(b.files["diff/agent.yaml.diff"]).toMatch(/^\+\s+- name: servicenow_incidents$/m);

    const v = await verifyBundle(ROOT_OF(b.files));
    expect(v.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("verification catches a tampered risk tier", async () => {
    const before = sampleManifest();
    const after = structuredClone(before);
    after.spec.identity.appRoles = ["Mail.Send"];
    after.spec.identity.allowedAuthFlows = ["obo", "app"];
    const b = await buildBundle({ before, after, title: "Mail send", rationale: "Needs to send notifications.", requestedBy: "me" });
    expect(b.changeRequest.spec.risk.tier).toBe("privileged");

    const cr = YAML.parse(b.files["change-request.yaml"]);
    cr.spec.risk.tier = "read";
    const files = { ...b.files, "change-request.yaml": YAML.stringify(cr) };
    const v = await verifyBundle(files);
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => c.name === "Checksums")?.status).toBe("fail");
    expect(v.checks.find((c) => c.name === "Declared risk")?.status).toBe("fail");
  });

  it("terraform output references the agent module", async () => {
    const b = await buildBundle({ before: null, after: sampleManifest(), title: "New agent", rationale: "Register claims intake agent.", requestedBy: "me" });
    expect(b.files["terraform/main.tf"]).toMatch(/module "claims_intake_agent"/);
    expect(b.files["terraform/main.tf"]).toContain("rai_policy");
    expect(b.changeRequest.spec.changeType).toBe("create");
  });
});

describe("proxy allowlist", () => {
  it("only forwards Azure AI hosts", () => {
    expect(isAllowedHost("aif-contoso.services.ai.azure.com")).toBe(true);
    expect(isAllowedHost("services.ai.azure.com")).toBe(false);
    expect(isAllowedHost("evil.example.com")).toBe(false);
    expect(isAllowedHost("aif.services.ai.azure.com.evil.com")).toBe(false);
    expect(isAllowedHost("x@evil.com")).toBe(false);
  });
});

describe("rai policy naming", () => {
  it("never targets built-in Microsoft.* policies", () => {
    const m = sampleManifest();
    m.spec.guardrails.raiPolicy.name = "Microsoft.DefaultV2";
    expect(validateAgent(m).some((i) => i.path === "/spec/guardrails/raiPolicy/name")).toBe(true);
    for (const a of AGENTS) expect(agentToManifest(a, DEPLOYMENTS, SUB).spec.guardrails.raiPolicy.name.startsWith("Microsoft.")).toBe(false);
  });
});

describe("kql", () => {
  it("identity usage query tolerates missing app ids (Agent ID list returns appId: null)", async () => {
    const { identityUsageQuery } = await import("../api/live/kql");
    const q = identityUsageQuery("24h", ["abc", undefined as unknown as string, ""]);
    expect(q).toContain('dynamic(["abc"])');
  });
});
