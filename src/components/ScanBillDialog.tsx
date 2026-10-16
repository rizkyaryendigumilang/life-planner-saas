import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Input, Label, Select, SelectItem } from "./ui";
import { pb } from "../lib/pocketbase";
import { formatIDR } from "../lib/utils";
import { recognizeBill, type OcrProgress } from "../lib/bill-ocr";
import { EXPENSE_CATEGORIES } from "../lib/categories";
import type { BankAccount } from "../types";

const PROGRESS_LABEL: Record<string, string> = {
  "loading tesseract core": "Menyiapkan mesin OCR…",
  "initializing tesseract": "Menyiapkan mesin OCR…",
  "loading language traineddata": "Mengunduh data bahasa…",
  "initializing api": "Menyiapkan pembaca teks…",
  "recognizing text": "Membaca struk…",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

type ScanBillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  bankAccounts?: BankAccount[];
  defaultCategory?: string;
};

export default function ScanBillDialog({
  open,
  onOpenChange,
  onSaved,
  bankAccounts = [],
  defaultCategory = "Other",
}: ScanBillDialogProps) {
  const [phase, setPhase] = useState<"pick" | "reading" | "review">("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState(defaultCategory);
  const [account, setAccount] = useState("");
  const [raw, setRaw] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<string | null>(null);

  function releasePreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }

  function reset() {
    releasePreview();
    setPreview(null);
    setPhase("pick");
    setProgress(0);
    setStatusText("");
    setMerchant("");
    setAmount("");
    setDate(today());
    setCategory(defaultCategory);
    setAccount("");
    setRaw("");
    setShowRaw(false);
    setSaving(false);
  }

  useEffect(() => () => releasePreview(), []);

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) reset();
  }

  async function handleFile(file: File) {
    releasePreview();

    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    setPhase("reading");
    setProgress(0);
    setStatusText("Menyiapkan…");

    try {
      const fields = await recognizeBill(file, (value: OcrProgress) => {
        setProgress(value.progress);
        setStatusText(PROGRESS_LABEL[value.status] || "Memproses…");
      });

      setMerchant(fields.merchant);
      setAmount(fields.amount ? String(fields.amount) : "");
      setDate(fields.date || today());
      setCategory(fields.category || defaultCategory);
      setRaw(fields.raw);
      setPhase("review");

      if (fields.amount) toast.success("Struk terbaca. Periksa lalu simpan.");
      else toast.warning("Nominal belum terbaca. Isi manual ya.");
    } catch (error) {
      console.error("Bill scan failed:", error);
      setPhase("review");
      toast.error("Gagal membaca struk. Isi manual atau coba foto lain.");
    }
  }

  async function handleSave() {
    const userId = pb.authStore.record?.id;
    if (!userId) {
      toast.error("Sesi berakhir. Silakan login kembali.");
      return;
    }

    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Isi nominal yang valid.");
      return;
    }
    if (!date) {
      toast.error("Pilih tanggal transaksi.");
      return;
    }

    setSaving(true);
    try {
      await pb.collection("expenses").create({
        user: userId,
        type: "Expense",
        amount: value,
        category,
        date,
        notes: merchant.trim() || undefined,
        account: account || undefined,
      });

      toast.success("Pengeluaran dicatat dari struk.");
      onSaved?.();
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to save scanned expense:", error);
      toast.error("Gagal menyimpan pengeluaran.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Scan bill"
      description="Foto struk, lalu harga, merchant, dan tanggal terisi otomatis."
    >
      {phase === "pick" && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line/20 bg-muted px-6 py-12 text-center transition hover:border-line/30">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-line/15 bg-surface text-ink">
            <ImageUp size={19} />
          </span>
          <span className="text-sm font-medium text-ink">Pilih foto atau ambil dari kamera</span>
          <span className="text-xs text-ink-faint">JPG atau PNG · struk, nota, atau tagihan</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </label>
      )}

      {phase === "reading" && (
        <div className="space-y-4">
          {preview && (
            <img
              src={preview}
              alt="Pratinjau struk"
              className="max-h-64 w-full rounded-xl border border-line/15 object-contain"
            />
          )}

          <div>
            <div className="flex items-center justify-between text-xs text-ink-soft">
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {statusText}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/[.07]">
              <div
                className="h-full bg-ink transition-all"
                style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {preview && (
              <img
                src={preview}
                alt="Pratinjau struk"
                className="h-28 w-24 shrink-0 rounded-lg border border-line/15 object-cover"
              />
            )}

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <Label>Merchant</Label>
                <Input
                  value={merchant}
                  onChange={(event) => setMerchant(event.target.value)}
                  placeholder="Nama toko"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {Number(amount) > 0 && (
            <p className="text-xs text-ink-faint">Tercatat sebagai {formatIDR(Number(amount))}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                {EXPENSE_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {bankAccounts.length > 0 && (
              <div>
                <Label>Account</Label>
                <Select
                  value={account || "none"}
                  onValueChange={(value) => setAccount(value === "none" ? "" : value)}
                >
                  <SelectItem value="none">No account selected</SelectItem>
                  {bankAccounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.bank_name} · {item.account_name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {raw && (
            <div>
              <button
                type="button"
                onClick={() => setShowRaw((value) => !value)}
                className="text-[11px] text-ink-faint underline-offset-2 transition hover:text-ink hover:underline"
              >
                {showRaw ? "Sembunyikan teks OCR" : "Lihat teks OCR"}
              </button>

              {showRaw && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line/15 bg-muted p-3 text-[11px] leading-5 text-ink-soft">
                  {raw}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={reset}>
              <RefreshCw size={15} />
              Scan ulang
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan expense"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
