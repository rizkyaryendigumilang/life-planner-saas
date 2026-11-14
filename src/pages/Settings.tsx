import { useEffect, useState, type FormEvent } from "react";
import {
  Download,
  KeyRound,
  MailCheck,
  ShieldCheck,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RotateCcw,
  Smartphone,
  Share,
  LifeBuoy,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  CreditCard,
  TrendingUp,
  Target,
  ListTodo,
  Receipt,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { pb } from "../lib/pocketbase";
import { Badge, Button, Card, Input, Label } from "../components/ui";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BrandLogo } from "../components/BrandLogo";
import { usePwa } from "../hooks/use-pwa";
import { useAutoBackup } from "../hooks/use-auto-backup";
import { recycleBin, type TrashedItem } from "../lib/recycle-bin";
import { formatIDR } from "../lib/utils";
import { openHelpdeskModal, openHelpdeskTicket } from "../lib/helpdesk";
import { ImportRestoreModal } from "../components/ImportRestoreModal";
import { ActiveSessionsCard } from "../components/ActiveSessionsCard";

const OWNED_COLLECTIONS = [
  "expenses",
  "goals",
  "life_planner",
  "pets",
  "itineraries",
  "travel_trips",
  "bank_accounts",
  "goal_contributions",
  "experience_expenses",
  "experiences",
  "itinerary_items",
  "market_watchlist",
  "expense_ingestions",
  "investments",
  "household_bills",
];

export function Settings() {
  const user = pb.authStore.record as any;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Auto-Backup & Export State (JSON & CSV)
  const [backupFormat, setBackupFormat] = useState<"json" | "csv">("json");
  const {
    meta: autoBackupMeta,
    syncing: autoBackupSyncing,
    syncNow: autoBackupSyncNow,
    timeAgoText: autoBackupTimeAgo,
    downloadJson: autoBackupDownloadJson,
    downloadConsolidatedCsv: autoBackupDownloadConsolidatedCsv,
    downloadModuleCsv: autoBackupDownloadModuleCsv,
  } = useAutoBackup();

  // PWA Hook
  const { isStandalone, isIos, canInstall, promptInstall } = usePwa();
  const [installing, setInstalling] = useState(false);

  // Recycle Bin State
  const [trashedItems, setTrashedItems] = useState<TrashedItem[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [itemToDeletePermanently, setItemToDeletePermanently] = useState<TrashedItem | null>(null);
  const [emptyBinOpen, setEmptyBinOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const loadRecycleBin = () => {
    setTrashedItems(recycleBin.list(user?.id));
  };

  useEffect(() => {
    loadRecycleBin();

    const handleBinUpdate = () => loadRecycleBin();
    window.addEventListener("life-planner:recycle-bin-updated", handleBinUpdate);
    return () => window.removeEventListener("life-planner:recycle-bin-updated", handleBinUpdate);
  }, [user?.id]);

  const handleInstallClick = async () => {
    setInstalling(true);
    const success = await promptInstall();
    if (success) {
      toast.success("Aplikasi berhasil dipasang ke Layar Utama!");
    }
    setInstalling(false);
  };

  const handleRestoreItem = async (item: TrashedItem) => {
    setRestoringId(item.id);
    try {
      await recycleBin.restore(item.id);
      toast.success(`${item.title} (${item.typeLabel}) berhasil dipulihkan!`);
    } catch {
      toast.error("Gagal memulihkan item.");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = (item: TrashedItem) => {
    setItemToDeletePermanently(item);
  };

  const confirmPermanentDelete = () => {
    if (!itemToDeletePermanently) return;
    recycleBin.permanentlyDelete(itemToDeletePermanently.id);
    toast.success("Item telah dihapus secara permanen.");
    setItemToDeletePermanently(null);
  };

  const handleEmptyBin = () => {
    setEmptyBinOpen(true);
  };

  const confirmEmptyBin = () => {
    recycleBin.emptyBin(user?.id);
    toast.success("Tempat sampah telah dikosongkan.");
    setEmptyBinOpen(false);
  };

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
    if (next.length < 10) return toast.error("Password baru minimal 10 karakter.");
    if (next !== confirm) return toast.error("Konfirmasi password belum sama.");
    setBusy(true);
    try {
      await pb.collection("users").update(user.id, {
        oldPassword: current,
        password: next,
        passwordConfirm: confirm,
        is_password_temp: false,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      if (pb.authStore.record) pb.authStore.record.is_password_temp = false;
      toast.success("Password berhasil diperbarui.");
    } catch (error: any) {
      toast.error(
        error?.response?.message ||
          "Tidak dapat mengubah password. Pastikan password saat ini benar."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail() {
    const email = user?.email;
    if (!email) return toast.error("Email akun tidak tersedia.");
    try {
      await pb.collection("users").requestVerification(email);
      toast.success("Jika akun memenuhi syarat, email verifikasi akan dikirim.");
    } catch {
      toast.error("Email verifikasi belum dapat dikirim. Periksa konfigurasi SMTP PocketBase.");
    }
  }

  async function exportData() {
    setExporting(true);
    const bundle: Record<string, unknown> = {
      app: "life-planner",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { email: user?.email, name: user?.name, id: user?.id },
      summary: {} as Record<string, number>,
      data: {},
      notes: [] as string[],
    };
    const data = bundle.data as Record<string, unknown>;
    const summary = bundle.summary as Record<string, number>;
    const notes = bundle.notes as string[];
    for (const collection of OWNED_COLLECTIONS) {
      try {
        const records = await pb.collection(collection).getFullList({ sort: "created" });
        data[collection] = records;
        summary[collection] = records.length;
      } catch {
        notes.push(
          `Collection '${collection}' could not be exported (it may not exist or your account cannot read it).`
        );
      }
    }
    try {
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-planner-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export data selesai. Simpan file di tempat aman.");
    } catch {
      toast.error("Gagal membuat file export.");
    } finally {
      setExporting(false);
    }
  }

  const verified = Boolean(user?.verified);
  const hasSyntheticEmail = String(user?.email || "").toLowerCase().endsWith("@users.invalid");

  async function sendPasswordSetupLink() {
    if (!user?.email || hasSyntheticEmail) {
      toast.error("Akun ini belum memiliki alamat email yang bisa menerima link pemulihan.");
      return;
    }
    try {
      await pb.collection("users").requestPasswordReset(String(user.email));
    } catch {
      // Deliberately keep the same response for registered/unregistered states.
    }
    toast.success(
      "Jika alamat email ini dapat menerima pemulihan, link setup/reset akan dikirim. Periksa inbox dan spam."
    );
  }

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Kelola identitas akun, instalasi Layar Utama (PWA), Tempat Sampah (Recycle Bin), dan keamanan data Anda.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        {/* Kolom Kiri */}
        <div className="space-y-5">
          {/* Card 1: Pasang ke Layar Utama (1-Klik Instan PWA) */}
          <Card className="overflow-hidden border-line/15 bg-surface">
            <div className="flex items-center gap-4 border-b border-line/10 p-5 bg-muted/30">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line/15 bg-surface shadow-xs">
                <BrandLogo variant="mark" size="md" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink">Pasang ke Layar Utama</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Akses instan dari Home Screen ponsel, tablet, atau komputer Anda.
                </p>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {isStandalone ? (
                <div className="flex items-center gap-3 rounded-xl border border-positive/20 bg-positive/10 p-3.5 text-positive">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <p className="text-xs font-medium leading-5">
                    Aplikasi sudah terpasang dan berjalan dalam mode <strong>Standalone App</strong> di perangkat ini.
                  </p>
                </div>
              ) : canInstall ? (
                <div className="space-y-3">
                  <p className="text-xs text-ink-soft leading-5">
                    Perangkat Anda mendukung instalasi langsung 1-klik tanpa perlu unduh dari Play Store / App Store.
                  </p>
                  <Button
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="w-full gap-2 py-2.5"
                  >
                    <Smartphone size={16} />
                    {installing ? "Memasang…" : "Pasang ke Layar Utama (1-Klik)"}
                  </Button>
                </div>
              ) : isIos ? (
                <div className="space-y-2.5 rounded-xl border border-line/15 bg-muted/40 p-3.5">
                  <p className="text-xs font-semibold text-ink">
                    Cara Pasang di iPhone / iPad (Safari):
                  </p>
                  <ol className="space-y-1.5 text-xs leading-5 text-ink-soft">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-ink">1.</span>
                      <span>Ketuk tombol <strong>Share</strong> (ikon kotak dengan panah atas <Share size={12} className="inline align-baseline" />) di Safari.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-ink">2.</span>
                      <span>Pilih <strong>"Add to Home Screen"</strong> (<em>Tambah ke Layar Utama</em>).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-ink">3.</span>
                      <span>Ketuk <strong>Add</strong> di pojok kanan atas.</span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-ink-soft leading-5">
                    Untuk memasang aplikasi ini, klik ikon instalasi di bilah alamat browser Anda (Chrome / Edge) atau pilih menu <strong>"Install LifePlanner"</strong>.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Card 2: Account Details */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-line/10 p-5">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-ink">
                <UserRound size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink">Account details</h2>
                <p className="mt-0.5 truncate text-sm text-ink-soft">
                  {hasSyntheticEmail
                    ? "Telegram sign-in · no email provided"
                    : user?.email || "No email available"}
                </p>
              </div>
              <Badge tone={user?.role === "superadmin" ? "accent" : "neutral"}>
                {user?.role === "superadmin" ? "Admin" : "Customer"}
              </Badge>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-soft">Email verification</span>
                <Badge tone={hasSyntheticEmail ? "warning" : verified ? "success" : "warning"}>
                  {hasSyntheticEmail ? "No email from provider" : verified ? "Verified" : "Not verified"}
                </Badge>
              </div>
              {!verified && !hasSyntheticEmail && (
                <Button variant="outline" size="sm" onClick={() => void verifyEmail()}>
                  <MailCheck size={15} /> Send verification email
                </Button>
              )}
              {!hasSyntheticEmail && (
                <Button variant="outline" size="sm" onClick={() => void sendPasswordSetupLink()}>
                  <KeyRound size={15} /> Send password setup/reset link
                </Button>
              )}
              {hasSyntheticEmail && (
                <div className="rounded-xl border border-caution/25 bg-caution/10 p-3 text-xs leading-5 text-caution">
                  <p className="font-semibold">Telegram did not provide an email address.</p>
                  <p className="mt-1">
                    This account uses an internal <code>@users.invalid</code> placeholder. It cannot receive email verification or password-reset messages.
                  </p>
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs leading-5 text-ink-soft">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ink" />
                <p>
                  Your role and account status are controlled by the application administrator; changing profile fields cannot grant administrator access.
                </p>
              </div>
            </div>
          </Card>

          {/* Card 3: Cadangan Data Pribadi & Auto-Sync (JSON & CSV) */}
          <Card className="overflow-hidden border-line/15 bg-surface">
            {/* Header Card */}
            <div className="flex items-center justify-between border-b border-line/10 p-5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-line/15 bg-surface shadow-xs">
                  <Database size={18} className="text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink">Cadangan Data & Auto-Sync</h2>
                  <p className="text-xs text-ink-soft">
                    Sinkronisasi otomatis latar belakang & unduh cadangan.
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                {autoBackupSyncing ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                    <Loader2 size={12} className="animate-spin" />
                    Menyinkronkan…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-positive/20 bg-positive/10 px-2.5 py-1 text-[11px] font-medium text-positive">
                    <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                    Auto-Sync Aktif
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* Telemetry info & Manual Sync Button */}
              <div className="flex flex-col gap-2 rounded-xl border border-line/12 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-ink">
                    Status Sinkronisasi Terbaru:
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {autoBackupTimeAgo} · <strong className="text-ink">{autoBackupMeta?.totalRecords ?? 0} data</strong> tersimpan aman
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={autoBackupSyncing}
                  onClick={() => {
                    void autoBackupSyncNow().then(() => {
                      toast.success("Data berhasil disinkronkan ke versi terbaru!");
                    });
                  }}
                  className="self-start sm:self-auto gap-1.5 text-xs"
                >
                  <RefreshCw size={13} className={autoBackupSyncing ? "animate-spin text-accent" : ""} />
                  {autoBackupSyncing ? "Menyinkronkan…" : "Sync Sekarang"}
                </Button>
              </div>

              {/* Format Switcher: JSON vs CSV */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-ink-soft">Pilih Format Cadangan:</Label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-line/15 bg-muted/30 p-1">
                  <button
                    type="button"
                    onClick={() => setBackupFormat("json")}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                      backupFormat === "json"
                        ? "bg-surface text-ink shadow-xs border border-line/15"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    <FileJson size={15} className={backupFormat === "json" ? "text-accent" : "text-ink-soft"} />
                    Format JSON (Utuh)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupFormat("csv")}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                      backupFormat === "csv"
                        ? "bg-surface text-ink shadow-xs border border-line/15"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    <FileSpreadsheet size={15} className={backupFormat === "csv" ? "text-positive" : "text-ink-soft"} />
                    Format CSV (Excel)
                  </button>
                </div>
              </div>

              {/* Konten Pilihan JSON */}
              {backupFormat === "json" && (
                <div className="space-y-3 rounded-xl border border-line/12 bg-surface p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink">
                      Cadangan Sistem Lengkap (15 Modul)
                    </p>
                    <p className="text-[11px] leading-5 text-ink-soft">
                      Menyimpan seluruh transaksi, tagihan rumah tangga, rekening, target, investasi, agenda, perjalanan, dan riwayat dalam 1 berkas JSON terstruktur.
                    </p>
                  </div>

                  <Button
                    className="w-full gap-2 py-2.5"
                    variant="primary"
                    disabled={autoBackupSyncing}
                    onClick={() => {
                      autoBackupDownloadJson();
                      toast.success("File cadangan JSON berhasil diunduh.");
                    }}
                  >
                    <Download size={15} />
                    Unduh Cadangan JSON (.json)
                  </Button>
                </div>
              )}

              {/* Konten Pilihan CSV */}
              {backupFormat === "csv" && (
                <div className="space-y-3.5 rounded-xl border border-line/12 bg-surface p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-ink">
                      Format Spreadsheet & Excel (RFC 4180 / UTF-8)
                    </p>
                    <p className="text-[11px] leading-5 text-ink-soft">
                      Kompatibel langsung dengan Microsoft Excel, Google Sheets, dan Apple Numbers tanpa konversi.
                    </p>
                  </div>

                  {/* Primary CSV Download: Consolidated Ledger */}
                  <Button
                    className="w-full gap-2 py-2.5 bg-positive hover:bg-positive/90 text-white"
                    disabled={autoBackupSyncing}
                    onClick={() => {
                      autoBackupDownloadConsolidatedCsv();
                      toast.success("Buku Kas Terpadu (CSV) berhasil diunduh.");
                    }}
                  >
                    <FileSpreadsheet size={16} />
                    Unduh Buku Kas Terpadu (.csv)
                  </Button>

                  <div className="pt-1">
                    <p className="mb-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                      Atau Unduh Berkas Per Modul Spesifik:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-xs"
                        onClick={() => {
                          autoBackupDownloadModuleCsv("expenses");
                          toast.success("CSV Transaksi berhasil diunduh.");
                        }}
                      >
                        <Receipt size={14} className="text-accent" />
                        <span>Transaksi (.csv)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-xs"
                        onClick={() => {
                          autoBackupDownloadModuleCsv("household_bills");
                          toast.success("CSV Tagihan Rumah Tangga berhasil diunduh.");
                        }}
                      >
                        <CreditCard size={14} className="text-warning" />
                        <span>Rumah Tangga (.csv)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-xs"
                        onClick={() => {
                          autoBackupDownloadModuleCsv("bank_accounts");
                          toast.success("CSV Rekening Bank berhasil diunduh.");
                        }}
                      >
                        <CreditCard size={14} className="text-ink" />
                        <span>Rekening Bank (.csv)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-xs"
                        onClick={() => {
                          autoBackupDownloadModuleCsv("investments");
                          toast.success("CSV Investasi berhasil diunduh.");
                        }}
                      >
                        <TrendingUp size={14} className="text-positive" />
                        <span>Investasi (.csv)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-xs"
                        onClick={() => {
                          autoBackupDownloadModuleCsv("goals");
                          toast.success("CSV Target Impian berhasil diunduh.");
                        }}
                      >
                        <Target size={14} className="text-negative" />
                        <span>Target Impian (.csv)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 text-xs"
                        onClick={() => {
                          autoBackupDownloadModuleCsv("tasks");
                          toast.success("CSV Agenda & Tugas berhasil diunduh.");
                        }}
                      >
                        <ListTodo size={14} className="text-accent" />
                        <span>Agenda & Tugas (.csv)</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-5 text-ink-faint">
                Snapshot cadangan otomatis diperbarui saat Anda membuka atau menggunakan aplikasi. File hasil ekspor bersifat pribadi, simpan di media penyimpanan yang aman.
              </p>

              <div className="pt-2 border-t border-line/10">
                <Button
                  variant="outline"
                  className="w-full gap-2 py-2.5 text-xs font-semibold hover:border-accent hover:text-accent transition"
                  onClick={() => setIsRestoreModalOpen(true)}
                >
                  <Database size={15} className="text-accent" />
                  <span>Pulihkan / Impor Cadangan Data (JSON / CSV)</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-5">
          {/* Card: Bantuan & Laporkan Kendala (Helpdesk SSO Handoff) */}
          <Card className="overflow-hidden border-line/15 bg-surface">
            <div className="flex items-center justify-between border-b border-line/10 p-5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-ink shadow-xs">
                  <LifeBuoy size={19} className="stroke-[2]" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink">Bantuan & Laporkan Kendala</h2>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Pusat tiket bantuan terpusat dengan SSO Handoff instan
                  </p>
                </div>
              </div>
              <Badge tone="accent" className="text-[10px]">
                Helpdesk VPS
              </Badge>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-xs leading-5 text-ink-soft">
                Mengalami kendala, error, atau memiliki masukan perbaikan? Tekan tombol di bawah untuk langsung membuka formulir pembuatan tiket di sistem Helpdesk tanpa harus login atau registrasi ulang.
              </p>

              <div className="rounded-xl border border-line/10 bg-muted/40 p-3.5 text-xs leading-5 text-ink-soft space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Aplikasi Terdaftar:</span>
                  <span className="font-semibold text-ink">life-planner</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Identitas Pengguna:</span>
                  <span className="font-semibold text-ink truncate max-w-[220px]">
                    {user?.name || user?.email || "Pengguna"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Peran Akun:</span>
                  <Badge tone={user?.role === "superadmin" ? "accent" : "neutral"} className="text-[10px]">
                    {user?.role === "superadmin" ? "Admin" : "Member"}
                  </Badge>
                </div>
              </div>

              <Button
                onClick={() => openHelpdeskModal()}
                className="w-full gap-2 py-2.5 font-medium"
              >
                <LifeBuoy size={16} />
                <span>Buat Tiket Baru di Helpdesk</span>
                <ExternalLink size={14} className="opacity-70 ml-auto" />
              </Button>
            </div>
          </Card>

          {/* Card 4: Tempat Sampah (Recycle Bin / Soft Delete) */}
          <Card className="overflow-hidden border-line/15 bg-surface">
            <div className="flex items-center justify-between border-b border-line/10 p-5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-ink">
                  <Trash2 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-ink">Tempat Sampah (Recycle Bin)</h2>
                    {trashedItems.length > 0 && (
                      <span className="rounded-full bg-line/[.08] px-2 py-0.5 text-[11px] font-semibold text-ink">
                        {trashedItems.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Item yang dihapus tersimpan selama 30 hari dan dapat dipulihkan kapan saja.
                  </p>
                </div>
              </div>

              {trashedItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEmptyBin}
                  className="text-negative hover:bg-negative/10 hover:text-negative"
                >
                  Kosongkan
                </Button>
              )}
            </div>

            <div className="p-5">
              {trashedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-ink-faint">
                    <Trash2 size={20} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink">Tempat Sampah Kosong</p>
                  <p className="mt-1 max-w-xs text-xs text-ink-soft">
                    Semua akun dan transaksi Anda aman. Data yang dihapus akan masuk ke sini terlebih dahulu untuk perlindungan soft delete.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line/10">
                  {trashedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-line/15 bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                            {item.typeLabel}
                          </span>
                          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        </div>
                        {item.subtitle && (
                          <p className="mt-0.5 truncate text-xs text-ink-faint">{item.subtitle}</p>
                        )}
                        <p className="mt-1 text-[10px] text-ink-faint">
                          Dihapus: {new Date(item.deletedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.amount !== undefined && item.amount > 0 && (
                          <span className="mr-1 text-xs font-semibold text-ink">
                            {formatIDR(item.amount)}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={restoringId === item.id}
                          onClick={() => handleRestoreItem(item)}
                          className="gap-1.5"
                        >
                          <RotateCcw size={13} />
                          {restoringId === item.id ? "Memulihkan…" : "Pulihkan"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePermanentDelete(item)}
                          className="text-negative hover:bg-negative/10 hover:text-negative"
                          aria-label="Hapus permanen"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Card 5: Change Password */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-ink">
                <KeyRound size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-ink">Change password</h2>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  Use a unique password with at least 10 characters. Never reuse your email password on other services.
                </p>
              </div>
            </div>
            <form onSubmit={updatePassword} className="mt-5 space-y-4">
              <div>
                <Label>Current password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </Card>

          {/* Active Sessions & Security */}
          <ActiveSessionsCard />

          {/* Card 6: Privacy & Account Isolation */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-ink">
                <CheckCircle2 size={17} />
              </div>
              <div>
                <h2 className="font-semibold text-ink">Privacy & account isolation</h2>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  Your records should be isolated by PocketBase API rules, not only by frontend filters. Every collection with personal data must check the authenticated user on the server.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-caution/25 bg-caution/10 p-3">
              <div className="flex gap-2 text-xs leading-5 text-caution">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <p>
                  Before inviting testers, verify collection rules and OAuth-created account defaults using two separate test users. A UI filter by itself is not a security boundary.
                </p>
              </div>
            </div>
          </Card>

          {/* Card 7: Tentang LifePlanner & Branding */}
          <Card className="p-5 border-line/15 bg-surface overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <BrandLogo variant="horizontal" size="lg" subtitle="Personal Life & Finance Workspace" />
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-line/15 bg-muted px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                  v1.2.0 PWA
                </span>
                <span className="rounded-full border border-positive/25 bg-positive/10 px-2.5 py-0.5 text-[11px] font-medium text-positive">
                  Active Brand
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-soft border-t border-line/10 pt-3">
              LifePlanner dirancang untuk menyatukan perencanaan hidup, manajemen saldo rekening, pelacakan anggaran, dan produktivitas harian Anda dalam satu platform cerdas dan terintegrasi.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(itemToDeletePermanently)}
        onOpenChange={(open) => !open && setItemToDeletePermanently(null)}
        title="Hapus Permanen"
        description={`Hapus permanen "${itemToDeletePermanently?.title}" (${itemToDeletePermanently?.typeLabel})?\n\nTindakan ini tidak dapat dibatalkan dan data akan hilang selamanya.`}
        confirmLabel="Hapus Permanen"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmPermanentDelete}
      />

      <ConfirmDialog
        open={emptyBinOpen}
        onOpenChange={setEmptyBinOpen}
        title="Kosongkan Tempat Sampah"
        description="Kosongkan semua isi Tempat Sampah?\n\nSeluruh item yang ada di tempat sampah akan dihapus secara permanen dan tidak dapat dikembalikan."
        confirmLabel="Kosongkan Semua"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmEmptyBin}
      />

      <ImportRestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onSuccess={() => {
          toast.success("Pemulihan data selesai. Memuat ulang data sistem...");
          setTimeout(() => window.location.reload(), 1200);
        }}
      />
    </div>
  );
}
