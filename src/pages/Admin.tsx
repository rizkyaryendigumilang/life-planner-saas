import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
} from "../components/ui";
import { toast } from "sonner";
import { API_BASE } from "../lib/hosts";
import { pb } from "../lib/pocketbase";

type Role = "superadmin" | "customer";
type AccountStatus = "active" | "suspended" | "pending";

type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  status: AccountStatus;
  verified: boolean;
  emailVisibility: boolean;
  is_password_temp: boolean;
  created: string;
  updated: string;
};

type CreatedCredentials = {
  email: string;
  username: string;
  password: string;
};

type UserForm = {
  email: string;
  username: string;
  password: string;
  name: string;
  role: Role;
  status: AccountStatus;
  verified: boolean;
  emailVisibility: boolean;
  is_password_temp: boolean;
};

type AuditLog = {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_id: string;
  target_label: string;
  details: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string;
  created: string;
};

type BackupItem = {
  key: string;
  size: number;
  modified: string;
};

type MailSettings = {
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password?: string;
    tls: boolean;
    authMethod: string;
  };
  meta: {
    senderName: string;
    senderAddress: string;
  };
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(
    { length: 12 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

function generateUsername() {
  return `user_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyForm(): UserForm {
  return {
    email: "",
    username: generateUsername(),
    password: generatePassword(),
    name: "",
    role: "customer",
    status: "active",
    verified: false,
    emailVisibility: false,
    is_password_temp: true,
  };
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function getActionBadgeTone(action: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (action.includes("delete")) return "danger";
  if (action.includes("create")) return "success";
  if (action.includes("revoke") || action.includes("suspend")) return "warning";
  if (action.includes("reset") || action.includes("mail")) return "accent";
  return "neutral";
}

function formatActionLabel(action: string) {
  switch (action) {
    case "user_create":
      return "Buat Pengguna";
    case "user_update":
      return "Edit Pengguna";
    case "user_delete":
      return "Hapus Pengguna";
    case "user_revoke_sessions":
      return "Cabut Sesi (Force Logout)";
    case "user_send_reset_email":
      return "Kirim Email Reset PW";
    case "backup_create":
      return "Buat Cadangan DB";
    case "backup_delete":
      return "Hapus Cadangan DB";
    case "mail_settings_update":
      return "Perbarui Konfigurasi SMTP";
    default:
      return action;
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = pb.authStore.token;
  if (!token || !pb.authStore.isValid) {
    throw new Error("Sesi login sudah berakhir. Silakan login kembali.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
        `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Tersalin ke clipboard");
  } catch {
    toast.error("Gagal menyalin ke clipboard");
  }
}

export function Admin() {
  const [activeTab, setActiveTab] = useState<"users" | "audit" | "backups" | "mail">("users");

  // Users Tab State
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Audit Logs Tab State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalItems, setAuditTotalItems] = useState(0);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Backups Tab State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // Mail Settings Tab State
  const [mailSettings, setMailSettings] = useState<MailSettings>({
    smtp: {
      enabled: false,
      host: "",
      port: 587,
      username: "",
      password: "",
      tls: false,
      authMethod: "PLAIN",
    },
    meta: {
      senderName: "",
      senderAddress: "",
    },
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [loadingMail, setLoadingMail] = useState(false);
  const [savingMail, setSavingMail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestMail, setSendingTestMail] = useState(false);

  // Load Users
  async function loadUsers(showRefresh = false) {
    try {
      if (showRefresh) setRefreshingUsers(true);
      else setLoadingUsers(true);

      const result = await apiRequest<{
        success: boolean;
        users: User[];
      }>("/api/admin/users");

      setUsers(result.users || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat daftar pengguna",
      );
    } finally {
      setLoadingUsers(false);
      setRefreshingUsers(false);
    }
  }

  // Load Audit Logs
  async function loadAuditLogs(page = 1, action = auditActionFilter) {
    try {
      setLoadingAudit(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        perPage: "15",
      });
      if (action && action !== "all") {
        queryParams.set("action", action);
      }

      const result = await apiRequest<{
        success: boolean;
        items: AuditLog[];
        page: number;
        perPage: number;
        totalItems: number;
        totalPages: number;
      }>(`/api/admin/audit-logs?${queryParams.toString()}`);

      setAuditLogs(result.items || []);
      setAuditPage(result.page || 1);
      setAuditTotalPages(result.totalPages || 1);
      setAuditTotalItems(result.totalItems || 0);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat log audit",
      );
    } finally {
      setLoadingAudit(false);
    }
  }

  // Load Backups
  async function loadBackups() {
    try {
      setLoadingBackups(true);
      const result = await apiRequest<{
        success: boolean;
        backups: BackupItem[];
      }>("/api/admin/backups");
      setBackups(result.backups || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat cadangan database",
      );
    } finally {
      setLoadingBackups(false);
    }
  }

  // Load Mail Settings
  async function loadMailSettings() {
    try {
      setLoadingMail(true);
      const result = await apiRequest<{
        success: boolean;
        smtp: MailSettings["smtp"];
        meta: MailSettings["meta"];
      }>("/api/admin/settings/mail");

      setMailSettings({
        smtp: {
          enabled: result.smtp.enabled ?? false,
          host: result.smtp.host || "",
          port: result.smtp.port || 587,
          username: result.smtp.username || "",
          password: result.smtp.password || "",
          tls: result.smtp.tls ?? false,
          authMethod: result.smtp.authMethod || "PLAIN",
        },
        meta: {
          senderName: result.meta.senderName || "",
          senderAddress: result.meta.senderAddress || "",
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat pengaturan email",
      );
    } finally {
      setLoadingMail(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "audit") {
      loadAuditLogs(1, auditActionFilter);
    } else if (activeTab === "backups") {
      loadBackups();
    } else if (activeTab === "mail") {
      loadMailSettings();
    }
  }, [activeTab]);

  // User Management Handlers
  function openCreateDialog() {
    setDialogMode("create");
    setSelectedUser(null);
    setCreatedCredentials(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEditDialog(user: User) {
    setDialogMode("edit");
    setSelectedUser(user);
    setCreatedCredentials(null);

    setForm({
      email: user.email || "",
      username: user.username || "",
      password: "",
      name: user.name || "",
      role: user.role,
      status: (user.status || "active") as AccountStatus,
      verified: user.verified,
      emailVisibility: user.emailVisibility,
      is_password_temp: user.is_password_temp,
    });

    setDialogOpen(true);
  }

  function closeDialog() {
    if (savingUser) return;
    setDialogOpen(false);
    setCreatedCredentials(null);
    setSelectedUser(null);
  }

  function updateForm<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function createUser() {
    if (!form.email.trim()) {
      toast.error("Email wajib diisi");
      return;
    }
    if (!form.username.trim()) {
      toast.error("Username wajib diisi");
      return;
    }
    if (!form.password.trim()) {
      toast.error("Password wajib diisi");
      return;
    }

    setSavingUser(true);
    try {
      const result = await apiRequest<{
        success: boolean;
        user: User;
      }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          status: form.status,
          emailVisibility: form.emailVisibility,
          verified: form.verified,
          is_password_temp: form.is_password_temp,
        }),
      });

      setUsers((current) => [result.user, ...current]);
      setCreatedCredentials({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
      });

      toast.success("Akun berhasil dibuat");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat akun pengguna",
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function updateUser() {
    if (!selectedUser) return;
    if (!form.email.trim()) {
      toast.error("Email wajib diisi");
      return;
    }
    if (!form.username.trim()) {
      toast.error("Username wajib diisi");
      return;
    }

    setSavingUser(true);
    try {
      const payload: Record<string, unknown> = {
        email: form.email.trim(),
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        status: form.status,
        emailVisibility: form.emailVisibility,
        verified: form.verified,
        is_password_temp: form.is_password_temp,
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      const result = await apiRequest<{
        success: boolean;
        user: User;
      }>(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setUsers((current) =>
        current.map((user) =>
          user.id === selectedUser.id ? result.user : user,
        ),
      );

      toast.success("Perubahan pengguna berhasil disimpan");
      closeDialog();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui pengguna",
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(user: User) {
    const confirmed = window.confirm(
      `Hapus pengguna "${user.username}"?\n\nTindakan ini permanen dan tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;

    try {
      await apiRequest<{ success: boolean }>(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      setUsers((current) => current.filter((item) => item.id !== user.id));
      toast.success(`Pengguna "${user.username}" berhasil dihapus`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus pengguna",
      );
    }
  }

  // Force Invalidation / Revoke Sessions
  async function revokeSessions(user: User) {
    const confirmed = window.confirm(
      `Cabut semua sesi dan token shortcut milik "${user.username}"?\n\nPengguna akan seketika di-logout dari semua perangkat dan semua token Apple Shortcut akan dibatalkan.`,
    );
    if (!confirmed) return;

    setActionInProgress(`revoke_${user.id}`);
    try {
      await apiRequest<{ success: boolean; message: string }>(
        `/api/admin/users/${user.id}/revoke-sessions`,
        { method: "POST" },
      );
      toast.success(
        `Seluruh sesi login & token shortcut untuk "${user.username}" telah dicabut`,
      );
      loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mencabut sesi pengguna",
      );
    } finally {
      setActionInProgress(null);
    }
  }

  // Send Reset Password Email
  async function sendPasswordResetEmail(user: User) {
    const confirmed = window.confirm(
      `Kirim email instruksi reset password resmi ke alamat "${user.email}"?`,
    );
    if (!confirmed) return;

    setActionInProgress(`reset_${user.id}`);
    try {
      await apiRequest<{ success: boolean; message: string }>(
        `/api/admin/users/${user.id}/send-reset-email`,
        { method: "POST" },
      );
      toast.success(`Email reset password berhasil dikirim ke ${user.email}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengirim email reset password. Pastikan SMTP aktif.",
      );
    } finally {
      setActionInProgress(null);
    }
  }

  // Backup Handlers
  async function createBackup() {
    setCreatingBackup(true);
    try {
      const result = await apiRequest<{ success: boolean; backupName: string }>(
        "/api/admin/backups",
        { method: "POST" },
      );
      toast.success(`Cadangan "${result.backupName}" berhasil dibuat`);
      loadBackups();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat cadangan database",
      );
    } finally {
      setCreatingBackup(false);
    }
  }

  async function downloadBackup(key: string) {
    setDownloadingKey(key);
    try {
      const token = pb.authStore.token;
      const response = await fetch(
        `${API_BASE}/api/admin/backups/${encodeURIComponent(key)}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Gagal mengunduh berkas cadangan");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = key;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Cadangan ${key} berhasil diunduh`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengunduh berkas cadangan",
      );
    } finally {
      setDownloadingKey(null);
    }
  }

  async function deleteBackup(key: string) {
    const confirmed = window.confirm(
      `Hapus berkas cadangan "${key}"?\n\nTindakan ini tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;

    try {
      await apiRequest<{ success: boolean }>(
        `/api/admin/backups/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      setBackups((current) => current.filter((b) => b.key !== key));
      toast.success(`Cadangan "${key}" telah dihapus`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus cadangan",
      );
    }
  }

  // Mail Settings Handlers
  async function saveMailSettings() {
    setSavingMail(true);
    try {
      await apiRequest<{ success: boolean; message: string }>(
        "/api/admin/settings/mail",
        {
          method: "PATCH",
          body: JSON.stringify(mailSettings),
        },
      );
      toast.success("Konfigurasi SMTP berhasil disimpan");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan konfigurasi SMTP",
      );
    } finally {
      setSavingMail(false);
    }
  }

  async function testMailConnection() {
    if (!testEmailAddress.trim()) {
      toast.error("Masukkan alamat email tujuan uji kirim");
      return;
    }

    setSendingTestMail(true);
    try {
      await apiRequest<{ success: boolean; message: string }>(
        "/api/admin/settings/mail/test",
        {
          method: "POST",
          body: JSON.stringify({ to: testEmailAddress.trim() }),
        },
      );
      toast.success(
        `Email uji coba berhasil dikirim ke ${testEmailAddress.trim()}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Uji coba pengiriman email gagal. Periksa konfigurasi host, port, dan otentikasi SMTP.",
      );
    } finally {
      setSendingTestMail(false);
    }
  }

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ? true : u.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [users, searchQuery, statusFilter]);

  const customerCount = users.filter((user) => user.role === "customer").length;
  const adminCount = users.filter((user) => user.role === "superadmin").length;
  const suspendedCount = users.filter((user) => user.status === "suspended").length;

  return (
    <div className="animate-rise space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">
            Panel Administrasi & Keamanan
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Pusat kendali akun pengguna, jejak audit, snapshot cadangan, dan konfigurasi email resmi.
          </p>
        </div>

        {activeTab === "users" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => loadUsers(true)}
              disabled={refreshingUsers}
            >
              <RefreshCw
                size={16}
                className={refreshingUsers ? "animate-spin" : ""}
              />
              Segarkan
            </Button>
            <Button onClick={openCreateDialog}>
              <UserPlus size={16} />
              Tambah Akun
            </Button>
          </div>
        )}

        {activeTab === "audit" && (
          <Button
            variant="outline"
            onClick={() => loadAuditLogs(auditPage, auditActionFilter)}
            disabled={loadingAudit}
          >
            <RefreshCw
              size={16}
              className={loadingAudit ? "animate-spin" : ""}
            />
            Segarkan Log
          </Button>
        )}

        {activeTab === "backups" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadBackups}
              disabled={loadingBackups}
            >
              <RefreshCw
                size={16}
                className={loadingBackups ? "animate-spin" : ""}
              />
              Segarkan
            </Button>
            <Button onClick={createBackup} disabled={creatingBackup}>
              <Database size={16} className={creatingBackup ? "animate-spin" : ""} />
              {creatingBackup ? "Membuat snapshot..." : "Buat Cadangan Baru"}
            </Button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-line/15 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "users"
              ? "bg-accent text-accent-ink shadow-sm"
              : "text-ink-soft hover:bg-muted hover:text-ink"
          }`}
        >
          <Users size={16} />
          <span>Pengguna</span>
          <span className="ml-1 rounded-full bg-black/10 px-1.5 py-0.5 text-xs font-semibold">
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "audit"
              ? "bg-accent text-accent-ink shadow-sm"
              : "text-ink-soft hover:bg-muted hover:text-ink"
          }`}
        >
          <ShieldAlert size={16} />
          <span>Jejak Audit</span>
          {auditTotalItems > 0 && (
            <span className="ml-1 rounded-full bg-black/10 px-1.5 py-0.5 text-xs font-semibold">
              {auditTotalItems}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("backups")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "backups"
              ? "bg-accent text-accent-ink shadow-sm"
              : "text-ink-soft hover:bg-muted hover:text-ink"
          }`}
        >
          <Database size={16} />
          <span>Cadangan Database</span>
          {backups.length > 0 && (
            <span className="ml-1 rounded-full bg-black/10 px-1.5 py-0.5 text-xs font-semibold">
              {backups.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mail")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "mail"
              ? "bg-accent text-accent-ink shadow-sm"
              : "text-ink-soft hover:bg-muted hover:text-ink"
          }`}
        >
          <Mail size={16} />
          <span>Email & SMTP</span>
          <span
            className={`h-2 w-2 rounded-full ${
              mailSettings.smtp.enabled ? "bg-positive" : "bg-ink-faint"
            }`}
          />
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
                Total Akun
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {loadingUsers ? "—" : users.length}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
                Pelanggan (Customer)
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {loadingUsers ? "—" : customerCount}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
                Superadmin
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {loadingUsers ? "—" : adminCount}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
                Ditangguhkan (Suspended)
              </p>
              <p className="mt-2 text-2xl font-semibold text-negative">
                {loadingUsers ? "—" : suspendedCount}
              </p>
            </Card>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <Input
                placeholder="Cari nama, email, username..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | AccountStatus)}
                className="h-10 rounded-lg border border-line/15 bg-surface px-3 text-sm text-ink outline-none transition focus:border-ink/40"
              >
                <option value="all">Semua Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* User Table Card */}
          <Card className="overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted text-xs text-ink-soft">
                  <tr>
                    <th className="px-5 py-3 font-medium">Pengguna</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Peran</th>
                    <th className="px-5 py-3 font-medium">Status Akun</th>
                    <th className="px-5 py-3 font-medium">Terdaftar</th>
                    <th className="px-5 py-3 text-right font-medium">Tindakan Keamanan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line/10">
                  {loadingUsers &&
                    [1, 2, 3].map((item) => (
                      <tr key={item}>
                        <td colSpan={6} className="p-5">
                          <Skeleton className="h-7" />
                        </td>
                      </tr>
                    ))}

                  {!loadingUsers &&
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-muted"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-medium text-ink">{user.username}</p>
                            {user.name && (
                              <p className="mt-0.5 text-xs text-ink-soft">
                                {user.name}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-ink-soft">{user.email}</td>

                        <td className="px-5 py-4">
                          <Badge
                            tone={
                              user.role === "superadmin" ? "accent" : "neutral"
                            }
                          >
                            {user.role === "superadmin"
                              ? "Superadmin"
                              : "Customer"}
                          </Badge>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              tone={
                                user.status === "active"
                                  ? "success"
                                  : user.status === "suspended"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {user.status || "active"}
                            </Badge>

                            {user.verified ? (
                              <Badge tone="success">Verified</Badge>
                            ) : (
                              <Badge tone="warning">Unverified</Badge>
                            )}

                            {user.is_password_temp && (
                              <Badge tone="warning">Temp PW</Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-ink-soft text-xs">
                          {new Date(user.created).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendPasswordResetEmail(user)}
                              disabled={actionInProgress === `reset_${user.id}`}
                              title="Kirim instruksi reset password resmi"
                            >
                              <Send size={13} />
                              <span className="hidden xl:inline">Reset PW</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => revokeSessions(user)}
                              disabled={actionInProgress === `revoke_${user.id}`}
                              className="text-caution hover:text-caution"
                              title="Force logout: Cabut seluruh sesi aktif dan token shortcut"
                            >
                              <LogOut size={13} />
                              <span className="hidden xl:inline">Revoke Sesi</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                              title="Edit rincian pengguna"
                            >
                              <Edit3 size={13} />
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteUser(user)}
                              className="text-negative hover:text-negative"
                              title="Hapus akun secara permanen"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {!loadingUsers && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <ShieldCheck
                          size={28}
                          className="mx-auto text-ink-faint"
                        />
                        <p className="mt-3 font-medium">Tidak ada akun ditemukan</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          Coba ganti filter atau tambahkan pengguna baru.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="divide-y divide-line/10 md:hidden">
              {loadingUsers &&
                [1, 2, 3].map((item) => (
                  <div key={item} className="p-4">
                    <Skeleton className="h-24" />
                  </div>
                ))}

              {!loadingUsers &&
                filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{user.username}</p>
                        {user.name && (
                          <p className="text-xs text-ink-soft">{user.name}</p>
                        )}
                        <p className="mt-1 break-all text-xs text-ink-soft">
                          {user.email}
                        </p>
                      </div>

                      <Badge
                        tone={user.role === "superadmin" ? "accent" : "neutral"}
                      >
                        {user.role}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        tone={
                          user.status === "active"
                            ? "success"
                            : user.status === "suspended"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {user.status || "active"}
                      </Badge>
                      <Badge tone={user.verified ? "success" : "warning"}>
                        {user.verified ? "Verified" : "Unverified"}
                      </Badge>
                      {user.is_password_temp && (
                        <Badge tone="warning">Temp PW</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-line/10">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendPasswordResetEmail(user)}
                        className="flex-1 text-xs"
                      >
                        <Send size={13} />
                        Reset PW
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeSessions(user)}
                        className="flex-1 text-xs text-caution"
                      >
                        <LogOut size={13} />
                        Revoke Sesi
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit3 size={13} />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteUser(user)}
                        className="text-negative"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: AUDIT LOGGING */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <Card className="p-5 bg-muted/40">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-surface p-2.5 shadow-sm border border-line/15">
                <ShieldAlert size={22} className="text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">
                  Audit Logging Database (Kepatuhan & Keamanan)
                </h3>
                <p className="mt-1 text-sm text-ink-soft leading-relaxed">
                  Semua aktivitas administratif penting seperti manipulasi akun pengguna, force revocation sesi, eksekusi snapshot cadangan, dan pembaruan konfigurasi SMTP direkam ke tabel database resmi <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono">admin_audit_logs</code> lengkap dengan timestamp, IP address, dan metadata.
                </p>
              </div>
            </div>
          </Card>

          {/* Action Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft whitespace-nowrap">Filter Aksi:</span>
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  loadAuditLogs(1, e.target.value);
                }}
                className="h-10 rounded-lg border border-line/15 bg-surface px-3 text-sm text-ink outline-none transition focus:border-ink/40"
              >
                <option value="all">Semua Aksi</option>
                <option value="user_create">Pembuatan Pengguna</option>
                <option value="user_update">Pembaruan Pengguna</option>
                <option value="user_delete">Penghapusan Pengguna</option>
                <option value="user_revoke_sessions">Pencabutan Sesi (Force Logout)</option>
                <option value="user_send_reset_email">Pengiriman Email Reset PW</option>
                <option value="backup_create">Pembuatan Cadangan Database</option>
                <option value="backup_delete">Penghapusan Cadangan Database</option>
                <option value="mail_settings_update">Pembaruan Pengaturan SMTP</option>
              </select>
            </div>

            <p className="text-xs text-ink-soft">
              Menampilkan {auditLogs.length} dari {auditTotalItems} rekaman audit
            </p>
          </div>

          {/* Audit Logs Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted text-xs text-ink-soft">
                  <tr>
                    <th className="px-5 py-3 font-medium">Waktu</th>
                    <th className="px-5 py-3 font-medium">Aksi</th>
                    <th className="px-5 py-3 font-medium">Admin</th>
                    <th className="px-5 py-3 font-medium">Target</th>
                    <th className="px-5 py-3 font-medium">IP & User Agent</th>
                    <th className="px-5 py-3 text-right font-medium">Rincian</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line/10">
                  {loadingAudit &&
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i}>
                        <td colSpan={6} className="p-5">
                          <Skeleton className="h-7" />
                        </td>
                      </tr>
                    ))}

                  {!loadingAudit &&
                    auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="transition-colors hover:bg-muted"
                      >
                        <td className="px-5 py-4 text-xs font-mono text-ink-soft whitespace-nowrap">
                          {new Date(log.created).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>

                        <td className="px-5 py-4">
                          <Badge tone={getActionBadgeTone(log.action)}>
                            {formatActionLabel(log.action)}
                          </Badge>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-ink text-xs">
                            {log.admin_email || "System"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-xs text-ink">
                            {log.target_label || log.target_id || "—"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-xs text-ink-soft">
                          <p className="font-mono">{log.ip_address || "127.0.0.1"}</p>
                          <p className="mt-0.5 truncate max-w-[200px] text-[11px] text-ink-faint">
                            {log.user_agent || "Direct API"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAuditLog(log)}
                          >
                            <FileText size={13} />
                            Lihat
                          </Button>
                        </td>
                      </tr>
                    ))}

                  {!loadingAudit && auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <CheckCircle2
                          size={28}
                          className="mx-auto text-ink-faint"
                        />
                        <p className="mt-3 font-medium">Belum ada riwayat audit</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          Setiap tindakan administratif akan tercatat secara otomatis di sini.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line/10 px-5 py-3">
                <p className="text-xs text-ink-soft">
                  Halaman {auditPage} dari {auditTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={auditPage <= 1 || loadingAudit}
                    onClick={() => {
                      const next = auditPage - 1;
                      setAuditPage(next);
                      loadAuditLogs(next, auditActionFilter);
                    }}
                  >
                    <ChevronLeft size={14} />
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={auditPage >= auditTotalPages || loadingAudit}
                    onClick={() => {
                      const next = auditPage + 1;
                      setAuditPage(next);
                      loadAuditLogs(next, auditActionFilter);
                    }}
                  >
                    Selanjutnya
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: DATABASE BACKUPS */}
      {activeTab === "backups" && (
        <div className="space-y-6">
          <Card className="p-5 bg-muted/40">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-surface p-2.5 shadow-sm border border-line/15">
                <Database size={22} className="text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">
                  Panel Snapshot & Cadangan Database (1-Klik)
                </h3>
                <p className="mt-1 text-sm text-ink-soft leading-relaxed">
                  Buat arsip snapshot terkompresi (<code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono">.zip</code>) dari seluruh database SQLite PocketBase beserta file lampiran pengguna. Unduh berkas cadangan langsung ke komputer Anda sebelum melakukan update sistem, pemeliharaan, atau migrasi hosting.
                </p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-muted text-xs text-ink-soft">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nama Berkas Cadangan</th>
                    <th className="px-5 py-3 font-medium">Ukuran</th>
                    <th className="px-5 py-3 font-medium">Waktu Pembuatan</th>
                    <th className="px-5 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line/10">
                  {loadingBackups &&
                    [1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={4} className="p-5">
                          <Skeleton className="h-7" />
                        </td>
                      </tr>
                    ))}

                  {!loadingBackups &&
                    backups.map((b) => (
                      <tr key={b.key} className="transition-colors hover:bg-muted">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Database size={16} className="text-ink-soft flex-shrink-0" />
                            <span className="font-mono text-sm font-medium text-ink">
                              {b.key}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono text-xs text-ink-soft">
                          {formatBytes(b.size)}
                        </td>

                        <td className="px-5 py-4 text-xs text-ink-soft">
                          {b.modified
                            ? new Date(b.modified).toLocaleString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadBackup(b.key)}
                              disabled={downloadingKey === b.key}
                            >
                              <Download
                                size={14}
                                className={downloadingKey === b.key ? "animate-bounce" : ""}
                              />
                              Unduh .ZIP
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteBackup(b.key)}
                              className="text-negative hover:text-negative"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {!loadingBackups && backups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center">
                        <Database size={28} className="mx-auto text-ink-faint" />
                        <p className="mt-3 font-medium">Belum ada berkas cadangan</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          Klik tombol &quot;Buat Cadangan Baru&quot; di kanan atas untuk membuat snapshot pertama Anda.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: MAIL & SMTP */}
      {activeTab === "mail" && (
        <div className="space-y-6">
          <Card className="p-5 bg-muted/40">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-surface p-2.5 shadow-sm border border-line/15">
                <Mail size={22} className="text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">
                  Konfigurasi Server SMTP Resmi
                </h3>
                <p className="mt-1 text-sm text-ink-soft leading-relaxed">
                  Konfigurasikan server SMTP transaksional (seperti Resend, SendGrid, Amazon SES, Mailgun, atau Gmail SMTP) agar pengguna Anda dapat menerima email verifikasi akun resmi dan mengatur ulang kata sandi (reset password) secara mandiri tanpa campur tangan admin.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SMTP Settings Form */}
            <Card className="p-6 lg:col-span-2 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-line/10">
                <div>
                  <h3 className="font-semibold text-base text-ink">
                    Pengaturan Pengiriman (SMTP)
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Konfigurasi host, port, dan kredensial autentikasi.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={mailSettings.smtp.enabled}
                    onChange={(e) =>
                      setMailSettings((prev) => ({
                        ...prev,
                        smtp: { ...prev.smtp, enabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded accent-accent"
                  />
                  <span>Aktifkan SMTP</span>
                </label>
              </div>

              {loadingMail ? (
                <div className="space-y-4">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <Label>Host SMTP</Label>
                      <Input
                        placeholder="contoh: smtp.resend.com atau smtp.sendgrid.net"
                        value={mailSettings.smtp.host}
                        onChange={(e) =>
                          setMailSettings((prev) => ({
                            ...prev,
                            smtp: { ...prev.smtp, host: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <Label>Port</Label>
                      <Input
                        type="number"
                        placeholder="587"
                        value={mailSettings.smtp.port}
                        onChange={(e) =>
                          setMailSettings((prev) => ({
                            ...prev,
                            smtp: {
                              ...prev.smtp,
                              port: parseInt(e.target.value, 10) || 587,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Username</Label>
                      <Input
                        placeholder="resend / apikey / user@domain.com"
                        value={mailSettings.smtp.username}
                        onChange={(e) =>
                          setMailSettings((prev) => ({
                            ...prev,
                            smtp: { ...prev.smtp, username: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <Label>Password / API Key</Label>
                      <div className="relative">
                        <Input
                          type={showSmtpPassword ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={mailSettings.smtp.password || ""}
                          onChange={(e) =>
                            setMailSettings((prev) => ({
                              ...prev,
                              smtp: { ...prev.smtp, password: e.target.value },
                            }))
                          }
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                        >
                          {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Metode Autentikasi</Label>
                      <select
                        value={mailSettings.smtp.authMethod}
                        onChange={(e) =>
                          setMailSettings((prev) => ({
                            ...prev,
                            smtp: { ...prev.smtp, authMethod: e.target.value },
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-line/15 bg-surface px-3 text-sm text-ink outline-none transition focus:border-ink/40"
                      >
                        <option value="PLAIN">PLAIN (Standar)</option>
                        <option value="LOGIN">LOGIN</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={mailSettings.smtp.tls}
                          onChange={(e) =>
                            setMailSettings((prev) => ({
                              ...prev,
                              smtp: { ...prev.smtp, tls: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 rounded accent-accent"
                        />
                        <span>Paksa TLS / SSL Langsung</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line/10">
                    <h4 className="font-semibold text-sm mb-3">
                      Identitas Pengirim (Sender Identity)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Nama Pengirim</Label>
                        <Input
                          placeholder="Life Planner App"
                          value={mailSettings.meta.senderName}
                          onChange={(e) =>
                            setMailSettings((prev) => ({
                              ...prev,
                              meta: { ...prev.meta, senderName: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label>Alamat Email Pengirim</Label>
                        <Input
                          type="email"
                          placeholder="support@domainanda.com"
                          value={mailSettings.meta.senderAddress}
                          onChange={(e) =>
                            setMailSettings((prev) => ({
                              ...prev,
                              meta: {
                                ...prev.meta,
                                senderAddress: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      onClick={saveMailSettings}
                      disabled={savingMail}
                    >
                      {savingMail ? "Menyimpan..." : "Simpan Konfigurasi SMTP"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Test Mail Panel */}
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-base text-ink">
                Uji Coba Pengiriman Email
              </h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Kirim pesan uji coba untuk memverifikasi bahwa host, kredensial, dan port SMTP Anda dapat terhubung dan berhasil mengirimkan email keluar.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <Label>Kirim Ke Alamat Email:</Label>
                  <Input
                    type="email"
                    placeholder="email-anda@gmail.com"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={testMailConnection}
                  disabled={sendingTestMail || !mailSettings.smtp.enabled}
                >
                  <Send size={15} className={sendingTestMail ? "animate-spin" : ""} />
                  {sendingTestMail ? "Mengirim surel..." : "Kirim Email Percobaan"}
                </Button>

                {!mailSettings.smtp.enabled && (
                  <p className="text-xs text-caution">
                    ⚠️ Aktifkan dan simpan SMTP terlebih dahulu sebelum mengirim tes.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* DIALOG: VIEW AUDIT LOG DETAILS */}
      <Dialog
        open={Boolean(selectedAuditLog)}
        onOpenChange={(open) => {
          if (!open) setSelectedAuditLog(null);
        }}
        title="Rincian Jejak Audit"
      >
        {selectedAuditLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-ink-soft">Waktu:</p>
                <p className="font-medium text-ink">
                  {new Date(selectedAuditLog.created).toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-ink-soft">Aksi:</p>
                <Badge tone={getActionBadgeTone(selectedAuditLog.action)}>
                  {formatActionLabel(selectedAuditLog.action)}
                </Badge>
              </div>
              <div>
                <p className="text-ink-soft">Admin:</p>
                <p className="font-medium text-ink">
                  {selectedAuditLog.admin_email}
                </p>
              </div>
              <div>
                <p className="text-ink-soft">Target:</p>
                <p className="font-medium text-ink">
                  {selectedAuditLog.target_label || selectedAuditLog.target_id || "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-ink-soft">IP & User Agent:</p>
                <p className="font-mono text-ink">
                  {selectedAuditLog.ip_address} — {selectedAuditLog.user_agent}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink-soft mb-1.5">
                Payload / Perubahan Data:
              </p>
              <pre className="max-h-60 overflow-auto rounded-lg border border-line/15 bg-muted p-3 text-xs font-mono text-ink">
                {JSON.stringify(selectedAuditLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-line/10">
              <Button
                variant="outline"
                onClick={() => setSelectedAuditLog(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* DIALOG: CREATE / EDIT USER */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={dialogMode === "create" ? "Tambah Akun Pengguna" : "Edit Akun Pengguna"}
      >
        {createdCredentials ? (
          <Credentials credentials={createdCredentials} onDone={closeDialog} />
        ) : (
          <div className="space-y-5">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                placeholder="customer@example.com"
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </div>

            <div>
              <Label>Username</Label>
              <Input
                value={form.username}
                placeholder="username"
                onChange={(event) => updateForm("username", event.target.value)}
              />
            </div>

            <div>
              <Label>Nama Lengkap</Label>
              <Input
                value={form.name}
                placeholder="Nama Pengguna"
                onChange={(event) => updateForm("name", event.target.value)}
              />
            </div>

            <div>
              <Label>
                {dialogMode === "create"
                  ? "Kata Sandi Sementara"
                  : "Kata Sandi Baru (Opsional)"}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <Input
                    type="text"
                    className="pl-9"
                    value={form.password}
                    placeholder={
                      dialogMode === "create"
                        ? "Kata sandi"
                        : "Kosongkan jika tidak diubah"
                    }
                    onChange={(event) =>
                      updateForm("password", event.target.value)
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => updateForm("password", generatePassword())}
                  title="Generate Password Acak"
                >
                  <RefreshCw size={15} />
                </Button>
              </div>
            </div>

            <div>
              <Label>Peran (Role)</Label>
              <select
                value={form.role}
                onChange={(event) => updateForm("role", event.target.value as Role)}
                className="mt-1 h-10 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/[.05]"
              >
                <option value="customer">Customer</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>

            <div>
              <Label>Status Akun</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateForm("status", value as AccountStatus)}
              >
                <SelectItem value="active">Active — Dapat masuk & beraktivitas</SelectItem>
                <SelectItem value="pending">Pending — Menunggu verifikasi</SelectItem>
                <SelectItem value="suspended">Suspended — Blokir akses & cabut sesi</SelectItem>
              </Select>
              <p className="mt-1.5 text-[11px] leading-5 text-ink-faint">
                Status ditangguhkan (Suspended) otomatis membatalkan seluruh sesi aktif pengguna dan kunci shortcut iOS.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-line/10 bg-muted p-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(event) => updateForm("verified", event.target.checked)}
                  className="h-4 w-4 rounded accent-accent"
                />
                <span>Tandai email sebagai terverifikasi (Verified)</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.emailVisibility}
                  onChange={(event) =>
                    updateForm("emailVisibility", event.target.checked)
                  }
                  className="h-4 w-4 rounded accent-accent"
                />
                <span>Jadikan email dapat dilihat publik</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_password_temp}
                  onChange={(event) =>
                    updateForm("is_password_temp", event.target.checked)
                  }
                  className="h-4 w-4 rounded accent-accent"
                />
                <span>Wajibkan pengguna mengganti password saat login pertama</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-line/10 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={closeDialog}
                disabled={savingUser}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={dialogMode === "create" ? createUser : updateUser}
                disabled={savingUser}
              >
                {savingUser
                  ? "Menyimpan..."
                  : dialogMode === "create"
                    ? "Buat Pengguna"
                    : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Credentials({
  credentials,
  onDone,
}: {
  credentials: CreatedCredentials;
  onDone: () => void;
}) {
  const allCredentials = [
    `Email: ${credentials.email}`,
    `Username: ${credentials.username}`,
    `Password: ${credentials.password}`,
  ].join("\n");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line/15 bg-muted p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-surface p-2 shadow-sm">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h3 className="font-semibold">Akun Berhasil Dibuat</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Salin dan simpan kredensial ini sebelum menutup dialog ini.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <CredentialRow label="Email" value={credentials.email} />
        <CredentialRow label="Username" value={credentials.username} />
        <CredentialRow label="Password" value={credentials.password} secret />
      </div>

      <div className="rounded-xl bg-muted p-4">
        <p className="text-xs leading-5 text-ink-soft">
          Kata sandi ini dirancang sebagai kata sandi sementara. Pengguna dapat mengubahnya secara mandiri setelah berhasil login.
        </p>
      </div>

      <div className="flex justify-between gap-2 border-t border-line/10 pt-4">
        <Button variant="outline" onClick={() => copyText(allCredentials)}>
          <Copy size={15} />
          Salin Semua
        </Button>
        <Button onClick={onDone}>Selesai</Button>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-xl border border-line/15 bg-surface px-3 py-2.5">
          <p
            className={`truncate text-sm ${
              secret ? "font-mono tracking-wide" : ""
            }`}
          >
            {value}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyText(value)}
          title={`Salin ${label}`}
        >
          <Copy size={14} />
        </Button>
      </div>
    </div>
  );
}
