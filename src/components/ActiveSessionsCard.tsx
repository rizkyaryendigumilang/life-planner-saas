import React, { useState, useEffect } from "react";
import {
  Laptop,
  Smartphone,
  Tablet,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import { pb } from "../lib/pocketbase";
import {
  listActiveSessions,
  revokeOtherSessions,
  type ClientSessionInfo,
} from "../lib/security-sessions";

export const ActiveSessionsCard: React.FC = () => {
  const [sessions, setSessions] = useState<ClientSessionInfo[]>([]);
  const [isRevoking, setIsRevoking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const userId = pb.authStore.model?.id || "guest";
  const currentToken = pb.authStore.token || "token_local";
  const currentSessionId = `session_${userId}_${currentToken.slice(-8)}`;

  const refreshSessions = () => {
    const list = listActiveSessions(userId, currentSessionId);
    setSessions(list);
  };

  useEffect(() => {
    refreshSessions();
  }, [userId]);

  const handleRevokeOthers = async () => {
    setIsRevoking(true);
    setMessage(null);
    try {
      const remaining = revokeOtherSessions(userId, currentSessionId);
      setSessions(remaining);
      setMessage("Semua sesi perangkat lain telah berhasil diakhiri.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Gagal mengakhiri sesi lain.");
    } finally {
      setIsRevoking(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile":
        return <Smartphone className="w-4 h-4 text-indigo-500" />;
      case "tablet":
        return <Tablet className="w-4 h-4 text-indigo-500" />;
      default:
        return <Laptop className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="rounded-3xl p-5 sm:p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Sesi & Perangkat Aktif
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </h3>
            <p className="text-xs text-zinc-500">
              Pantau dan kelola perangkat yang memiliki akses ke akun Anda
            </p>
          </div>
        </div>

        {sessions.length > 1 && (
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={isRevoking}
            className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100/50 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Sesi Lain
          </button>
        )}
      </div>

      {message && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
          {message}
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {sessions.map((sess) => (
          <div
            key={sess.id}
            className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-black/5 dark:border-white/5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center border border-black/5 dark:border-white/5">
                {getDeviceIcon(sess.deviceType)}
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>
                    {sess.browser} di {sess.os}
                  </span>
                  {sess.isCurrent && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      Perangkat Ini
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>Aktif: {new Date(sess.lastActive).toLocaleDateString("id-ID")}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Terotorisasi
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
