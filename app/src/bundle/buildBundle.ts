import JSZip from "jszip";
import { createTwoFilesPatch } from "diff";
import YAML from "yaml";
import { config } from "../config";
import { composeInstructions } from "../lib/manifestDefaults";
import { API_VERSION, type AgentManifest, type ChangeRequest } from "../schema/manifest";
import { agentSchema, changeRequestSchema, validateAgent, validateChangeRequest, type ValidationIssue } from "../schema/validate";
import { foundryAgentPayload } from "./foundryPayload";
import { assessRisk, computeChanges, requiredApprovals } from "./risk";
import { terraformMainTf } from "./terraform";

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const toYaml = (o: unknown) => YAML.stringify(o, { lineWidth: 0, aliasDuplicateObjects: false });

/** Removes undefined values so YAML, JSON and hashes are stable. */
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export function manifestDiff(before: AgentManifest | null, after: AgentManifest): string {
  return createTwoFilesPatch(
    before ? "a/manifest/agent.yaml" : "/dev/null",
    "b/manifest/agent.yaml",
    before ? toYaml(clean(before)) : "",
    toYaml(clean(after)),
    undefined,
    undefined,
    { context: 4 },
  );
}

function crId(now: Date) {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `cr-${d}-${r}`;
}

export interface BundleInput {
  before: AgentManifest | null;
  after: AgentManifest;
  title: string;
  rationale: string;
  requestedBy: string;
  foundryAgentId?: string;
}

export interface BundleResult {
  changeRequest: ChangeRequest;
  files: Record<string, string>;
  agentIssues: ValidationIssue[];
  crIssues: ValidationIssue[];
  folder: string;
}

export async function buildBundle(input: BundleInput): Promise<BundleResult> {
  const now = new Date();
  const after = clean(input.after);
  const before = input.before ? clean(input.before) : null;
  const manifestYaml = toYaml(after);
  const manifestSha = await sha256(manifestYaml);
  const baseSha = before ? await sha256(toYaml(before)) : undefined;

  const changes = computeChanges(before, after);
  const risk = assessRisk(changes, after);
  const approvals = requiredApprovals(changes, risk);

  const changeRequest: ChangeRequest = {
    apiVersion: API_VERSION,
    kind: "ChangeRequest",
    metadata: {
      id: crId(now),
      title: input.title,
      createdAt: now.toISOString(),
      requestedBy: input.requestedBy,
      source: "agentctl-ui",
    },
    spec: {
      target: {
        agent: after.metadata.name,
        project: after.spec.foundry.project,
        account: after.spec.foundry.account,
        ...(input.foundryAgentId ? { foundryAgentId: input.foundryAgentId } : {}),
      },
      changeType: before ? "update" : "create",
      rationale: input.rationale,
      changes: changes.length ? changes : [{ op: "update_other", path: "/", summary: "No effective changes", riskTier: "read" }],
      risk,
      approvals,
      ...(baseSha ? { baseManifestSha256: baseSha } : {}),
      manifestSha256: manifestSha,
    },
  };

  const folder = `${config.gitops.basePath}/${after.metadata.name}`;
  const files: Record<string, string> = {
    "manifest/agent.yaml": manifestYaml,
    "change-request.yaml": toYaml(changeRequest),
    "diff/agent.yaml.diff": manifestDiff(before, after),
    "instructions/system.md": after.spec.instructions.system + "\n",
    "instructions/effective.md": composeInstructions(after) + "\n",
    "foundry/agent-definition.json": JSON.stringify(foundryAgentPayload(after, manifestSha), null, 2) + "\n",
    "terraform/main.tf": terraformMainTf(after),
    "approvals/CODEOWNERS": codeowners(folder, approvals),
    "schema/agent.schema.json": JSON.stringify(agentSchema, null, 2) + "\n",
    "schema/change-request.schema.json": JSON.stringify(changeRequestSchema, null, 2) + "\n",
    "README.md": readme(changeRequest, after, folder),
  };
  // The deployed state, so reviewers (and the pipeline) can recompute risk independently.
  if (before) files["manifest/base.yaml"] = toYaml(before);
  const sums = await Promise.all(Object.entries(files).map(async ([p, c]) => `${await sha256(c)}  ${p}`));
  files["checksums.sha256"] = sums.sort((a, b) => a.slice(66).localeCompare(b.slice(66))).join("\n") + "\n";

  return {
    changeRequest,
    files,
    agentIssues: validateAgent(after),
    crIssues: validateChangeRequest(changeRequest),
    folder,
  };
}

export async function zipBundle(result: BundleResult): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder(`${result.changeRequest.metadata.id}-${result.changeRequest.spec.target.agent}`)!;
  for (const [path, content] of Object.entries(result.files)) root.file(path, content);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function codeowners(folder: string, approvals: ChangeRequest["spec"]["approvals"]) {
  return `# Generated by agentctl. Merge into the GitOps repo's .github/CODEOWNERS.\n/${folder}/ ${approvals.required
    .map((r) => (r.group.startsWith("@") ? r.group : `@${r.group}`))
    .join(" ")}\n`;
}

function readme(cr: ChangeRequest, m: AgentManifest, folder: string) {
  const r = cr.spec.risk;
  return `# ${cr.metadata.title}

| | |
|---|---|
| Change request | \`${cr.metadata.id}\` (${cr.spec.changeType}) |
| Agent | \`${m.metadata.name}\` — ${m.metadata.displayName} |
| Target | \`${m.spec.foundry.account}/${m.spec.foundry.project}\` (${m.metadata.environment}) |
| Requested by | ${cr.metadata.requestedBy} at ${cr.metadata.createdAt} |
| Risk | **${r.tier}** (score ${r.score}/100) |
| Approvers | ${cr.spec.approvals.required.map((a) => a.group).join(", ")} (min ${cr.spec.approvals.minApprovers}) |
| GitOps path | \`${folder}/\`${config.gitops.repo ? ` in ${config.gitops.repo}` : ""} |

## Rationale

${cr.spec.rationale}

## Changes

${cr.spec.changes.map((c) => `- **${c.riskTier}** \`${c.op}\` — ${c.summary}`).join("\n")}

## Contents

| Path | Purpose |
|---|---|
| \`manifest/agent.yaml\` | Desired state of the agent (validates against \`schema/agent.schema.json\`) |
| \`manifest/base.yaml\` | Deployed state the change was built from (updates only) |
| \`change-request.yaml\` | Risk, approvals and change list (validates against \`schema/change-request.schema.json\`) |
| \`diff/agent.yaml.diff\` | Unified diff from the currently deployed state |
| \`instructions/effective.md\` | Exact prompt deployed: harness injections composed around the owner's instructions |
| \`foundry/agent-definition.json\` | Foundry Agent Service payload (\`POST {project}/assistants?api-version=v1\`) |
| \`terraform/main.tf\` | Module call for identity, RBAC and RAI policy |
| \`approvals/CODEOWNERS\` | Reviewer routing for the pipeline |
| \`checksums.sha256\` | Integrity of every file above |

## Pipeline steps (suggested)

1. Verify checksums; validate both YAML files against the schemas (e.g. \`ajv validate --spec=draft2020\`).
2. Check \`spec.baseManifestSha256\` still matches the deployed state (detects drift / concurrent changes).
3. Enforce approvals from \`spec.approvals\` (CODEOWNERS / environment protection rules).
4. \`terraform plan\` → approval → \`apply\` (identity, RBAC, RAI policy).
5. Resolve \`\${...}\` placeholders and apply \`foundry/agent-definition.json\` to the project endpoint.
6. Record \`agentctl.manifest_sha256\` in agent metadata (already in the payload) for drift detection in agentctl.
`;
}
