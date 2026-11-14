import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Droplets,
  Home,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  ShoppingBasket,
  Trash2,
  Tv,
  Utensils,
  Wrench,
  Zap,
  Users2,
} from "lucide-react";
import { HouseholdSettlementCard } from "../components/HouseholdSettlementCard";
import { pb } from "../lib/pocketbase";
import { formatIDR, formatDate, maskAccountNumber } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
} from "../components/ui";
import ScanBillDialog from "../components/ScanBillDialog";
import {
  getHouseholdBills,
  fetchHouseholdBills,
  upsertHouseholdBillRemote,
  deleteHouseholdBillRemote,
  getHouseholdStats,
  isHouseholdExpense,
  extractHouseholdSubcategory,
  cleanHouseholdNotes,
  buildHouseholdNotes,
  HOUSEHOLD_SUBCATEGORIES,
  type HouseholdBillConfig,
  type HouseholdSubcategory,
} from "../lib/household";
import { getBudgets, saveBudgets } from "../lib/budgets";
import type { BankAccount, Expense } from "../types";
import { toast } from "sonner";

type TabKey = "utilities" | "groceries" | "maintenance" | "collaboration";

const TABS: { id: TabKey; label: string; icon: any }[] = [
  { id: "utilities", label: "Tagihan Rutin & Utilitas", icon: Zap },
  { id: "groceries", label: "Belanja Dapur & Pokok", icon: ShoppingBasket },
  { id: "maintenance", label: "Perawatan & Servis Rumah", icon: Wrench },
  { id: "collaboration", label: "Bagi Tagihan & Split", icon: Users2 },
];

function getCategoryIcon(subcategory: string) {
  switch (subcategory) {
    case "Listrik PLN":
      return Zap;
    case "Air PDAM":
      return Droplets;
    case "Internet & TV":
      return Tv;
    case "Belanja Dapur & Pokok":
      return ShoppingBasket;
    case "Perawatan & Servis Rumah":
      return Wrench;
    default:
      return Home;
  }
}

export function HouseholdExpenses() {
  const [activeTab, setActiveTab] = useState<TabKey>("utilities");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bills, setBills] = useState<HouseholdBillConfig[]>(() =>
    getHouseholdBills(),
  );
  const [loading, setLoading] = useState(true);

  // Scan dialog
  const [scanOpen, setScanOpen] = useState(false);

  // Manual Add / Pay Bill dialog
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [recordPreset, setRecordPreset] = useState<{
    subCategory: HouseholdSubcategory;
    title: string;
    defaultAmount?: number;
    tagihanRutin?: boolean;
    dueDate?: string;
  } | null>(null);

  // Bill Config dialog
  const [billConfigOpen, setBillConfigOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<HouseholdBillConfig | null>(
    null,
  );
  const [billName, setBillName] = useState("");
  const [billSubCategory, setBillSubCategory] =
    useState<HouseholdSubcategory>("Listrik PLN");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDay, setBillDueDay] = useState("20");

  // Groceries Budget dialog
  const [groceryBudgetOpen, setGroceryBudgetOpen] = useState(false);
  const [groceryBudgetAmount, setGroceryBudgetAmount] = useState("");

  // Record Form state
  const [recordAmount, setRecordAmount] = useState("");
  const [recordDate, setRecordDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [recordNotes, setRecordNotes] = useState("");
  const [recordAccount, setRecordAccount] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expenseRes, accountsRes, billsRes] = await Promise.all([
        pb.collection("expenses").getList<Expense>(1, 200, {
          sort: "-date,-created",
          filter: `date >= "${currentMonthKey}-01" || notes ~ "[Household]"`,
        }),
        pb
          .collection("bank_accounts")
          .getFullList<BankAccount>({ sort: "bank_name" })
          .catch(() => [] as BankAccount[]),
        fetchHouseholdBills(),
      ]);

      setExpenses(expenseRes.items);
      setBankAccounts(accountsRes);
      setBills(billsRes);
    } catch (err) {
      console.error("Failed to load household expenses:", err);
      toast.error("Gagal memuat data pengeluaran rumah tangga.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const handleBillsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<HouseholdBillConfig[]>).detail;
      if (detail) setBills(detail);
    };

    window.addEventListener(
      "life-planner:household-bills-updated",
      handleBillsUpdated,
    );
    return () => {
      window.removeEventListener(
        "life-planner:household-bills-updated",
        handleBillsUpdated,
      );
    };
  }, [currentMonthKey]);

  const stats = useMemo(() => {
    return getHouseholdStats(expenses, bills, currentMonthKey);
  }, [expenses, bills, currentMonthKey]);

  // Account map helper
  const accountMap = useMemo(() => {
    return new Map(bankAccounts.map((a) => [a.id, a]));
  }, [bankAccounts]);

  // Grocery budget
  const groceryBudget = useMemo(() => {
    const b = getBudgets();
    return b["Household Groceries"] || b["Belanja Dapur"] || 3000000;
  }, []);

  // Filtered expenses per tab
  const tabExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!isHouseholdExpense(e)) return false;
      const sub = extractHouseholdSubcategory(e);
      if (activeTab === "utilities") {
        return (
          sub === "Listrik PLN" ||
          sub === "Air PDAM" ||
          sub === "Internet & TV" ||
          sub === "Iuran Lingkungan / IPL" ||
          sub === "Gas LPG"
        );
      }
      if (activeTab === "groceries") {
        return sub === "Belanja Dapur & Pokok";
      }
      if (activeTab === "maintenance") {
        return sub === "Perawatan & Servis Rumah";
      }
      return true;
    });
  }, [expenses, activeTab]);

  // Handle Tab Switch
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
  };

  // Quick Action: Open Record Form for Bill / Expense
  const openRecordModal = (preset: {
    subCategory: HouseholdSubcategory;
    title: string;
    defaultAmount?: number;
    tagihanRutin?: boolean;
    dueDate?: string;
  }) => {
    setRecordPreset(preset);
    setRecordAmount(preset.defaultAmount ? String(preset.defaultAmount) : "");
    setRecordDate(new Date().toISOString().slice(0, 10));
    setRecordNotes(preset.title);
    setRecordAccount(bankAccounts[0]?.id || "");
    setAddRecordOpen(true);
  };

  // Submit Expense
  const handleSaveExpense = async () => {
    const userId = pb.authStore.record?.id;
    if (!userId) {
      toast.error("Silakan login kembali.");
      return;
    }

    const amt = Number(recordAmount);
    if (!amt || amt <= 0) {
      toast.error("Masukkan nominal yang valid.");
      return;
    }

    setSavingRecord(true);
    try {
      const sub = recordPreset?.subCategory || "Lainnya";
      const notes = buildHouseholdNotes(
        recordNotes,
        sub,
        Boolean(recordPreset?.tagihanRutin),
      );

      let category = "Bills";
      if (sub === "Belanja Dapur & Pokok") category = "Food";
      else if (sub === "Perawatan & Servis Rumah") category = "Other";

      await pb.collection("expenses").create({
        user: userId,
        type: "Expense",
        amount: amt,
        category,
        date: recordDate,
        notes,
        paid: true,
        account: recordAccount || undefined,
        due_date: recordPreset?.dueDate || undefined,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }

      toast.success("Pengeluaran rumah tangga berhasil dicatat.");
      setAddRecordOpen(false);
      void loadData();
    } catch (err) {
      console.error("Failed to save household expense:", err);
      toast.error("Gagal menyimpan pengeluaran.");
    } finally {
      setSavingRecord(false);
    }
  };

  // Save / Update Recurring Bill Config in PocketBase & Local Cache
  const handleSaveBillConfig = async () => {
    if (!billName.trim()) {
      toast.error("Nama tagihan wajib diisi.");
      return;
    }
    const amt = Number(billAmount) || 0;
    const due = Math.min(Math.max(Number(billDueDay) || 1, 1), 31);

    try {
      await upsertHouseholdBillRemote({
        id: editingBill?.id,
        name: billName.trim(),
        subCategory: billSubCategory,
        defaultAmount: amt,
        dueDay: due,
      });

      const updated = await fetchHouseholdBills();
      setBills(updated);
      setBillConfigOpen(false);
      setEditingBill(null);
      toast.success("Konfigurasi tagihan berhasil disimpan ke cloud.");
    } catch (err) {
      console.error("Failed to save bill config:", err);
      toast.error("Gagal menyimpan konfigurasi tagihan.");
    }
  };

  // Delete Recurring Bill Config in PocketBase & Local Cache
  const handleDeleteBillConfig = async (id: string) => {
    try {
      await deleteHouseholdBillRemote(id);
      const updated = await fetchHouseholdBills();
      setBills(updated);
      toast.success("Tagihan dihapus dari cloud.");
    } catch (err) {
      console.error("Failed to delete bill config:", err);
      toast.error("Gagal menghapus tagihan.");
    }
  };

  // Save Grocery Budget
  const handleSaveGroceryBudget = () => {
    const amt = Number(groceryBudgetAmount);
    if (!amt || amt <= 0) {
      toast.error("Nominal anggaran tidak valid.");
      return;
    }
    const current = getBudgets();
    current["Household Groceries"] = amt;
    saveBudgets(current);
    setGroceryBudgetOpen(false);
    toast.success("Plafon anggaran belanja dapur diperbarui.");
  };

  return (
    <div className="animate-rise space-y-6">
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-ink shadow-xs">
              <Home size={20} className="stroke-[2]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-.03em] text-ink">
                Household Expenses
              </h1>
              <p className="text-xs sm:text-sm text-ink-soft">
                Pemisahan belanja pribadi vs operasional domestik rumah tangga
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={() => setScanOpen(true)}
          >
            <ScanLine size={14} />
            Scan Struk Belanja
          </Button>

          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={() =>
              openRecordModal({
                subCategory: "Listrik PLN",
                title: "Pengeluaran Rumah Tangga",
              })
            }
          >
            <Plus size={14} />
            Catat Pengeluaran
          </Button>
        </div>
      </div>

      {/* =====================================================
          SUMMARY KPI CARDS
          ===================================================== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">
              Total Rumah Tangga
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-ink">
              <Home size={14} />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-ink">
            {formatIDR(stats.householdSpend)}
          </p>
          <p className="mt-1 text-[11px] text-ink-soft">
            {stats.householdRatio}% dari total pengeluaran bulan ini
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">
              Status Tagihan Rutin
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-ink">
              <Zap size={14} />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-ink">
            {stats.paidBillsCount} / {stats.totalBillsCount} Lunas
          </p>
          <p className="mt-1 text-[11px] text-ink-soft">
            {stats.totalBillsCount - stats.paidBillsCount} tagihan menanti jatuh tempo
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">
              Belanja Dapur & Pokok
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-ink">
              <ShoppingBasket size={14} />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-ink">
            {formatIDR(stats.groceriesSpend)}
          </p>
          <p className="mt-1 text-[11px] text-ink-soft">
            Plafon: {formatIDR(groceryBudget)} (
            {Math.round((stats.groceriesSpend / groceryBudget) * 100)}%)
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">
              Perawatan & Servis
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-ink">
              <Wrench size={14} />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-ink">
            {formatIDR(stats.maintenanceSpend)}
          </p>
          <p className="mt-1 text-[11px] text-ink-soft">
            Perbaikan & pemeliharaan berkala
          </p>
        </Card>
      </div>

      {/* =====================================================
          TAB NAVIGATION (WWDC FLUID SPRINGS)
          ===================================================== */}
      <div className="flex items-center gap-1.5 border-b border-line/10 pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                isSelected
                  ? "text-ink font-semibold"
                  : "text-ink-soft hover:text-ink hover:bg-surface/50"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {isSelected && (
                <motion.div
                  layoutId="household-active-tab"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                  transition={{ type: "spring", damping: 30, stiffness: 380 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* =====================================================
          TAB 1: TAGIHAN RUTIN & UTILITAS
          ===================================================== */}
      {activeTab === "utilities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Tagihan Wajib Bulanan
              </h2>
              <p className="text-xs text-ink-soft">
                Pantau tanggal jatuh tempo listrik PLN, PDAM, internet Wi-Fi, dan IPL
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => {
                setEditingBill(null);
                setBillName("");
                setBillSubCategory("Listrik PLN");
                setBillAmount("500000");
                setBillDueDay("20");
                setBillConfigOpen(true);
              }}
            >
              <Plus size={13} />
              Tambah Tagihan
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {stats.billStatuses.map((status) => {
              const Icon = getCategoryIcon(status.bill.subCategory);
              return (
                <Card
                  key={status.bill.id}
                  className="p-4 transition-all hover:border-line/25 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-ink border border-line/10">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-ink">
                            {status.bill.name}
                          </h3>
                          <Badge
                            tone={status.isPaid ? "success" : status.isOverdue ? "danger" : status.isNearDue ? "warning" : "neutral"}
                            className="text-[10px]"
                          >
                            {status.isPaid
                              ? "Lunas Bulan Ini"
                              : status.isOverdue
                                ? "Terlambat"
                                : status.isNearDue
                                  ? `H-${status.daysUntilDue} Jatuh Tempo`
                                  : `Tiap Tgl ${status.bill.dueDay}`}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">
                          Estimasi: {formatIDR(status.bill.defaultAmount)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Edit bill config"
                      onClick={() => {
                        setEditingBill(status.bill);
                        setBillName(status.bill.name);
                        setBillSubCategory(status.bill.subCategory);
                        setBillAmount(String(status.bill.defaultAmount));
                        setBillDueDay(String(status.bill.dueDay));
                        setBillConfigOpen(true);
                      }}
                      className="text-ink-faint hover:text-ink p-1 rounded-md"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-line/10 pt-3">
                    <div className="text-xs text-ink-soft">
                      {status.isPaid ? (
                        <div className="flex items-center gap-1.5 text-positive font-medium">
                          <CheckCircle2 size={13} />
                          <span>
                            Dibayar {formatDate(status.paidDate)} (
                            {formatIDR(status.paidAmount || 0)})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-ink-faint" />
                          <span>Jatuh tempo: {formatDate(status.dueDateStr)}</span>
                        </div>
                      )}
                    </div>

                    {!status.isPaid && (
                      <Button
                        size="sm"
                        className="text-xs h-8 px-3 gap-1.5"
                        onClick={() =>
                          openRecordModal({
                            subCategory: status.bill.subCategory,
                            title: status.bill.name,
                            defaultAmount: status.bill.defaultAmount,
                            tagihanRutin: true,
                            dueDate: status.dueDateStr,
                          })
                        }
                      >
                        <Check size={13} />
                        Tandai Lunas
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================
          TAB 2: BELANJA DAPUR & POKOK
          ===================================================== */}
      {activeTab === "groceries" && (
        <div className="space-y-4">
          {/* BUDGET VS ACTUAL SPENDING PROGRESS */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Plafon Anggaran Dapur Bulanan
                </h3>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Realisasi belanja sembako dan kebutuhan konsumsi harian
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5"
                  onClick={() => {
                    setGroceryBudgetAmount(String(groceryBudget));
                    setGroceryBudgetOpen(true);
                  }}
                >
                  <Settings2 size={13} />
                  Atur Plafon
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5"
                  onClick={() => setScanOpen(true)}
                >
                  <ScanLine size={13} />
                  Scan Struk Supermarket
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">
                  Terpakai: {formatIDR(stats.groceriesSpend)}
                </span>
                <span className="text-ink-soft">
                  Sisa Plafon: {formatIDR(Math.max(groceryBudget - stats.groceriesSpend, 0))}
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    stats.groceriesSpend > groceryBudget
                      ? "bg-negative"
                      : "bg-accent"
                  }`}
                  style={{
                    width: `${Math.min(
                      Math.round((stats.groceriesSpend / groceryBudget) * 100),
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* LIST OF GROCERIES TRANSACTIONS */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/10 p-4">
              <h3 className="text-sm font-semibold text-ink">
                Riwayat Belanja Dapur Bulan Ini
              </h3>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                onClick={() =>
                  openRecordModal({
                    subCategory: "Belanja Dapur & Pokok",
                    title: "Belanja Supermarket / Pasar",
                  })
                }
              >
                <Plus size={13} />
                Catat Belanja
              </Button>
            </div>

            {tabExpenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-soft">
                Belum ada transaksi belanja dapur tercatat bulan ini.
              </div>
            ) : (
              <div className="divide-y divide-line/10">
                {tabExpenses.map((exp) => {
                  const account = exp.account
                    ? accountMap.get(exp.account)
                    : undefined;
                  return (
                    <div
                      key={exp.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {cleanHouseholdNotes(exp.notes) || "Belanja Dapur"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {formatDate(exp.date)}
                          {account && ` · ${account.bank_name}`}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        −{formatIDR(exp.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* =====================================================
          TAB 3: PERAWATAN & SERVIS RUMAH
          ===================================================== */}
      {activeTab === "maintenance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Log Perawatan & Servis Rumah
              </h2>
              <p className="text-xs text-ink-soft">
                Pencatatan servis AC berkala, perbaikan pipa, atap bocor, dan kelistrikan
              </p>
            </div>

            <Button
              size="sm"
              className="text-xs gap-1.5"
              onClick={() =>
                openRecordModal({
                  subCategory: "Perawatan & Servis Rumah",
                  title: "Servis AC / Perbaikan Rumah",
                })
              }
            >
              <Plus size={13} />
              Catat Servis Baru
            </Button>
          </div>

          <Card className="overflow-hidden">
            {tabExpenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-soft">
                Belum ada riwayat perbaikan atau perawatan rumah yang dicatat.
              </div>
            ) : (
              <div className="divide-y divide-line/10">
                {tabExpenses.map((exp) => {
                  const account = exp.account
                    ? accountMap.get(exp.account)
                    : undefined;
                  return (
                    <div
                      key={exp.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-ink border border-line/10">
                          <Wrench size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {cleanHouseholdNotes(exp.notes) || "Perawatan Rumah"}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            Tanggal: {formatDate(exp.date)}
                            {account && ` · Rekening: ${account.bank_name}`}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-ink">
                        −{formatIDR(exp.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* =====================================================
          TAB 4: KOLABORASI & BAGI TAGIHAN (SPLIT BILL)
          ===================================================== */}
      {activeTab === "collaboration" && (
        <div className="space-y-4">
          <HouseholdSettlementCard />
        </div>
      )}

      {/* =====================================================
          RECORD FORM MODAL
          ===================================================== */}
      <Dialog
        open={addRecordOpen}
        onOpenChange={setAddRecordOpen}
        title={recordPreset?.title || "Catat Pengeluaran Rumah Tangga"}
      >
        <div className="space-y-4">
          <div>
            <Label>Kategori Kebutuhan</Label>
            <p className="text-xs font-medium text-ink bg-muted px-3 py-2 rounded-lg border border-line/10">
              🏠 {recordPreset?.subCategory}
            </p>
          </div>

          <div>
            <Label>Nominal Pengeluaran</Label>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={recordAmount}
              onChange={(e) => setRecordAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label>Tanggal Pembayaran</Label>
            <Input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Keterangan / Catatan</Label>
            <Input
              value={recordNotes}
              onChange={(e) => setRecordNotes(e.target.value)}
              placeholder="Misal: Token Listrik 500rb / Servis 2 unit AC"
            />
          </div>

          {bankAccounts.length > 0 && (
            <div>
              <Label>Sumber Rekening / Dompet</Label>
              <Select
                value={recordAccount || "none"}
                onValueChange={(val) => setRecordAccount(val === "none" ? "" : val)}
              >
                <SelectItem value="none">Tanpa rekening spesifik</SelectItem>
                {bankAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.bank_name} · {a.account_name}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
            <Button
              variant="outline"
              onClick={() => setAddRecordOpen(false)}
            >
              Batal
            </Button>
            <Button
              disabled={savingRecord}
              onClick={() => void handleSaveExpense()}
            >
              {savingRecord ? "Menyimpan…" : "Simpan Transaksi"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* =====================================================
          BILL CONFIG MODAL
          ===================================================== */}
      <Dialog
        open={billConfigOpen}
        onOpenChange={setBillConfigOpen}
        title={editingBill ? "Ubah Konfigurasi Tagihan" : "Tambah Tagihan Rutin"}
      >
        <div className="space-y-4">
          <div>
            <Label>Nama Tagihan</Label>
            <Input
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              placeholder="Misal: Listrik PLN Token / Wi-Fi Indihome"
            />
          </div>

          <div>
            <Label>Subkategori</Label>
            <Select
              value={billSubCategory}
              onValueChange={(val) => setBillSubCategory(val as HouseholdSubcategory)}
            >
              {HOUSEHOLD_SUBCATEGORIES.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {sub}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div>
            <Label>Estimasi Nominal Bulanan</Label>
            <Input
              type="number"
              min="0"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label>Tanggal Jatuh Tempo Tiap Bulan (1–31)</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={billDueDay}
              onChange={(e) => setBillDueDay(e.target.value)}
              placeholder="20"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line/10">
            {editingBill ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  handleDeleteBillConfig(editingBill.id);
                  setBillConfigOpen(false);
                }}
              >
                Hapus
              </Button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setBillConfigOpen(false)}
              >
                Batal
              </Button>
              <Button onClick={handleSaveBillConfig}>
                Simpan
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* =====================================================
          GROCERY BUDGET MODAL
          ===================================================== */}
      <Dialog
        open={groceryBudgetOpen}
        onOpenChange={setGroceryBudgetOpen}
        title="Atur Plafon Belanja Dapur Bulanan"
      >
        <div className="space-y-4">
          <div>
            <Label>Plafon Anggaran Belanja Dapur</Label>
            <Input
              type="number"
              min="0"
              value={groceryBudgetAmount}
              onChange={(e) => setGroceryBudgetAmount(e.target.value)}
              placeholder="3000000"
            />
            <p className="mt-1 text-xs text-ink-soft">
              Plafon ini digunakan untuk memantau pengeluaran sembako dan logistik dapur bulanan.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
            <Button
              variant="outline"
              onClick={() => setGroceryBudgetOpen(false)}
            >
              Batal
            </Button>
            <Button onClick={handleSaveGroceryBudget}>
              Simpan Plafon
            </Button>
          </div>
        </div>
      </Dialog>

      {/* =====================================================
          SCAN RECEIPT MODAL INTEGRATION
          ===================================================== */}
      <ScanBillDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        bankAccounts={bankAccounts}
        defaultCategory="Food"
        notePrefix="[Household] [Belanja Dapur & Pokok]"
        onSaved={() => void loadData()}
      />
    </div>
  );
}
