import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pb, PB_URL, authenticatePocketBase } from "./services/pb.mjs";
import { rateLimit } from "./middleware/rate-limit.mjs";
import { authenticateRequest, isAdminAuthorized } from "./middleware/auth.mjs";

import { createHealthRouter } from "./routes/health.routes.mjs";
import { createMarketRouter } from "./routes/market.routes.mjs";
import { createCalendarRouter } from "./routes/calendar.routes.mjs";
import { createShortcutsRouter } from "./routes/shortcuts.routes.mjs";
import { createExpensesRouter } from "./routes/expenses.routes.mjs";
import { createAuthRouter } from "./routes/auth.routes.mjs";
import { createAdminRouter } from "./routes/admin.routes.mjs";

/* =========================================================
   SERVER CONFIGURATION & CONSTANTS
========================================================= */

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.API_PORT || 3001);
const API_HOST = process.env.API_HOST || "0.0.0.0";
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (origin === "null") return false;
  if (FRONTEND_ORIGINS.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.protocol === "null:") return false;
    const host = url.hostname;

    // Allow local development & loopback
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
      return true;
    }
    // Allow strictly formatted private LAN IPv4 addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
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

/* =========================================================
   SECURITY & CORE MIDDLEWARE
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "blob:",
          "https://cdn.jsdelivr.net",
          "https://tessdata.projectnaptha.com",
          "https://raw.githubusercontent.com",
          "http://127.0.0.1:*",
          "http://localhost:*",
          "https:",
        ],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

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

app.use(express.json({ limit: "1mb" }));

/* =========================================================
   RATE LIMITING
========================================================= */

app.use("/api", rateLimit({ max: 180 }));
app.use("/api/admin", rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }));
app.use("/api/expense-ingestions", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use("/api/shortcut-tokens", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));

/* =========================================================
   DOMAIN ROUTERS
========================================================= */

app.use(createHealthRouter({ pbUrl: PB_URL }));
app.use(createMarketRouter());
app.use(createCalendarRouter());
app.use(createShortcutsRouter({ port: PORT }));
app.use(createExpensesRouter());
app.use(createAuthRouter());
app.use(createAdminRouter());

/* =========================================================
   404 & STATIC SPA SERVING
========================================================= */

app.use("/api", (_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

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

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/shortcuts") || req.path.startsWith("/shortcut")) {
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
   SECURITY & AUTH EXPORTS (FOR MULTI-TENANT AUDITING)
   - Inspects authorization headers: req.headers.authorization
   - Returns 401 Unauthorized for missing / invalid credentials
   - Enforces 403 Forbidden for non-superadmin roles
   - pb.authStore validates active user session
========================================================= */
export { pb, authenticatePocketBase };
export { authenticateRequest, isAdminAuthorized };

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, API_HOST, () => {
  console.log(`Life Planner API listening on ${API_HOST}:${PORT}`);
  console.log(`PocketBase: ${PB_URL}`);
  console.log("Automatic expense processing: ENABLED");
});
