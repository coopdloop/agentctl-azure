import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSession } from "../auth/session";
import { LiveDataSource } from "./live";
import { MockDataSource } from "./mock";
import type { DataSource, TimeRange } from "./types";

const mock = new MockDataSource();
let live: LiveDataSource | null = null;

const Ctx = createContext<DataSource>(mock);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const { mode } = useSession();
  const ds = useMemo<DataSource>(() => (mode === "live" ? (live ??= new LiveDataSource()) : mock), [mode]);
  return <Ctx.Provider value={ds}>{children}</Ctx.Provider>;
}

export const useDataSource = () => useContext(Ctx);

type Method = {
  [K in keyof DataSource]: DataSource[K] extends (...a: never[]) => Promise<unknown> ? K : never;
}[keyof DataSource];

/** useQuery bound to the active data source; the query key includes the mode. */
export function useDs<M extends Method>(
  method: M,
  ...args: Parameters<DataSource[M]>
): UseQueryResult<Awaited<ReturnType<DataSource[M]>>> {
  const ds = useDataSource();
  return useQuery({
    queryKey: [ds.kind, method, ...args],
    queryFn: () => (ds[method] as (...a: unknown[]) => Promise<unknown>)(...args) as Promise<Awaited<ReturnType<DataSource[M]>>>,
  });
}

export type { TimeRange };
