import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pb, authenticatePocketBase, escapeFilterValue, getPocketBaseError } from "../services/pb.mjs";
import { authenticateRequest, hashShortcutToken } from "../middleware/auth.mjs";

const RUNTIME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".runtime");
const PUBLIC_BASE_FILE = path.join(RUNTIME_DIR, "public-base.json");
const SHORTCUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "ios-shortcut");

export function normalizeBaseUrl(value) {
  const raw = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!raw) return "";
  return /^https?:\/\/[^\s]+$/i.test(raw) ? raw : "";
}

export function readPublicBase() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLIC_BASE_FILE, "utf8"));
    return normalizeBaseUrl(parsed?.url);
  } catch {
    return "";
  }
}

export function writePublicBase(value) {
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

export function getLanBase(port = 3001) {
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
    url: addresses.length ? `http://${addresses[0]}:${port}` : "",
  };
}

const shortcutTokenCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
});

export function createShortcutsRouter({ port = 3001 } = {}) {
  const router = Router();

  router.get("/api/network-info", async (req, res) => {
    try {
      if (!(await authenticateRequest(req))) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const lan = getLanBase(port);
      const publicUrl = readPublicBase();

      return res.json({
        success: true,
        port,
        addresses: lan.addresses,
        lanUrl: lan.url,
        publicUrl,
        url: publicUrl || lan.url,
        reachableFromInternet: Boolean(publicUrl),
      });
    } catch (error) {
      console.error("Network info error:", error);
      return res.status(500).json({ success: false, message: "Could not read the network addresses." });
    }
  });

  router.post("/api/public-base", async (req, res) => {
    try {
      if (!(await authenticateRequest(req))) {
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

  router.get("/api/shortcut-tokens", async (req, res) => {
    try {
      if (!(await authenticateRequest(req))) {
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

  router.post("/api/shortcut-tokens", async (req, res) => {
    try {
      if (!(await authenticateRequest(req))) {
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

  router.delete("/api/shortcut-tokens/:id", async (req, res) => {
    try {
      if (!(await authenticateRequest(req))) {
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

  router.get("/shortcut/life-planner-expense.shortcut", (_req, res) => {
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

  return router;
}
