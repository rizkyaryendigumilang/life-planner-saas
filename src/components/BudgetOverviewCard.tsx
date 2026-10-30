import { useState, useMemo } from "react";
import { Card, Button, Badge } from "./ui";
import { formatIDR } from "../lib/utils";
import { EXPENSE_CATEGORIES } from "../lib/categories";
import { type CategoryBudgets } from "../lib/budgets";
import { PiggyBank, SlidersHorizontal, AlertTriangle, CheckCircle2, Plus } from "lucide-react";

interface BudgetOverviewCardProps {
  budgets: CategoryBudgets;
  categorySpending: Map<string, number>;
  selectedMonthLabel?: string;
  onOpenManage: () => void;
}

export function BudgetOverviewCard({
  budgets,
  categorySpending,
  selectedMonthLabel = "Bulan Ini",
  onOpenManage,
}: BudgetOverviewCardProps) {
  const [showAll, setShowAll] = useState(false);

  const budgetableCategories = useMemo(
    () => EXPENSE_CATEGORIES.filter((c) => c !== "Salary"),
    [],
  );

  // Kategori yang memiliki budget > 0
  const activeBudgetEntries = useMemo(() => {
    return Object.entries(budgets)
      .filter(([_, limit]) => limit > 0)
      .map(([cat, limit]) => {
        const spent = categorySpending.get(cat) || 0;
        const percentage = Math.round((spent / limit) * 100);
        const remaining = limit - spent;
        return {
          category: cat,
          limit,
          spent,
          percentage,
          remaining,
          isOverbudget: spent > limit,
        };
      })
      .sort((a, b) => b.percentage - a.percentage); // Urutkan dari persentase terbesar
  }, [budgets, categorySpending]);

  // Total statistik untuk kategori yang dianggarkan
  const summary = useMemo(() => {
    const totalBudget = activeBudgetEntries.reduce((sum, item) => sum + item.limit, 0);
    const totalSpent = activeBudgetEntries.reduce((sum, item) => sum + item.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const overbudgetCount = activeBudgetEntries.filter((item) => item.isOverbudget).length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overallPercentage,
      overbudgetCount,
    };
  }, [activeBudgetEntries]);

  // Kategori yang belum memiliki anggaran
  const unbudgetedCategories = useMemo(() => {
    return budgetableCategories
      .filter((cat) => !budgets[cat] || budgets[cat] <= 0)
      .map((cat) => ({
        category: cat,
        spent: categorySpending.get(cat) || 0,
      }))
      .filter((item) => item.spent > 0); // Kategori yang ada pengeluarannya tapi belum di-budget
  }, [budgetableCategories, budgets, categorySpending]);

  const hasAnyBudgets = activeBudgetEntries.length > 0;

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent-ink">
              <PiggyBank size={16} />
            </div>
            <h2 className="font-semibold text-ink">Batas Anggaran Bulanan</h2>
            {hasAnyBudgets && (
              <Badge tone={summary.overbudgetCount > 0 ? "danger" : "neutral"} className="text-xs">
                {activeBudgetEntries.length} Kategori
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Realisasi pengeluaran per kategori untuk periode {selectedMonthLabel}.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onOpenManage}
          className="gap-1.5 self-start sm:self-auto text-xs"
        >
          <SlidersHorizontal size={14} />
          {hasAnyBudgets ? "Atur Anggaran" : "Atur Batas Anggaran"}
        </Button>
      </div>

      {/* Content */}
      {!hasAnyBudgets ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-ink-soft mb-3 shadow-xs">
            <PiggyBank size={24} className="stroke-[1.5]" />
          </div>
          <p className="text-sm font-semibold text-ink">Belum Ada Batas Anggaran</p>
          <p className="mt-1 text-xs text-ink-soft max-w-sm">
            Batas anggaran bersifat opsional. Anda dapat menetapkan batas belanja untuk kategori tertentu saja (misal: Makanan, Belanja, Hiburan) untuk membantu mengontrol pengeluaran.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenManage}
            className="mt-4 gap-1.5 text-xs"
          >
            <Plus size={14} />
            Mulai Atur Anggaran
          </Button>
        </div>
      ) : (
        /* Budget Dashboard */
        <div className="mt-5 space-y-5">
          {/* Summary Metric Strip */}
          <div className="rounded-xl border border-line/15 bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-medium text-ink-soft">Total Anggaran Terpasang</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
                    {formatIDR(summary.totalSpent)}
                  </span>
                  <span className="text-xs text-ink-soft tabular-nums">
                    / {formatIDR(summary.totalBudget)}
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-[11px] font-medium text-ink-soft">Sisa Anggaran Gabungan</p>
                <p
                  className={`mt-1 text-base font-bold tabular-nums ${
                    summary.totalRemaining >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {summary.totalRemaining >= 0 ? "+" : ""}
                  {formatIDR(summary.totalRemaining)}
                </p>
              </div>
            </div>

            {/* Total Utilization Progress Bar */}
            <div className="mt-3.5 space-y-1.5">
              <div className="flex justify-between text-[11px] text-ink-soft">
                <span>Penggunaan Anggaran</span>
                <span className="font-semibold text-ink tabular-nums">
                  {summary.overallPercentage}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    summary.overallPercentage > 100
                      ? "bg-rose-500"
                      : summary.overallPercentage > 75
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(summary.overallPercentage, 100)}%` }}
                />
              </div>
            </div>

            {summary.overbudgetCount > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  Perhatian: Terdapat <strong>{summary.overbudgetCount} kategori</strong> yang telah melebihi batas anggaran bulan ini.
                </span>
              </div>
            )}
          </div>

          {/* List of Active Category Budgets */}
          <div className="grid gap-3 sm:grid-cols-2">
            {activeBudgetEntries.map((item) => {
              const isOver = item.isOverbudget;
              const isNear = item.percentage >= 75 && !isOver;

              return (
                <div
                  key={item.category}
                  className={`rounded-xl border p-3.5 transition-all ${
                    isOver
                      ? "border-rose-500/30 bg-rose-500/5 shadow-xs"
                      : "border-line/15 bg-surface hover:border-line/25"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{item.category}</span>
                    <Badge
                      tone={isOver ? "danger" : isNear ? "warning" : "success"}
                      className="text-[10px] tabular-nums"
                    >
                      {item.percentage}%
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOver
                          ? "bg-rose-500"
                          : isNear
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>

                  {/* Numbers */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-ink font-medium tabular-nums">
                      {formatIDR(item.spent)}{" "}
                      <span className="text-ink-soft text-[11px]">/ {formatIDR(item.limit)}</span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        isOver ? "text-negative" : "text-ink-soft"
                      }`}
                    >
                      {isOver
                        ? `Over +${formatIDR(Math.abs(item.remaining))}`
                        : `Sisa ${formatIDR(item.remaining)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unbudgeted Active Categories (Suggestions) */}
          {unbudgetedCategories.length > 0 && (
            <div className="border-t border-line/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-soft">
                  Kategori lain dengan pengeluaran bulan ini ({unbudgetedCategories.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {showAll ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>

              {showAll && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {unbudgetedCategories.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between rounded-lg border border-dashed border-line/15 bg-muted/10 p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-medium text-ink">{item.category}</span>
                        <p className="text-[11px] text-ink-soft tabular-nums">
                          Terpakai {formatIDR(item.spent)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenManage}
                        className="text-[11px] font-medium text-accent hover:underline"
                      >
                        + Atur batas
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
