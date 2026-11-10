import { pb } from "./pocketbase";

export interface HelpdeskUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export type HelpdeskCategory =
  | "bug_error"
  | "data_transaction"
  | "account_login"
  | "feature_question"
  | "other";

export type HelpdeskPriority = "urgent" | "high" | "medium" | "low";

export interface HelpdeskTicketOptions {
  user?: HelpdeskUser;
  fromUrl?: string;
  subject?: string;
  description?: string;
  category?: HelpdeskCategory;
  priority?: HelpdeskPriority;
  autoSubmit?: boolean;
  photoName?: string;
  photoSize?: number;
}

export const HELPDESK_BASE_URL = "https://43.156.236.102/helpdesk/handoff";
export const APP_SLUG = "life-planner";

export const HELPDESK_CATEGORIES: Array<{ value: HelpdeskCategory; label: string; icon: string }> = [
  { value: "bug_error", label: "Kendala / Bug Aplikasi", icon: "🐛" },
  { value: "data_transaction", label: "Transaksi & Catatan Keuangan", icon: "💳" },
  { value: "account_login", label: "Akun & Akses Masuk", icon: "🔐" },
  { value: "feature_question", label: "Pertanyaan Fitur & Saran", icon: "💡" },
  { value: "other", label: "Kendala Lainnya", icon: "📌" },
];

/**
 * Menghasilkan URL Handoff SSO ke VPS Helpdesk terpusat.
 * Mendukung pembukaan formulir baru (/portal/new) atau tiket instan dengan parameter terisi.
 */
export function getHelpdeskUrl(
  optionsOrUser?: HelpdeskTicketOptions | HelpdeskUser,
  legacyFromUrl?: string,
): string {
  // Kompatibilitas mundur: jika argumen pertama adalah user objek sederhana atau options
  const isOptions =
    optionsOrUser &&
    ("subject" in optionsOrUser ||
      "description" in optionsOrUser ||
      "category" in optionsOrUser ||
      "autoSubmit" in optionsOrUser ||
      "fromUrl" in optionsOrUser ||
      "user" in optionsOrUser);

  const options: HelpdeskTicketOptions = isOptions
    ? (optionsOrUser as HelpdeskTicketOptions)
    : {
        user: optionsOrUser as HelpdeskUser | undefined,
        fromUrl: legacyFromUrl,
      };

  const authRecord = pb.authStore.record as any;
  const user = options.user || authRecord;

  // Resolusi identitas pengguna
  const rawUid =
    user?.id ||
    user?.username ||
    user?.email ||
    (typeof window !== "undefined" && window.crypto?.randomUUID
      ? `guest_${window.crypto.randomUUID().slice(0, 8)}`
      : `guest_${Math.random().toString(36).slice(2, 8)}`);

  const uid = String(rawUid).slice(0, 200);

  const name = String(
    user?.name ||
      user?.fullName ||
      user?.username ||
      user?.email?.split("@")[0] ||
      "Pengguna LifePlanner",
  ).trim();

  const role =
    user?.role === "superadmin"
      ? "Admin"
      : typeof user?.role === "string" && user.role.trim()
        ? user.role.trim()
        : "Member";

  const currentUrl =
    options.fromUrl ||
    legacyFromUrl ||
    (typeof window !== "undefined" && window.location?.href
      ? window.location.href
      : "");

  const params = new URLSearchParams({
    app: APP_SLUG,
    uid,
    name,
    role,
    from_url: currentUrl,
    new: "1",
  });

  if (options.subject?.trim()) {
    params.set("subject", options.subject.trim().slice(0, 200));
  }

  if (options.description?.trim()) {
    params.set("description", options.description.trim().slice(0, 4000));
  }

  if (options.category) {
    params.set("category", options.category);
  }

  if (options.priority) {
    params.set("priority", options.priority);
  }

  if (options.autoSubmit) {
    params.set("auto_submit", "1");
  }

  return `${HELPDESK_BASE_URL}?${params.toString()}`;
}

/**
 * Membuka tiket di tab baru dengan proteksi noopener,noreferrer.
 */
export function openHelpdeskTicket(
  optionsOrUser?: HelpdeskTicketOptions | HelpdeskUser,
  legacyFromUrl?: string,
): void {
  const targetUrl = getHelpdeskUrl(optionsOrUser, legacyFromUrl);
  if (typeof window !== "undefined") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * Membuka modal dialog laporan kendala in-app yang berisi form deskripsi keluhan
 * dan unggah tangkapan layar/foto problem (opsional).
 */
export function openHelpdeskModal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("life-planner:open-helpdesk"));
  }
}
