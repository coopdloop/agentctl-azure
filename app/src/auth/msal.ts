import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from "@azure/msal-browser";
import { config, liveCapable } from "../config";

/** One token per audience. Each entry maps to a required_resource_access block in Terraform. */
export const SCOPES = {
  arm: ["https://management.azure.com/user_impersonation"],
  graph: [
    "User.Read",
    "Application.Read.All",
    "Directory.Read.All",
    "DelegatedPermissionGrant.Read.All",
  ],
  // Entra Agent ID (preview). Requested separately so a tenant without it still works.
  graphAgentId: ["AgentIdentity.Read.All"],
  logAnalytics: ["https://api.loganalytics.io/Data.Read"],
  foundry: [config.azure.foundryScope],
} as const;

export type ScopeKey = keyof typeof SCOPES;

const msalConfig: Configuration = {
  auth: {
    clientId: config.auth.clientId,
    authority: `https://login.microsoftonline.com/${config.auth.tenantId || "organizations"}`,
    redirectUri: config.auth.redirectUri || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: { cacheLocation: "sessionStorage" },
};

export const msalInstance: PublicClientApplication | null = liveCapable ? new PublicClientApplication(msalConfig) : null;

export async function initMsal(): Promise<void> {
  if (!msalInstance) return;
  await msalInstance.initialize();
  const result = await msalInstance.handleRedirectPromise();
  if (result?.account) msalInstance.setActiveAccount(result.account);
  else if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
  }
}

export function activeAccount(): AccountInfo | null {
  return msalInstance?.getActiveAccount() ?? null;
}

export async function login() {
  if (!msalInstance) return;
  await msalInstance.loginRedirect({ scopes: [...SCOPES.arm] });
}

export async function logout() {
  await msalInstance?.logoutRedirect();
}

export class AuthRequiredError extends Error {
  constructor(public scopeKey: ScopeKey) {
    super(`Consent or sign-in required for ${scopeKey}`);
    this.name = "AuthRequiredError";
  }
}

/** Silent token for one audience; throws AuthRequiredError when the user must interact. */
export async function getToken(key: ScopeKey): Promise<string> {
  const account = activeAccount();
  if (!msalInstance || !account) throw new AuthRequiredError(key);
  try {
    const r = await msalInstance.acquireTokenSilent({ scopes: [...SCOPES[key]], account });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) throw new AuthRequiredError(key);
    throw e;
  }
}

/** Interactive consent for an audience (popup keeps app state). */
export async function consent(key: ScopeKey) {
  if (!msalInstance) return;
  const r = await msalInstance.acquireTokenPopup({ scopes: [...SCOPES[key]], account: activeAccount() ?? undefined });
  if (r.account) msalInstance.setActiveAccount(r.account);
}
