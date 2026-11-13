import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { pb, authenticatePocketBase, escapeFilterValue, getPocketBaseError, publicUser } from "../services/pb.mjs";
import { isAdminAuthorized } from "../middleware/auth.mjs";

export async function logAdminAction(
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

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(1).optional(),
  name: z.string().optional(),
  role: z.enum(["superadmin", "customer"]).default("customer"),
  status: z.enum(["active", "suspended", "pending"]).default("active"),
  verified: z.boolean().default(false),
  emailVisibility: z.boolean().default(false),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  name: z.string().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["superadmin", "customer"]).optional(),
  status: z.enum(["active", "suspended", "pending"]).optional(),
  verified: z.boolean().optional(),
  emailVisibility: z.boolean().optional(),
  is_password_temp: z.boolean().optional(),
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

export function createAdminRouter() {
  const router = Router();

  router.get("/api/admin/users", async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      await authenticatePocketBase();
      const result = await pb.collection("_pb_users_auth_").getFullList({
        sort: "-created",
      });

      return res.json({
        success: true,
        users: result.map(publicUser),
      });
    } catch (error) {
      console.error("Admin list users error:", getPocketBaseError(error));
      return res.status(500).json({ success: false, message: "Could not load users." });
    }
  });

  router.post("/api/admin/users", async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user data.",
          errors: parsed.error.flatten(),
        });
      }

      await authenticatePocketBase();
      const data = parsed.data;
      const username = data.username || data.email.split("@")[0];

      const user = await pb.collection("_pb_users_auth_").create({
        email: data.email,
        password: data.password,
        passwordConfirm: data.password,
        username,
        name: data.name || "",
        role: data.role,
        status: data.status,
        verified: data.verified,
        emailVisibility: data.emailVisibility,
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
        message: "User created successfully.",
        user: publicUser(user),
        temporary_password: data.password,
      });
    } catch (error) {
      console.error("Admin create user error:", getPocketBaseError(error));
      return res.status(400).json({
        success: false,
        message: error?.response?.data?.message || error?.message || "Could not create user.",
      });
    }
  });

  router.patch("/api/admin/users/:id", async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user data.",
          errors: parsed.error.flatten(),
        });
      }

      await authenticatePocketBase();
      const data = parsed.data;
      const actingAdmin = req.authUser;

      if (actingAdmin?.id === req.params.id) {
        if (data.role === "customer" || (data.status !== undefined && data.status !== "active")) {
          return res.status(400).json({
            success: false,
            message: "You cannot remove administrator access or suspend your own account.",
          });
        }
      }

      const updateData = {};
      if (data.email !== undefined) updateData.email = data.email;
      if (data.username !== undefined) updateData.username = data.username;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.verified !== undefined) updateData.verified = data.verified;
      if (data.emailVisibility !== undefined) updateData.emailVisibility = data.emailVisibility;

      if (data.password) {
        updateData.password = data.password;
        updateData.passwordConfirm = data.password;
        if (data.is_password_temp === undefined) {
          updateData.is_password_temp = true;
        }
      } else if (data.is_password_temp !== undefined) {
        updateData.is_password_temp = data.is_password_temp;
      }

      if (data.status === "suspended" || data.password) {
        updateData.tokenKey = randomBytes(30).toString("base64url");
      }

      const user = await pb.collection("_pb_users_auth_").update(req.params.id, updateData);

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
        message: "User updated successfully.",
        user: publicUser(user),
        ...(data.password ? { temporary_password: data.password } : {}),
      });
    } catch (error) {
      console.error("Admin update user error:", getPocketBaseError(error));
      return res.status(400).json({
        success: false,
        message: error?.response?.data?.message || error?.message || "Could not update user.",
        details: error?.response?.data || undefined,
      });
    }
  });

  router.delete("/api/admin/users/:id", async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      await authenticatePocketBase();

      if (req.params.id === req.authUser?.id) {
        return res.status(400).json({
          success: false,
          message: "You cannot delete the currently authenticated superadmin.",
        });
      }

      await pb.collection("_pb_users_auth_").delete(req.params.id);

      await logAdminAction(req, {
        action: "USER_DELETE",
        targetId: req.params.id,
        targetLabel: req.params.id,
      });

      return res.json({ success: true, message: "User deleted successfully." });
    } catch (error) {
      console.error("Admin delete user error:", getPocketBaseError(error));
      return res.status(400).json({
        success: false,
        message: error?.response?.data?.message || error?.message || "Could not delete user.",
      });
    }
  });

  router.get("/api/admin/audit-logs", async (req, res) => {
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

  router.post("/api/admin/users/:id/revoke-sessions", async (req, res) => {
    try {
      if (!(await isAdminAuthorized(req))) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      await authenticatePocketBase();
      const targetUser = await pb.collection("_pb_users_auth_").getOne(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      const newTokenKey = randomBytes(30).toString("base64url");
      await pb.collection("_pb_users_auth_").update(targetUser.id, {
        tokenKey: newTokenKey,
      });

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

  router.post("/api/admin/users/:id/send-reset-email", async (req, res) => {
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

  router.get("/api/admin/backups", async (req, res) => {
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

  router.post("/api/admin/backups", async (req, res) => {
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

  router.delete("/api/admin/backups/:key", async (req, res) => {
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

  router.get("/api/admin/backups/:key/download", async (req, res) => {
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

      const safeFilename = path.basename(String(key)).replace(/[^a-zA-Z0-9._-]/g, "_") || "backup.zip";
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
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

  router.get("/api/admin/settings/mail", async (req, res) => {
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

  router.patch("/api/admin/settings/mail", async (req, res) => {
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
        message: error?.response?.data?.message || error?.message || "Gagal memperbarui pengaturan SMTP.",
      });
    }
  });

  router.post("/api/admin/settings/mail/test", async (req, res) => {
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

  return router;
}
