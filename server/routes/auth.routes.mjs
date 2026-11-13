import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { pb, authenticatePocketBase, escapeFilterValue, publicUser } from "../services/pb.mjs";
import { rateLimit } from "../middleware/rate-limit.mjs";

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_LOGIN_TTL_MS = 5 * 60 * 1000;

const telegramLogins = new Map();

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(72),
});

function baseUsernameFrom(value) {
  const local = String(value || "").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return (local || "user").slice(0, 11).padEnd(3, "0");
}

function usernameAttempt(base, attempt) {
  if (attempt === 0) return base;
  return `${base.slice(0, 10)}${randomBytes(2).toString("hex")}`.slice(0, 15);
}

async function createUserRecord(fields, seed) {
  await authenticatePocketBase();

  const base = baseUsernameFrom(seed);
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await pb.collection("users").create({
        ...fields,
        username: usernameAttempt(base, attempt),
      });
    } catch (error) {
      lastError = error;
      if (!(error?.response?.data || {}).username) throw error;
    }
  }

  throw lastError || new Error("Could not create the account.");
}

async function telegramApi(method, payload, timeoutMs = 15000) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return response.json();
}

function isTelegramNetworkError(error) {
  return (
    error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    error?.message === "fetch failed" ||
    ["ETIMEDOUT", "ENETUNREACH", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED"].includes(
      error?.cause?.code,
    )
  );
}

let telegramBot = null;
async function getTelegramBot() {
  if (telegramBot) return telegramBot;
  if (!TELEGRAM_BOT_TOKEN) return null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const body = await telegramApi("getMe", {}, 10000);
      if (!body?.ok) return null;
      telegramBot = body.result;
      return telegramBot;
    } catch (error) {
      if (attempt === 1 || !isTelegramNetworkError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return null;
}

let telegramLoopRunning = false;
let telegramOffset = 0;

async function telegramUpdateLoop() {
  if (telegramLoopRunning) return;
  telegramLoopRunning = true;

  try {
    while (telegramLogins.size > 0) {
      const now = Date.now();
      for (const [code, entry] of telegramLogins) {
        if (entry.expiresAt <= now) {
          telegramLogins.delete(code);
        }
      }
      if (telegramLogins.size === 0) break;

      const body = await telegramApi(
        "getUpdates",
        {
          offset: telegramOffset,
          timeout: 20,
          allowed_updates: ["message"],
        },
        35000,
      );

      if (!body?.ok) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      for (const update of body.result || []) {
        telegramOffset = Math.max(telegramOffset, (update.update_id || 0) + 1);
        const message = update.message;
        const text = typeof message?.text === "string" ? message.text.trim() : "";
        if (!message?.from || !text.startsWith("/start")) continue;

        const code = text.split(/\s+/)[1];
        const entry = code ? telegramLogins.get(code) : null;
        if (!entry || entry.status !== "pending") continue;

        entry.status = "confirmed";
        entry.from = message.from;
      }
    }
  } catch (error) {
    console.error("Telegram update loop error:", error);
  } finally {
    telegramLoopRunning = false;
  }
}

async function findOrCreateTelegramUser(from) {
  await authenticatePocketBase();

  const email = `telegram_${from.id}@users.lifeplanner.local`;
  const existing = await pb.collection("users").getList(1, 1, {
    filter: `email = "${escapeFilterValue(email)}"`,
  });
  if (existing.items[0]) return existing.items[0];

  const password = randomBytes(24).toString("base64url");
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 120);

  return createUserRecord(
    {
      email,
      password,
      passwordConfirm: password,
      name,
      role: "customer",
      status: "active",
      emailVisibility: false,
    },
    from.username || from.first_name || `tg${from.id}`,
  );
}

async function impersonateUser(user) {
  await authenticatePocketBase();
  const client = await pb.collection("users").impersonate(user.id, 3600);
  return { token: client.authStore.token, record: publicUser(user) };
}

export function createAuthRouter() {
  const router = Router();

  router.post("/api/auth/signup", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path?.[0];
        if (field === "password") {
          return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
        }
        return res.status(400).json({ success: false, message: "Enter a valid email address." });
      }

      const { email, password } = parsed.data;

      try {
        const user = await createUserRecord(
          {
            email,
            password,
            passwordConfirm: password,
            role: "customer",
            status: "active",
            emailVisibility: false,
          },
          email,
        );
        return res.json({ success: true, user: publicUser(user) });
      } catch (error) {
        if ((error?.response?.data || {}).email) {
          return res
            .status(409)
            .json({ success: false, message: "That email is already registered. Try signing in instead." });
        }
        throw error;
      }
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ success: false, message: "Could not create the account. Please try again." });
    }
  });

  router.get("/api/auth/providers", async (_req, res) => {
    try {
      await authenticatePocketBase();
      const collection = await pb.collections.getOne("users");
      const names = (collection?.oauth2?.providers || []).map((provider) => String(provider.name || "").toLowerCase());
      return res.json({
        success: true,
        google: names.includes("google"),
        github: names.includes("github"),
        telegram: Boolean(TELEGRAM_BOT_TOKEN),
      });
    } catch (error) {
      console.error("Provider list error:", error);
      return res.json({ success: true, google: false, github: false, telegram: Boolean(TELEGRAM_BOT_TOKEN) });
    }
  });

  router.post("/api/auth/telegram/start", rateLimit({ windowMs: 60 * 1000, max: 20 }), async (_req, res) => {
    try {
      const bot = await getTelegramBot();
      if (!bot) {
        return res.status(503).json({ success: false, message: "Telegram sign-in is not configured on this server." });
      }

      const now = Date.now();
      for (const [code, entry] of telegramLogins) {
        if (entry.expiresAt <= now) telegramLogins.delete(code);
      }

      const code = randomBytes(18).toString("base64url");
      const expiresAt = now + TELEGRAM_LOGIN_TTL_MS;
      telegramLogins.set(code, { status: "pending", expiresAt, from: null });

      return res.json({
        success: true,
        code,
        expiresAt,
        url: `https://t.me/${bot.username}?start=${code}`,
      });
    } catch (error) {
      console.error("Telegram start error:", error);
      if (isTelegramNetworkError(error)) {
        return res
          .status(503)
          .json({ success: false, message: "Telegram is temporarily unreachable. Please try again." });
      }
      return res.status(500).json({ success: false, message: "Could not start the Telegram sign-in." });
    }
  });

  router.get("/api/auth/telegram/poll", rateLimit({ windowMs: 60 * 1000, max: 300 }), async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const entry = code ? telegramLogins.get(code) : null;
      if (!entry) return res.json({ success: true, status: "expired" });

      if (entry.expiresAt <= Date.now()) {
        telegramLogins.delete(code);
        return res.json({ success: true, status: "expired" });
      }

      if (entry.status !== "confirmed") {
        void telegramUpdateLoop();
        return res.json({ success: true, status: "pending" });
      }

      telegramLogins.delete(code);
      const user = await findOrCreateTelegramUser(entry.from);
      const session = await impersonateUser(user);
      return res.json({ success: true, status: "ok", token: session.token, record: session.record });
    } catch (error) {
      console.error("Telegram poll error:", error);
      return res.status(500).json({ success: false, message: "Could not finish the Telegram sign-in." });
    }
  });

  return router;
}
