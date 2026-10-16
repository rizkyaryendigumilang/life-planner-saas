import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, KeyRound, RefreshCw, Server, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "./ui";
import { API_BASE } from "../lib/hosts";
import { pb } from "../lib/pocketbase";

const TOKEN_STORAGE_KEY = "lp-shortcut-token";

type Device = {
  id: string;
  label: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = pb.authStore.token;
  if (!token || !pb.authStore.isValid) throw new Error("Sesi login berakhir. Silakan login kembali.");

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(payload?.message || "Permintaan ke server gagal.");
  return payload;
}

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(value: string | null) {
  try {
    if (value) window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage disabled — the token simply will not be remembered */
  }
}

export function AddToIphoneCard() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [devices, setDevices] = useState<Device[]>([]);
  const [serverBase, setServerBase] = useState(API_BASE);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);
  const [error, setError] = useState("");

  const serverUrl = `${serverBase}/api/expense-ingestions`;
  // The signed Shortcut lives in the repo (ios-shortcut/) and is served by the
  // API, so the phone downloads it from an address it can actually reach.
  const shortcutFile = `${serverBase}/shortcut/life-planner-expense.shortcut`;

  const serverPort = useMemo(() => {
    try {
      return new URL(serverBase).port || "3001";
    } catch {
      return "3001";
    }
  }, [serverBase]);

  const createToken = useCallback(async () => {
    const created = await request<{ token: string }>("/api/shortcut-tokens", {
      method: "POST",
      body: JSON.stringify({ label: "iPhone" }),
    });
    storeToken(created.token);
    setToken(created.token);
    return created.token;
  }, []);

  const loadDevices = useCallback(async () => {
    const result = await request<{ devices: Device[] }>("/api/shortcut-tokens");
    setDevices(result.devices || []);
    return result.devices || [];
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await loadDevices();
        if (!active) return;

        // Ask the API for the address the phone should use. This is what the
        // Shortcut needs, so showing 127.0.0.1 here would just be a dead end.
        try {
          const info = await request<{ url?: string }>("/api/network-info");
          if (active && info?.url) setServerBase(info.url);
        } catch {
          /* keep the default base when the address cannot be read */
        }

        // The token only exists in plain text once, so keep a copy on this
        // browser. If it is missing, mint a fresh one right away so the user
        // always has something to paste.
        if (!readStoredToken()) {
          await createToken();
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Tidak dapat menghubungi server.");
      }
    })();

    return () => {
      active = false;
    };
  }, [createToken, loadDevices]);

  const copy = async (value: string, which: "token" | "url") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(which === "token" ? "Token disalin." : "Server URL disalin.");
      window.setTimeout(() => setCopied((current) => (current === which ? null : current)), 2000);
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Salin manual dari kotak di atas.");
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    setError("");
    try {
      const list = await loadDevices();
      for (const device of list) {
        await request(`/api/shortcut-tokens/${device.id}`, { method: "DELETE" });
      }
      await createToken();
      await loadDevices();
      toast.success("Token baru dibuat. Pasang ulang Shortcut di iPhone ya.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tidak dapat membuat token baru.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const fields = [
    { key: "url" as const, label: "Server URL", hint: "Diisi otomatis saat memasang Shortcut.", value: serverUrl },
    { key: "token" as const, label: "Device token", hint: "Diisi otomatis saat memasang Shortcut.", value: token ?? "" },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-ink">
          <Smartphone size={18} />
        </div>
        <div>
          <h2 className="font-semibold text-ink">Catat pengeluaran dari iPhone</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Shortcut ini mengirim pengeluaran langsung ke Life Planner tanpa membuka web. Token dan alamat server
            diminta satu kali saja saat Shortcut dipasang.
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-2 text-sm leading-6 text-ink-soft">
        <li className="flex gap-2">
          <span className="text-ink-faint">1.</span>
          <span>Tekan tombol “Install Shortcut” dari iPhone, lalu buka di aplikasi Shortcuts.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-ink-faint">2.</span>
          <span>Shortcut akan meminta Server URL dan Device token — tempel dua nilai di bawah.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-ink-faint">3.</span>
          <span>Selesai. Jalankan Shortcut, isi nominal, kategori, merchant, lalu kirim.</span>
        </li>
      </ol>

      <div className="mt-5 space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-soft">{field.label}</span>
              <span className="text-[11px] text-ink-faint">{field.hint}</span>
            </div>
            <div className="mt-2 flex items-stretch gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line/15 bg-muted px-3 py-2 font-mono text-xs text-ink">
                {field.value || "Token disembunyikan — buat token baru untuk menampilkannya."}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => void copy(field.value, field.key)}
                disabled={!field.value}
                aria-label={`Copy ${field.label}`}
              >
                {copied === field.key ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        ))}

        {error && <p className="text-xs leading-5 text-caution">{error}</p>}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => window.open(shortcutFile, "_blank", "noopener")}>
          <Download size={15} />
          Install Shortcut
        </Button>
        <Button variant="outline" onClick={() => void handleRegenerate()} disabled={busy}>
          <RefreshCw size={15} className={busy ? "animate-spin" : undefined} />
          {devices.length ? "Buat token baru" : "Buat token"}
        </Button>
      </div>

      <div className="mt-4 space-y-2 border-t border-line/10 pt-4">
        <p className="flex items-start gap-2 text-[11px] leading-5 text-ink-faint">
          <Server size={13} className="mt-0.5 shrink-0" />
          Alamat di atas diambil otomatis dari jaringan komputer ini. iPhone harus berada di Wi-Fi atau hotspot yang
          sama, dan Windows Firewall perlu mengizinkan port {serverPort}. Kalau aplikasinya
          sudah di-hosting, ganti host dengan domain publikmu.
        </p>
        <p className="flex items-start gap-2 text-[11px] leading-5 text-ink-faint">
          <KeyRound size={13} className="mt-0.5 shrink-0" />
          Token berlaku 1 tahun dan hanya bisa dipakai untuk mencatat pengeluaran. Membuat token baru langsung mematikan
          token lama di semua perangkat.
        </p>
      </div>
    </Card>
  );
}
