// Local development binds PocketBase and the API to loopback, which a phone on
// the same Wi-Fi cannot reach. When the app is opened from a non-loopback host
// (a LAN IP, a hotspot address, a tunnel), rewrite loopback endpoints to that
// same host so the whole stack stays reachable without editing .env.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function currentHost() {
  if (typeof window === "undefined") return "";
  return window.location.hostname || "";
}

export function resolveHost(configured: string | undefined, fallback: string) {
  const base = (configured || fallback).replace(/\/+$/, "");
  const host = currentHost();
  if (!host || LOOPBACK_HOSTS.has(host)) return base;

  try {
    const url = new URL(base);
    if (!LOOPBACK_HOSTS.has(url.hostname)) return base;
    url.hostname = host;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return base;
  }
}

export const API_BASE = resolveHost(import.meta.env.VITE_API_BASE_URL, "http://127.0.0.1:3001");
export const POCKETBASE_BASE = resolveHost(import.meta.env.VITE_POCKETBASE_URL, "http://127.0.0.1:8090");
