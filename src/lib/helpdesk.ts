import { pb } from "./pocketbase";

export interface HelpdeskUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export const HELPDESK_BASE_URL = "https://43.156.236.102/helpdesk/handoff";
export const APP_SLUG = "life-planner";

/**
 * Menghasilkan URL Handoff SSO ke VPS Helpdesk terpusat.
 * Mengarahkan pengguna langsung ke formulir pembuatan tiket baru (new=1).
 */
export function getHelpdeskUrl(
  customUser?: HelpdeskUser,
  fromUrl?: string,
): string {
  const authRecord = pb.authStore.record as any;
  const user = customUser || authRecord;

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
    fromUrl ||
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

  return `${HELPDESK_BASE_URL}?${params.toString()}`;
}

/**
 * Membuka formulir pembuatan tiket di tab baru dengan proteksi noopener,noreferrer.
 */
export function openHelpdeskTicket(
  customUser?: HelpdeskUser,
  fromUrl?: string,
): void {
  const targetUrl = getHelpdeskUrl(customUser, fromUrl);
  if (typeof window !== "undefined") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }
}
