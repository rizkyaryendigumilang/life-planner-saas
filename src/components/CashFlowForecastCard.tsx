import React from "react";
import {
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Flame,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  computeBurnRate,
  computeRunway,
  projectMonthEndBalance,
  detectSpendingAnomalies,
  type ExpenseRecord,
} from "../lib/financial-analytics";

interface CashFlowForecastCardProps {
  expenses: ExpenseRecord[];
  totalBalance: number;
}

export const CashFlowForecastCard: React.FC<CashFlowForecastCardProps> = ({
  expenses = [],
  totalBalance = 0,
}) => {
  const burn = computeBurnRate(expenses, 90);
  const runway = computeRunway(totalBalance, burn.monthlyBurnRate);
  const projection = projectMonthEndBalance(totalBalance, expenses);
  const anomalies = detectSpendingAnomalies(expenses, 1.35);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = () => {
    switch (runway.status) {
      case "healthy":
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />,
          label: `${runway.runwayMonths} Bulan (Aman)`,
          className:
            "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
          label: `${runway.runwayMonths} Bulan (Waspada)`,
          className:
            "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
        };
      case "critical":
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />,
          label: `${runway.runwayMonths} Bulan (Kritis)`,
          className:
            "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
        };
      default:
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />,
          label: "Dana Tak Terbatas",
          className:
            "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="rounded-3xl p-5 sm:p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Proyeksi Arus Kas & Runway
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </h3>
            <p className="text-xs text-zinc-500">
              Analisis prediktif ketahanan dana & proyeksi akhir bulan
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 ${badge.className}`}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-500" />
            Burn Rate Bulanan
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            {formatRupiah(burn.monthlyBurnRate)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            ~{formatRupiah(burn.dailyBurnRate)} / hari
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5">
          <div className="text-[11px] text-zinc-500">Estimasi Saldo Akhir Bulan</div>
          <div
            className={`text-sm font-semibold mt-1 ${
              projection.projectedNetEndingBalance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatRupiah(projection.projectedNetEndingBalance)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Berdasarkan tren MTD
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5 col-span-2 sm:col-span-1">
          <div className="text-[11px] text-zinc-500">Total Pengeluaran 90 Hari</div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            {formatRupiah(burn.totalSpent)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            {expenses.length} transaksi dianalisis
          </div>
        </div>
      </div>

      {/* Anomaly Alerts if any */}
      {anomalies.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Deteksi Lonjakan Pengeluaran (14 Hari Terakhir):
          </div>
          <div className="space-y-1 pt-0.5">
            {anomalies.slice(0, 2).map((a) => (
              <div
                key={a.category}
                className="text-[11px] text-amber-700 dark:text-amber-400 flex justify-between"
              >
                <span>Kategori {a.category}</span>
                <span className="font-semibold">+{a.spikePercentage}% vs baseline</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
