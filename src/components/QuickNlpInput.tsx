import React, { useState } from "react";
import { Sparkles, ArrowRight, CheckCircle2, CornerDownLeft } from "lucide-react";
import { pb } from "../lib/pocketbase";
import { parseNaturalLanguageTransaction, type ParsedTransaction } from "../lib/nlp-transaction";

interface QuickNlpInputProps {
  onSuccess?: () => void;
}

export const QuickNlpInput: React.FC<QuickNlpInputProps> = ({ onSuccess }) => {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const parsed: ParsedTransaction | null = text.trim().length > 3
    ? parseNaturalLanguageTransaction(text)
    : null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parsed || parsed.amount <= 0 || !pb.authStore.model?.id) return;

    setIsSubmitting(true);
    try {
      await pb.collection("expenses").create({
        user: pb.authStore.model.id,
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        notes: parsed.notes,
        date: parsed.date,
      });

      setText("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Gagal menyimpan transaksi via NLP:", err);
    } finally {
      setIsSubmitting(false);
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
    <div className="w-full rounded-2xl bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-black/5 dark:border-white/10 p-2.5 sm:p-3 shadow-sm transition hover:border-black/10 dark:hover:border-white/20">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ketik bebas: "Kopi janji jiwa 25rb bca" atau "Gaji 15jt bca"...'
            className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />

          {parsed && parsed.amount > 0 && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              {justSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Tersimpan!
                </>
              ) : (
                <>
                  <span>Catat</span>
                  <CornerDownLeft className="w-3 h-3 opacity-60" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Real-time Parsed Chips Preview */}
        {parsed && parsed.amount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-[11px] animate-in fade-in duration-150">
            <span className="text-zinc-400 text-[10px]">Terdeteksi:</span>

            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/60">
              {formatRupiah(parsed.amount)}
            </span>

            <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
              {parsed.category}
            </span>

            {parsed.accountHint && (
              <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                {parsed.accountHint}
              </span>
            )}

            <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {parsed.notes}
            </span>
          </div>
        )}
      </form>
    </div>
  );
};
