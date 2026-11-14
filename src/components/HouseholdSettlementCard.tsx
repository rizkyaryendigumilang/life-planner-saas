import React, { useState } from "react";
import {
  Users2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Scale,
} from "lucide-react";
import {
  generateHouseholdInviteCode,
  calculateHouseholdSettlements,
  type SharedBill,
} from "../lib/household-collaboration";

interface HouseholdSettlementCardProps {
  bills?: SharedBill[];
  members?: string[];
}

export const HouseholdSettlementCard: React.FC<HouseholdSettlementCardProps> = ({
  bills = [],
  members = ["Saya", "Pasangan"],
}) => {
  const [inviteCode] = useState(() => generateHouseholdInviteCode());
  const [copied, setCopied] = useState(false);

  // Default sample shared bills if none passed
  const activeBills: SharedBill[] =
    bills.length > 0
      ? bills
      : [
          {
            id: "hb_1",
            title: "Belanja Dapur & Groceries",
            amount: 450000,
            paidBy: members[0] || "Saya",
            splitBetween: members,
            date: new Date().toISOString().slice(0, 10),
          },
          {
            id: "hb_2",
            title: "Tagihan Listrik PLN",
            amount: 250000,
            paidBy: members[1] || "Pasangan",
            splitBetween: members,
            date: new Date().toISOString().slice(0, 10),
          },
        ];

  const { balances, settlements } = calculateHouseholdSettlements(activeBills, members);

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Users2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Kolaborasi & Pelunasan Rumah Tangga
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </h3>
            <p className="text-xs text-zinc-500">
              Pemisahan pengeluaran adil & penyelesaian saldo antar anggota
            </p>
          </div>
        </div>

        {/* Invite Code Pill */}
        <div className="flex items-center gap-1.5 p-1 px-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-black/5 dark:border-white/5">
          <span className="text-[10px] text-zinc-400 font-medium">Kode Keluarga:</span>
          <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
            {inviteCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition"
            title="Salin kode"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Member Balances Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {balances.map((b) => (
          <div
            key={b.member}
            className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5 flex flex-col justify-between"
          >
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {b.member}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[10px] text-zinc-400">Posisi Bersih:</span>
              <span
                className={`text-xs font-bold ${
                  b.netBalance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {b.netBalance >= 0 ? "+" : ""}
                {formatRupiah(b.netBalance)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Settlement Advice */}
      {settlements.length > 0 ? (
        <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Instruksi Penyelesaian Saldo:
          </div>
          <div className="space-y-1.5 pt-0.5">
            {settlements.map((s, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{s.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{s.to}</span>
                </div>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {formatRupiah(s.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 text-center text-xs text-zinc-500">
          Saldo pengeluaran bersama sudah seimbang (Rp 0).
        </div>
      )}

      {/* Privacy guarantee */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>Rekening bank pribadi & aset investasi tetap 100% rahasia untuk tiap anggota.</span>
      </div>
    </div>
  );
};
