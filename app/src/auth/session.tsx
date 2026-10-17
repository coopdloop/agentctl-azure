import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { config, liveCapable } from "../config";
import { activeAccount, login, logout } from "./msal";
import { resolveScope, type AccessConfig, type ResolvedScope } from "./scope";
import { MOCK_ACCESS } from "../api/mock/access";

export { MOCK_ACCESS };

/**
 * App roles (Entra app role values AgentCtl.<Role>, see infra/modules/agentctl/entra.tf):
 *  Reader          observe agents, activity, guardrails
 *  IdentityReader  Identity & access views (sign-ins, grants, RBAC, agent identities)
 *  Requester       propose new agents / changes (bundles are marked as proposals)
 *  Builder         create agents and change requests
 *  Approver        verify bundles
 *  Admin           everything, unscoped, bulk remediation
 */
export type AppRole = "Reader" | "IdentityReader" | "Requester" | "Builder" | "Approver" | "Admin";
export const ALL_ROLES: AppRole[] = ["Reader", "IdentityReader", "Requester", "Builder", "Approver", "Admin"];

const ROLE_CLAIMS: Record<string, AppRole> = Object.fromEntries(ALL_ROLES.map((r) => [`AgentCtl.${r}`, r]));

interface Session {
  mode: "mock" | "live";
  setMode(m: "mock" | "live"): void;
  liveCapable: boolean;
  signedIn: boolean;
  user: { name: string; upn: string };
  roles: AppRole[];
  groups: string[];
  scope: ResolvedScope;
  access: AccessConfig;
  /** Mock mode only: simulate app roles and scope groups. */
  setMockRoles(r: AppRole[]): void;
  setMockGroups(g: string[]): void;
  can(role: AppRole): boolean;
  /** Can create bundles: Builders directly, Requesters as proposals. */
  canPropose: boolean;
  signIn(): void;
  signOut(): void;
}

const Ctx = createContext<Session | null>(null);
const MODE_KEY = "agentctl.mode";
const ROLES_KEY = "agentctl.mockRoles";
const GROUPS_KEY = "agentctl.mockGroups";

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: preference is per-session only */
  }
}

export function SessionProvider({ children, loadGroups }: { children: ReactNode; loadGroups?: () => Promise<string[]> }) {
  const [mode, setModeState] = useState<"mock" | "live">(() => (liveCapable ? read(MODE_KEY, config.mode) : "mock"));
  const [mockRoles, setMockRolesState] = useState<AppRole[]>(() => read(ROLES_KEY, ALL_ROLES));
  const [mockGroups, setMockGroupsState] = useState<string[]>(() => read(GROUPS_KEY, []));
  const [overageGroups, setOverageGroups] = useState<string[] | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    // re-render once MSAL has processed the redirect
    const t = setTimeout(() => force((n) => n + 1), 0);
    return () => clearTimeout(t);
  }, []);

  const account = mode === "live" ? activeAccount() : null;
  const claims = (account?.idTokenClaims ?? {}) as { roles?: string[]; groups?: string[]; _claim_names?: { groups?: string } };
  const claimRoles = (claims.roles ?? []).map((r) => ROLE_CLAIMS[r]).filter(Boolean);
  const groupOverage = Boolean(claims._claim_names?.groups);

  // >200 groups: Entra omits the claim; fetch memberships from Graph instead.
  useEffect(() => {
    if (mode !== "live" || !account || !groupOverage || overageGroups || !loadGroups) return;
    loadGroups()
      .then(setOverageGroups)
      .catch((e) => console.warn("group lookup failed", e));
  }, [mode, account, groupOverage, overageGroups, loadGroups]);

  // Least privilege: no app role assigned = no access (app_role_assignment_required should stop
  // such users at sign-in anyway).
  const roles: AppRole[] = mode === "mock" ? mockRoles : claimRoles;
  const groups = mode === "mock" ? mockGroups : (claims.groups ?? overageGroups ?? []);
  const access = mode === "mock" ? MOCK_ACCESS : config.access;
  const scope = useMemo(() => resolveScope(access, groups, roles.includes("Admin")), [access, groups, roles]);

  const setMode = useCallback((m: "mock" | "live") => {
    setModeState(m);
    write(MODE_KEY, m);
  }, []);
  const setMockRoles = useCallback((r: AppRole[]) => {
    setMockRolesState(r);
    write(ROLES_KEY, r);
  }, []);
  const setMockGroups = useCallback((g: string[]) => {
    setMockGroupsState(g);
    write(GROUPS_KEY, g);
  }, []);

  const value = useMemo<Session>(() => {
    const can = (r: AppRole) => roles.includes("Admin") || roles.includes(r);
    return {
      mode,
      setMode,
      liveCapable,
      signedIn: mode === "mock" || Boolean(account),
      user:
        mode === "mock"
          ? { name: "Dev User (mock)", upn: "dev.user@contoso.example" }
          : { name: account?.name ?? "Not signed in", upn: account?.username ?? "" },
      roles,
      groups,
      scope,
      access,
      setMockRoles,
      setMockGroups,
      can,
      canPropose: can("Builder") || can("Requester"),
      signIn: () => void login(),
      signOut: () => void logout(),
    };
  }, [mode, setMode, account, roles, groups, scope, access, setMockRoles, setMockGroups]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
