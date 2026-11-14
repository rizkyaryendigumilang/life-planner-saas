import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  RefreshCw,
  Database,
  ShieldCheck,
} from "lucide-react";
import { pb } from "../lib/pocketbase";
import {
  parseBackupJson,
  parseExpensesCsv,
  generateImportPreview,
  executeRestore,
  type ImportPreview,
  type ConflictStrategy,
  type ImportResult,
} from "../lib/restore-engine";

interface ImportRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportRestoreModal: React.FC<ImportRestoreModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"json" | "csv">("json");
  const [strategy, setStrategy] = useState<ConflictStrategy>("merge");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, any[]> | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: "" });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setPreview(null);
    setParsedData(null);
    setFileName("");
    setIsProcessing(false);
    setProgress({ percent: 0, status: "" });
    setResult(null);
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setErrorMsg("File kosong atau tidak dapat dibaca.");
        return;
      }

      if (activeTab === "json" || file.name.endsWith(".json")) {
        const jsonRes = parseBackupJson(content);
        if (!jsonRes.valid || !jsonRes.data) {
          setErrorMsg(jsonRes.error || "Gagal memproses file cadangan JSON.");
          return;
        }
        setParsedData(jsonRes.data);
        setPreview(generateImportPreview(jsonRes.data, "json_backup", jsonRes.meta));
      } else {
        const csvRes = parseExpensesCsv(content);
        if (!csvRes.valid) {
          setErrorMsg(csvRes.errors.join(", ") || "Gagal membaca format CSV.");
          return;
        }
        const data = { expenses: csvRes.records };
        setParsedData(data);
        setPreview(generateImportPreview(data, "csv_expenses"));
      }
    };

    reader.onerror = () => {
      setErrorMsg("Terjadi kesalahan saat membaca file.");
    };

    reader.readAsText(file);
  };

  const handleStartRestore = async () => {
    if (!parsedData || !pb.authStore.model) {
      setErrorMsg("Data belum siap atau Anda belum masuk.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const user = {
        id: pb.authStore.model.id,
        email: pb.authStore.model.email,
      };

      const res = await executeRestore(
        user,
        parsedData,
        strategy,
        ({ percent, collection, current, total }) => {
          setProgress({
            percent,
            status: `Memproses ${collection} (${current}/${total})...`,
          });
        }
      );

      setResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memulihkan data.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 dark:bg-zinc-900/95 border border-black/10 dark:border-white/10 shadow-2xl p-6 sm:p-7 flex flex-col gap-5 text-zinc-900 dark:text-zinc-100 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Restore & Import Data</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pulihkan cadangan JSON atau impor mutasi dari CSV
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Success View */}
        {result ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Data Berhasil Dipulihkan!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Sebanyak <strong>{result.totalImported}</strong> catatan telah disimpan ke akun Anda.
                  {result.totalSkipped > 0 && ` (${result.totalSkipped} catatan dilewati karena sudah ada).`}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/40 p-4 space-y-2 text-xs">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300">Rincian Koleksi:</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.collectionResults).map(([col, stat]) => (
                  <div key={col} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 flex justify-between">
                    <span className="capitalize">{col.replace(/_/g, " ")}:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{stat.imported}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                resetState();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition active:scale-[0.98]"
            >
              Selesai & Muat Ulang
            </button>
          </div>
        ) : (
          <>
            {/* Tab Selection */}
            {!preview && (
              <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("json");
                    resetState();
                  }}
                  className={`py-2 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition ${
                    activeTab === "json"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Cadangan JSON (Lengkap)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("csv");
                    resetState();
                  }}
                  className={`py-2 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition ${
                    activeTab === "csv"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  File CSV (Transaksi)
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Upload Zone */}
            {!preview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition group bg-zinc-50/40 dark:bg-zinc-800/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept={activeTab === "json" ? ".json" : ".csv"}
                  onChange={handleFileChange}
                />
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-105 transition mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold mb-1">
                  Pilih atau Tarik File {activeTab === "json" ? "JSON" : "CSV"} ke Sini
                </div>
                <p className="text-xs text-zinc-500 max-w-sm">
                  {activeTab === "json"
                    ? "Gunakan file cadangan 'life-planner-export-*.json' yang sebelumnya Anda unduh."
                    : "File CSV dengan kolom Tanggal, Kategori, Nominal/Jumlah, dan Catatan."}
                </p>
              </div>
            ) : (
              /* Step 2: Inspection & Strategy */
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileJson className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-medium truncate">{fileName}</span>
                  </div>
                  <button
                    onClick={resetState}
                    disabled={isProcessing}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 text-xs font-semibold"
                  >
                    Ganti File
                  </button>
                </div>

                {/* Preview Cards */}
                <div className="p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-800/30 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Total Catatan Ditemukan:</span>
                    <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {preview.totalRecords} data
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="text-zinc-500 font-medium">Koleksi Terdeteksi:</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(preview.collections).map(([name, info]) => (
                        <span
                          key={name}
                          className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          {name.replace(/_/g, " ")}: {info.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Strategy Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Strategi Penanganan Duplikasi:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "merge", label: "Perbarui (Merge)", desc: "Update data lama" },
                      { id: "skip_existing", label: "Lewati (Skip)", desc: "Hanya tambah yang baru" },
                      { id: "replace", label: "Tambah Semua", desc: "Buat ID baru" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStrategy(opt.id as ConflictStrategy)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          strategy === opt.id
                            ? "border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200"
                            : "border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Security Tag */}
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Isolasi Terjamin: Semua data otomatis dikaitkan ke akun aktif Anda.</span>
                </div>

                {/* Progress bar if processing */}
                {isProcessing && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{progress.status}</span>
                      <span>{progress.percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetState}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleStartRestore}
                    disabled={isProcessing || preview.totalRecords === 0}
                    className="flex-[2] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Memulihkan...
                      </>
                    ) : (
                      <>
                        Mulai Pulihkan Data
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
