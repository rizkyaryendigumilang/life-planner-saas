import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  PawPrint,
  Pencil,
  Plus,
  Search,
  Trash2,
  ScanLine,
  WalletCards, type LucideIcon } from 'lucide-react';
import { API_BASE } from "../lib/hosts";
import { pb } from "../lib/pocketbase";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Select,
  SelectItem,
  Skeleton,
} from "../components/ui";
import AddTransactionDialog from "../components/AddTransactionDialog";
import ScanBillDialog from "../components/ScanBillDialog";
import { formatIDR, formatDate } from "../lib/utils";
import { toast } from "sonner";
import { recycleBin } from "../lib/recycle-bin";
import type { BankAccount, Expense } from "../types";

type PetOption = {
  id: string;
  name: string;
};

function getMonthKey(date?: string | null) {
  if (!date) return "";

  const value = date.slice(0, 10);
  const [year, month] = value.split("-");

  if (!year || !month) return "";

  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");

  if (!year || !month) {
    return monthKey;
  }

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1,
  );

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getCurrentMonthKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function maskAccountNumber(
  accountNumber?: string,
) {
  if (!accountNumber) return "";

  const cleaned =
    accountNumber.replace(/\s+/g, "");

  if (cleaned.length <= 4) {
    return cleaned;
  }

  return `•••• ${cleaned.slice(-4)}`;
}

function getAccountDisplayName(
  account?: BankAccount,
) {
  if (!account) {
    return "No account";
  }

  const masked = maskAccountNumber(
    account.account_number,
  );

  if (masked) {
    return `${account.bank_name} · ${masked}`;
  }

  return account.bank_name;
}

export function Finance() {
  const [items, setItems] = useState<
    Expense[]
  >([]);

  const [pets, setPets] = useState<
    PetOption[]
  >([]);

  const [bankAccounts, setBankAccounts] =
    useState<BankAccount[]>([]);

  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [
    editingTransaction,
    setEditingTransaction,
  ] = useState<Expense | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<Expense | null>(null);

  /*
   * =========================================================
   * ACCOUNT MAP
   * =========================================================
   */
  const accountMap = useMemo(() => {
    return new Map(
      bankAccounts.map((account) => [
        account.id,
        account,
      ]),
    );
  }, [bankAccounts]);

  /*
   * =========================================================
   * LOAD FINANCE (OPTIMIZED PAGINATION & DATE FILTER)
   * =========================================================
   */
  const PAGE_SIZE = 60;

  const load = async (page = 1, append = false, month = selectedMonth) => {
    if (page === 1 && !append) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      /*
       * 1. LOAD EXPENSES WITH DATE FILTER AND PAGINATION
       */
      let filter = "";
      if (month !== "all") {
        filter = `date >= "${month}-01" && date <= "${month}-31"`;
      }

      try {
        const res = await pb
          .collection("expenses")
          .getList<Expense>(page, PAGE_SIZE, {
            sort: "-date,-created",
            filter: filter || undefined,
          });

        setCurrentPage(res.page);
        setTotalItems(res.totalItems);
        setHasMore(res.page < res.totalPages);

        if (append) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const fresh = res.items.filter((i) => !existingIds.has(i.id));
            return [...prev, ...fresh];
          });
        } else {
          setItems(res.items);
        }
      } catch (expenseError) {
        console.error("FINANCE EXPENSE LOAD FAILED:", expenseError);
        toast.error("Could not load transactions.");
      }

      /*
       * 2. LOAD PETS (FIRST PAGE ONLY)
       */
      if (page === 1 && !append) {
        try {
          const petRecords = await pb
            .collection("pets")
            .getFullList<PetOption>({
              sort: "name",
            });
          setPets(petRecords);
        } catch (petError) {
          console.error("Failed to load pets:", petError);
          setPets([]);
        }

        /*
         * 3. LOAD BANK ACCOUNTS (FIRST PAGE ONLY)
         */
        try {
          const accountRecords = await pb
            .collection("bank_accounts")
            .getFullList<BankAccount>({
              sort: "bank_name",
            });
          setBankAccounts(accountRecords);
        } catch (accountError) {
          console.error("Failed to load bank accounts:", accountError);
          setBankAccounts([]);
        }
      }
    } catch (error) {
      console.error("Unexpected finance loading error:", error);
      toast.error("Could not load financial data.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      void load(currentPage + 1, true, selectedMonth);
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    void load(1, false, month);
  };

  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */
  useEffect(() => {
    void load(1, false, selectedMonth);

    const handleRestored = (e: Event) => {
      const collection = (e as CustomEvent).detail?.collection;
      if (collection === "expenses" || collection === "bank_accounts") {
        void load(1, false, selectedMonth);
      }
    };
    window.addEventListener("life-planner:data-restored", handleRestored);
    return () => window.removeEventListener("life-planner:data-restored", handleRestored);
  }, []);

  /*
   * =========================================================
   * MONTH OPTIONS (PRE-POPULATE 12 RECENT MONTHS)
   * =========================================================
   */
  const monthOptions = useMemo(() => {
    const months = new Set<string>();

    items.forEach((item) => {
      const month = getMonthKey(item.date);
      if (month) months.add(month);
    });

    // Populate past 12 months up to current month by default
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [items]);

  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */
  const searchedItems = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return items;
    }

    return items.filter((item) => {
      const account =
        item.account
          ? accountMap.get(
              item.account,
            )
          : undefined;

      const accountText =
        account
          ? `
              ${account.bank_name}
              ${account.account_name}
              ${account.account_number || ""}
            `
          : "";

      const searchableText = `
        ${item.category}
        ${item.notes || ""}
        ${item.type}
        ${accountText}
      `
        .toLowerCase()
        .trim();

      return searchableText.includes(
        keyword,
      );
    });
  }, [
    items,
    search,
    accountMap,
  ]);

  /*
   * =========================================================
   * MONTH FILTER
   * =========================================================
   */
  const filteredItems = useMemo(() => {
    if (selectedMonth === "all") {
      return searchedItems;
    }

    return searchedItems.filter(
      (item) =>
        getMonthKey(item.date) ===
        selectedMonth,
    );
  }, [
    searchedItems,
    selectedMonth,
  ]);

  /*
   * =========================================================
   * METRICS
   * =========================================================
   */
  const income = useMemo(() => {
    return filteredItems
      .filter(
        (item) =>
          item.type === "Income",
      )
      .reduce(
        (total, item) =>
          total +
          Number(item.amount || 0),
        0,
      );
  }, [filteredItems]);

  const expense = useMemo(() => {
    return filteredItems
      .filter(
        (item) =>
          item.type === "Expense",
      )
      .reduce(
        (total, item) =>
          total +
          Number(item.amount || 0),
        0,
      );
  }, [filteredItems]);

  const currentMonthExpense =
    useMemo(() => {
      const currentMonth =
        getCurrentMonthKey();

      return items
        .filter(
          (item) =>
            getMonthKey(item.date) ===
              currentMonth &&
            item.type ===
              "Expense",
        )
        .reduce(
          (total, item) =>
            total +
            Number(item.amount || 0),
          0,
        );
    }, [items]);

  const selectedMonthExpense =
    useMemo(() => {
      return filteredItems
        .filter(
          (item) =>
            item.type ===
            "Expense",
        )
        .reduce(
          (total, item) =>
            total +
            Number(item.amount || 0),
          0,
        );
    }, [filteredItems]);

  const expenseCardValue =
    selectedMonth === "all"
      ? currentMonthExpense
      : selectedMonthExpense;

  /*
   * =========================================================
   * GROUP BY MONTH
   * =========================================================
   */
  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      Expense[]
    >();

    filteredItems.forEach((item) => {
      const monthKey =
        getMonthKey(item.date);

      if (!monthKey) {
        return;
      }

      const current =
        groups.get(monthKey) ?? [];

      current.push(item);

      groups.set(
        monthKey,
        current,
      );
    });

    return Array.from(
      groups.entries(),
    ).sort(([a], [b]) =>
      b.localeCompare(a),
    );
  }, [filteredItems]);

  /*
   * =========================================================
   * ADD
   * =========================================================
   */
  const handleAdd = () => {
    setEditingTransaction(null);
    setOpen(true);
  };

  /*
   * =========================================================
   * EDIT
   * =========================================================
   */
  const handleEdit = (
    item: Expense,
  ) => {
    setEditingTransaction(item);
    setOpen(true);
  };

  /*
   * =========================================================
   * DIALOG
   * =========================================================
   */
  const handleDialogChange = (
    value: boolean,
  ) => {
    setOpen(value);

    if (!value) {
      setEditingTransaction(
        null,
      );
    }
  };

  /*
   * =========================================================
   * SAVE
   * =========================================================
   */
  const handleSave = async (
    data: Record<string, unknown>,
  ) => {
    const userId =
      pb.authStore.record?.id;

    if (!userId) {
      toast.error(
        "Your session has expired. Please log in again.",
      );

      return;
    }

    try {
      /*
       * =======================================================
       * EDIT
       * =======================================================
       */
      if (editingTransaction) {
        const updated =
          await pb
            .collection("expenses")
            .update<Expense>(
              editingTransaction.id,
              {
                user: userId,

                type:
                  data.type ===
                  "Income"
                    ? "Income"
                    : "Expense",

                amount:
                  Number(
                    data.amount,
                  ),

                category:
                  typeof data.category ===
                    "string" &&
                  data.category.trim()
                    ? data.category.trim()
                    : "Uncategorized",

                date:
                  typeof data.date ===
                  "string"
                    ? data.date
                    : editingTransaction.date,

                notes:
                  typeof data.notes ===
                  "string"
                    ? data.notes.trim()
                    : "",

                pet:
                  typeof data.pet ===
                    "string" &&
                  data.pet
                    ? data.pet
                    : null,

                account:
                  typeof data.account ===
                    "string" &&
                  data.account
                    ? data.account
                    : null,
              },
            );

        /*
         * Update UI immediately.
         */
        setItems((current) =>
          current.map((item) =>
            item.id ===
            editingTransaction.id
              ? updated
              : item,
          ),
        );

        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(10);
        }

        toast.success(
          "Transaction updated",
        );
      } else {
        /*
         * =====================================================
         * NEW TRANSACTION
         * =====================================================
         *
         * React
         *   ↓
         * Express
         *   ↓
         * expense_ingestions
         *   ↓
         * automatic processor
         *   ↓
         * expenses
         */

        const accountId =
          typeof data.account ===
            "string" &&
          data.account
            ? data.account
            : null;

        const petId =
          typeof data.pet ===
            "string" &&
          data.pet
            ? data.pet
            : null;

        const transactionType =
          data.type ===
          "Income"
            ? "Income"
            : "Expense";

        const category =
          typeof data.category ===
            "string" &&
          data.category.trim()
            ? data.category.trim()
            : "Uncategorized";

        const notes =
          typeof data.notes ===
          "string"
            ? data.notes.trim()
            : "";

        const apiBaseUrl = API_BASE;

        const token = pb.authStore.token;
        if (!token || !pb.authStore.isValid) {
          throw new Error("Sesi login sudah berakhir. Silakan login kembali.");
        }

        const response =
          await fetch(
            `${apiBaseUrl}/api/expense-ingestions`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
                Authorization: `Bearer ${token}`,
              },

              body: JSON.stringify({
                external_id: null,

                amount:
                  Number(
                    data.amount,
                  ),

                category,

                date: data.date,

                type:
                  transactionType,

                notes,

                merchant: null,

                pet: petId,

                account:
                  accountId,

                source: "manual",
              }),
            },
          );

        let result: {
          message?: string;
          error?: string;
          ingestion?: Record<
            string,
            unknown
          >;
          expense?: Expense;
          [key: string]: unknown;
        } = {};

        try {
          result =
            await response.json();
        } catch {
          result = {};
        }

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.error ||
              `Failed to record transaction (${response.status})`,
          );
        }

        /*
         * =====================================================
         * IMPORTANT
         * =====================================================
         *
         * The backend currently returns the created
         * expense when automatic processing succeeds.
         *
         * If it exists, insert it immediately into state.
         */
        if (
          result.expense &&
          typeof result.expense ===
            "object" &&
          result.expense.id
        ) {
          const createdExpense =
            result.expense;

          setItems((current) => {
            const exists =
              current.some(
                (item) =>
                  item.id ===
                  createdExpense.id,
              );

            if (exists) {
              return current;
            }

            return [
              createdExpense,
              ...current,
            ];
          });
        }

        /*
         * Reload canonical data from PocketBase.
         *
         * Small delay gives the automatic processor
         * a chance to finish if the API response
         * only contains ingestion information.
         */
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              300,
            ),
        );

        await load();

        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(12);
        }

        toast.success(
          "Transaction created successfully",
        );
      }

      /*
       * Close dialog.
       */
      setOpen(false);

      setEditingTransaction(
        null,
      );
    } catch (error) {
      console.error(
        "Finance save error:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : editingTransaction
            ? "Could not update transaction."
            : "Could not save transaction.",
      );

      throw error;
    }
  };

  /*
   * =========================================================
   * DELETE
   * =========================================================
   */
  const handleDelete =
    async () => {
      if (!deleteTarget) {
        return;
      }

      try {
        await recycleBin.trash("expenses", deleteTarget, {
          typeLabel: "Expense",
          title: deleteTarget.category || "Expense",
          subtitle: deleteTarget.notes || deleteTarget.date,
          amount: Number(deleteTarget.amount || 0),
        });

        setItems((current) =>
          current.filter(
            (item) =>
              item.id !==
              deleteTarget.id,
          ),
        );

        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(15);
        }

        toast.success(
          "Transaksi dipindahkan ke Tempat Sampah (Recycle Bin)",
        );

        setDeleteTarget(null);
      } catch (error) {
        console.error(error);

        toast.error(
          error instanceof Error
            ? error.message
            : "Could not delete transaction.",
        );
      }
    };

  return (
    <div className="animate-rise">
      {/* =====================================================
          HEADER
          ===================================================== */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">
            Expense Tracking
          </h1>

          <p className="mt-1 text-sm text-ink-soft">
            Know where the money moved,
            without making finance feel
            like work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine size={15} />
            Scan bill
          </Button>

          <Button size="sm" onClick={handleAdd}>
            <Plus size={15} />
            Add transaction
          </Button>
        </div>
      </div>

      {/* =====================================================
          EXPENSE PERIOD
          ===================================================== */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-line/15 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            Expense period
          </p>

          <p className="mt-1 text-xs text-ink-soft">
            Transactions are organized by
            transaction date.
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={selectedMonth}
            onValueChange={handleMonthChange}
          >
            <SelectItem value="all">
              All months
            </SelectItem>

            {monthOptions.map(
              (month) => (
                <SelectItem
                  key={month}
                  value={month}
                >
                  {formatMonthLabel(
                    month,
                  )}
                </SelectItem>
              ),
            )}
          </Select>
        </div>
      </div>

      {/* =====================================================
          BANK ACCOUNT
          ===================================================== */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-line/15 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            Account
          </p>

          <p className="mt-1 text-xs text-ink-soft">
            A transaction can be associated
            with an account. Recorded balance
            is managed separately.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(
                "life-planner:navigate",
                {
                  detail:
                    "bank-accounts",
                },
              ),
            )
          }
        >
          <Landmark size={15} />
          Manage accounts
        </Button>
      </div>

      {/* =====================================================
          PET
          ===================================================== */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-line/15 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            Pet expenses
          </p>

          <p className="mt-1 text-xs text-ink-soft">
            Link a transaction to one of
            your pet profiles.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(
                "life-planner:navigate",
                {
                  detail: "pets",
                },
              ),
            )
          }
        >
          <PawPrint size={15} />
          Manage pets
        </Button>
      </div>

      {/* =====================================================
          METRICS
          ===================================================== */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={WalletCards}
          label="Net cash flow"
          value={formatIDR(
            income - expense,
          )}
        />

        <Metric
          icon={ArrowUpRight}
          label="Income"
          value={formatIDR(
            income,
          )}
        />

        <Metric
          icon={ArrowDownLeft}
          label="Expenses"
          value={formatIDR(
            expense,
          )}
        />

        <Metric
          icon={CreditCard}
          label={
            selectedMonth ===
            "all"
              ? "This month"
              : formatMonthLabel(
                  selectedMonth,
                )
          }
          value={formatIDR(
            expenseCardValue,
          )}
        />
      </div>

      {/* =====================================================
          TRANSACTION TABLE
          ===================================================== */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-3 text-ink-soft"
            />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search transactions..."
              className="pl-9"
            />
          </div>

          <span className="text-xs text-ink-soft">
            {filteredItems.length}{" "}
            records
          </span>
        </div>

        {/* ===================================================
            LOADING
            =================================================== */}
        {loading ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <tbody>
                  {[1, 2, 3, 4].map(
                    (item) => (
                      <tr key={item}>
                        <td
                          colSpan={7}
                          className="px-5 py-4"
                        >
                          <Skeleton className="h-7" />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line/10 md:hidden">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="p-4"
                  >
                    <Skeleton className="h-20" />
                  </div>
                ),
              )}
            </div>
          </>
        ) : filteredItems.length ? (
          <>
            {/* =================================================
                DESKTOP
                ================================================= */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted text-xs text-ink-soft">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Date
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Category
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Account
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Type
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Notes
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Amount
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line/10">
                  {groupedItems.map(
                    ([
                      monthKey,
                      monthItems,
                    ]) => (
                      <MonthRows
                        key={monthKey}
                        monthKey={
                          monthKey
                        }
                        items={
                          monthItems
                        }
                        accountMap={
                          accountMap
                        }
                        onEdit={
                          handleEdit
                        }
                        onDelete={
                          setDeleteTarget
                        }
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* =================================================
                MOBILE
                ================================================= */}
            <div className="divide-y divide-line/10 md:hidden">
              {groupedItems.map(
                ([
                  monthKey,
                  monthItems,
                ]) => (
                  <div
                    key={monthKey}
                  >
                    <div className="flex items-center justify-between bg-muted px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink-soft">
                        {formatMonthLabel(
                          monthKey,
                        )}
                      </p>

                      <p className="text-xs text-ink-faint">
                        {
                          monthItems.length
                        }{" "}
                        records
                      </p>
                    </div>

                    {monthItems.map(
                      (item) => {
                        const account =
                          item.account
                            ? accountMap.get(
                                item.account,
                              )
                            : undefined;

                        return (
                          <div
                            key={
                              item.id
                            }
                            className="p-4"
                          >
                            <div className="flex justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                  {
                                    item.category
                                  }
                                </p>

                                <p className="mt-1 text-xs text-ink-soft">
                                  {formatDate(
                                    item.date,
                                  )}
                                  {" · "}
                                  {item.notes ||
                                    "No note"}
                                </p>

                                {account && (
                                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                                    <Landmark
                                      size={
                                        12
                                      }
                                    />

                                    {getAccountDisplayName(
                                      account,
                                    )}
                                  </p>
                                )}
                              </div>

                              <p
                                className={
                                  item.type ===
                                  "Income"
                                    ? "shrink-0 text-sm font-semibold text-positive"
                                    : "shrink-0 text-sm font-semibold"
                                }
                              >
                                {item.type ===
                                "Income"
                                  ? "+"
                                  : "−"}

                                {formatIDR(
                                  item.amount,
                                )}
                              </p>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <Badge
                                tone={
                                  item.type ===
                                  "Income"
                                    ? "success"
                                    : "neutral"
                                }
                              >
                                {
                                  item.type
                                }
                              </Badge>

                              <div className="flex items-center gap-1">
                                <IconButton
                                  label="Edit"
                                  onClick={() =>
                                    handleEdit(
                                      item,
                                    )
                                  }
                                >
                                  <Pencil
                                    size={
                                      15
                                    }
                                  />
                                </IconButton>

                                <IconButton
                                  label="Delete"
                                  danger
                                  onClick={() =>
                                    setDeleteTarget(
                                      item,
                                    )
                                  }
                                >
                                  <Trash2
                                    size={
                                      15
                                    }
                                  />
                                </IconButton>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ),
              )}
            </div>

            {hasMore && (
              <div className="flex items-center justify-center border-t border-line/10 p-4 bg-muted/20">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full sm:w-auto text-xs"
                >
                  {loadingMore
                    ? "Loading more transactions..."
                    : `Load more transactions (${items.length} of ${totalItems} loaded)`}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="p-10 text-center text-sm text-ink-soft">
            {search
              ? "No transactions match your search."
              : selectedMonth ===
                  "all"
                ? "No transactions yet. Add your first one above."
                : `No transactions recorded for ${formatMonthLabel(
                    selectedMonth,
                  )}.`}
          </div>
        )}
      </Card>

      {/* =====================================================
          ADD / EDIT DIALOG
          ===================================================== */}
      <AddTransactionDialog
        pets={pets}
        bankAccounts={
          bankAccounts
        }
        open={open}
        onOpenChange={
          handleDialogChange
        }
        transaction={
          editingTransaction
        }
        onCreate={handleSave}
      />

      <ScanBillDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        bankAccounts={bankAccounts}
        onSaved={() => void load()}
      />

      {/* =====================================================
          DELETE DIALOG
          ===================================================== */}
      <DeleteDialog
        transaction={
          deleteTarget
        }
        open={Boolean(
          deleteTarget,
        )}
        onOpenChange={(value) => {
          if (!value) {
            setDeleteTarget(
              null,
            );
          }
        }}
        onConfirm={
          handleDelete
        }
      />
    </div>
  );
}

/*
 * ===========================================================
 * MONTH ROWS
 * ===========================================================
 */
function MonthRows({
  monthKey,
  items,
  accountMap,
  onEdit,
  onDelete,
}: {
  monthKey: string;
  items: Expense[];
  accountMap: Map<
    string,
    BankAccount
  >;
  onEdit: (item: Expense) => void;
  onDelete: (item: Expense) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={7}
          className="bg-muted px-5 py-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink-soft">
              {formatMonthLabel(
                monthKey,
              )}
            </p>

            <p className="text-xs text-ink-faint">
              {items.length} records
            </p>
          </div>
        </td>
      </tr>

      {items.map((item) => {
        const account =
          item.account
            ? accountMap.get(
                item.account,
              )
            : undefined;

        return (
          <tr
            key={item.id}
            className="transition hover:bg-muted"
          >
            <td className="px-5 py-4">
              {formatDate(item.date)}
            </td>

            <td className="px-5 py-4 font-medium">
              {item.category}
            </td>

            <td className="px-5 py-4">
              {account ? (
                <div>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    <Landmark
                      size={13}
                    />

                    {
                      account.bank_name
                    }
                  </p>

                  <p className="mt-0.5 text-xs text-ink-soft">
                    {maskAccountNumber(
                      account.account_number,
                    )}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-ink-faint">
                  No account
                </span>
              )}
            </td>

            <td className="px-5 py-4">
              <Badge
                tone={
                  item.type ===
                  "Income"
                    ? "success"
                    : "neutral"
                }
              >
                {item.type}
              </Badge>
            </td>

            <td className="px-5 py-4 text-ink-soft">
              {item.notes || "—"}
            </td>

            <td
              className={
                item.type ===
                "Income"
                  ? "px-5 py-4 text-right font-semibold text-positive"
                  : "px-5 py-4 text-right font-semibold"
              }
            >
              {item.type ===
              "Income"
                ? "+"
                : "−"}

              {formatIDR(
                item.amount,
              )}
            </td>

            <td className="px-5 py-4">
              <div className="flex justify-end gap-1">
                <IconButton
                  label="Edit transaction"
                  onClick={() =>
                    onEdit(item)
                  }
                >
                  <Pencil size={15} />
                </IconButton>

                <IconButton
                  label="Delete transaction"
                  danger
                  onClick={() =>
                    onDelete(item)
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/*
 * ===========================================================
 * ICON BUTTON
 * ===========================================================
 */
function IconButton({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        "grid h-8 w-8 place-items-center rounded-lg border transition",

        danger
          ? "border-transparent text-negative hover:border-negative/25 hover:bg-negative/10"
          : "border-transparent text-ink-soft hover:border-line/15 hover:bg-surface hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/*
 * ===========================================================
 * DELETE DIALOG
 * ===========================================================
 */
function DeleteDialog({
  transaction,
  open,
  onOpenChange,
  onConfirm,
}: {
  transaction: Expense | null;
  open: boolean;
  onOpenChange: (
    value: boolean,
  ) => void;
  onConfirm: () => void;
}) {
  if (!transaction) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
      title="Delete transaction"
    >
      <div>
        <p className="text-sm leading-6 text-ink-soft">
          Are you sure you want to
          delete this transaction?
          This action cannot be
          undone.
        </p>

        <div className="mt-4 rounded-xl bg-muted p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">
                {
                  transaction.category
                }
              </p>

              <p className="mt-1 text-xs text-ink-soft">
                {formatDate(
                  transaction.date,
                )}
              </p>
            </div>

            <p className="text-sm font-semibold">
              {transaction.type ===
              "Income"
                ? "+"
                : "−"}

              {formatIDR(
                transaction.amount,
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Cancel
          </Button>

          <Button
            onClick={onConfirm}
            className="bg-negative hover:bg-negative/90"
          >
            Delete transaction
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/*
 * ===========================================================
 * METRIC
 * ===========================================================
 */
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-ink-soft">
            {label}
          </p>

          <p className="mt-1 text-xl font-semibold tracking-tight">
            {value}
          </p>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted">
          <Icon size={17} />
        </div>
      </div>
    </Card>
  );
}


