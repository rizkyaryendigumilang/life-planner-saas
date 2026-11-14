import { useCallback, useEffect, useState } from "react";
import { autoBackup, type AutoBackupMeta } from "../lib/auto-backup";
import { pb } from "../lib/pocketbase";

export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return "Belum pernah disinkronkan";
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 15) return "Baru saja";
  if (diffSec < 60) return `${diffSec} detik yang lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam yang lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useAutoBackup() {
  const user = pb.authStore.record as any;
  const [meta, setMeta] = useState<AutoBackupMeta | null>(() => autoBackup.getMeta(user?.id));
  const [syncing, setSyncing] = useState(false);
  const [timeAgoText, setTimeAgoText] = useState(() => formatTimeAgo(meta?.lastSyncedAt));

  const syncNow = useCallback(async () => {
    if (!user?.id) return;
    setSyncing(true);
    try {
      const res = await autoBackup.syncNow(user);
      setMeta(res.meta);
      setTimeAgoText("Baru saja");
    } catch (err) {
      console.error("Auto backup sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, [user]);

  // Initial check & auto-sync if stale (> 30 mins or not exists)
  useEffect(() => {
    if (!user?.id) return;

    const currentMeta = autoBackup.getMeta(user.id);
    setMeta(currentMeta);

    const isStale = !currentMeta || Date.now() - new Date(currentMeta.lastSyncedAt).getTime() > 30 * 60 * 1000;
    if (isStale) {
      void syncNow();
    }

    // Auto-sync on window focus
    const handleFocus = () => {
      const latest = autoBackup.getMeta(user.id);
      if (!latest || Date.now() - new Date(latest.lastSyncedAt).getTime() > 15 * 60 * 1000) {
        void syncNow();
      }
    };

    window.addEventListener("focus", handleFocus);

    // Live update for "X minutes ago" text
    const timer = setInterval(() => {
      const current = autoBackup.getMeta(user.id);
      if (current) {
        setTimeAgoText(formatTimeAgo(current.lastSyncedAt));
      }
    }, 30000);

    // Event listener for external syncs
    const handleSyncedEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.meta) {
        setMeta(detail.meta);
        setTimeAgoText(formatTimeAgo(detail.meta.lastSyncedAt));
      }
    };
    window.addEventListener("life-planner:auto-backup-synced", handleSyncedEvent);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("life-planner:auto-backup-synced", handleSyncedEvent);
      clearInterval(timer);
    };
  }, [user?.id, syncNow]);

  const downloadJson = useCallback(() => {
    if (!user?.id) return;
    // If not synced yet, do a quick sync then download
    if (!autoBackup.getData(user.id)) {
      void syncNow().then(() => autoBackup.downloadJson(user));
    } else {
      autoBackup.downloadJson(user);
    }
  }, [user, syncNow]);

  const downloadConsolidatedCsv = useCallback(() => {
    if (!user?.id) return;
    if (!autoBackup.getData(user.id)) {
      void syncNow().then(() => autoBackup.downloadConsolidatedCsv(user.id));
    } else {
      autoBackup.downloadConsolidatedCsv(user.id);
    }
  }, [user, syncNow]);

  const downloadModuleCsv = useCallback(
    (module: "expenses" | "household_bills" | "bank_accounts" | "investments" | "goals" | "tasks") => {
      if (!user?.id) return;
      if (!autoBackup.getData(user.id)) {
        void syncNow().then(() => autoBackup.downloadModuleCsv(module, user.id));
      } else {
        autoBackup.downloadModuleCsv(module, user.id);
      }
    },
    [user, syncNow],
  );

  return {
    meta,
    syncing,
    syncNow,
    timeAgoText,
    downloadJson,
    downloadConsolidatedCsv,
    downloadModuleCsv,
  };
}
