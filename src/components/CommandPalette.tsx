import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckSquare,
  CircleDollarSign,
  Command,
  CreditCard,
  PawPrint,
  Plane,
  PlusCircle,
  ScanLine,
  Search,
  Settings2,
  Shield,
  Smartphone,
  SunMoon,
  Target,
  Ticket,
  WalletCards,
  X,
} from "lucide-react";
import type { Page } from "./layout";

interface CommandItem {
  id: string;
  title: string;
  category: "Halaman" | "Aksi Cepat" | "Preferensi";
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onToggleTheme,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (page: Page) => void;
  onToggleTheme?: () => void;
  role?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Daftar perintah lengkap & halaman
  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigasi Halaman
      { id: "p-overview", title: "Overview Dashboard", category: "Halaman", icon: Activity, action: () => onNavigate("overview") },
      { id: "p-finance", title: "Expense Tracking (Keuangan)", category: "Halaman", icon: CircleDollarSign, action: () => onNavigate("finance") },
      { id: "p-planner", title: "Life Planner (Aktivitas)", category: "Halaman", icon: CheckSquare, action: () => onNavigate("planner") },
      { id: "p-accounts", title: "Bank & E-Wallet Accounts", category: "Halaman", icon: CreditCard, action: () => onNavigate("bank-accounts") },
      { id: "p-goals", title: "Financial Goals (Impian)", category: "Halaman", icon: Target, action: () => onNavigate("goals") },
      { id: "p-portfolio", title: "Investments Portfolio", category: "Halaman", icon: WalletCards, action: () => onNavigate("portfolio") },
      { id: "p-pets", title: "Pet Management", category: "Halaman", icon: PawPrint, action: () => onNavigate("pets") },
      { id: "p-travel", title: "Traveling Hub", category: "Halaman", icon: Plane, action: () => onNavigate("travel") },
      { id: "p-experiences", title: "Entertainment & Experiences", category: "Halaman", icon: Ticket, action: () => onNavigate("entertainment") },
      { id: "p-device", title: "Mobile & iOS Shortcut Integrations", category: "Halaman", icon: Smartphone, action: () => onNavigate("device") },
      { id: "p-settings", title: "Application Settings", category: "Halaman", icon: Settings2, action: () => onNavigate("settings") },
      // Aksi Cepat
      {
        id: "a-add-expense",
        title: "Tambah Transaksi Baru",
        category: "Aksi Cepat",
        icon: PlusCircle,
        action: () => {
          onNavigate("finance");
          window.dispatchEvent(new CustomEvent("life-planner:open-add-transaction"));
        },
      },
      {
        id: "a-scan-receipt",
        title: "Pindai Struk / Nota (OCR)",
        category: "Aksi Cepat",
        icon: ScanLine,
        action: () => {
          onNavigate("finance");
          window.dispatchEvent(new CustomEvent("life-planner:open-scan-bill"));
        },
      },
      {
        id: "a-add-account",
        title: "Tambah Rekening / Kartu Bank",
        category: "Aksi Cepat",
        icon: CreditCard,
        action: () => {
          onNavigate("bank-accounts");
          window.dispatchEvent(new CustomEvent("life-planner:open-add-account"));
        },
      },
    ];

    if (onToggleTheme) {
      list.push({
        id: "a-toggle-theme",
        title: "Ganti Tema Tampilan (Dark / Light)",
        category: "Preferensi",
        icon: SunMoon,
        action: onToggleTheme,
      });
    }

    if (role === "superadmin") {
      list.push({
        id: "p-admin",
        title: "Admin Control Center",
        category: "Halaman",
        icon: Shield,
        action: () => onNavigate("admin"),
      });
    }

    return list;
  }, [onNavigate, onToggleTheme, role]);

  // Filter berdasarkan teks pencarian
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Reset index saat filter berubah
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Fokus input saat palette dibuka
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Cmd+K atau Ctrl+K membuka / menutup palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(8);
          } catch {}
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [open, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeItem(filtered[selectedIndex]);
    }
  };

  const executeItem = (item: CommandItem) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    onOpenChange(false);
    item.action();
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="dialog-backdrop fixed inset-0 z-[200] flex items-start justify-center p-3 pt-[12vh] sm:p-6 sm:pt-[15vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            key="command-palette-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", damping: 28, stiffness: 400, mass: 0.8 }}
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line/15 bg-surface shadow-pop before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 border-b border-line/10 px-4 py-3 sm:px-5">
              <Search size={18} className="shrink-0 text-ink-faint" />
              <input
                ref={inputRef}
                id={titleId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari halaman, fitur, atau aksi cepat..."
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint sm:text-base"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:text-ink"
                  aria-label="Bersihkan pencarian"
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd className="hidden rounded border border-line/15 bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:inline-block">
                  ESC
                </kbd>
              )}
            </div>

            {/* Results List */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-faint">
                  Tidak ada perintah atau halaman yang cocok dengan &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={index}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-100 ${
                        isSelected
                          ? "bg-line/[.08] text-ink font-medium"
                          : "text-ink-soft hover:bg-line/[.04]"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                            isSelected ? "bg-accent text-accent-ink" : "bg-line/[.06] text-ink-soft"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <span className="truncate">{item.title}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-line/[.06] px-2 py-0.5 text-[10px] text-ink-faint">
                          {item.category}
                        </span>
                        {isSelected && <ArrowRight size={14} className="text-ink-faint" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer helper */}
            <div className="hidden items-center justify-between border-t border-line/10 bg-canvas/40 px-4 py-2 text-[11px] text-ink-faint sm:flex">
              <div className="flex items-center gap-4">
                <span><kbd className="rounded border border-line/15 bg-surface px-1">↑</kbd> <kbd className="rounded border border-line/15 bg-surface px-1">↓</kbd> Navigasi</span>
                <span><kbd className="rounded border border-line/15 bg-surface px-1">↵</kbd> Buka</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Command size={12} />
                <span>Life Planner Command Hub</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
