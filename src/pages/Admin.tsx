import { useEffect, useState } from "react";
import {
  Copy,
  Edit3,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
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

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

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
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<
    "create" | "edit"
  >("create");

  const [selectedUser, setSelectedUser] = useState<User | null>(
    null,
  );

  const [form, setForm] = useState<UserForm>(emptyForm());

  const [createdCredentials, setCreatedCredentials] =
    useState<CreatedCredentials | null>(null);

  const [saving, setSaving] = useState(false);

  async function loadUsers(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await apiRequest<{
        success: boolean;
        users: User[];
      }>("/api/admin/users");

      setUsers(result.users || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load users",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

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
    if (saving) return;

    setDialogOpen(false);
    setCreatedCredentials(null);
    setSelectedUser(null);
  }

  function updateForm<K extends keyof UserForm>(
    key: K,
    value: UserForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function createUser() {
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }

    if (!form.password.trim()) {
      toast.error("Password is required");
      return;
    }

    setSaving(true);

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

      toast.success("Customer account created");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create user",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateUser() {
    if (!selectedUser) return;

    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }

    setSaving(true);

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

      toast.success("User updated");
      closeDialog();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update user",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: User) {
    const confirmed = window.confirm(
      `Delete user "${user.username}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      await apiRequest<{
        success: boolean;
      }>(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      setUsers((current) =>
        current.filter((item) => item.id !== user.id),
      );

      toast.success(`User "${user.username}" deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete user",
      );
    }
  }

  const customerCount = users.filter(
    (user) => user.role === "customer",
  ).length;

  const adminCount = users.filter(
    (user) => user.role === "superadmin",
  ).length;

  return (
    <div className="animate-rise">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">
            Customer accounts
          </h1>

          <p className="mt-1 text-sm text-ink-soft">
            Create and manage customer access without exposing
            customer data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadUsers(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </Button>

          <Button onClick={openCreateDialog}>
            <UserPlus size={16} />
            Create user
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
            Total users
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {loading ? "—" : users.length}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
            Customers
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {loading ? "—" : customerCount}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[.15em] text-ink-soft">
            Administrators
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {loading ? "—" : adminCount}
          </p>
        </Card>
      </div>

      {/* User table */}
      <Card className="overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted text-xs text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-medium">
                  User
                </th>

                <th className="px-5 py-3 font-medium">
                  Email
                </th>

                <th className="px-5 py-3 font-medium">
                  Role
                </th>

                <th className="px-5 py-3 font-medium">
                  Status
                </th>

                <th className="px-5 py-3 font-medium">
                  Created
                </th>

                <th className="px-5 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line/10">
              {loading &&
                [1, 2, 3].map((item) => (
                  <tr key={item}>
                    <td
                      colSpan={6}
                      className="p-5"
                    >
                      <Skeleton className="h-7" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-muted"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium">
                          {user.username}
                        </p>

                        {user.name && (
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {user.name}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-ink-soft">
                      {user.email}
                    </td>

                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          user.role === "superadmin"
                            ? "accent"
                            : "neutral"
                        }
                      >
                        {user.role === "superadmin"
                          ? "Superadmin"
                          : "Customer"}
                      </Badge>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          tone={
                            user.verified
                              ? "success"
                              : "warning"
                          }
                        >
                          {user.verified
                            ? "Verified"
                            : "Unverified"}
                        </Badge>

                        {user.is_password_temp && (
                          <Badge tone="warning">
                            Temporary password
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-ink-soft">
                      {new Date(
                        user.created,
                      ).toLocaleDateString("id-ID")}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openEditDialog(user)
                          }
                        >
                          <Edit3 size={14} />
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            deleteUser(user)
                          }
                          className="text-negative"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center"
                  >
                    <ShieldCheck
                      size={28}
                      className="mx-auto text-ink-faint"
                    />

                    <p className="mt-3 font-medium">
                      No users found
                    </p>

                    <p className="mt-1 text-sm text-ink-soft">
                      Create your first customer account.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-line/10 md:hidden">
          {loading &&
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="p-4"
              >
                <Skeleton className="h-20" />
              </div>
            ))}

          {!loading &&
            users.map((user) => (
              <div
                key={user.id}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {user.username}
                    </p>

                    <p className="mt-1 break-all text-xs text-ink-soft">
                      {user.email}
                    </p>
                  </div>

                  <Badge
                    tone={
                      user.role === "superadmin"
                        ? "accent"
                        : "neutral"
                    }
                  >
                    {user.role}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    tone={
                      user.verified
                        ? "success"
                        : "warning"
                    }
                  >
                    {user.verified
                      ? "Verified"
                      : "Unverified"}
                  </Badge>

                  {user.is_password_temp && (
                    <Badge tone="warning">
                      Temporary password
                    </Badge>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openEditDialog(user)
                    }
                    className="flex-1"
                  >
                    <Edit3 size={14} />
                    Edit
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      deleteUser(user)
                    }
                    className="text-negative"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
        title={
          dialogMode === "create"
            ? "Create customer"
            : "Edit user"
        }
      >
        {createdCredentials ? (
          <Credentials
            credentials={createdCredentials}
            onDone={closeDialog}
          />
        ) : (
          <div className="space-y-5">
            {/* Email */}
            <div>
              <Label>Email</Label>

              <Input
                type="email"
                value={form.email}
                placeholder="customer@example.com"
                onChange={(event) =>
                  updateForm(
                    "email",
                    event.target.value,
                  )
                }
              />
            </div>

            {/* Username */}
            <div>
              <Label>Username</Label>

              <Input
                value={form.username}
                placeholder="username"
                onChange={(event) =>
                  updateForm(
                    "username",
                    event.target.value,
                  )
                }
              />
            </div>

            {/* Name */}
            <div>
              <Label>Name</Label>

              <Input
                value={form.name}
                placeholder="Customer name"
                onChange={(event) =>
                  updateForm(
                    "name",
                    event.target.value,
                  )
                }
              />
            </div>

            {/* Password */}
            <div>
              <Label>
                {dialogMode === "create"
                  ? "Temporary password"
                  : "New password (optional)"}
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
                        ? "Password"
                        : "Leave blank to keep current"
                    }
                    onChange={(event) =>
                      updateForm(
                        "password",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    updateForm(
                      "password",
                      generatePassword(),
                    )
                  }
                  title="Generate password"
                >
                  <RefreshCw size={15} />
                </Button>
              </div>
            </div>

            {/* Role */}
            <div>
              <Label>Role</Label>

              <select
                value={form.role}
                onChange={(event) =>
                  updateForm(
                    "role",
                    event.target.value as Role,
                  )
                }
                className="mt-1 h-10 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/[.05]"
              >
                <option value="customer">
                  Customer
                </option>

                <option value="superadmin">
                  Superadmin
                </option>
              </select>
            </div>

            {/* Account status */}
            <div>
              <Label>Account status</Label>
              <Select value={form.status} onValueChange={(value) => updateForm("status", value as AccountStatus)}>
                <SelectItem value="active">Active — can sign in</SelectItem>
                <SelectItem value="pending">Pending — awaiting approval</SelectItem>
                <SelectItem value="suspended">Suspended — access blocked</SelectItem>
              </Select>
              <p className="mt-1.5 text-[11px] leading-5 text-ink-faint">Suspended/pending status is enforced by PocketBase rules and backend authentication, not just hidden in the UI.</p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 rounded-xl border border-line/10 bg-muted p-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(event) =>
                    updateForm(
                      "verified",
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4"
                />

                <span>
                  Mark email as verified
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.emailVisibility}
                  onChange={(event) =>
                    updateForm(
                      "emailVisibility",
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4"
                />

                <span>
                  Make email publicly visible
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_password_temp}
                  onChange={(event) =>
                    updateForm(
                      "is_password_temp",
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4"
                />

                <span>
                  Require temporary password handling
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-line/10 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={
                  dialogMode === "create"
                    ? createUser
                    : updateUser
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : dialogMode === "create"
                    ? "Create user"
                    : "Save changes"}
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
            <h3 className="font-semibold">
              Account created successfully
            </h3>

            <p className="mt-1 text-sm text-ink-soft">
              Save these credentials before closing this
              dialog.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <CredentialRow
          label="Email"
          value={credentials.email}
        />

        <CredentialRow
          label="Username"
          value={credentials.username}
        />

        <CredentialRow
          label="Password"
          value={credentials.password}
          secret
        />
      </div>

      <div className="rounded-xl bg-muted p-4">
        <p className="text-xs leading-5 text-ink-soft">
          This password is intended as a temporary password.
          The customer should change it after the first login.
        </p>
      </div>

      <div className="flex justify-between gap-2 border-t border-line/10 pt-4">
        <Button
          variant="outline"
          onClick={() => copyText(allCredentials)}
        >
          <Copy size={15} />
          Copy all
        </Button>

        <Button onClick={onDone}>Done</Button>
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
              secret
                ? "font-mono tracking-wide"
                : ""
            }`}
          >
            {value}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => copyText(value)}
          title={`Copy ${label}`}
        >
          <Copy size={14} />
        </Button>
      </div>
    </div>
  );
}
