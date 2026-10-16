import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { pb } from "../lib/pocketbase";
import { Button, Card, Dialog, Input, Label, Select, SelectItem } from "../components/ui";
import CardSwipeDeck from "../components/CardSwipeDeck";
import { recycleBin } from "../lib/recycle-bin";
import type { BankAccount } from "../types";

type AccountForm = {
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: BankAccount["account_type"];
  balance: string;
  status: BankAccount["status"];
  notes: string;
};

const emptyForm: AccountForm = {
  bank_name: "",
  account_name: "",
  account_number: "",
  account_type: "Savings",
  balance: "",
  status: "Active",
  notes: "",
};

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function maskAccountNumber(value?: string) {
  if (!value) return "No account number";

  const clean = value.replace(/\s+/g, "");

  if (clean.length <= 4) {
    return `•••• ${clean}`;
  }

  return `•••• ${clean.slice(-4)}`;
}

function formatUpdatedDate(value?: string) {
  if (!value) return "Not updated";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitials(name: string) {
  if (!name.trim()) return "AC";

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getCardTone(index: number, type?: string) {
  if (type === "E-Wallet") {
    return "from-slate-900 via-indigo-950 to-zinc-950 text-white";
  }

  const tones = [
    "from-zinc-900 via-zinc-800 to-zinc-950 text-white",
    "from-slate-900 via-slate-800 to-slate-950 text-white",
    "from-emerald-950 via-teal-900 to-zinc-950 text-white",
    "from-indigo-950 via-slate-900 to-zinc-950 text-white",
    "from-stone-900 via-zinc-900 to-neutral-950 text-white",
  ];

  return tones[index % tones.length];
}

export function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);

  const userId = pb.authStore.record?.id;

  // Tutup menu opsi kartu saat klik di luar
  useEffect(() => {
    if (!menuAccountId) return;
    const closeMenu = () => setMenuAccountId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [menuAccountId]);

  const loadAccounts = async () => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const records = await pb.collection("bank_accounts").getFullList<BankAccount>({
        filter: `user = "${userId}"`,
        sort: "-created",
      });

      setAccounts(records);

      if (records.length === 0) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex((current) => Math.min(current, records.length - 1));
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
      toast.error("Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();

    const handleRestored = (e: Event) => {
      if ((e as CustomEvent).detail?.collection === "bank_accounts") {
        loadAccounts();
      }
    };
    window.addEventListener("life-planner:data-restored", handleRestored);
    return () => window.removeEventListener("life-planner:data-restored", handleRestored);
  }, [userId]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "Active"),
    [accounts],
  );

  const totalRecordedBalance = useMemo(
    () =>
      activeAccounts.reduce(
        (total, account) => total + Number(account.balance || 0),
        0,
      ),
    [activeAccounts],
  );

  const openCreateDialog = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setMenuAccountId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (account: BankAccount) => {
    setEditingAccount(account);

    setForm({
      bank_name: account.bank_name || "",
      account_name: account.account_name || "",
      account_number: account.account_number || "",
      account_type: account.account_type || "Savings",
      balance: String(account.balance ?? ""),
      status: account.status || "Active",
      notes: account.notes || "",
    });

    setMenuAccountId(null);
    setDialogOpen(true);
  };

  const updateForm = <K extends keyof AccountForm>(
    key: K,
    value: AccountForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("You are not authenticated.");
      return;
    }

    if (!form.bank_name.trim()) {
      toast.error("Please enter the institution / wallet name.");
      return;
    }

    if (!form.account_name.trim()) {
      toast.error("Please enter the account name.");
      return;
    }

    const balance = Number(form.balance || 0);

    if (Number.isNaN(balance) || balance < 0) {
      toast.error("Please enter a valid recorded balance.");
      return;
    }

    try {
      const payload = {
        user: userId,
        bank_name: form.bank_name.trim(),
        account_name: form.account_name.trim(),
        account_number: form.account_number.trim(),
        account_type: form.account_type,
        balance,
        status: form.status,
        notes: form.notes.trim(),
      };

      if (editingAccount) {
        await pb.collection("bank_accounts").update(editingAccount.id, payload);
        toast.success("Account updated.");
      } else {
        await pb.collection("bank_accounts").create(payload);
        toast.success("Account added.");
      }

      setDialogOpen(false);
      setEditingAccount(null);
      setForm(emptyForm);

      await loadAccounts();
    } catch (error) {
      console.error("Failed to save account:", error);
      toast.error("Failed to save account.");
    }
  };

  const handleDelete = async (account: BankAccount) => {
    setMenuAccountId(null);

    const confirmed = window.confirm(`Pindahkan akun ${account.bank_name} ke Tempat Sampah (Recycle Bin)?`);
    if (!confirmed) return;

    try {
      await recycleBin.trash("bank_accounts", account, {
        typeLabel: "Account",
        title: account.bank_name,
        subtitle: `${account.account_type} · ${maskAccountNumber(account.account_number)}`,
        amount: Number(account.balance || 0),
      });
      toast.success(`${account.bank_name} dipindahkan ke Tempat Sampah.`);
      await loadAccounts();
    } catch (error) {
      console.error("Failed to delete account:", error);
      toast.error("Gagal menghapus akun.");
    }
  };

  const handlePrevious = () => {
    if (accounts.length === 0) return;
    setSelectedIndex((current) =>
      current <= 0 ? accounts.length - 1 : current - 1,
    );
  };

  const handleNext = () => {
    if (accounts.length === 0) return;
    setSelectedIndex((current) =>
      current >= accounts.length - 1 ? 0 : current + 1,
    );
  };

  const renderCard = useCallback(
    (account: BankAccount, { index }: { isActive: boolean; index: number }) => (
      <div
        className={[
          "relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[26px]",
          "bg-gradient-to-br",
          getCardTone(index, account.account_type),
          "p-6 shadow-[0_18px_45px_rgba(0,0,0,0.22)] border border-white/10",
        ].join(" ")}
      >
        {/* Decorative background circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full border border-white/5" />

        {/* Card top */}
        <div className="relative flex items-start justify-between">
          <div>
            <span className="inline-block rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
              {account.account_type}
            </span>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
              {account.bank_name}
            </h3>
          </div>

          {/* Actions menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAccountId(
                  menuAccountId === account.id ? null : account.id,
                );
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 active:scale-95"
              aria-label="Account menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuAccountId === account.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl border border-line/15 bg-surface p-1 text-ink shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => openEditDialog(account)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit account
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(account)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-negative hover:bg-negative/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account number */}
        <div className="relative my-auto py-1">
          <p className="font-mono text-sm tracking-[0.25em] text-white/70">
            {maskAccountNumber(account.account_number)}
          </p>
        </div>

        {/* Balance & Account Holder */}
        <div className="relative flex items-end justify-between pt-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
              Recorded Balance
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-white">
              {formatIDR(Number(account.balance || 0))}
            </p>
            <p className="mt-1 max-w-[190px] truncate text-[11px] font-medium text-white/80">
              {account.account_name}
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/15 text-xs font-bold text-white shadow-inner backdrop-blur-sm">
            {getInitials(account.bank_name)}
          </div>
        </div>

        {/* Inactive overlay */}
        {account.status === "Inactive" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[26px] bg-black/45 backdrop-blur-[2px]">
            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
              Inactive
            </span>
          </div>
        )}
      </div>
    ),
    [menuAccountId]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-ink-faint">
            <WalletCards className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-[0.18em]">
              Wallet & Accounts
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Accounts
          </h1>

          <p className="mt-1 max-w-xl text-sm leading-6 text-ink-soft">
            Manage your financial accounts and wallets privately. Balances are manually recorded
            and are not connected to your bank.
          </p>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add account
        </Button>
      </div>

      {/* Recorded balance summary */}
      <Card className="border-line/15 bg-muted">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
              Total recorded balance
            </p>

            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
              {formatIDR(totalRecordedBalance)}
            </p>

            <p className="mt-1 text-xs text-ink-soft">
              Across {activeAccounts.length} active{" "}
              {activeAccounts.length === 1 ? "account" : "accounts"}
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line/10 bg-surface">
            <WalletCards className="h-5 w-5 text-ink-soft" />
          </div>
        </div>
      </Card>

      {/* Wallet swipe deck */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Your accounts</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Swipe left or right to switch cards, or click to inspect.
            </p>
          </div>

          {accounts.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevious}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line/10 bg-surface text-ink-soft transition hover:bg-muted"
                aria-label="Previous account"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line/10 bg-surface text-ink-soft transition hover:bg-muted"
                aria-label="Next account"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="mx-auto h-[240px] max-w-[440px] animate-pulse rounded-[26px] bg-muted" />
        ) : accounts.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-line/15 bg-muted px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-sm">
              <CreditCard className="h-5 w-5 text-ink-soft" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-ink">No accounts yet</h3>

            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-soft">
              Add your first account to create your private wallet deck.
            </p>

            <Button className="mt-5" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first account
            </Button>
          </div>
        ) : (
          <CardSwipeDeck
            items={accounts}
            currentIndex={selectedIndex}
            onIndexChange={(nextIndex) => setSelectedIndex(nextIndex)}
            renderCard={renderCard}
          />
        )}
      </section>

      {/* Account list */}
      {accounts.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">My accounts</h2>
              <p className="mt-1 text-xs text-ink-soft">
                Private records stored only in your Life Planner account.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateDialog}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line/10 bg-surface text-ink-soft hover:bg-muted"
              aria-label="Add account"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line/15 bg-surface">
            {accounts.map((account, index) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={[
                  "flex w-full items-center gap-3 px-4 py-4 text-left transition",
                  index === selectedIndex ? "bg-muted/70 font-medium" : "hover:bg-muted",
                  index !== accounts.length - 1 ? "border-b border-line/10" : "",
                ].join(" ")}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-ink-soft">
                  {getInitials(account.bank_name)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {account.bank_name}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-ink-faint">
                    {account.account_type} · {maskAccountNumber(account.account_number)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatIDR(Number(account.balance || 0))}
                  </p>

                  <p className="mt-0.5 text-[10px] text-ink-faint">
                    {formatUpdatedDate(account.updated || account.created)}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Add/Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingAccount ? "Edit account" : "Add account"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Institution / Wallet name</Label>
            <Input
              value={form.bank_name}
              onChange={(event) =>
                updateForm("bank_name", event.target.value)
              }
              placeholder="BCA, Mandiri, GoPay, Cash..."
            />
          </div>

          <div>
            <Label>Account name</Label>
            <Input
              value={form.account_name}
              onChange={(event) =>
                updateForm("account_name", event.target.value)
              }
              placeholder="Personal Savings"
            />
          </div>

          <div>
            <Label>Account type</Label>
            <Select
              value={form.account_type}
              onValueChange={(value) =>
                updateForm("account_type", value as BankAccount["account_type"])
              }
            >
              <SelectItem value="Savings">Savings</SelectItem>
              <SelectItem value="Current">Current</SelectItem>
              <SelectItem value="E-Wallet">E-Wallet</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </Select>
          </div>

          <div>
            <Label>Account number</Label>
            <Input
              value={form.account_number}
              onChange={(event) =>
                updateForm("account_number", event.target.value)
              }
              placeholder="Optional"
              inputMode="numeric"
            />
            <p className="mt-1 text-[10px] leading-4 text-ink-faint">
              Only the last 4 digits will normally be shown in the wallet.
            </p>
          </div>

          <div>
            <Label>Recorded balance</Label>
            <Input
              type="number"
              min="0"
              value={form.balance}
              onChange={(event) =>
                updateForm("balance", event.target.value)
              }
              placeholder="0"
            />
            <p className="mt-1 text-[10px] leading-4 text-ink-faint">
              This is a manual record, not a live bank balance.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) =>
                updateForm("status", value as BankAccount["status"])
              }
            >
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(event) =>
                updateForm("notes", event.target.value)
              }
              placeholder="Optional"
            />
          </div>

          <div className="sm:col-span-2 flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button className="flex-1" onClick={handleSave}>
              {editingAccount ? "Save changes" : "Add account"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
