import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import PocketBase from "pocketbase";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const app = express();

const PORT = Number(process.env.API_PORT || 3001);
const API_HOST = process.env.API_HOST || "0.0.0.0";
const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";

const SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL;
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (FRONTEND_ORIGINS.includes(origin)) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname;

    // Allow local development & loopback
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
      return true;
    }
    // Allow private LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return true;
    }
    // Allow Capacitor / Ionic native mobile origins
    if (url.protocol === "capacitor:" || url.protocol === "ionic:" || origin.startsWith("https://localhost")) {
      return true;
    }
    // Allow configured production VPS host
    if (process.env.PUBLIC_BASE) {
      try {
        const publicUrl = new URL(process.env.PUBLIC_BASE);
        if (url.host === publicUrl.host) return true;
      } catch {}
    }
  } catch {
    return false;
  }
  return false;
}

if (!SUPERUSER_EMAIL || !SUPERUSER_PASSWORD) {
  throw new Error(
    "Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD in .env",
  );
}

const pb = new PocketBase(PB_URL);

pb.autoCancellation(false);

app.use(helmet());
app.use(compression({ threshold: 1024 }));

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

// Lightweight in-memory limiter. For multi-instance production deployments,
// replace this with a shared store (for example Redis).
const rateBuckets = new Map();
function rateLimit({ windowMs = 15 * 60 * 1000, max = 120 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${req.baseUrl || ""}${req.path}`;
    let bucket = rateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
    }
    // Avoid unbounded growth from one-off IP/path combinations.
    if (rateBuckets.size > 10000) {
      for (const [bucketKey, value] of rateBuckets) {
        if (now >= value.resetAt) rateBuckets.delete(bucketKey);
      }
    }
    next();
  };
}
app.use("/api", rateLimit({ max: 180 }));


app.use("/api/admin", rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }));
app.use("/api/expense-ingestions", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use("/api/shortcut-tokens", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));

/* =========================================================
   HELPERS
========================================================= */

function getBearerToken(req) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
}

async function authenticateRequest(req, { admin = false } = {}) {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const userClient = new PocketBase(PB_URL);
    userClient.autoCancellation(false);
    userClient.authStore.save(token, null);
    const refreshed = await userClient.collection("_pb_users_auth_").authRefresh();
    const user = refreshed?.record;
    if (!user || user.status !== "active") return false;
    if (admin && user.role !== "superadmin") return false;
    req.authUser = user;
    return true;
  } catch {
    return false;
  }
}

async function isAuthorized(req) {
  return authenticateRequest(req);
}

async function isAdminAuthorized(req) {
  return authenticateRequest(req, { admin: true });
}

function hashShortcutToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function getShortcutToken(req, { allowQuery = false } = {}) {
  const token = req.headers["x-shortcut-token"];
  if (typeof token === "string" && token.trim()) return token.trim();
  // Calendar subscriptions cannot send custom headers, so a feed URL may carry
  // the same device token in the query string.
  if (!allowQuery) return null;
  const query = req.query?.token;
  return typeof query === "string" && query.trim() ? query.trim() : null;
}

async function authenticateShortcutToken(req, { allowQuery = false } = {}) {
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
  } catch (error) {
    return false;
  }
}

async function authenticatePocketBase() {
  if (pb.authStore.isValid) {
    return;
  }

  await pb.collection("_superusers").authWithPassword(
    SUPERUSER_EMAIL,
    SUPERUSER_PASSWORD,
  );
}

function escapeFilterValue(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
}

function getPocketBaseError(error) {
  return (
    error?.response?.data ||
    error?.response ||
    error?.message ||
    String(error)
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
    verified: user.verified,
    emailVisibility: user.emailVisibility,
    is_password_temp: user.is_password_temp,
    created: user.created,
    updated: user.updated,
  };
}

/* =========================================================
   AUTOMATIC EXPENSE INGESTION PROCESSOR
========================================================= */

async function processExpenseIngestion(ingestion) {
  console.log(
    `Processing ingestion ${ingestion.id} - ${
      ingestion.merchant || "Unknown merchant"
    }`,
  );

  const raw =
    ingestion.raw_data && typeof ingestion.raw_data === "object"
      ? ingestion.raw_data
      : {};

  const transactionType =
    raw.type === "Income" ? "Income" : "Expense";

  const transactionNotes =
    typeof raw.notes === "string"
      ? raw.notes.trim()
      : "";

  let accountId = null;

  if (
    typeof ingestion.account === "string" &&
    ingestion.account.trim()
  ) {
    accountId = ingestion.account.trim();
  } else if (
    typeof raw.account === "string" &&
    raw.account.trim()
  ) {
    accountId = raw.account.trim();
  }

  /* -----------------------------------------
     Validate account ownership
  ----------------------------------------- */

  if (accountId) {
    try {
      const account = await pb
        .collection("bank_accounts")
        .getOne(accountId);

      if (account.user !== ingestion.user) {
        throw new Error(
          "Bank account does not belong to ingestion user.",
        );
      }
    } catch (error) {
      console.error(
        `Invalid account ${accountId}:`,
        getPocketBaseError(error),
      );

      accountId = null;
    }
  }

  /* -----------------------------------------
     Validate pet ownership
  ----------------------------------------- */

  let petId = null;

  if (
    typeof raw.pet === "string" &&
    raw.pet.trim()
  ) {
    petId = raw.pet.trim();

    try {
      const pet = await pb
        .collection("pets")
        .getOne(petId);

      if (pet.user !== ingestion.user) {
        throw new Error(
          "Pet does not belong to ingestion user.",
        );
      }
    } catch (error) {
      console.error(
        `Invalid pet ${petId}:`,
        getPocketBaseError(error),
      );

      petId = null;
    }
  }

  /* -----------------------------------------
     Duplicate expense protection

     IMPORTANT:
     Duplicate is scoped by user.
  ----------------------------------------- */

  const duplicate = await pb
    .collection("expenses")
    .getList(1, 1, {
      filter:
        `user = "${escapeFilterValue(
          ingestion.user,
        )}" && notes ~ "Ingestion: ${escapeFilterValue(
          ingestion.id,
        )}"`,
    });

  if (duplicate.items.length > 0) {
    console.log(
      "Duplicate expense found. Marking ingestion as processed.",
    );

    await pb
      .collection("expense_ingestions")
      .update(ingestion.id, {
        status: "processed",
      });

    return {
      success: true,
      duplicate: true,
      expense: duplicate.items[0],
    };
  }

  /* -----------------------------------------
     Create expense
  ----------------------------------------- */

  const expenseData = {
    user: ingestion.user,
    date: ingestion.transaction_date,
    amount: Number(ingestion.amount),
    category:
      ingestion.category || "Uncategorized",
    type: transactionType,
    notes: [
      ingestion.merchant || "",
      transactionNotes,
      `Source: ${ingestion.source || "unknown"}`,
      `Ingestion: ${ingestion.id}`,
    ]
      .filter(Boolean)
      .join(" | "),
    paid: true,
  };

  if (accountId) {
    expenseData.account = accountId;
  }

  if (petId) {
    expenseData.pet = petId;
  }

  console.log("Creating expense...");

  const expense = await pb
    .collection("expenses")
    .create(expenseData);

  console.log(
    `Expense created successfully: ${expense.id}`,
  );

  /* -----------------------------------------
     Mark ingestion as processed
  ----------------------------------------- */

  await pb
    .collection("expense_ingestions")
    .update(ingestion.id, {
      status: "processed",
    });

  console.log(
    `Ingestion ${ingestion.id} marked as processed.`,
  );

  return {
    success: true,
    duplicate: false,
    expense,
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "life-planner-saas-api",
    pocketbase: PB_URL,
  });
});

/* =========================================================
   VERIFIED MARKET QUOTES (Twelve Data; server-side API key only)
========================================================= */

const MARKET_DATA_API_KEY = process.env.MARKET_DATA_API_KEY || "";
const marketQuoteCache = new Map();
const MARKET_QUOTE_TTL_MS = 60 * 1000;
const MAX_MARKET_SYMBOLS = 15;

function unavailableQuote(symbol, message = "Market data is not configured or temporarily unavailable.") {
  return {
    symbol,
    price: null,
    change: null,
    percentChange: null,
    currency: "—",
    marketStatus: "unavailable",
    source: "Twelve Data",
    updatedAt: null,
    message,
  };
}

async function fetchTwelveDataQuote(symbol) {
  const cached = marketQuoteCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < MARKET_QUOTE_TTL_MS) return cached.quote;
  if (!MARKET_DATA_API_KEY) return unavailableQuote(symbol, "Market-data provider is not configured on the server.");

  try {
    const url = new URL("https://api.twelvedata.com/quote");
    url.searchParams.set("symbol", symbol);
    const response = await fetch(url, {
      headers: { Authorization: `apikey ${MARKET_DATA_API_KEY}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailableQuote(symbol);
    const raw = await response.json();
    if (!raw || raw.status === "error" || raw.code || raw.close == null) return unavailableQuote(symbol);

    const price = Number(raw.close);
    if (!Number.isFinite(price)) return unavailableQuote(symbol);
    const parsedChange = raw.change == null ? null : Number(raw.change);
    const parsedPercent = raw.percent_change == null ? null : Number(raw.percent_change);
    const quote = {
      symbol: String(raw.symbol || symbol).toUpperCase(),
      price,
      change: Number.isFinite(parsedChange) ? parsedChange : null,
      percentChange: Number.isFinite(parsedPercent) ? parsedPercent : null,
      currency: String(raw.currency || "—").slice(0, 12),
      marketStatus: raw.is_market_open === true || raw.is_market_open === "true" ? "live" : "eod",
      source: "Twelve Data",
      updatedAt: typeof raw.datetime === "string" ? raw.datetime : null,
    };
    marketQuoteCache.set(symbol, { cachedAt: Date.now(), quote });
    return quote;
  } catch {
    return unavailableQuote(symbol);
  }
}

app.get("/api/market-quotes", rateLimit({ windowMs: 60 * 1000, max: 30 }), async (req, res) => {
  if (!(await isAuthorized(req))) {
    return res.status(401).json({ success: false, message: "Please sign in to view market quotes." });
  }

  const rawSymbols = typeof req.query.symbols === "string" ? req.query.symbols : "";
  const symbols = [...new Set(rawSymbols.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length) return res.json({ quotes: [] });
  if (symbols.length > MAX_MARKET_SYMBOLS || symbols.some((symbol) => !/^[A-Z0-9._:/-]{1,32}$/.test(symbol))) {
    return res.status(400).json({ success: false, message: `Request up to ${MAX_MARKET_SYMBOLS} valid symbols at a time.` });
  }

  // Small concurrent batches keep the request bounded while avoiding a long
  // 15-symbol serial wait; the per-IP route limiter caps repeat bursts.
  const quotes = [];
  for (let index = 0; index < symbols.length; index += 3) {
    const batch = await Promise.all(symbols.slice(index, index + 3).map(fetchTwelveDataQuote));
    quotes.push(...batch);
  }
  return res.json({ quotes });
});

/* =========================================================
   IOS SHORTCUT DEVICE TOKENS
========================================================= */

const shortcutTokenCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
});

/* =========================================================
   PUBLIC BASE URL
========================================================= */

// A tunnel (or a real deployment) makes the API reachable from the internet,
// which is what a phone needs before it can subscribe to the calendar feed.
// The value lives in a small file so the API and the tunnel helper share it
// without either one having to restart.
const RUNTIME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".runtime");
const PUBLIC_BASE_FILE = path.join(RUNTIME_DIR, "public-base.json");

function normalizeBaseUrl(value) {
  const raw = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!raw) return "";
  return /^https?:\/\/[^\s]+$/i.test(raw) ? raw : "";
}

function readPublicBase() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLIC_BASE_FILE, "utf8"));
    return normalizeBaseUrl(parsed?.url);
  } catch {
    return "";
  }
}

function writePublicBase(value) {
  const clean = normalizeBaseUrl(value);
  if (!clean) {
    try {
      fs.rmSync(PUBLIC_BASE_FILE, { force: true });
    } catch {
      /* already gone */
    }
    return "";
  }

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(
    PUBLIC_BASE_FILE,
    `${JSON.stringify({ url: clean, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return clean;
}

// Home Wi-Fi ranges are the ones a phone can actually reach; virtual adapters
// (Hyper-V, WSL, Docker) usually sit on 172.x and go last.
function getLanBase() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!addresses.includes(entry.address)) addresses.push(entry.address);
    }
  }

  const rank = (address) => {
    if (address.startsWith("192.168.")) return 0;
    if (address.startsWith("10.")) return 1;
    if (address.startsWith("172.")) return 3;
    return 2;
  };
  addresses.sort((a, b) => rank(a) - rank(b));

  return {
    addresses,
    url: addresses.length ? `http://${addresses[0]}:${PORT}` : "",
  };
}

// The phone can only reach this machine through a LAN address, so the setup
// screen needs to know which one to hand out instead of guessing.
app.get("/api/network-info", async (req, res) => {
  try {
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const lan = getLanBase();
    const publicUrl = readPublicBase();

    return res.json({
      success: true,
      port: PORT,
      addresses: lan.addresses,
      lanUrl: lan.url,
      publicUrl,
      // The feed is opened by the phone, so prefer the tunnel when one is up.
      url: publicUrl || lan.url,
      reachableFromInternet: Boolean(publicUrl),
    });
  } catch (error) {
    console.error("Network info error:", error);
    return res.status(500).json({ success: false, message: "Could not read the network addresses." });
  }
});

// Lets the app (or the tunnel helper) publish a public address by hand.
// Sending an empty value clears it; sending something unparseable is rejected
// instead of silently dropping a tunnel that is currently working.
app.post("/api/public-base", async (req, res) => {
  try {
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const raw = req.body?.url;
    const blank = raw === undefined || raw === null || String(raw).trim() === "";
    if (!blank && !normalizeBaseUrl(raw)) {
      return res.status(400).json({
        success: false,
        message: "The public base URL must start with http:// or https://.",
      });
    }

    return res.json({ success: true, publicUrl: writePublicBase(blank ? "" : raw) });
  } catch (error) {
    console.error("Public base error:", error);
    return res.status(500).json({ success: false, message: "Could not save the public base URL." });
  }
});

app.get("/api/shortcut-tokens", async (req, res) => {
  try {
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    await authenticatePocketBase();
    const user = req.authUser;
    const result = await pb.collection("shortcut_tokens").getFullList({
      filter: `user = "${escapeFilterValue(user.id)}"`,
      sort: "-created",
    });
    return res.json({
      success: true,
      devices: result.map((item) => ({
        id: item.id,
        label: item.label,
        last_four: item.last_four,
        created: item.created,
        updated: item.updated,
        last_used_at: item.last_used_at || null,
        expires_at: item.expires_at || null,
        revoked: Boolean(item.revoked),
      })),
    });
  } catch (error) {
    console.error("Shortcut token list error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not load Shortcut devices." });
  }
});

app.post("/api/shortcut-tokens", async (req, res) => {
  try {
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const parsed = shortcutTokenCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Enter a device name (1–80 characters)." });
    }
    const user = req.authUser;
    if (!user?.id || String(user.status || "").toLowerCase() !== "active") {
      return res.status(403).json({ success: false, message: "An active account is required." });
    }

    await authenticatePocketBase();
    const rawToken = `lpst_${randomBytes(32).toString("base64url")}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const record = await pb.collection("shortcut_tokens").create({
      user: user.id,
      label: parsed.data.label,
      token_hash: hashShortcutToken(rawToken),
      last_four: rawToken.slice(-4),
      revoked: false,
      expires_at: expiry.toISOString(),
    });

    // The cleartext token is returned once. Only its SHA-256 hash is stored.
    return res.status(201).json({
      success: true,
      token: rawToken,
      device: {
        id: record.id,
        label: record.label,
        last_four: record.last_four,
        created: record.created,
        expires_at: record.expires_at,
        revoked: false,
      },
      message: "Copy this token now. It cannot be shown again.",
    });
  } catch (error) {
    console.error("Shortcut token create error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not create a Shortcut device token." });
  }
});

app.delete("/api/shortcut-tokens/:id", async (req, res) => {
  try {
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    await authenticatePocketBase();
    const user = req.authUser;
    let device;
    try {
      device = await pb.collection("shortcut_tokens").getOne(req.params.id);
    } catch {
      return res.status(404).json({ success: false, message: "Shortcut device not found." });
    }
    if (device.user !== user.id) {
      return res.status(404).json({ success: false, message: "Shortcut device not found." });
    }
    if (!device.revoked) {
      await pb.collection("shortcut_tokens").update(device.id, { revoked: true });
    }
    return res.json({ success: true, message: "Shortcut device token revoked." });
  } catch (error) {
    console.error("Shortcut token revoke error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not revoke Shortcut device token." });
  }
});

/* =========================================================
   CALENDAR FEED (ICS)
========================================================= */

function icsEscape(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 asks for content lines under 75 octets. Long values are folded
// onto continuation lines that begin with a single space.
function icsFold(line) {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  return parts.join("\r\n");
}

function toIcsDateKey(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

function addIcsDays(key, days) {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))));
  date.setUTCDate(date.getUTCDate() + days);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}${month}${day}`;
}

function buildCalendarIcs(events, { calendarName }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Life Planner//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    icsFold(`X-WR-CALNAME:${icsEscape(calendarName)}`),
    "X-WR-TIMEZONE:UTC",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${event.start}`);
    lines.push(`DTEND;VALUE=DATE:${event.end}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(event.title)}`));
    if (event.description) lines.push(icsFold(`DESCRIPTION:${icsEscape(event.description)}`));
    if (event.location) lines.push(icsFold(`LOCATION:${icsEscape(event.location)}`));
    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

async function collectCalendarEvents(userId) {
  const filter = `user = "${escapeFilterValue(userId)}"`;
  const [tasks, trips, goals, experiences] = await Promise.all([
    pb.collection("life_planner").getFullList({ filter, sort: "due_date" }),
    pb.collection("travel_trips").getFullList({ filter, sort: "start_date" }),
    pb.collection("goals").getFullList({ filter, sort: "due_date" }),
    pb.collection("experiences").getFullList({ filter, sort: "start_date" }),
  ]);

  const events = [];

  for (const task of tasks) {
    const start = toIcsDateKey(task.due_date);
    if (!start || String(task.status || "").toLowerCase() === "done") continue;
    events.push({
      uid: `task-${task.id}@life-planner`,
      start,
      end: addIcsDays(start, 1),
      title: `Task: ${task.title || "Untitled task"}`,
      description: [
        task.priority ? `Priority: ${task.priority}` : "",
        task.category ? `Category: ${task.category}` : "",
        task.description || "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  for (const trip of trips) {
    const start = toIcsDateKey(trip.start_date);
    if (!start) continue;
    const finish = toIcsDateKey(trip.end_date) || start;
    events.push({
      uid: `trip-${trip.id}@life-planner`,
      start,
      end: addIcsDays(finish < start ? start : finish, 1),
      title: `Trip: ${trip.name || "Untitled trip"}`,
      location: trip.destination || "",
      description: trip.notes || "",
    });
  }

  for (const goal of goals) {
    const start = toIcsDateKey(goal.target_date);
    if (!start) continue;
    const target = Number(goal.target_amount || 0);
    const current = Number(goal.current_amount || 0);
    const percent =
      target > 0 ? Math.round((current / target) * 100) : Math.round(Number(goal.progress || 0));
    events.push({
      uid: `goal-${goal.id}@life-planner`,
      start,
      end: addIcsDays(start, 1),
      title: `Goal: ${goal.name || "Untitled goal"}`,
      description: [`Progress: ${percent}%`, goal.status ? `Status: ${goal.status}` : "", goal.notes || ""]
        .filter(Boolean)
        .join("\n"),
    });
  }

  for (const item of experiences) {
    const start = toIcsDateKey(item.start_date);
    if (!start || String(item.status || "").toLowerCase() === "cancelled") continue;
    const finish = toIcsDateKey(item.end_date) || start;
    events.push({
      uid: `experience-${item.id}@life-planner`,
      start,
      end: addIcsDays(finish < start ? start : finish, 1),
      title: `Experience: ${item.name || "Untitled experience"}`,
      location: item.location || "",
      description: [item.type ? `Type: ${item.type}` : "", item.status ? `Status: ${item.status}` : "", item.notes || ""]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

app.get("/api/calendar.ics", rateLimit({ windowMs: 60 * 1000, max: 60 }), async (req, res) => {
  try {
    const sessionAuthorized = await isAuthorized(req);
    const shortcutAuthorized = sessionAuthorized ? false : await authenticateShortcutToken(req, { allowQuery: true });
    if (!sessionAuthorized && !shortcutAuthorized) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Sign in or add a valid token to the calendar feed URL.",
      });
    }

    await authenticatePocketBase();
    const user = req.authUser;
    const events = await collectCalendarEvents(user.id);
    const calendarName = `Life Planner - ${user.name || user.email || "Calendar"}`;

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="life-planner.ics"');
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.send(buildCalendarIcs(events, { calendarName }));
  } catch (error) {
    console.error("Calendar feed error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not build the calendar feed." });
  }
});

/* =========================================================
   EXPENSE INGESTION
========================================================= */

const expenseIngestionSchema = z.object({
  external_id: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .nullable(),

  amount: z
    .number()
    .positive(),

  category: z
    .string()
    .min(1)
    .max(200),

  date: z
    .string()
    .min(1),

  type: z
    .enum(["Income", "Expense"])
    .default("Expense"),

  notes: z
    .string()
    .max(2000)
    .optional()
    .nullable(),

  merchant: z
    .string()
    .max(200)
    .optional()
    .nullable(),

  pet: z
    .string()
    .max(100)
    .optional()
    .nullable(),

  account: z
    .string()
    .max(100)
    .optional()
    .nullable(),

  source: z
    .enum(["manual", "shortcut", "receipt"])
    .default("manual"),
});

app.post(
  "/api/expense-ingestions",
  async (req, res) => {
    try {
      /* -----------------------------------------
         API authorization
      ----------------------------------------- */

      const sessionAuthorized = await isAuthorized(req);
      const shortcutAuthorized = sessionAuthorized ? false : await authenticateShortcutToken(req);
      if (!sessionAuthorized && !shortcutAuthorized) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Use a valid user session or a registered Shortcut device token.",
        });
      }

      /* -----------------------------------------
         Validate request
      ----------------------------------------- */

      const parsed =
        expenseIngestionSchema.safeParse(
          req.body,
        );

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid expense ingestion data.",
          errors:
            parsed.error.flatten(),
        });
      }

      const data = parsed.data;

      /* -----------------------------------------
         Authenticate PocketBase
      ----------------------------------------- */

      await authenticatePocketBase();

      /* -----------------------------------------
         User identity comes only from the verified session.
      ----------------------------------------- */

      const user = req.authUser;
      if (!user?.id || String(user.status || "").toLowerCase() !== "active") {
        return res.status(403).json({
          success: false,
          message: "An active user session is required.",
        });
      }

      /* -----------------------------------------
         Validate account ownership
      ----------------------------------------- */

      let accountId = null;

      if (
        data.account &&
        data.account.trim()
      ) {
        try {
          const account = await pb
            .collection("bank_accounts")
            .getOne(data.account.trim());

          if (account.user !== user.id) {
            return res.status(403).json({
              success: false,
              message:
                "Bank account does not belong to this user.",
            });
          }

          accountId = account.id;
        } catch {
          return res.status(400).json({
            success: false,
            message:
              "Invalid bank account.",
          });
        }
      }

      /* -----------------------------------------
         Validate pet ownership
      ----------------------------------------- */

      let petId = null;

      if (
        data.pet &&
        data.pet.trim()
      ) {
        try {
          const pet = await pb
            .collection("pets")
            .getOne(data.pet.trim());

          if (pet.user !== user.id) {
            return res.status(403).json({
              success: false,
              message:
                "Pet does not belong to this user.",
            });
          }

          petId = pet.id;
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid pet.",
          });
        }
      }

      /* -----------------------------------------
         Duplicate external ID

         Scoped per user.
      ----------------------------------------- */

      if (data.external_id) {
        const escaped =
          escapeFilterValue(
            data.external_id,
          );

        const userEscaped =
          escapeFilterValue(user.id);

        const existing = await pb
          .collection(
            "expense_ingestions",
          )
          .getList(1, 1, {
            filter:
              `user = "${userEscaped}" && external_id = "${escaped}"`,
          });

        if (
          existing.items.length > 0
        ) {
          const item =
            existing.items[0];

          /* -----------------------------------------
             Existing pending ingestion:
             process it now.
          ----------------------------------------- */

          if (
            item.status === "pending"
          ) {
            console.log(
              `Existing pending ingestion found: ${item.id}`,
            );

            try {
              const processed =
                await processExpenseIngestion(
                  item,
                );

              return res.status(200).json({
                success: true,
                duplicate: true,
                processed: true,
                message:
                  "Existing expense ingestion processed.",
                ingestion: {
                  id: item.id,
                  status: "processed",
                  source: item.source,
                },
                expense:
                  processed.expense
                    ? {
                        id:
                          processed.expense
                            .id,
                      }
                    : null,
              });
            } catch (
              processingError
            ) {
              console.error(
                "Existing ingestion processing error:",
                getPocketBaseError(
                  processingError,
                ),
              );

              await pb
                .collection(
                  "expense_ingestions",
                )
                .update(item.id, {
                  status: "failed",
                });

              return res
                .status(500)
                .json({
                  success: false,
                  message:
                    "Expense ingestion exists but automatic processing failed.",
                  ingestion: {
                    id: item.id,
                    status: "failed",
                  },
                });
            }
          }

          return res.status(200).json({
            success: true,
            duplicate: true,
            message:
              "Expense ingestion already exists.",
            ingestion: {
              id: item.id,
              status: item.status,
              source: item.source,
            },
          });
        }
      }

      /* -----------------------------------------
         Create ingestion
      ----------------------------------------- */

      const ingestionData = {
        user: user.id,
        source: req.authMethod === "shortcut" ? "shortcut" : data.source,
        external_id:
          data.external_id || null,
        merchant:
          data.merchant || null,
        amount: data.amount,
        transaction_date: data.date,
        category: data.category,
        notes: data.notes || "",
        raw_data: {
          type: data.type,
          notes: data.notes || "",
          pet: petId,
          account: accountId,
          merchant:
            data.merchant || null,
          source: data.source,
        },
        status: "pending",
      };

      if (accountId) {
        ingestionData.account =
          accountId;
      }

      const ingestion = await pb
        .collection(
          "expense_ingestions",
        )
        .create(ingestionData);

      console.log(
        `Expense ingestion created: ${ingestion.id}`,
      );

      /* -----------------------------------------
         Automatic processing
      ----------------------------------------- */

      let processed;

      try {
        processed =
          await processExpenseIngestion(
            ingestion,
          );
      } catch (
        processingError
      ) {
        console.error(
          "Automatic expense processing error:",
          getPocketBaseError(
            processingError,
          ),
        );

        try {
          await pb
            .collection(
              "expense_ingestions",
            )
            .update(
              ingestion.id,
              {
                status: "failed",
              },
            );
        } catch (
          statusError
        ) {
          console.error(
            "Could not mark ingestion as failed:",
            getPocketBaseError(
              statusError,
            ),
          );
        }

        return res.status(500).json({
          success: false,
          message:
            "Expense ingestion was created, but automatic processing failed.",
          ingestion: {
            id: ingestion.id,
            status: "failed",
          },
        });
      }

      /* -----------------------------------------
         Response
      ----------------------------------------- */

      return res.status(201).json({
        success: true,
        message:
          "Expense created successfully.",
        ingestion: {
          id: ingestion.id,
          source: ingestion.source,
          status: "processed",
          amount: ingestion.amount,
          category:
            ingestion.category,
          transaction_date:
            ingestion.transaction_date,
          user: ingestion.user,
          account: accountId,
          pet: petId,
        },
        expense: {
          id:
            processed.expense?.id ||
            null,
          user:
            processed.expense?.user ||
            user.id,
        },
      });
    } catch (error) {
      console.error(
        "Expense ingestion API error:",
        getPocketBaseError(error),
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not create expense ingestion.",
      });
    }
  },
);

/* =========================================================
   ADMIN
========================================================= */

async function logAdminAction(
  req,
  { action, targetId = null, targetLabel = null, details = null } = {},
) {
  try {
    await authenticatePocketBase();
    const admin = req.authUser;
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const userAgent = req.headers["user-agent"] || "";

    await pb.collection("admin_audit_logs").create({
      admin_id: admin?.id || "unknown",
      admin_email: admin?.email || "unknown",
      action,
      target_id: targetId,
      target_label: targetLabel,
      details: details ? details : null,
      ip_address: ip,
      user_agent: userAgent.slice(0, 500),
    });
  } catch (err) {
    console.error("Failed to record admin audit log:", getPocketBaseError(err));
  }
}

/* -----------------------------------------
   LIST USERS
----------------------------------------- */

app.get(
  "/api/admin/users",
  async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      await authenticatePocketBase();

      const result = await pb
        .collection("_pb_users_auth_")
        .getFullList({
          sort: "-created",
        });

      return res.json({
        success: true,
        users: result.map(
          publicUser,
        ),
      });
    } catch (error) {
      console.error(
        "Admin list users error:",
        getPocketBaseError(error),
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load users.",
      });
    }
  },
);

/* -----------------------------------------
   CREATE USER

   Flow:
   Admin provides temporary password
   ↓
   is_password_temp = true
   ↓
   Customer logs in
   ↓
   ChangePassword page
----------------------------------------- */

const createUserSchema =
  z.object({
    email: z
      .string()
      .email(),

    password: z
      .string()
      .min(8),

    username: z
      .string()
      .min(1)
      .optional(),

    name: z
      .string()
      .optional(),

    role: z
      .enum([
        "superadmin",
        "customer",
      ])
      .default("customer"),

    status: z
      .enum(["active", "suspended", "pending"])
      .default("active"),
    verified: z.boolean().default(false),
    emailVisibility: z.boolean().default(false),
  });

app.post(
  "/api/admin/users",
  async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const parsed =
        createUserSchema.safeParse(
          req.body,
        );

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user data.",
          errors:
            parsed.error.flatten(),
        });
      }

      await authenticatePocketBase();

      const data = parsed.data;

      const username =
        data.username ||
        data.email.split("@")[0];

      const user = await pb
        .collection(
          "_pb_users_auth_",
        )
        .create({
          email: data.email,
          password: data.password,
          passwordConfirm:
            data.password,
          username,
          name: data.name || "",
          role: data.role,
          status: data.status,
          verified: data.verified,
          emailVisibility: data.emailVisibility,

          // New users MUST change
          // their temporary password.
          is_password_temp: true,
        });

      await logAdminAction(req, {
        action: "USER_CREATE",
        targetId: user.id,
        targetLabel: user.email || user.username,
        details: { role: user.role, status: user.status },
      });

      return res.status(201).json({
        success: true,
        message:
          "User created successfully.",

        user: publicUser(user),

        // Returned only during creation.
        // Do not persist this value.
        temporary_password:
          data.password,
      });
    } catch (error) {
      console.error(
        "Admin create user error:",
        getPocketBaseError(error),
      );

      return res.status(400).json({
        success: false,
        message:
          error?.response?.data
            ?.message ||
          error?.message ||
          "Could not create user.",
      });
    }
  },
);

/* -----------------------------------------
   UPDATE USER

   IMPORTANT FIX:
   password MUST be passed to PocketBase.

   Previous bug:
     delete updateData.password

   That caused password reset
   to fail with:
     "Failed to update record."
----------------------------------------- */

const updateUserSchema =
  z.object({
    email: z
      .string()
      .email()
      .optional(),

    username: z
      .string()
      .min(1)
      .optional(),

    name: z
      .string()
      .optional(),

    password: z
      .string()
      .min(8)
      .optional(),

    role: z
      .enum([
        "superadmin",
        "customer",
      ])
      .optional(),

    status: z
      .enum(["active", "suspended", "pending"])
      .optional(),
    verified: z.boolean().optional(),
    emailVisibility: z.boolean().optional(),

    is_password_temp:
      z.boolean().optional(),
  });

app.patch(
  "/api/admin/users/:id",
  async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const parsed =
        updateUserSchema.safeParse(
          req.body,
        );

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user data.",
          errors:
            parsed.error.flatten(),
        });
      }

      await authenticatePocketBase();

      const data = parsed.data;
      const actingAdmin = req.authUser;

      // Do not let the current admin demote or suspend their own account.
      // This checks the authenticated users-collection record, not the separate
      // PocketBase superuser used internally by this Express service.
      if (actingAdmin?.id === req.params.id) {
        if (data.role === "customer" || (data.status !== undefined && data.status !== "active")) {
          return res.status(400).json({
            success: false,
            message: "You cannot remove administrator access or suspend your own account.",
          });
        }
      }

      const updateData = {};

      if (data.email !== undefined) {
        updateData.email =
          data.email;
      }

      if (
        data.username !== undefined
      ) {
        updateData.username =
          data.username;
      }

      if (data.name !== undefined) {
        updateData.name =
          data.name;
      }

      if (data.role !== undefined) {
        updateData.role =
          data.role;
      }

      if (data.status !== undefined) updateData.status = data.status;
      if (data.verified !== undefined) updateData.verified = data.verified;
      if (data.emailVisibility !== undefined) updateData.emailVisibility = data.emailVisibility;

      /*
       * Password reset:
       *
       * Admin supplies a new temporary
       * password.
       *
       * PocketBase receives BOTH password
       * and passwordConfirm.
       *
       * Unless explicitly overridden,
       * resetting a password means the
       * customer must change it.
       */
      if (data.password) {
        updateData.password =
          data.password;

        updateData.passwordConfirm =
          data.password;

        if (
          data.is_password_temp ===
          undefined
        ) {
          updateData.is_password_temp =
            true;
        }
      } else if (
        data.is_password_temp !==
        undefined
      ) {
        updateData.is_password_temp =
          data.is_password_temp;
      }

      if (data.status === "suspended" || data.password) {
        updateData.tokenKey = randomBytes(30).toString("base64url");
      }

      const user = await pb
        .collection(
          "_pb_users_auth_",
        )
        .update(
          req.params.id,
          updateData,
        );

      if (data.status === "suspended") {
        try {
          const tokens = await pb.collection("shortcut_tokens").getFullList({
            filter: `user = "${escapeFilterValue(req.params.id)}" && revoked = false`,
          });
          for (const t of tokens) {
            await pb.collection("shortcut_tokens").update(t.id, { revoked: true });
          }
        } catch (tokenErr) {
          console.warn("Could not revoke shortcut tokens on suspension:", tokenErr);
        }
      }

      await logAdminAction(req, {
        action:
          data.status === "suspended"
            ? "USER_SUSPEND"
            : data.password
              ? "USER_PASSWORD_CHANGE"
              : "USER_UPDATE",
        targetId: user.id,
        targetLabel: user.email || user.username,
        details: { updatedFields: Object.keys(updateData) },
      });

      return res.json({
        success: true,
        message:
          "User updated successfully.",
        user: publicUser(user),

        /*
         * Only return the new temporary
         * password when a password was
         * actually reset.
         */
        ...(data.password
          ? {
              temporary_password:
                data.password,
            }
          : {}),
      });
    } catch (error) {
      console.error(
        "Admin update user error:",
        getPocketBaseError(error),
      );

      return res.status(400).json({
        success: false,
        message:
          error?.response?.data
            ?.message ||
          error?.message ||
          "Could not update user.",
        details:
          error?.response?.data ||
          undefined,
      });
    }
  },
);

/* -----------------------------------------
   DELETE USER
----------------------------------------- */

app.delete(
  "/api/admin/users/:id",
  async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      await authenticatePocketBase();

      if (
        req.params.id ===
        req.authUser?.id
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot delete the currently authenticated superadmin.",
        });
      }

      await pb
        .collection(
          "_pb_users_auth_",
        )
        .delete(
          req.params.id,
        );

      await logAdminAction(req, {
        action: "USER_DELETE",
        targetId: req.params.id,
        targetLabel: req.params.id,
      });

      return res.json({
        success: true,
        message:
          "User deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Admin delete user error:",
        getPocketBaseError(error),
      );

      return res.status(400).json({
        success: false,
        message:
          error?.response?.data
            ?.message ||
          error?.message ||
          "Could not delete user.",
      });
    }
  },
);


/* -----------------------------------------
   ADMIN AUDIT LOGS
----------------------------------------- */

app.get("/api/admin/audit-logs", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();

    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(10, Number(req.query.perPage) || 30));
    let filter = "";
    if (req.query.action && typeof req.query.action === "string" && req.query.action.trim()) {
      filter = `action = "${escapeFilterValue(req.query.action.trim())}"`;
    }

    const result = await pb.collection("admin_audit_logs").getList(page, perPage, {
      sort: "-created",
      filter: filter || undefined,
    });

    return res.json({
      success: true,
      items: result.items,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Admin list audit logs error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not load audit logs." });
  }
});

/* -----------------------------------------
   FORCE REVOKE / INSTANT INVALIDATE SESSIONS
----------------------------------------- */

app.post("/api/admin/users/:id/revoke-sessions", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();

    const targetUser = await pb.collection("_pb_users_auth_").getOne(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // 1. Invalidate PocketBase JWT sessions by regenerating tokenKey
    const newTokenKey = randomBytes(30).toString("base64url");
    await pb.collection("_pb_users_auth_").update(targetUser.id, {
      tokenKey: newTokenKey,
    });

    // 2. Revoke all shortcut device tokens
    let revokedTokensCount = 0;
    try {
      const tokens = await pb.collection("shortcut_tokens").getFullList({
        filter: `user = "${escapeFilterValue(targetUser.id)}" && revoked = false`,
      });
      for (const t of tokens) {
        await pb.collection("shortcut_tokens").update(t.id, { revoked: true });
        revokedTokensCount++;
      }
    } catch (tokenErr) {
      console.warn("Could not revoke shortcut tokens:", tokenErr);
    }

    await logAdminAction(req, {
      action: "USER_REVOKE_SESSIONS",
      targetId: targetUser.id,
      targetLabel: targetUser.email || targetUser.username,
      details: { revokedTokensCount },
    });

    return res.json({
      success: true,
      message: `Semua sesi aktif untuk "${targetUser.username}" berhasil dicabut. Pengguna harus login kembali.`,
      revokedTokensCount,
    });
  } catch (error) {
    console.error("Revoke sessions error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Gagal mencabut sesi pengguna." });
  }
});

/* -----------------------------------------
   SEND PASSWORD RESET EMAIL (VIA POCKETBASE SMTP)
----------------------------------------- */

app.post("/api/admin/users/:id/send-reset-email", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();

    const targetUser = await pb.collection("_pb_users_auth_").getOne(req.params.id);
    if (!targetUser || !targetUser.email) {
      return res.status(400).json({ success: false, message: "Pengguna tidak memiliki alamat email yang valid." });
    }

    await pb.collection("users").requestPasswordReset(targetUser.email);

    await logAdminAction(req, {
      action: "PASSWORD_RESET_SENT",
      targetId: targetUser.id,
      targetLabel: targetUser.email,
    });

    return res.json({
      success: true,
      message: `Instruksi reset kata sandi telah dikirim ke ${targetUser.email}.`,
    });
  } catch (error) {
    console.error("Send password reset email error:", getPocketBaseError(error));
    return res.status(500).json({
      success: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        "Gagal mengirim email reset kata sandi. Pastikan konfigurasi SMTP aktif.",
    });
  }
});

/* -----------------------------------------
   DATABASE BACKUPS (1-CLICK SNAPSHOT)
----------------------------------------- */

app.get("/api/admin/backups", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();
    const list = await pb.backups.getFullList();

    return res.json({
      success: true,
      backups: list.map((item) => ({
        key: item.key,
        size: item.size,
        modified: item.modified,
      })),
    });
  } catch (error) {
    console.error("Admin list backups error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not load backups." });
  }
});

app.post("/api/admin/backups", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `backup_${dateStr}.zip`;

    await pb.backups.create(backupName);

    await logAdminAction(req, {
      action: "BACKUP_CREATE",
      targetLabel: backupName,
    });

    return res.status(201).json({
      success: true,
      message: `Snapshot cadangan "${backupName}" berhasil dibuat.`,
      backupName,
    });
  } catch (error) {
    console.error("Admin create backup error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Gagal membuat snapshot backup database." });
  }
});

app.delete("/api/admin/backups/:key", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();
    const key = req.params.key;

    await pb.backups.delete(key);

    await logAdminAction(req, {
      action: "BACKUP_DELETE",
      targetLabel: key,
    });

    return res.json({
      success: true,
      message: `File backup "${key}" berhasil dihapus.`,
    });
  } catch (error) {
    console.error("Admin delete backup error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Gagal menghapus file backup." });
  }
});

app.get("/api/admin/backups/:key/download", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();
    const key = req.params.key;
    const fileToken = await pb.files.getToken();
    const downloadUrl = pb.backups.getDownloadURL(fileToken, key);

    const pbRes = await fetch(downloadUrl);
    if (!pbRes.ok) {
      throw new Error(`PocketBase download failed with status ${pbRes.status}`);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${key}"`);
    res.setHeader("Content-Type", pbRes.headers.get("content-type") || "application/zip");

    if (pbRes.body) {
      Readable.fromWeb(pbRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Admin download backup error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Gagal mengunduh file backup." });
  }
});

/* -----------------------------------------
   SMTP & EMAIL CONFIGURATION
----------------------------------------- */

app.get("/api/admin/settings/mail", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await authenticatePocketBase();
    const settings = await pb.settings.getAll();

    return res.json({
      success: true,
      smtp: {
        enabled: Boolean(settings.smtp?.enabled),
        host: settings.smtp?.host || "",
        port: Number(settings.smtp?.port) || 587,
        username: settings.smtp?.username || "",
        authMethod: settings.smtp?.authMethod || "PLAIN",
        tls: Boolean(settings.smtp?.tls),
        hasPassword: Boolean(settings.smtp?.password),
      },
      meta: {
        senderName: settings.meta?.senderName || "Life Planner",
        senderAddress: settings.meta?.senderAddress || "noreply@lifeplanner.local",
      },
    });
  } catch (error) {
    console.error("Admin get mail settings error:", getPocketBaseError(error));
    return res.status(500).json({ success: false, message: "Could not load mail settings." });
  }
});

const mailSettingsSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim(),
  port: z.number().int().min(1).max(65535),
  username: z.string().trim(),
  password: z.string().optional(),
  authMethod: z.enum(["PLAIN", "LOGIN"]).default("PLAIN"),
  tls: z.boolean(),
  senderName: z.string().trim().min(1),
  senderAddress: z.string().trim().email(),
});

app.patch("/api/admin/settings/mail", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = mailSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid mail settings data.",
        errors: parsed.error.flatten(),
      });
    }

    await authenticatePocketBase();
    const currentSettings = await pb.settings.getAll();
    const data = parsed.data;

    const newSmtp = {
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      username: data.username,
      password:
        data.password !== undefined && data.password !== ""
          ? data.password
          : currentSettings.smtp?.password || "",
      authMethod: data.authMethod,
      tls: data.tls,
    };

    const newMeta = {
      ...(currentSettings.meta || {}),
      senderName: data.senderName,
      senderAddress: data.senderAddress,
    };

    await pb.settings.update({
      smtp: newSmtp,
      meta: newMeta,
    });

    await logAdminAction(req, {
      action: "SMTP_UPDATE",
      targetLabel: data.senderAddress,
      details: { host: data.host, port: data.port, enabled: data.enabled },
    });

    return res.json({
      success: true,
      message: "Pengaturan SMTP dan email berhasil disimpan.",
      smtp: {
        ...newSmtp,
        password: undefined,
        hasPassword: Boolean(newSmtp.password),
      },
      meta: {
        senderName: newMeta.senderName,
        senderAddress: newMeta.senderAddress,
      },
    });
  } catch (error) {
    console.error("Admin update mail settings error:", getPocketBaseError(error));
    return res.status(500).json({
      success: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        "Gagal memperbarui pengaturan SMTP.",
    });
  }
});

app.post("/api/admin/settings/mail/test", async (req, res) => {
  try {
    if (!(await isAdminAuthorized(req))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const targetEmail = String(req.body?.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Alamat email penerima uji coba tidak valid.",
      });
    }

    await authenticatePocketBase();
    await pb.settings.testEmail(targetEmail, "verification");

    await logAdminAction(req, {
      action: "SMTP_TEST",
      targetLabel: targetEmail,
    });

    return res.json({
      success: true,
      message: `Email uji coba berhasil dikirim ke "${targetEmail}". Silakan periksa kotak masuk/spam.`,
    });
  } catch (error) {
    console.error("Admin test mail error:", getPocketBaseError(error));
    return res.status(500).json({
      success: false,
      message:
        error?.response?.data?.message ||
        error?.message ||
        "Pengiriman email uji coba gagal. Periksa konfigurasi host, port, username, atau password SMTP Anda.",
    });
  }
});

/* =========================================================
   ACCOUNT SIGN-UP
========================================================= */

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_LOGIN_TTL_MS = 5 * 60 * 1000;

// Codes handed to the browser while it waits for the Telegram bot to confirm.
// Nothing is persisted; restarting the API simply cancels pending attempts.
const telegramLogins = new Map();

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(72),
});

// PocketBase wants a username that is 3-15 lowercase characters and unique.
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
      // Only a taken username is worth retrying; anything else is the caller's.
      if (!(error?.response?.data || {}).username) throw error;
    }
  }

  throw lastError || new Error("Could not create the account.");
}

app.post("/api/auth/signup", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), async (req, res) => {
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

// Tells the auth screen which social sign-in buttons can actually work.
app.get("/api/auth/providers", async (_req, res) => {
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

/* ----- Telegram sign-in (bot handshake, so no domain is required) ----- */

async function telegramApi(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return response.json();
}

let telegramBot = null;
async function getTelegramBot() {
  if (telegramBot) return telegramBot;
  if (!TELEGRAM_BOT_TOKEN) return null;
  const body = await telegramApi("getMe", {});
  if (!body?.ok) return null;
  telegramBot = body.result;
  return telegramBot;
}

// One long-poll loop serves every pending sign-in, so Telegram is only asked
// for updates while somebody is actually waiting.
let telegramLoopRunning = false;
let telegramOffset = 0;

async function telegramUpdateLoop() {
  if (telegramLoopRunning) return;
  telegramLoopRunning = true;

  try {
    while (telegramLogins.size > 0) {
      const body = await telegramApi("getUpdates", {
        offset: telegramOffset,
        timeout: 20,
        allowed_updates: ["message"],
      });

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

app.post("/api/auth/telegram/start", rateLimit({ windowMs: 60 * 1000, max: 20 }), async (_req, res) => {
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
    return res.status(500).json({ success: false, message: "Could not start the Telegram sign-in." });
  }
});

app.get("/api/auth/telegram/poll", rateLimit({ windowMs: 60 * 1000, max: 300 }), async (req, res) => {
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

    // Claim the code before the slow part so a second poll cannot replay it.
    telegramLogins.delete(code);
    const user = await findOrCreateTelegramUser(entry.from);
    const session = await impersonateUser(user);
    return res.json({ success: true, status: "ok", token: session.token, record: session.record });
  } catch (error) {
    console.error("Telegram poll error:", error);
    return res.status(500).json({ success: false, message: "Could not finish the Telegram sign-in." });
  }
});

/* =========================================================
   SHORTCUT DOWNLOAD
========================================================= */

const SHORTCUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ios-shortcut");

app.get("/shortcut/life-planner-expense.shortcut", (_req, res) => {
  const file = path.join(SHORTCUT_DIR, "Life Planner Expense.shortcut");
  if (!fs.existsSync(file)) {
    return res.status(404).json({
      success: false,
      message: "The signed Shortcut file is not available on this server.",
    });
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="Life Planner Expense.shortcut"');
  return res.sendFile(file);
});

/* =========================================================
   404 & Static Assets Serving
========================================================= */

app.use(
  "/api",
  (_req, res) => {
    res.status(404).json({
      success: false,
      message: "API endpoint not found.",
    });
  },
);

// In production, serve the compiled Vite frontend with optimal caching headers
const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (fs.existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (filePath.includes(path.join("", "assets")) || filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      },
    }),
  );

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/shortcuts")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"), {
      headers: {
        "Cache-Control": "no-cache, must-revalidate",
      },
    });
  });
}

// Keep CORS and unexpected API failures in a JSON shape; do not leak stack traces.
app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const blockedOrigin = error?.message === "Origin is not allowed by CORS";
  if (blockedOrigin) {
    return res.status(403).json({ success: false, message: "Origin is not allowed." });
  }
  console.error("Unhandled API middleware error:", error?.message || String(error));
  return res.status(500).json({ success: false, message: "Unexpected API error." });
});

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  API_HOST,
  () => {
    console.log(
      `Life Planner API listening on ${API_HOST}:${PORT}`,
    );

    console.log(
      `PocketBase: ${PB_URL}`,
    );

    console.log(
      "Automatic expense processing: ENABLED",
    );
  },
);
