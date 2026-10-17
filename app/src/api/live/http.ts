import { getToken, type ScopeKey } from "../../auth/msal";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public source: string,
  ) {
    super(`${source}: ${message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch + bearer token for the given audience, JSON in/out, retries 429/503 with Retry-After. */
export async function apiFetch<T>(
  scope: ScopeKey,
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  source = scope,
): Promise<T> {
  const token = await getToken(scope);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const ra = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await sleep(Math.min(ra, 10) * 1000);
      continue;
    }
    if (!res.ok) {
      let code = String(res.status);
      let message = res.statusText;
      try {
        const j = await res.json();
        code = j?.error?.code ?? code;
        message = j?.error?.message ?? j?.message ?? message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, code, message, source);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

/** Follows ARM `nextLink` / Graph `@odata.nextLink` paging. */
export async function fetchAllPages<T>(scope: ScopeKey, url: string, max = 20): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < max; i++) {
    const page: { value?: T[]; nextLink?: string; "@odata.nextLink"?: string } = await apiFetch(scope, next);
    out.push(...(page.value ?? []));
    next = page.nextLink ?? page["@odata.nextLink"];
  }
  return out;
}

/** Runs promises but turns individual failures into `fallback` (for optional sources). */
export async function settle<T>(p: Promise<T>, fallback: T, onError?: (e: unknown) => void): Promise<T> {
  try {
    return await p;
  } catch (e) {
    onError?.(e);
    return fallback;
  }
}
