import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity, CalendarDays, CheckSquare, CircleDollarSign, CreditCard, Download, Eye,
  LogOut, Menu, Monitor, Moon, PawPrint, Plane, Search, Settings2, Shield,
  Smartphone, Sun, Target, Ticket, X, WalletCards,
} from "lucide-react";
import { Button } from "./ui";
import { cn } from "../lib/utils";
import { pb } from "../lib/pocketbase";
import { useTheme, type ThemePreference } from "../hooks/use-theme";
import { usePwa } from "../hooks/use-pwa";
import type { Role } from "../types";
import { BrandLogo } from "./BrandLogo";

export type Page = "overview" | "planner" | "finance" | "bank-accounts" | "portfolio" | "pets" | "travel" | "goals" | "calendar" | "entertainment" | "device" | "admin" | "settings";

const navGroups = [
  {
    title: "Workspace",
    items: [
      { id: "overview", label: "Overview", icon: Activity },
      { id: "planner", label: "Life Planner", icon: CheckSquare },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    title: "Your life",
    items: [
      { id: "finance", label: "Expense Tracking", icon: CircleDollarSign },
      { id: "bank-accounts", label: "Accounts", icon: CreditCard },
      { id: "portfolio", label: "Portfolio", icon: WalletCards },
      { id: "goals", label: "Goals", icon: Target },
      { id: "pets", label: "Pet Management", icon: PawPrint },
      { id: "travel", label: "Traveling Hub", icon: Plane },
      { id: "entertainment", label: "Experiences", icon: Ticket },
    ],
  },
  {
    title: "Integrations",
    items: [
      { id: "device", label: "Mobile & Integrations", icon: Smartphone },
    ],
  },
] as const satisfies ReadonlyArray<{ title: string; items: ReadonlyArray<{ id: Page; label: string; icon: typeof Activity }> }>;

const pageMeta: Record<Page, string> = {
  overview: "Overview",
  planner: "Life Planner",
  finance: "Expense Tracking",
  "bank-accounts": "Accounts",
  portfolio: "Portfolio",
  pets: "Pet Management",
  travel: "Traveling Hub",
  goals: "Goals",
  calendar: "Calendar",
  entertainment: "Experiences",
  device: "Mobile & Integrations",
  admin: "Admin control",
  settings: "Settings",
};

function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const options: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <div className="flex w-full items-center rounded-lg border border-line/15 p-0.5" role="group" aria-label="Color theme">
      {options.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={`${option.label} theme`}
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            onClick={() => setPreference(option.value)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[11px] font-medium transition",
              active ? "bg-line/[.07] text-ink" : "text-ink-faint hover:text-ink",
            )}
          >
            <Icon size={13} strokeWidth={1.9} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AppShell({ page, onPage, role, onLogout, children }: {
  page: Page; onPage: (p: Page) => void; role: Role; onLogout: () => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { isStandalone, canInstall, promptInstall } = usePwa();
  const user = pb.authStore.record as any;
  const initials = useMemo(() => {
    const source = String(user?.name || user?.email || "LP").trim();
    return source.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s: string) => s[0].toUpperCase()).join("") || "LP";
  }, [user?.name, user?.email]);
  const pageTitle = pageMeta[page];
  const navigate = (target: Page) => { onPage(target); setOpen(false); setSearchTerm(""); searchRef.current?.blur(); };
  const quickPages: { id: Page; label: string; group: string }[] = [
    ...navGroups.flatMap((group) => group.items.map((item) => ({ id: item.id as Page, label: item.label, group: group.title }))),
    ...(role === "superadmin" ? [{ id: "admin" as Page, label: "Admin control", group: "Management" }] : []),
    { id: "settings", label: "Settings", group: "Account" },
  ];
  const visibleQuickPages = quickPages.filter((item) => `${item.label} ${item.id} ${item.group}`.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setSearchTerm("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function handleSearchKeyDown(event: import("react").KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && visibleQuickPages[0]) {
      event.preventDefault();
      navigate(visibleQuickPages[0].id);
    }
    if (event.key === "Escape") {
      setSearchTerm("");
      searchRef.current?.blur();
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[262px] flex-col border-r border-line/10 bg-surface px-3 py-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pl-[calc(0.75rem+env(safe-area-inset-left,0px))] transition-transform duration-200 lg:translate-x-0 lg:pt-5 lg:pb-5 lg:pl-3",
          open ? "translate-x-0 shadow-pop" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <button onClick={() => navigate("overview")} className="text-left group transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 rounded-xl">
            <BrandLogo variant="horizontal" size="md" />
          </button>
          <Button className="lg:hidden" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={17} />
          </Button>
        </div>

        <div className="relative mb-4 px-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search pages and navigate"
            placeholder="Search pages"
            className="h-9 w-full rounded-lg border border-line/15 bg-transparent pl-9 pr-12 text-xs text-ink outline-none transition placeholder:text-ink-faint hover:border-line/20 focus:border-ink/35 focus:ring-4 focus:ring-ink/[.05]"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line/15 px-1.5 py-0.5 text-[9px] font-medium text-ink-faint sm:block">Ctrl K</kbd>
          {searchTerm.trim() && (
            <div className="absolute left-1 right-1 top-11 z-10 max-h-64 overflow-y-auto rounded-lg border border-line/15 bg-surface p-1.5 shadow-pop">
              {visibleQuickPages.length ? (
                visibleQuickPages.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-ink-soft transition hover:bg-line/[.05] hover:text-ink"
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] text-ink-faint">{item.group}</span>
                  </button>
                ))
              ) : (
                <p className="px-2.5 py-3 text-xs text-ink-faint">No pages found.</p>
              )}
            </div>
          )}
        </div>

        <nav aria-label="Primary navigation" className="flex-1 space-y-6 overflow-y-auto px-1 pb-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[.14em] text-ink-faint">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const selected = page === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id as Page)}
                      aria-current={selected ? "page" : undefined}
                      className={cn(
                        "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition",
                        selected ? "bg-line/[.06] font-medium text-ink" : "text-ink-soft hover:bg-line/[.04] hover:text-ink",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.9} className={selected ? "text-ink" : "text-ink-faint"} />
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {role === "superadmin" && (
            <div>
              <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[.14em] text-ink-faint">Management</p>
              <button
                onClick={() => navigate("admin")}
                aria-current={page === "admin" ? "page" : undefined}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition",
                  page === "admin" ? "bg-line/[.06] font-medium text-ink" : "text-ink-soft hover:bg-line/[.04] hover:text-ink",
                )}
              >
                <Shield size={16} strokeWidth={1.9} className={page === "admin" ? "text-ink" : "text-ink-faint"} />
                <span className="flex-1">Admin control</span>
              </button>
            </div>
          )}
        </nav>

        <div className="mt-auto space-y-1 border-t border-line/10 pt-3">
          {canInstall && !isStandalone && (
            <button
              onClick={() => void promptInstall()}
              className="flex min-h-9 w-full items-center gap-2.5 rounded-lg bg-line/[.05] px-2.5 text-left text-[13px] text-ink transition hover:bg-line/[.09]"
            >
              <Download size={16} strokeWidth={1.9} />
              <span className="font-medium">Install App</span>
            </button>
          )}
          <button
            onClick={() => navigate("settings")}
            className={cn(
              "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition",
              page === "settings" ? "bg-line/[.06] font-medium text-ink" : "text-ink-soft hover:bg-line/[.04] hover:text-ink",
            )}
          >
            <Settings2 size={16} strokeWidth={1.9} className={page === "settings" ? "text-ink" : "text-ink-faint"} />
            <span>Settings</span>
          </button>
          <div className="px-2.5 pt-2">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[.14em] text-ink-faint">Theme</p>
            <ThemeToggle />
          </div>
          <button
            onClick={onLogout}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-ink-soft transition hover:bg-negative/10 hover:text-negative"
          >
            <LogOut size={16} strokeWidth={1.9} className="text-ink-faint" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="min-h-screen pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] lg:pl-[262px]">
        <header className="sticky top-0 z-20 flex min-h-16 pt-[env(safe-area-inset-top,0px)] items-center justify-between gap-3 border-b border-line/10 bg-canvas/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button className="lg:hidden" size="icon" variant="outline" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu size={17} />
            </Button>
            <button
              onClick={() => navigate("overview")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line/15 bg-surface lg:hidden transition hover:border-line/25"
              aria-label="LifePlanner Home"
            >
              <BrandLogo variant="mark" size="xs" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-[-.01em] text-ink">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("settings")}
              className="flex items-center gap-2.5 rounded-lg p-1 pr-2 transition hover:bg-line/[.05]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line/15 text-[11px] font-semibold text-ink">{initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-medium text-ink">{user?.name || user?.username || "Your account"}</span>
                <span className="mt-0.5 block max-w-32 truncate text-[10px] text-ink-faint">{role === "superadmin" ? "Administrator" : "Personal workspace"}</span>
              </span>
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</div>
        <footer className="flex flex-col sm:flex-row items-center justify-center gap-2 px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-4 text-center text-xs text-ink-faint">
          <div className="flex items-center gap-1.5 font-medium text-ink-soft">
            <BrandLogo variant="mark" size="xs" />
            <span>LifePlanner</span>
          </div>
          <span className="hidden sm:inline text-line/20">•</span>
          <span>A little more clarity, every day</span>
        </footer>
      </main>
    </div>
  );
}
