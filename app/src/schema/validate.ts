import type { ErrorObject } from "ajv";
// Precompiled by scripts/gen-validators.mjs (no eval at runtime → strict CSP stays intact).
import { validateAgent as validateAgentFn, validateChangeRequest as validateCrFn } from "./validators.generated.js";
import agentSchema from "./agent.schema.json";
import changeRequestSchema from "./change-request.schema.json";

export interface ValidationIssue {
  path: string;
  message: string;
}

function toIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) return [];
  // if/then failures duplicate the underlying error; drop them to keep the list readable
  return errors
    .filter((e) => e.keyword !== "if")
    .map((e) => ({
      path: e.instancePath || "/",
      message:
        e.keyword === "additionalProperties"
          ? `unexpected property "${(e.params as { additionalProperty: string }).additionalProperty}"`
          : e.keyword === "enum"
            ? `must be one of ${(e.params as { allowedValues: unknown[] }).allowedValues.join(", ")}`
            : (e.message ?? "invalid"),
    }));
}

export function validateAgent(manifest: unknown): ValidationIssue[] {
  validateAgentFn(manifest);
  return toIssues(validateAgentFn.errors);
}

export function validateChangeRequest(cr: unknown): ValidationIssue[] {
  validateCrFn(cr);
  return toIssues(validateCrFn.errors);
}

export { agentSchema, changeRequestSchema };
