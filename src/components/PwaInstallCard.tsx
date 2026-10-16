import { useState } from "react";
import { CheckCircle2, Download, Laptop, Share, Smartphone, Sparkles, Tablet } from "lucide-react";
import { Button, Card } from "./ui";
import { BrandLogo } from "./BrandLogo";
import { usePwa } from "../hooks/use-pwa";

export function PwaInstallCard() {
  const { isStandalone, isIos, canInstall, promptInstall } = usePwa();
  const [platformTab, setPlatformTab] = useState<"ios" | "android" | "desktop">(
    isIos ? "ios" : "android"
  );
  const [installing, setInstalling] = useState(false);

  const handleInstallClick = async () => {
    setInstalling(true);
    await promptInstall();
    setInstalling(false);
  };

  return (
    <Card className="overflow-hidden border-line/15 bg-surface">
      <div className="border-b border-line/10 bg-muted/40 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line/15 bg-surface shadow-xs">
              <BrandLogo variant="mark" size="md" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink sm:text-lg">
                  LifePlanner Mobile & Desktop App
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-line/15 bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                  <Sparkles size={11} className="text-amber-500" />
                  PWA
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Akses cepat langsung dari layar utama tanpa address bar browser.
              </p>
            </div>
          </div>

          {canInstall && (
            <Button
              onClick={handleInstallClick}
              disabled={installing}
              className="w-full shrink-0 gap-2 sm:w-auto"
            >
              <Download size={16} />
              {installing ? "Memasang…" : "Install App"}
            </Button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isStandalone ? (
          <div className="flex items-center gap-3 rounded-xl border border-positive/20 bg-positive/10 p-4 text-positive">
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="text-xs font-medium leading-5">
              Aplikasi LifePlanner sudah terpasang dan berjalan dalam mode <strong>Standalone App</strong> di perangkat ini.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Platform switcher tabs */}
            <div className="flex rounded-xl border border-line/15 bg-muted/50 p-1" role="tablist">
              <button
                type="button"
                onClick={() => setPlatformTab("ios")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                  platformTab === "ios"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <Smartphone size={14} />
                iPhone / iPad
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab("android")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                  platformTab === "android"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <Tablet size={14} />
                Android & Tablet
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab("desktop")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                  platformTab === "desktop"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <Laptop size={14} />
                Desktop (Mac / Windows)
              </button>
            </div>

            {/* iOS Instructions */}
            {platformTab === "ios" && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-ink">
                  Panduan Pasang di iPhone atau iPad (Safari):
                </p>
                <ol className="space-y-2 text-xs leading-5 text-ink-soft">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      1
                    </span>
                    <span>
                      Buka halaman LifePlanner di browser <strong>Safari</strong> pada iPhone/iPad Anda.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      2
                    </span>
                    <span>
                      Ketuk tombol <strong>Share</strong> (ikon kotak dengan panah ke atas <Share size={12} className="inline align-baseline" />) di bilah navigasi Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      3
                    </span>
                    <span>
                      Gulir ke bawah dan pilih <strong>"Add to Home Screen"</strong> (<em>Tambah ke Layar Utama</em>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      4
                    </span>
                    <span>
                      Ketuk <strong>Add</strong> di pojok kanan atas. Ikon resmi LifePlanner akan tampil di layar utama Anda.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            {/* Android Instructions */}
            {platformTab === "android" && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-ink">
                  Panduan Pasang di Ponsel atau Tablet Android (Chrome):
                </p>
                <ol className="space-y-2 text-xs leading-5 text-ink-soft">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      1
                    </span>
                    <span>
                      Buka LifePlanner di browser <strong>Google Chrome</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      2
                    </span>
                    <span>
                      Jika muncul tombol <strong>"Install App"</strong> di bagian atas kartu ini, cukup klik sekali untuk langsung memasang.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      3
                    </span>
                    <span>
                      Atau ketuk menu <strong>tiga titik (⋮)</strong> di sudut kanan atas Chrome, lalu pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen"</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            {/* Desktop Instructions */}
            {platformTab === "desktop" && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-ink">
                  Panduan Pasang di Komputer / Laptop (Chrome, Edge, Brave):
                </p>
                <ol className="space-y-2 text-xs leading-5 text-ink-soft">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      1
                    </span>
                    <span>
                      Gunakan browser berbasis Chromium seperti <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      2
                    </span>
                    <span>
                      Klik ikon <strong>Install (komputer dengan tanda panah ke bawah)</strong> di ujung kanan bilah URL browser Anda, atau gunakan tombol <strong>"Install App"</strong> di atas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-ink">
                      3
                    </span>
                    <span>
                      Aplikasi akan terbuka dalam jendela tersendiri layaknya software desktop mandiri tanpa gangguan tab browser.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-3">
              <div className="rounded-xl border border-line/10 bg-muted/30 p-3 text-center">
                <p className="text-xs font-semibold text-ink">Full Screen</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">Tampilan bersih tanpa bilah URL</p>
              </div>
              <div className="rounded-xl border border-line/10 bg-muted/30 p-3 text-center">
                <p className="text-xs font-semibold text-ink">Cepat & Ringan</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">Cache offline & pemuatan instan</p>
              </div>
              <div className="rounded-xl border border-line/10 bg-muted/30 p-3 text-center">
                <p className="text-xs font-semibold text-ink">Privat & Aman</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">Langsung terhubung ke PocketBase</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
