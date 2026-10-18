import type { Attestation } from "../config";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Sample sign-offs for mock mode: some current, one expired, many missing. */
export const MOCK_ATTESTATIONS: Record<string, Attestation> = {
  "GV-05": { status: "attested", evidence: "https://lms.contoso.example/reports/ai-literacy-2026", owner: "platform-security", date: daysAgo(60), expires: inDays(305) },
  "GV-06": { status: "attested", evidence: "https://grc.contoso.example/vendors/azure-openai", owner: "procurement", date: daysAgo(200), expires: inDays(165) },
  "IR-02": { status: "attested", evidence: "https://wiki.contoso.example/soc/ai-incident-runbook", owner: "soc", date: daysAgo(400), expires: daysAgo(35) },
  "MO-05": { status: "attested", evidence: "Sentinel automation rule 'AI alerts → SOC'", owner: "soc", date: daysAgo(30), expires: inDays(335) },
  "TL-07@finance-invoice-triage": { status: "attested", evidence: "ERP API enforces per-user posting limits (ADR-112)", owner: "priya.nair@contoso.example", date: daysAgo(90), expires: inDays(275) },
  "DP-04@hr-benefits-assistant": { status: "risk_accepted", evidence: "Debug capture during pilot; 30-day retention", owner: "maria.garcia@contoso.example", date: daysAgo(10), expires: inDays(20) },
};

export const MOCK_APPROVED_MCP_HOSTS = ["mcp-d365.agentctl.internal.example"];
