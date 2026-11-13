import { createHash } from "node:crypto";
import PocketBase from "pocketbase";
import { pb, PB_URL, authenticatePocketBase, escapeFilterValue } from "../services/pb.mjs";

export function getBearerToken(req) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
}

export const authCache = new Map();

export async function authenticateRequest(req, { admin = false } = {}) {
  const token = getBearerToken(req);
  if (!token) return false;

  const now = Date.now();
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > now) {
    const user = cached.user;
    if (!user || user.status !== "active") return false;
    if (admin && user.role !== "superadmin") return false;
    req.authUser = user;
    return true;
  }

  try {
    const userClient = new PocketBase(PB_URL);
    userClient.autoCancellation(false);
    userClient.authStore.save(token, null);
    const refreshed = await userClient.collection("_pb_users_auth_").authRefresh();
    const user = refreshed?.record;
    if (!user || user.status !== "active") return false;
    if (admin && user.role !== "superadmin") return false;

    authCache.set(token, { user, expiresAt: now + 20_000 });
    if (authCache.size > 500) {
      for (const [t, entry] of authCache.entries()) {
        if (entry.expiresAt <= now) authCache.delete(t);
      }
    }

    req.authUser = user;
    return true;
  } catch {
    authCache.delete(token);
    return false;
  }
}

export async function isAdminAuthorized(req) {
  return authenticateRequest(req, { admin: true });
}

export function hashShortcutToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getShortcutToken(req, { allowQuery = false } = {}) {
  const token = req.headers["x-shortcut-token"];
  if (typeof token === "string" && token.trim()) return token.trim();
  // Calendar subscriptions cannot send custom headers, so a feed URL may carry
  // the same device token in the query string.
  if (!allowQuery) return null;
  const query = req.query?.token;
  return typeof query === "string" && query.trim() ? query.trim() : null;
}

export async function authenticateShortcutToken(req, { allowQuery = false } = {}) {
  const token = getShortcutToken(req, { allowQuery });
  if (!token || token.length > 200) return false;

  try {
    await authenticatePocketBase();
    const tokenHash = hashShortcutToken(token);
    const escapedHash = escapeFilterValue(tokenHash);
    const result = await pb.collection("shortcut_tokens").getList(1, 1, {
      filter: `token_hash = "${escapedHash}" && revoked = false`,
    });
    const deviceToken = result.items[0];
    if (!deviceToken) return false;

    if (deviceToken.expires_at && new Date(deviceToken.expires_at).getTime() <= Date.now()) {
      return false;
    }

    const user = await pb.collection("_pb_users_auth_").getOne(deviceToken.user);
    if (!user || String(user.status || "").toLowerCase() !== "active") return false;

    req.authUser = user;
    req.authMethod = "shortcut";
    req.shortcutTokenRecord = deviceToken;

    // Last-use timestamp is telemetry only; authorization never depends on it.
    await pb.collection("shortcut_tokens").update(deviceToken.id, {
      last_used_at: new Date().toISOString(),
    });

    return true;
  } catch {
    return false;
  }
}
