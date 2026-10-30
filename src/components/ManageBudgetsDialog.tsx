import { useState, useEffect, useMemo } from "react";
import { Dialog, Button, Input, Badge } from "./ui";
import { formatIDR } from "../lib/utils";
import { EXPENSE_CATEGORIES } from "../lib/categories";
import { type CategoryBudgets, saveBudgets } from "../lib/budgets";
import { PiggyBank, Search, Check, Trash2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

interface ManageBudgetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBudgets: CategoryBudgets;
  categorySpending?: Map<string, number>;
  onSaved?: (budgets: CategoryBudgets) => void;
}

export function ManageBudgetsDialog({
  open,
  onOpenChange,
  currentBudgets,
  categorySpending = new Map(),
  onSaved,
}: ManageBudgetsDialogProps) {
  // Hanya kategori pengeluaran (tidak menyertakan Salary)
  const budgetableCategories = useMemo(
    () => EXPENSE_CATEGORIES.filter((c) => c !== "Salary"),
    [],
  );

  const [draftBudgets, setDraftBudgets] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  // Sinkronisasi saat dialog dibuka
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      budgetableCategories.forEach((cat) => {
        initial[cat] = currentBudgets[cat] ? String(currentBudgets[cat]) : "";
      });
      setDraftBudgets(initial);
      setSearch("");
    }
  }, [open, currentBudgets, budgetableCategories]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return budgetableCategories;
    return budgetableCategories.filter((c) => c.toLowerCase().includes(q));
  }, [search, budgetableCategories]);

  const handleValueChange = (cat: string, val: string) => {
    // Hanya angka
    const clean = val.replace(/\D/g, "");
    setDraftBudgets((prev) => ({ ...prev, [cat]: clean }));
  };

  const handleQuickAdd = (cat: string, amount: number) => {
    const current = Number(draftBudgets[cat] || 0);
    const next = current + amount;
    setDraftBudgets((prev) => ({ ...prev, [cat]: String(next) }));
  };

  const handleClear = (cat: string) => {
    setDraftBudgets((prev) => ({ ...prev, [cat]: "" }));
  };

  const handleSave = () => {
    const cleaned: CategoryBudgets = {};
    for (const [cat, val] of Object.entries(draftBudgets)) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) {
        cleaned[cat] = num;
      }
    }

    saveBudgets(cleaned);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }

    toast.success("Batas anggaran kategori berhasil disimpan.");
    onSaved?.(cleaned);
    onOpenChange(false);
  };

  const totalSet = Object.values(draftBudgets).filter((v) => Number(v) > 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atur Batas Anggaran Kategori"
      description="Tentukan batas pengeluaran bulanan per kategori. Kategori bersifat opsional: kosongkan atau nol jika tidak ingin membatasi."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Search & Active Info */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-3 text-ink-soft" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kategori..."
              className="pl-9 text-xs"
            />
          </div>
          <Badge tone={totalSet > 0 ? "accent" : "neutral"} className="w-fit">
            <SlidersHorizontal size={12} className="mr-1" />
            {totalSet} dari {budgetableCategories.length} Diatur
          </Badge>
        </div>

        {/* Categories List */}
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {filteredCategories.map((cat) => {
            const currentSpent = categorySpending.get(cat) || 0;
            const budgetVal = draftBudgets[cat] || "";
            const numVal = Number(budgetVal);
            const hasBudget = numVal > 0;

            return (
              <div
                key={cat}
                className={`rounded-xl border p-3.5 transition-all ${
                  hasBudget
                    ? "border-line/25 bg-surface shadow-xs"
                    : "border-line/10 bg-muted/20 hover:border-line/20"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{cat}</span>
                      {hasBudget && (
                        <Badge tone="success" className="text-[10px] py-0 px-1.5">
                          Aktif
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Pengeluaran bulan ini:{" "}
                      <span className="font-medium text-ink tabular-nums">
                        {formatIDR(currentSpent)}
                      </span>
                    </p>
                  </div>

                  {/* Input & Quick Helpers */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative w-40">
                      <span className="absolute left-2.5 top-2.5 text-xs text-ink-soft">
                        Rp
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={budgetVal ? Number(budgetVal).toLocaleString("id-ID") : ""}
                        onChange={(e) => handleValueChange(cat, e.target.value)}
                        placeholder="Tidak dibatasi"
                        className="pl-8 text-right text-xs font-semibold tabular-nums"
                      />
                    </div>
                    {hasBudget && (
                      <button
                        type="button"
                        onClick={() => handleClear(cat)}
                        title="Hapus batasan anggaran"
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-line/10 hover:text-negative transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Add Pills */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/10">
                  <span className="text-[11px] text-ink-soft mr-1">Cepat tambah:</span>
                  {[200000, 500000, 1000000, 2000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(cat, amt)}
                      className="rounded-md border border-line/15 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-ink-soft hover:bg-muted hover:text-ink transition"
                    >
                      +{amt >= 1000000 ? `${amt / 1000000}jt` : `${amt / 1000}rb`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-line/10 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button type="button" size="sm" onClick={handleSave} className="gap-1.5">
            <Check size={14} />
            Simpan Anggaran
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
