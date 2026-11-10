import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  Input,
  Label,
  Select,
  SelectItem,
} from "./ui";
import { toast } from "sonner";
import { EXPENSE_CATEGORIES } from "../lib/categories";
import {
  HOUSEHOLD_SUBCATEGORIES,
  type HouseholdSubcategory,
  isHouseholdExpense,
  extractHouseholdSubcategory,
  cleanHouseholdNotes,
  buildHouseholdNotes,
} from "../lib/household";

type Pet = {
  id: string;
  name: string;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number?: string;
  account_type?: string;
  balance?: number;
  status?: string;
};

type Transaction = {
  id?: string;
  type?: string;
  amount?: number | string | null;
  pet?: string | null;
  account?: string | null;
  category?: string | null;
  date?: string | null;
  notes?: string | null;
  due_date?: string | null;
};

type TransactionFormData = {
  type: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  pet?: string;
  account?: string;
  due_date?: string;
};

type AddTransactionDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onCreate: (
    data: TransactionFormData,
  ) => Promise<void> | void;
  pets?: Pet[];
  bankAccounts?: BankAccount[];
  transaction?: Transaction | null;
};

const categories = EXPENSE_CATEGORIES;

function getMonthLabel(date: string) {
  if (!date) return "";

  const value = new Date(`${date}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function getInitialDate(
  transaction: Transaction | null | undefined,
) {
  if (transaction?.date) {
    return transaction.date.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function maskAccountNumber(
  accountNumber?: string,
) {
  if (!accountNumber) {
    return "";
  }

  const cleaned = accountNumber.replace(/\s+/g, "");

  if (cleaned.length <= 4) {
    return cleaned;
  }

  return `•••• ${cleaned.slice(-4)}`;
}

function getAccountLabel(
  account: BankAccount,
) {
  const masked = maskAccountNumber(
    account.account_number,
  );

  return masked
    ? `${account.bank_name} · ${account.account_name} · ${masked}`
    : `${account.bank_name} · ${account.account_name}`;
}

export default function AddTransactionDialog({
  open,
  onOpenChange,
  onCreate,
  pets = [],
  bankAccounts = [],
  transaction = null,
}: AddTransactionDialogProps) {
  const isEditing = Boolean(transaction);

  const [type, setType] =
    useState("Expense");

  const [amount, setAmount] =
    useState("");

  const [account, setAccount] =
    useState("");

  const [pet, setPet] =
    useState("");

  const [category, setCategory] =
    useState("Food");

  const [date, setDate] =
    useState(getInitialDate(transaction));

  const [notes, setNotes] =
    useState("");

  const [allocation, setAllocation] =
    useState<"personal" | "household">("personal");

  const [householdSub, setHouseholdSub] =
    useState<HouseholdSubcategory>("Listrik PLN");

  const [dueDate, setDueDate] =
    useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setType(
      transaction?.type || "Expense",
    );

    setAmount(
      transaction?.amount != null
        ? String(transaction.amount)
        : "",
    );

    setAccount(
      transaction?.account || "",
    );

    setPet(
      transaction?.pet || "",
    );

    setCategory(
      transaction?.category || "Food",
    );

    setDate(
      getInitialDate(transaction),
    );

    const isHh = transaction ? isHouseholdExpense(transaction) : false;
    setAllocation(isHh ? "household" : "personal");

    if (isHh && transaction) {
      setHouseholdSub(extractHouseholdSubcategory(transaction));
      setNotes(cleanHouseholdNotes(transaction.notes));
    } else {
      setHouseholdSub("Listrik PLN");
      setNotes(transaction?.notes || "");
    }

    setDueDate(transaction?.due_date ? transaction.due_date.slice(0, 10) : "");
  }, [open, transaction]);

  const resetForm = () => {
    setType("Expense");
    setAmount("");
    setAccount("");
    setPet("");
    setCategory("Food");
    setAllocation("personal");
    setHouseholdSub("Listrik PLN");
    setDueDate("");

    setDate(
      new Date()
        .toISOString()
        .slice(0, 10),
    );

    setNotes("");
  };

  const handleOpenChange = (
    value: boolean,
  ) => {
    onOpenChange(value);

    if (!value) {
      resetForm();
    }
  };

  const handleCategoryChange = (
    value: string,
  ) => {
    setCategory(value);

    if (value !== "Pet") {
      setPet("");
    }
  };

  const handleSubmit = async () => {
    if (
      !amount ||
      Number(amount) <= 0
    ) {
      toast.error(
        "Please enter a valid amount.",
      );

      return;
    }

    if (!date) {
      toast.error(
        "Please select a transaction date.",
      );

      return;
    }

    let finalNotes = notes.trim();
    let finalCategory = category;

    if (allocation === "household") {
      finalNotes = buildHouseholdNotes(notes, householdSub);
      if (householdSub === "Belanja Dapur & Pokok") {
        finalCategory = "Food";
      } else if (householdSub === "Perawatan & Servis Rumah") {
        finalCategory = "Other";
      } else {
        finalCategory = "Bills";
      }
    }

    try {
      await onCreate({
        type,
        amount: Number(amount),
        category: finalCategory,
        date,
        notes:
          finalNotes || undefined,
        pet:
          pet || undefined,
        account:
          account || undefined,
        due_date:
          dueDate || undefined,
      });
    } catch {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={
        isEditing
          ? "Edit transaction"
          : "Add transaction"
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* ALLOCATION SWITCH (PERSONAL VS HOUSEHOLD) */}
        <div className="sm:col-span-2">
          <Label>Alokasi Anggaran</Label>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/60 p-1 border border-line/10">
            <button
              type="button"
              onClick={() => {
                setAllocation("personal");
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                allocation === "personal"
                  ? "bg-surface text-ink font-semibold shadow-xs border border-line/10"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              👤 Pribadi
            </button>
            <button
              type="button"
              onClick={() => {
                setAllocation("household");
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                allocation === "household"
                  ? "bg-surface text-ink font-semibold shadow-xs border border-line/10"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              🏠 Rumah Tangga
            </button>
          </div>
        </div>

        {/* TYPE */}
        <div className="sm:col-span-2">
          <Label>Type</Label>

          <Select
            value={type}
            onValueChange={setType}
          >
            <SelectItem value="Expense">
              Expense
            </SelectItem>

            <SelectItem value="Income">
              Income
            </SelectItem>
          </Select>
        </div>

        {/* AMOUNT */}
        <div>
          <Label>Amount</Label>

          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={amount}
            onChange={(event) =>
              setAmount(
                event.target.value,
              )
            }
            placeholder="0"
          />
        </div>

        {/* DATE */}
        <div>
          <Label>Date</Label>

          <Input
            type="date"
            value={date}
            onChange={(event) =>
              setDate(
                event.target.value,
              )
            }
          />

          {date && (
            <p className="mt-1 text-[11px] text-ink-faint">
              Recorded under{" "}
              {getMonthLabel(date)}
            </p>
          )}
        </div>

        {/* CATEGORY / HOUSEHOLD SUBCATEGORY */}
        {allocation === "household" ? (
          <>
            <div className="sm:col-span-2">
              <Label>Kebutuhan Rumah Tangga</Label>
              <Select
                value={householdSub}
                onValueChange={(val) => setHouseholdSub(val as HouseholdSubcategory)}
              >
                {HOUSEHOLD_SUBCATEGORIES.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Jatuh Tempo (Due Date)</Label>
                <span className="text-[11px] text-ink-faint">Opsional untuk tagihan</span>
              </div>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <Label>Category</Label>

            <Select
              value={category}
              onValueChange={
                handleCategoryChange
              }
            >
              {categories.map(
                (item) => (
                  <SelectItem
                    key={item}
                    value={item}
                  >
                    {item}
                  </SelectItem>
                ),
              )}
            </Select>
          </div>
        )}

        {/* ACCOUNT */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>
              Account
            </Label>

            <span className="text-[11px] text-ink-faint">
              Optional
            </span>
          </div>

          <Select
            value={
              account || "none"
            }
            onValueChange={(
              value,
            ) =>
              setAccount(
                value === "none"
                  ? ""
                  : value,
              )
            }
          >
            <SelectItem value="none">
              No account selected
            </SelectItem>

            {bankAccounts.map(
              (item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                >
                  {getAccountLabel(
                    item,
                  )}
                </SelectItem>
              ),
            )}
          </Select>

          {!bankAccounts.length && (
            <p className="mt-1 text-[11px] text-ink-faint">
              Add an account first
              if you want to associate
              this transaction with an
              account.
            </p>
          )}

          {account && (
            <p className="mt-1 text-[11px] text-ink-soft">
              This only records which
              account the transaction
              belongs to. It does not
              change the recorded account
              balance.
            </p>
          )}
        </div>

        {/* PET */}
        {category === "Pet" && (
          <div className="sm:col-span-2">
            <Label>Pet</Label>

            <Select
              value={
                pet || "none"
              }
              onValueChange={(
                value,
              ) =>
                setPet(
                  value === "none"
                    ? ""
                    : value,
                )
              }
            >
              <SelectItem value="none">
                General pet expense
              </SelectItem>

              {pets.map(
                (item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </SelectItem>
                ),
              )}
            </Select>
          </div>
        )}

        {/* NOTES */}
        <div className="sm:col-span-2">
          <Label>Notes</Label>

          <Input
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            placeholder="Optional"
          />
        </div>

        {/* SUBMIT */}
        <div className="sm:col-span-2">
          <Button
            className="w-full"
            disabled={
              !amount ||
              Number(amount) <= 0
            }
            onClick={handleSubmit}
          >
            {isEditing
              ? "Save changes"
              : "Save transaction"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
