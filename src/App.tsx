import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { pb } from "./lib/pocketbase";
import { useAuth } from "./hooks/use-pocketbase";
import { ThemeProvider, useTheme } from "./hooks/use-theme";
import { useCapacitor } from "./hooks/use-capacitor";
import { Login } from "./pages/Login";
import { AppShell, type Page } from "./components/layout";
import { Toaster, toast } from "sonner";

// Lazy-loaded pages for optimal bundle size & fast startup
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Planner = lazy(() => import("./pages/Planner").then((m) => ({ default: m.Planner })));
const Finance = lazy(() => import("./pages/Finance").then((m) => ({ default: m.Finance })));
const Entertainment = lazy(() => import("./pages/Entertainment").then((m) => ({ default: m.Entertainment })));
const Travel = lazy(() => import("./pages/Travel").then((m) => ({ default: m.Travel })));
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const Pets = lazy(() => import("./pages/Pets").then((m) => ({ default: m.Pets })));
const BankAccounts = lazy(() => import("./pages/BankAccounts").then((m) => ({ default: m.BankAccounts })));
const Goals = lazy(() => import("./pages/Goals").then((m) => ({ default: m.Goals })));
const Portfolio = lazy(() => import("./pages/Portfolio").then((m) => ({ default: m.Portfolio })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const Device = lazy(() => import("./pages/Device").then((m) => ({ default: m.Device })));
const Calendar = lazy(() => import("./pages/Calendar").then((m) => ({ default: m.Calendar })));
const ChangePassword = lazy(() => import("./pages/ChangePassword").then((m) => ({ default: m.ChangePassword })));

function PageFallback() {
  return (
    <div className="animate-pulse space-y-6 py-2">
      <div className="h-8 w-48 rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="h-28 rounded-2xl bg-muted" />
      </div>
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}

function Workspace() {
  const auth = useAuth();
  const { resolved } = useTheme();
  const [page, setPage] = useState<Page>("overview");

  useCapacitor({
    page,
    onNavigate: setPage,
    isDark: resolved === "dark",
  });

  useEffect(() => {
    const handler = (event: Event) => setPage((event as CustomEvent<Page>).detail);
    window.addEventListener("life-planner:navigate", handler);
    return () => window.removeEventListener("life-planner:navigate", handler);
  }, []);

  useEffect(() => {
    if (!auth.isValid) setPage("overview");
  }, [auth.isValid]);

  useEffect(() => {
    if (!auth.isValid || !auth.record) return;
    const status = typeof (auth.record as any).status === "string" ? String((auth.record as any).status).toLowerCase() : "";
    if (status !== "active") {
      pb.authStore.clear();
      toast.error("Akun tidak aktif. Hubungi administrator untuk bantuan.");
    }
  }, [auth.isValid, auth.record?.id]);

  const content = useMemo(() => {
    switch (page) {
      case "planner": return <Planner />;
      case "entertainment": return <Entertainment />;
      case "finance": return <Finance />;
      case "bank-accounts": return <BankAccounts />;
      case "pets": return <Pets />;
      case "travel": return <Travel />;
      case "portfolio": return <Portfolio />;
      case "goals": return <Goals />;
      case "calendar": return <Calendar />;
      case "device": return <Device />;
      case "settings": return <Settings />;
      case "admin": return auth.role === "superadmin" ? <Admin /> : <Dashboard />;
      case "overview": default: return <Dashboard />;
    }
  }, [page, auth.role]);

  const toaster = <Toaster position="top-right" theme={resolved} richColors={false} />;

  if (!auth.isValid) return <><Login onAuthenticated={() => setPage("overview")} />{toaster}</>;
  if (auth.record?.is_password_temp) return <><Suspense fallback={<PageFallback />}><ChangePassword onDone={() => { if (pb.authStore.record) pb.authStore.record.is_password_temp = false; setPage("overview"); }} /></Suspense>{toaster}</>;

  return (
    <AppShell
      page={page}
      onPage={setPage}
      role={auth.role}
      onLogout={() => {
        pb.authStore.clear();
        toast.success("Kamu sudah keluar dengan aman.");
      }}
    >
      <Suspense fallback={<PageFallback />}>
        {content}
      </Suspense>
      {toaster}
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Workspace />
    </ThemeProvider>
  );
}
