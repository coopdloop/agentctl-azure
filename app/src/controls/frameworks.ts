// Framework registry for the controls crosswalk. Versions are stored with the framework so a
// mapping can be re-checked when a framework moves (ATLAS releases monthly; AI RMF is under revision).

import { CONTROLS, type ControlMappings } from "./catalog";

export type FrameworkKey = keyof ControlMappings;

export interface Framework {
  key: FrameworkKey;
  name: string;
  short: string;
  version: string;
  published: string;
  url: string;
  kind: "threat taxonomy" | "risk framework" | "management system" | "regulation" | "benchmark";
  binding: boolean;
  /** Known item titles; items without a title are shown by id. */
  titles: Record<string, string>;
  /** Groups items for display (e.g. AI RMF function, ISO clause, AI Act chapter). */
  group?: (item: string) => string;
}

export const FRAMEWORKS: Framework[] = [
  {
    key: "llm", short: "OWASP LLM", name: "OWASP Top 10 for LLM Applications", version: "2025", published: "2024-11-18",
    url: "https://genai.owasp.org/llm-top-10/", kind: "threat taxonomy", binding: false,
    titles: {
      LLM01: "Prompt Injection", LLM02: "Sensitive Information Disclosure", LLM03: "Supply Chain", LLM04: "Data and Model Poisoning",
      LLM05: "Improper Output Handling", LLM06: "Excessive Agency", LLM07: "System Prompt Leakage", LLM08: "Vector and Embedding Weaknesses",
      LLM09: "Misinformation", LLM10: "Unbounded Consumption",
    },
  },
  {
    key: "asi", short: "OWASP Agentic", name: "OWASP Top 10 for Agentic Applications", version: "2026", published: "2025-12-09",
    url: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/", kind: "threat taxonomy", binding: false,
    titles: {
      ASI01: "Agent Goal Hijack", ASI02: "Tool Misuse and Exploitation", ASI03: "Identity and Privilege Abuse", ASI04: "Agentic Supply Chain Vulnerabilities",
      ASI05: "Unexpected Code Execution (RCE)", ASI06: "Memory & Context Poisoning", ASI07: "Insecure Inter-Agent Communication", ASI08: "Cascading Failures",
      ASI09: "Human-Agent Trust Exploitation", ASI10: "Rogue Agents",
    },
  },
  {
    key: "rmf", short: "NIST AI RMF", name: "NIST AI RMF 1.0 + AI 600-1 GenAI Profile", version: "1.0 / 600-1", published: "2023-01-26 / 2024-07-26",
    url: "https://www.nist.gov/itl/ai-risk-management-framework", kind: "risk framework", binding: false,
    titles: {},
    group: (i) => {
      const f = i.split(/[ -]/)[0].toUpperCase();
      return ({ GOVERN: "Govern", GV: "Govern", MAP: "Map", MP: "Map", MEASURE: "Measure", MS: "Measure", MANAGE: "Manage", MG: "Manage" } as Record<string, string>)[f] ?? "Other";
    },
  },
  {
    key: "iso", short: "ISO 42001", name: "ISO/IEC 42001:2023 Annex A", version: "2023", published: "2023-12",
    url: "https://www.iso.org/standard/81230.html", kind: "management system", binding: false,
    titles: {},
    group: (i) =>
      ({
        "A.2": "A.2 Policies related to AI", "A.3": "A.3 Internal organization", "A.4": "A.4 Resources for AI systems", "A.5": "A.5 Assessing impacts of AI systems",
        "A.6": "A.6 AI system life cycle", "A.7": "A.7 Data for AI systems", "A.8": "A.8 Information for interested parties", "A.9": "A.9 Use of AI systems",
        "A.10": "A.10 Third-party and customer relationships",
      } as Record<string, string>)[i.split(".").slice(0, 2).join(".")] ?? "Annex A",
  },
  {
    key: "aia", short: "EU AI Act", name: "EU AI Act (Reg. 2024/1689, as amended by 2026/1744)", version: "2026 consolidated", published: "2024-07-12",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj", kind: "regulation", binding: true,
    titles: {
      "Art. 4": "AI literacy", "Art. 5": "Prohibited AI practices", "Art. 6": "Classification of high-risk AI systems", "Art. 9": "Risk management system",
      "Art. 10": "Data and data governance", "Art. 11": "Technical documentation", "Art. 12": "Record-keeping", "Art. 13": "Transparency and information to deployers",
      "Art. 14": "Human oversight", "Art. 15": "Accuracy, robustness and cybersecurity", "Art. 19": "Automatically generated logs",
      "Art. 25": "Responsibilities along the AI value chain", "Art. 26": "Obligations of deployers of high-risk AI systems", "Art. 27": "Fundamental rights impact assessment",
      "Art. 50": "Transparency obligations", "Art. 53": "Obligations for providers of GPAI models", "Art. 73": "Reporting of serious incidents",
    },
  },
  {
    key: "atlas", short: "MITRE ATLAS", name: "MITRE ATLAS", version: "v2026.09", published: "2026-09-15",
    url: "https://atlas.mitre.org/", kind: "threat taxonomy", binding: false,
    titles: {
      "T0051.000": "LLM Prompt Injection: Direct", "T0051.001": "LLM Prompt Injection: Indirect", T0054: "LLM Jailbreak", T0053: "AI Agent Tool Invocation",
      T0056: "Extract LLM System Prompt", T0080: "AI Agent Context Poisoning", "T0080.000": "AI Agent Context Poisoning: Memory", T0086: "Exfiltration via AI Agent Tool Invocation",
      "T0110.000": "AI Agent Tool Poisoning: Definition and Instructions", "T0110.001": "AI Agent Tool Poisoning: Implementation", "T0110.002": "AI Agent Tool Poisoning: Runtime Response",
      T0109: "AI Supply Chain Rug Pull", "T0010.005": "AI Supply Chain Compromise: AI Agent Tool", T0098: "AI Agent Tool Credential Harvesting", T0118: "Autonomous AI Agent Communication",
      "T0034.002": "Agentic Resource Consumption",
    },
    group: (i) => (i.startsWith("M") ? "Mitigations" : "Techniques"),
  },
  {
    key: "mcsb", short: "MCSB AI", name: "Microsoft Cloud Security Benchmark v2: AI security", version: "v2 (preview)", published: "2025",
    url: "https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-v2-artificial-intelligence-security", kind: "benchmark", binding: false,
    titles: {
      "AI-1": "Ensure use of approved models", "AI-2": "Implement multi-layered content filtering", "AI-3": "Adopt safety meta-prompts",
      "AI-4": "Apply least privilege for agent functions", "AI-5": "Ensure human-in-the-loop", "AI-6": "Establish monitoring and detection", "AI-7": "Perform continuous AI red teaming",
    },
  },
];

/** Normalises a mapping value to the framework item it belongs to (e.g. "Art. 15(5)†" → "Art. 15"). */
export function itemKey(fw: FrameworkKey, raw: string): string {
  const v = raw.replace(/†/g, "").trim();
  if (fw === "aia") return v.match(/^Art\. \d+[a-z]?/)?.[0] ?? v;
  return v;
}

/** Items of a framework referenced by the catalog, with the controls mapped to each. */
export function frameworkItems(fw: FrameworkKey): { item: string; controls: string[] }[] {
  const m = new Map<string, Set<string>>();
  for (const c of CONTROLS) for (const raw of c.mappings[fw] ?? []) {
    const k = itemKey(fw, raw);
    // ASI list includes T-ids and MCP ids as refinements; only ASIxx are framework items.
    if (fw === "asi" && !/^ASI\d+/.test(k)) continue;
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(c.id);
  }
  const fwDef = FRAMEWORKS.find((f) => f.key === fw)!;
  // Make sure every titled item appears, even if no control maps to it (a coverage gap).
  for (const k of Object.keys(fwDef.titles)) if (!m.has(k)) m.set(k, new Set());
  return [...m.entries()]
    .map(([item, ids]) => ({ item, controls: [...ids].sort() }))
    .sort((a, b) => a.item.localeCompare(b.item, undefined, { numeric: true }));
}
