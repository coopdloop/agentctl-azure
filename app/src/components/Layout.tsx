import {
  Avatar,
  Badge,
  Button,
  Menu,
  MenuItem,
  MenuItemCheckbox,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  Tab,
  TabList,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  Board20Regular,
  Bot20Regular,
  BranchRequest20Regular,
  DocumentCheckmark20Regular,
  Navigation20Regular,
  PersonKey20Regular,
  Pulse20Regular,
  Settings20Regular,
  ShieldCheckmark20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
  Wrench20Regular,
} from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ALL_ROLES, useSession, type AppRole } from "../auth/session";
import { config } from "../config";
import type { TimeRange } from "../api/types";
import { useUi } from "../state/ui";

const NAV: { to: string; label: string; icon: ReactNode; role?: AppRole; group: string }[] = [
  { to: "/", label: "Overview", icon: <Board20Regular />, group: "Observe" },
  { to: "/agents", label: "Agents", icon: <Bot20Regular />, group: "Observe" },
  { to: "/activity", label: "Activity & traces", icon: <Pulse20Regular />, group: "Observe" },
  { to: "/identity", label: "Identity & access", icon: <PersonKey20Regular />, group: "Observe" },
  { to: "/guardrails", label: "Guardrails", icon: <ShieldCheckmark20Regular />, group: "Govern" },
  { to: "/builder", label: "Agent builder", icon: <Wrench20Regular />, role: "Builder", group: "Change" },
  { to: "/harness", label: "Harness injection", icon: <BranchRequest20Regular />, role: "Builder", group: "Change" },
  { to: "/review", label: "Review bundle", icon: <DocumentCheckmark20Regular />, role: "Approver", group: "Change" },
  { to: "/settings", label: "Data sources", icon: <Settings20Regular />, group: "Platform" },
];

const useStyles = makeStyles({
  root: { display: "grid", gridTemplateColumns: "240px 1fr", gridTemplateRows: "52px 1fr", height: "100vh", background: tokens.colorNeutralBackground2 },
  rootCollapsed: { gridTemplateColumns: "56px 1fr" },
  top: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 12px",
    background: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    minWidth: 0,
  },
  brand: { display: "flex", alignItems: "center", gap: "8px", fontWeight: tokens.fontWeightSemibold, whiteSpace: "nowrap" },
  logo: { width: "24px", height: "24px", borderRadius: "6px", background: "#2a78d6", display: "grid", placeItems: "center" },
  spacer: { flex: 1 },
  nav: {
    background: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: "8px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  group: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, textTransform: "uppercase", letterSpacing: "0.06em", padding: "12px 10px 4px" },
  link: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground2,
    textDecoration: "none",
    fontSize: tokens.fontSizeBase300,
    whiteSpace: "nowrap",
    ":hover": { background: tokens.colorNeutralBackground1Hover, color: tokens.colorNeutralForeground1 },
  },
  active: { background: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  main: { overflowY: "auto", padding: "24px 28px 48px", minWidth: 0 },
  inner: { maxWidth: "1480px", margin: "0 auto" },
  hideSmall: { "@media (max-width: 900px)": { display: "none" } },
  "@media (max-width: 700px)": {},
});

export function Layout({ children }: { children: ReactNode }) {
  const s = useStyles();
  const { range, setRange, dark, setThemePref } = useUi();
  const session = useSession();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900);
  const loc = useLocation();

  let lastGroup = "";
  return (
    <div className={mergeClasses(s.root, collapsed && s.rootCollapsed)}>
      <header className={s.top}>
        <Button appearance="subtle" icon={<Navigation20Regular />} aria-label="Toggle navigation" onClick={() => setCollapsed((c) => !c)} />
        <div className={s.brand}>
          <div className={s.logo}>
            <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden>
              <path d="M7 22l6-12 5 8 2-3 5 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span>agentctl</span>
          <Text size={200} className={s.hideSmall} style={{ color: tokens.colorNeutralForeground3, fontWeight: 400 }}>
            Agent control plane
          </Text>
        </div>
        <Badge appearance="tint" color={session.mode === "live" ? "success" : "warning"} className={s.hideSmall}>
          {session.mode === "live" ? `Live · ${config.environment}` : "Mock data"}
        </Badge>
        <div className={s.spacer} />
        <TabList size="small" selectedValue={range} onTabSelect={(_, d) => setRange(d.value as TimeRange)} aria-label="Time range">
          {(["1h", "24h", "7d", "30d"] as TimeRange[]).map((r) => (
            <Tab key={r} value={r}>
              {r}
            </Tab>
          ))}
        </TabList>
        <Tooltip content={dark ? "Light theme" : "Dark theme"} relationship="label">
          <Button appearance="subtle" icon={dark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />} onClick={() => setThemePref(dark ? "light" : "dark")} />
        </Tooltip>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" icon={<Avatar size={24} name={session.user.name} />} aria-label="Account" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList
              checkedValues={{ roles: session.roles, mode: [session.mode] }}
              onCheckedValueChange={(_, d) => {
                if (d.name === "roles") session.setMockRoles(d.checkedItems as AppRole[]);
              }}
            >
              <MenuGroup>
                <MenuGroupHeader>{session.user.upn || session.user.name}</MenuGroupHeader>
              </MenuGroup>
              <MenuDivider />
              <MenuItem disabled={!session.liveCapable} onClick={() => session.setMode(session.mode === "live" ? "mock" : "live")}>
                {session.mode === "live" ? "Switch to mock data" : session.liveCapable ? "Switch to live Azure" : "Live mode not configured"}
              </MenuItem>
              {session.mode === "live" &&
                (session.signedIn ? <MenuItem onClick={session.signOut}>Sign out</MenuItem> : <MenuItem onClick={session.signIn}>Sign in</MenuItem>)}
              <MenuDivider />
              <MenuGroup>
                <MenuGroupHeader>{session.mode === "mock" ? "Simulated app roles" : "App roles (from token)"}</MenuGroupHeader>
                {ALL_ROLES.map((r) => (
                  <MenuItemCheckbox key={r} name="roles" value={r} disabled={session.mode === "live"}>
                    {r}
                  </MenuItemCheckbox>
                ))}
              </MenuGroup>
            </MenuList>
          </MenuPopover>
        </Menu>
      </header>
      <nav className={s.nav} aria-label="Main">
        {NAV.map((n) => {
          const showGroup = !collapsed && n.group !== lastGroup;
          lastGroup = n.group;
          const allowed = !n.role || session.can(n.role);
          const link = (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) => mergeClasses(s.link, (isActive || (n.to !== "/" && loc.pathname.startsWith(n.to))) && s.active)}
              style={allowed ? undefined : { opacity: 0.45 }}
              title={allowed ? n.label : `${n.label} (requires ${n.role} role)`}
            >
              {n.icon}
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          );
          return (
            <div key={n.to}>
              {showGroup && <div className={s.group}>{n.group}</div>}
              {link}
            </div>
          );
        })}
      </nav>
      <main className={s.main}>
        <div className={s.inner}>{children}</div>
      </main>
    </div>
  );
}
