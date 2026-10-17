import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TimeRange } from "../api/types";

type ThemePref = "system" | "light" | "dark";

interface Ui {
  range: TimeRange;
  setRange(r: TimeRange): void;
  themePref: ThemePref;
  setThemePref(t: ThemePref): void;
  dark: boolean;
}

const Ctx = createContext<Ui | null>(null);

function stored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<TimeRange>(() => stored("agentctl.range", "24h"));
  const [themePref, setThemePrefState] = useState<ThemePref>(() => stored("agentctl.theme", "system"));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq?.addEventListener("change", h);
    return () => mq?.removeEventListener("change", h);
  }, []);

  const value = useMemo<Ui>(
    () => ({
      range,
      setRange: (r) => {
        setRangeState(r);
        store("agentctl.range", r);
      },
      themePref,
      setThemePref: (t) => {
        setThemePrefState(t);
        store("agentctl.theme", t);
      },
      dark: themePref === "dark" || (themePref === "system" && systemDark),
    }),
    [range, themePref, systemDark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi(): Ui {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi outside UiProvider");
  return v;
}
