import { MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { useSession, type AppRole } from "./auth/session";
import { Layout } from "./components/Layout";
import { ActivityPage } from "./pages/Activity";
import { AgentDetailPage } from "./pages/AgentDetail";
import { AgentsPage } from "./pages/Agents";
import { BuilderPage } from "./pages/builder/BuilderPage";
import { GuardrailsPage } from "./pages/Guardrails";
import { HarnessPage } from "./pages/Harness";
import { IdentityPage } from "./pages/Identity";
import { OverviewPage } from "./pages/Overview";
import { ReviewPage } from "./pages/Review";
import { SettingsPage } from "./pages/Settings";

function RoleGate({ role, children }: { role: AppRole; children: ReactNode }) {
  const { can, mode } = useSession();
  if (can(role)) return <>{children}</>;
  return (
    <MessageBar intent="warning">
      <MessageBarBody>
        <MessageBarTitle>Requires the {role} role</MessageBarTitle>
        {mode === "mock"
          ? "Enable it from the account menu (simulated roles in mock mode)."
          : `Ask an administrator to assign the AgentCtl.${role} app role on the agentctl enterprise application.`}
      </MessageBarBody>
    </MessageBar>
  );
}

function ProposeGate({ children }: { children: ReactNode }) {
  const { canPropose } = useSession();
  return canPropose ? <>{children}</> : <RoleGate role="Builder">{children}</RoleGate>;
}

function SignInGate({ children }: { children: ReactNode }) {
  const { signedIn, signIn, roles, mode } = useSession();
  if (signedIn && (roles.length || mode === "mock")) return <>{children}</>;
  if (signedIn)
    return (
      <MessageBar intent="warning">
        <MessageBarBody>
          <MessageBarTitle>No agentctl role assigned</MessageBarTitle>
          Your account signed in but has no AgentCtl app role. Ask an administrator to add you to one of the agentctl groups.
        </MessageBarBody>
      </MessageBar>
    );
  return (
    <MessageBar intent="info">
      <MessageBarBody>
        <MessageBarTitle>Sign in to view live data</MessageBarTitle>
        Live mode uses your own Entra ID token for ARM, Graph, Log Analytics and Foundry.{" "}
        <a href="#" onClick={(e) => (e.preventDefault(), signIn())}>
          Sign in
        </a>
      </MessageBarBody>
    </MessageBar>
  );
}

export function App() {
  return (
    <Layout>
      <SignInGate>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:project/:id" element={<AgentDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/identity" element={<RoleGate role="IdentityReader"><IdentityPage /></RoleGate>} />
          <Route path="/guardrails" element={<GuardrailsPage />} />
          <Route path="/builder" element={<ProposeGate><BuilderPage /></ProposeGate>} />
          <Route path="/harness" element={<ProposeGate><HarnessPage /></ProposeGate>} />
          <Route path="/review" element={<RoleGate role="Approver"><ReviewPage /></RoleGate>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<OverviewPage />} />
        </Routes>
      </SignInGate>
    </Layout>
  );
}
