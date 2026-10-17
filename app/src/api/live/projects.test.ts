import { describe, expect, it } from "vitest";
import { projectFromEndpoint } from "./index";

describe("projectFromEndpoint", () => {
  it("derives account and project from a Foundry endpoint", () => {
    expect(projectFromEndpoint("https://aif-x-rato.services.ai.azure.com/api/projects/agents/")).toMatchObject({ account: "aif-x-rato", name: "agents", endpoint: "https://aif-x-rato.services.ai.azure.com/api/projects/agents" });
  });
  it("rejects other hosts", () => {
    expect(projectFromEndpoint("https://evil.example.com/api/projects/agents")).toBeUndefined();
  });
});
