import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { DataSourceProvider } from "./api";
import { initMsal } from "./auth/msal";
import { getMyGroupIds } from "./api/live/graph";
import { SessionProvider } from "./auth/session";
import { UiProvider, useUi } from "./state/ui";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: (n, e) => n < 1 && !(e instanceof Error && e.name === "AuthRequiredError"), refetchOnWindowFocus: false },
  },
});

function Themed() {
  const { dark } = useUi();
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} style={{ height: "100%" }}>
      <App />
    </FluentProvider>
  );
}

initMsal()
  .catch((e) => console.error("MSAL init failed", e))
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <UiProvider>
              <SessionProvider loadGroups={getMyGroupIds}>
                <DataSourceProvider>
                  <Themed />
                </DataSourceProvider>
              </SessionProvider>
            </UiProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
  });
