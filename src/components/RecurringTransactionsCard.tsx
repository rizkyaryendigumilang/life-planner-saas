import React, { useState } from "react";
import {
  CalendarClock,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { pb } from "../lib/pocketbase";
import {
  type RecurringScheduleItem,
  evaluateRecurringSchedules,
  buildExpenseFromRecurring,
} from "../lib/recurring-engine";

interface RecurringTransactionsCardProps {
  items?: RecurringScheduleItem[];
  onTransactionCreated?: () => void;
}

export const RecurringTransactionsCard: React.FC<RecurringTransactionsCardProps> = ({
  items = [],
  onTransactionCreated,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Default sample recurring templates if user has none configured
  const activeItems: RecurringScheduleItem[] =
    items.length > 0
      ? items
      : [
          {
            id: "rec_netflix",
            user: pb.authStore.model?.id || "guest",
            title: "Langganan Netflix Premium",
            amount: 186000,
            category: "Entertainment",
            frequency: "monthly",
            dueDay: 18,
            autoDeduct: true,
            active: true,
          },
          {
            id: "rec_wifi",
            user: pb.authStore.model?.id || "guest",
            title: "Tagihan Internet Fiber",
            amount: 375000,
            category: "Utilities",
            frequency: "monthly",
            dueDay: 20,
            autoDeduct: false,
            active: true,
          },
          {
            id: "rec_gym",
            user: pb.authStore.model?.id || "guest",
            title: "Membership Gym Kebugaran",
            amount: 250000,
            category: "Healthcare",
            frequency: "monthly",
            dueDay: 25,
            autoDeduct: false,
            active: true,
          },
        ];

  const evaluation = evaluateRecurringSchedules(activeItems);

  const handleRecordExpense = async (item: RecurringScheduleItem) => {
    if (!pb.authStore.model?.id) return;
    setProcessingId(item.id);

    try {
      const payload = buildExpenseFromRecurring({
        ...item,
        user: pb.authStore.model.id,
      });

      await pb.collection("expenses").create(payload);

      setSuccessId(item.id);
      setTimeout(() => setSuccessId(null), 2500);

      if (onTransactionCreated) {
        onTransactionCreated();
      }
    } catch (err) {
      console.error("Gagal mencatat transaksi berulang:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="rounded-3xl p-5 sm:p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Langganan & Tagihan Rutin
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h3>
            <p className="text-xs text-zinc-500">
              Otomasi pencatatan tagihan bulanan berulang
            </p>
          </div>
        </div>

        {evaluation.dueSoon.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {evaluation.dueSoon.length} Jatuh Tempo
          </span>
        )}
      </div>

      {/* List of items */}
      <div className="space-y-2.5">
        {activeItems.map((item) => {
          const isDone = successId === item.id;
          const isLoading = processingId === item.id;

          return (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5 flex items-center justify-between hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition"
            >
              <div className="min-w-0 pr-3">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {item.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                  <span>Tgl {item.dueDay} setiap bulan</span>
                  <span>•</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {formatRupiah(item.amount)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRecordExpense(item)}
                disabled={isLoading || isDone}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90"
                }`}
              >
                {isDone ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Tercatat
                  </>
                ) : (
                  <>
                    Catat
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
