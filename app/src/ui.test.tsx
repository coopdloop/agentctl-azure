// @vitest-environment jsdom
// Smoke test: every route renders in mock mode without runtime errors or React warnings.

import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { DataSourceProvider } from "./api";
import { SessionProvider } from "./auth/session";
import { UiProvider } from "./state/ui";

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <UiProvider>
          <SessionProvider>
            <DataSourceProvider>
              <FluentProvider theme={webLightTheme}>
                <App />
              </FluentProvider>
            </DataSourceProvider>
          </SessionProvider>
        </UiProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ROUTES: [string, string | RegExp][] = [
  ["/", "Agents by activity"],
  ["/agents", "hr-benefits-assistant"],
  ["/agents/enterprise-agents/asst_itHelp9Kd0PqR2", "Effective instructions"],
  ["/activity", /Newest 300/],
  ["/identity", "Sign-ins by auth flow"],
  ["/guardrails", /Bulk-inject mandatory harness/],
  ["/builder", "Basics & ownership"],
  ["/harness?project=enterprise-agents&id=asst_itHelp9Kd0PqR2&fix=require-approval", /change/],
  ["/review", "Drop a bundle .zip here"],
  ["/settings", "Sources of truth"],
];

describe("routes render in mock mode", () => {
  for (const [path, text] of ROUTES) {
    it(path, async () => {
      const errors: string[] = [];
      const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
        const msg = a.map(String).join(" ");
        // jsdom has no layout; recharts warns about 0-size containers.
        if (!/width\(0\) and height\(0\)|ResizeObserver|not implemented: HTMLCanvasElement/i.test(msg)) errors.push(msg);
      });
      renderAt(path);
      await waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0), { timeout: 4000 });
      // let pending queries settle
      await new Promise((r) => setTimeout(r, 700));
      spy.mockRestore();
      expect(errors).toEqual([]);
    });
  }

  it("harness fix preset produces a change", async () => {
    renderAt("/harness?project=enterprise-agents&id=asst_itHelp9Kd0PqR2&fix=require-approval");
    await waitFor(() => expect(screen.getByText(/preset: Require human approval/)).toBeTruthy(), { timeout: 4000 });
    await waitFor(() => expect(screen.getAllByText(/^change(s)?$/).length).toBeGreaterThan(0), { timeout: 4000 });
  });
});
