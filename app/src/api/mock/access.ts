import type { AccessConfig } from "../../auth/scope";

/** Mock tenant scopes so scoping can be explored without Azure. */
export const MOCK_ACCESS: AccessConfig = {
  unscopedDefault: "all",
  scopes: [
    { name: "people-systems", groups: ["mock-grp-people"], projects: ["aif-contoso-prod/enterprise-agents"], agents: ["hr-*"] },
    { name: "security-ops", groups: ["mock-grp-secops"], projects: ["aif-contoso-prod/security-ops"] },
    { name: "platform-sandbox", groups: ["mock-grp-platform"], projects: ["aif-contoso-dev/sandbox"] },
  ],
};

