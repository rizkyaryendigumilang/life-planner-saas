import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Home,
  Plus,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, Skeleton } from "./ui";
import { formatIDR, formatDate } from "../lib/utils";
import {
  getHouseholdBills,
  fetchHouseholdBills,
  getHouseholdStats,
  type HouseholdBillConfig,
} from "../lib/household";
import type { BankAccount, Expense } from "../types";
import { pb } from "../lib/pocketbase";
import { toast } from "sonner";

type HouseholdPulseCardProps = {
  expenses: Expense[];
  loading?: boolean;
  bankAccounts?: BankAccount[];
  onRefresh?: () => void;
};

export function HouseholdPulseCard({
  expenses,
  loading = false,
  bankAccounts = [],
  onRefresh,
}: HouseholdPulseCardProps) {
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [bills, setBills] = useState<HouseholdBillConfig[]>(() => getHouseholdBills());

  useEffect(() => {
    void fetchHouseholdBills().then(setBills);

    const onBillsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<HouseholdBillConfig[]>).detail;
      if (detail) setBills(detail);
    };
    window.addEventListener("life-planner:household-bills-updated", onBillsUpdated);
    return () => window.removeEventListener("life-planner:household-bills-updated", onBillsUpdated);
  }, []);

  const stats = useMemo(() => {
    return getHouseholdStats(expenses, bills);
  }, [expenses, bills]);

  const handleMarkPaid = async (bill: HouseholdBillConfig) => {
    const userId = pb.authStore.record?.id;
    if (!userId) {
      toast.error("Silakan login kembali.");
      return;
    }

    setMarkingPaidId(bill.id);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const defaultAccount = bankAccounts[0]?.id;

      await pb.collection("expenses").create({
        user: userId,
        type: "Expense",
        amount: bill.defaultAmount,
        category: "Bills",
        date: todayStr,
        notes: `[Household] [Tagihan Rutin] [${bill.subCategory}] ${bill.name}`,
        paid: true,
        account: defaultAccount || undefined,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }

      toast.success(`${bill.name} berhasil ditandai lunas.`);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to mark bill as paid:", err);
      toast.error("Gagal menandai tagihan lunas.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const navigateToHousehold = () => {
    window.dispatchEvent(
      new CustomEvent("life-planner:navigate", { detail: "household" }),
    );
  };

  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-4" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  // Sifat Adaptif: Jika pengguna belum pernah mencatat pengeluaran Household
  if (!stats.hasHouseholdData && stats.householdSpend === 0) {
    return (
      <Card className="p-5 relative overflow-hidden transition-all duration-200 hover:border-line/25">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft border border-line/10">
              <Home size={18} className="stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-ink">
                  Household Expenses
                </h3>
                <Badge tone="neutral" className="text-[10px]">
                  Opsional
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-soft max-w-md leading-relaxed">
                Pisahkan pengeluaran pribadi dengan operasional domestik (listrik,
                air, internet, belanja dapur, servis rumah).
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs shrink-0 self-start sm:self-auto gap-1.5"
            onClick={navigateToHousehold}
          >
            Mulai Pantau
            <ArrowRight size={13} />
          </Button>
        </div>
      </Card>
    );
  }

  const { nearestDueBill } = stats;

  return (
    <Card className="p-5 relative overflow-hidden">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-line/10">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-ink border border-line/10">
            <Home size={16} />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-ink">Household Pulse</h2>
            <p className="text-xs text-ink-soft">
              Pemisahan belanja pribadi vs domestik & kontrol tagihan
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={navigateToHousehold}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink transition-colors"
        >
          Buka Household Hub
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* SPENDING RATIO VISUALIZATION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-ink-soft">Rasio Pengeluaran Bulan Ini</span>
            <span className="text-ink">
              {stats.personalRatio}% Pribadi · {stats.householdRatio}% Rumah Tangga
            </span>
          </div>

          {/* DUAL RATIO BAR */}
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${stats.personalRatio}%` }}
              className="bg-ink/70 transition-all duration-300"
              title={`Pribadi: ${formatIDR(stats.personalSpend)} (${stats.personalRatio}%)`}
            />
            <div
              style={{ width: `${stats.householdRatio}%` }}
              className="bg-accent transition-all duration-300"
              title={`Rumah Tangga: ${formatIDR(stats.householdSpend)} (${stats.householdRatio}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink/70" />
              <span className="text-ink-soft">Pribadi:</span>
              <span className="font-semibold text-ink">
                {formatIDR(stats.personalSpend)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-ink-soft">Rumah Tangga:</span>
              <span className="font-semibold text-ink">
                {formatIDR(stats.householdSpend)}
              </span>
            </div>
          </div>
        </div>

        {/* BILLS STATUS & NEAREST DUE ALERT */}
        <div className="space-y-3 rounded-xl bg-muted/40 p-3.5 border border-line/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <CheckCircle2 size={14} className="text-positive" />
              <span>
                {stats.paidBillsCount} dari {stats.totalBillsCount} tagihan lunas
              </span>
            </div>
            <Badge
              tone={
                stats.paidBillsCount === stats.totalBillsCount
                  ? "success"
                  : "neutral"
              }
              className="text-[10px]"
            >
              {stats.paidBillsCount === stats.totalBillsCount
                ? "Semua Lunas"
                : `${stats.totalBillsCount - stats.paidBillsCount} Menunggu`}
            </Badge>
          </div>

          {/* SMART DUE DATE ALERT */}
          {nearestDueBill ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      nearestDueBill.isOverdue
                        ? "bg-negative animate-pulse"
                        : nearestDueBill.isNearDue
                          ? "bg-caution animate-pulse"
                          : "bg-ink-faint"
                    }`}
                  />
                  <p className="text-xs font-semibold text-ink truncate">
                    {nearestDueBill.bill.name}
                  </p>
                </div>
                <p className="text-[11px] text-ink-soft mt-0.5">
                  {nearestDueBill.isOverdue ? (
                    <span className="text-negative font-medium">
                      Jatuh tempo terlewati ({formatDate(nearestDueBill.dueDateStr)})
                    </span>
                  ) : nearestDueBill.isNearDue ? (
                    <span className="text-caution font-medium">
                      Jatuh tempo H-{nearestDueBill.daysUntilDue} (
                      {formatDate(nearestDueBill.dueDateStr)})
                    </span>
                  ) : (
                    <span>Jatuh tempo: {formatDate(nearestDueBill.dueDateStr)}</span>
                  )}
                  {" · "}
                  {formatIDR(nearestDueBill.bill.defaultAmount)}
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2.5 shrink-0 gap-1 border-line/20 hover:bg-surface"
                disabled={markingPaidId === nearestDueBill.bill.id}
                onClick={() => void handleMarkPaid(nearestDueBill.bill)}
              >
                {markingPaidId === nearestDueBill.bill.id
                  ? "Menyimpan…"
                  : "Tandai Lunas"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1 text-xs text-ink-soft">
              <CheckCircle2 size={13} className="text-positive" />
              <span>Semua tagihan rutin bulan ini telah selesai dibayar.</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
