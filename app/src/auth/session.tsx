import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { liveCapable, config } from "../config";
import { activeAccount, login, logout } from "./msal";

export type AppRole = "Reader" | "Builder" | "Approver" | "Admin";
export const ALL_ROLES: AppRole[] = ["Reader", "Builder", "Approver", "Admin"];

/** Entra app role values (see infra/modules/agentctl/entra.tf). */
const ROLE_CLAIMS: Record<string, AppRole> = {
  "AgentCtl.Reader": "Reader",
  "AgentCtl.Builder": "Builder",
  "AgentCtl.Approver": "Approver",
  "AgentCtl.Admin": "Admin",
};

interface Session {
  mode: "mock" | "live";
  setMode(m: "mock" | "live"): void;
  liveCapable: boolean;
  signedIn: boolean;
  user: { name: string; upn: string };
  roles: AppRole[];
  /** Mock mode only: simulate different app roles. */
  setMockRoles(r: AppRole[]): void;
  can(role: AppRole): boolean;
  signIn(): void;
  signOut(): void;
}

const Ctx = createContext<Session | null>(null);
const MODE_KEY = "agentctl.mode";
const ROLES_KEY = "agentctl.mockRoles";

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<"mock" | "live">(() =>
    liveCapable ? read(MODE_KEY, config.mode) : "mock",
  );
  const [mockRoles, setMockRolesState] = useState<AppRole[]>(() => read(ROLES_KEY, ALL_ROLES));
  const [, force] = useState(0);

  useEffect(() => {
    // re-render once MSAL has processed the redirect
    const t = setTimeout(() => force((n) => n + 1), 0);
    return () => clearTimeout(t);
  }, []);

  const account = mode === "live" ? activeAccount() : null;
  const claimRoles = ((account?.idTokenClaims?.roles as string[] | undefined) ?? [])
    .map((r) => ROLE_CLAIMS[r])
    .filter(Boolean);

  const roles: AppRole[] = mode === "mock" ? mockRoles : claimRoles.length ? claimRoles : ["Reader"];

  const setMode = useCallback((m: "mock" | "live") => {
    setModeState(m);
    write(MODE_KEY, m);
  }, []);
  const setMockRoles = useCallback((r: AppRole[]) => {
    setMockRolesState(r);
    write(ROLES_KEY, r);
  }, []);

  const value = useMemo<Session>(
    () => ({
      mode,
      setMode,
      liveCapable,
      signedIn: mode === "mock" || Boolean(account),
      user:
        mode === "mock"
          ? { name: "Dev User (mock)", upn: "dev.user@contoso.example" }
          : { name: account?.name ?? "Not signed in", upn: account?.username ?? "" },
      roles,
      setMockRoles,
      can: (r) => roles.includes("Admin") || roles.includes(r),
      signIn: () => void login(),
      signOut: () => void logout(),
    }),
    [mode, setMode, account, roles, setMockRoles],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
