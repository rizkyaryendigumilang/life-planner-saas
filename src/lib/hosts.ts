// Local development binds PocketBase and the API to loopback, which a phone on
// the same Wi-Fi cannot reach. When the app is opened from a non-loopback host
// (a LAN IP, a hotspot address, a tunnel), rewrite loopback endpoints to that
// same host so the whole stack stays reachable without editing .env.

import { Capacitor } from "@capacitor/core";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function currentHost() {
  if (typeof window === "undefined") return "";
  return window.location.hostname || "";
}

export function resolveHost(configured: string | undefined, fallback: string) {
  const base = (configured || fallback).replace(/\/+$/, "");

  // On native mobile (Android APK / iOS IPA), window.location.hostname is typically 'localhost'.
  // Do NOT rewrite configured URLs to phone's loopback!
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    if (configured) {
      return configured.replace(/\/+$/, "");
    }
    // Check if custom server URL was saved in settings
    const custom = localStorage.getItem("lp_server_url");
    if (custom) return custom.replace(/\/+$/, "");

    return base;
  }

  const host = currentHost();
  if (!host || LOOPBACK_HOSTS.has(host)) return base;

  // On production HTTPS web, internal loopback ports cannot be reached directly.
  // Map loopback fallbacks to reverse-proxied paths.
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    if (base.startsWith("/")) {
      return `${window.location.origin}${base}`.replace(/\/+$/, "");
    }
    try {
      const url = new URL(base);
      if (LOOPBACK_HOSTS.has(url.hostname)) {
        const subpath = fallback.includes("8090") ? "/life-planner-pb" : "/life-planner-api";
        return `${window.location.origin}${subpath}`;
      }
    } catch {
      return base;
    }
  }

  try {
    const url = new URL(base);
    if (!LOOPBACK_HOSTS.has(url.hostname)) return base;
    url.hostname = host;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return base;
  }
}

// Addresses like these only work on the same network, never from a phone using
// mobile data. Used to decide whether a feed URL is truly reachable anywhere.
const PRIVATE_HOST = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fc|fd|fe80)/i;

export function isPublicHttpsBase(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!host || LOOPBACK_HOSTS.has(host)) return false;
    if (PRIVATE_HOST.test(host)) return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}

export const API_BASE = resolveHost(import.meta.env.VITE_API_BASE_URL, "http://127.0.0.1:3001");
export const POCKETBASE_BASE = resolveHost(import.meta.env.VITE_POCKETBASE_URL, "http://127.0.0.1:8090");
