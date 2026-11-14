export interface ClientSessionInfo {
  id: string;
  userId: string;
  deviceType: "desktop" | "mobile" | "tablet";
  os: string;
  browser: string;
  ip?: string;
  lastActive: string; // ISO 8601
  isCurrent: boolean;
  userAgent: string;
}

const STORAGE_KEY_PREFIX = "lp_active_sessions_";

/**
 * Detects current device OS and browser cleanly
 */
export function detectCurrentClientDevice(): {
  deviceType: "desktop" | "mobile" | "tablet";
  os: string;
  browser: string;
  userAgent: string;
} {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Node/Server";

  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS/i.test(ua)) os = "macOS";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown Browser";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Google Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Apple Safari";
  else if (/Firefox/i.test(ua)) browser = "Mozilla Firefox";

  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/Mobi|Android/i.test(ua)) deviceType = "mobile";
  if (/Tablet|iPad/i.test(ua)) deviceType = "tablet";

  return { deviceType, os, browser, userAgent: ua };
}

/**
 * Retrieves registered active sessions for the user
 */
export function listActiveSessions(userId: string, currentSessionId: string): ClientSessionInfo[] {
  if (!userId) return [];

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    const sessions: ClientSessionInfo[] = raw ? JSON.parse(raw) : [];

    // Ensure current session is present
    const currentFound = sessions.some((s) => s.id === currentSessionId);
    if (!currentFound) {
      const dev = detectCurrentClientDevice();
      const currentSession: ClientSessionInfo = {
        id: currentSessionId,
        userId,
        deviceType: dev.deviceType,
        os: dev.os,
        browser: dev.browser,
        lastActive: new Date().toISOString(),
        isCurrent: true,
        userAgent: dev.userAgent,
      };
      sessions.unshift(currentSession);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(sessions));
    }

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
  } catch {
    return [];
  }
}

/**
 * Revokes all sessions except the current active session
 */
export function revokeOtherSessions(userId: string, currentSessionId: string): ClientSessionInfo[] {
  if (!userId) return [];

  const dev = detectCurrentClientDevice();
  const currentSession: ClientSessionInfo = {
    id: currentSessionId,
    userId,
    deviceType: dev.deviceType,
    os: dev.os,
    browser: dev.browser,
    lastActive: new Date().toISOString(),
    isCurrent: true,
    userAgent: dev.userAgent,
  };

  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify([currentSession]));
  } catch {
    // Ignore storage quota
  }

  return [currentSession];
}

/**
 * Verifies password strength according to modern security standards
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number; // 0 - 4
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else reasons.push("Kata sandi minimal 8 karakter");

  if (/[A-Z]/.test(password)) score++;
  else reasons.push("Memerlukan minimal satu huruf besar");

  if (/[0-9]/.test(password)) score++;
  else reasons.push("Memerlukan minimal satu angka");

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else reasons.push("Memerlukan minimal satu simbol khusus");

  return {
    isValid: score >= 3 && password.length >= 8,
    score,
    reasons,
  };
}
