import { pb } from "./pocketbase";
import type { Expense, HouseholdBill } from "../types";

export const HOUSEHOLD_SUBCATEGORIES = [
  "Listrik PLN",
  "Air PDAM",
  "Internet & TV",
  "Belanja Dapur & Pokok",
  "Iuran Lingkungan / IPL",
  "Perawatan & Servis Rumah",
  "Gas LPG",
  "Lainnya",
] as const;

export type HouseholdSubcategory = (typeof HOUSEHOLD_SUBCATEGORIES)[number];

export interface HouseholdBillConfig {
  id: string;
  name: string;
  subCategory: HouseholdSubcategory;
  defaultAmount: number;
  dueDay: number; // 1-31
  accountName?: string;
}

export const DEFAULT_HOUSEHOLD_BILLS: HouseholdBillConfig[] = [
  {
    id: "bill-pln",
    name: "Listrik PLN",
    subCategory: "Listrik PLN",
    defaultAmount: 500000,
    dueDay: 20,
  },
  {
    id: "bill-wifi",
    name: "Internet & Wi-Fi",
    subCategory: "Internet & TV",
    defaultAmount: 375000,
    dueDay: 15,
  },
  {
    id: "bill-pdam",
    name: "Air PDAM",
    subCategory: "Air PDAM",
    defaultAmount: 150000,
    dueDay: 20,
  },
  {
    id: "bill-ipl",
    name: "Iuran Lingkungan / IPL",
    subCategory: "Iuran Lingkungan / IPL",
    defaultAmount: 120000,
    dueDay: 10,
  },
];

const BILLS_STORAGE_PREFIX = "lp_household_bills_";

/**
 * Memeriksa apakah suatu transaksi merupakan pengeluaran rumah tangga.
 */
export function isHouseholdExpense(expense: {
  notes?: string | null;
  category?: string | null;
}): boolean {
  if (!expense) return false;
  const notes = expense.notes || "";
  const cat = expense.category || "";
  if (notes.includes("[Household]")) return true;
  if (cat.toLowerCase().includes("household")) return true;
  return false;
}

/**
 * Mengekstrak subkategori rumah tangga dari catatan transaksi.
 */
export function extractHouseholdSubcategory(expense: {
  notes?: string | null;
  category?: string | null;
}): HouseholdSubcategory {
  const notes = expense.notes || "";
  for (const sub of HOUSEHOLD_SUBCATEGORIES) {
    if (notes.includes(`[${sub}]`)) return sub;
  }
  for (const sub of HOUSEHOLD_SUBCATEGORIES) {
    if (expense.category?.toLowerCase() === sub.toLowerCase()) return sub;
  }
  return "Lainnya";
}

/**
 * Membersihkan catatan dari tag [Household] dan subkategori untuk ditampilkan ke user.
 */
export function cleanHouseholdNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes
    .replace(/\[Household\]/g, "")
    .replace(/\[Tagihan Rutin\]/g, "")
    .replace(/\[.*?\]/g, (match) => {
      const stripped = match.slice(1, -1);
      return (HOUSEHOLD_SUBCATEGORIES as readonly string[]).includes(stripped)
        ? ""
        : match;
    })
    .trim();
}

/**
 * Membangun catatan standar dengan format [Household] [<Subkategori>] <Catatan>.
 */
export function buildHouseholdNotes(
  userNotes: string,
  subcategory: HouseholdSubcategory,
  tagihanRutin = false,
): string {
  const clean = cleanHouseholdNotes(userNotes);
  const prefix = tagihanRutin
    ? `[Household] [Tagihan Rutin] [${subcategory}]`
    : `[Household] [${subcategory}]`;
  return clean ? `${prefix} ${clean}` : prefix;
}

/**
 * Mengambil daftar konfigurasi tagihan rutin rumah tangga dari cache lokal.
 */
export function getHouseholdBills(userId?: string): HouseholdBillConfig[] {
  try {
    const id = userId || pb.authStore.record?.id || "default";
    const raw = localStorage.getItem(`${BILLS_STORAGE_PREFIX}${id}`);
    if (!raw) return DEFAULT_HOUSEHOLD_BILLS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_HOUSEHOLD_BILLS;
    }
    return parsed;
  } catch (err) {
    console.error("Error reading household bills:", err);
    return DEFAULT_HOUSEHOLD_BILLS;
  }
}

/**
 * Menyimpan konfigurasi tagihan rutin rumah tangga ke cache lokal dan emit event.
 */
export function saveHouseholdBillsLocal(
  bills: HouseholdBillConfig[],
  userId?: string,
): void {
  try {
    const id = userId || pb.authStore.record?.id || "default";
    localStorage.setItem(`${BILLS_STORAGE_PREFIX}${id}`, JSON.stringify(bills));
    window.dispatchEvent(
      new CustomEvent("life-planner:household-bills-updated", { detail: bills }),
    );
  } catch (err) {
    console.error("Error saving household bills local:", err);
  }
}

/**
 * Mengambil daftar konfigurasi tagihan rutin dari PocketBase dengan multi-tenant isolation.
 * Jika pengguna baru belum memiliki tagihan, otomatis seeding template default ke database.
 */
export async function fetchHouseholdBills(
  userId?: string,
): Promise<HouseholdBillConfig[]> {
  const user = userId || pb.authStore.record?.id;
  if (!user) return DEFAULT_HOUSEHOLD_BILLS;

  try {
    const records = await pb
      .collection("household_bills")
      .getFullList<HouseholdBill>({
        sort: "due_day",
        filter: `user = "${user}"`,
      });

    if (records.length === 0) {
      // Auto-seeding template default ke PocketBase
      const seeded: HouseholdBillConfig[] = [];
      for (const def of DEFAULT_HOUSEHOLD_BILLS) {
        try {
          const created = await pb.collection("household_bills").create({
            user,
            name: def.name,
            sub_category: def.subCategory,
            default_amount: def.defaultAmount,
            due_day: def.dueDay,
          });
          seeded.push({
            id: created.id,
            name: created.name,
            subCategory: created.sub_category as HouseholdSubcategory,
            defaultAmount: Number(created.default_amount || 0),
            dueDay: Number(created.due_day || 20),
          });
        } catch {
          seeded.push(def);
        }
      }
      saveHouseholdBillsLocal(seeded, user);
      return seeded;
    }

    const mapped: HouseholdBillConfig[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      subCategory: r.sub_category as HouseholdSubcategory,
      defaultAmount: Number(r.default_amount || 0),
      dueDay: Number(r.due_day || 20),
    }));

    saveHouseholdBillsLocal(mapped, user);
    return mapped;
  } catch (err) {
    console.error("fetchHouseholdBills error (falling back to local cache):", err);
    return getHouseholdBills(user);
  }
}

/**
 * Menyimpan atau memperbarui konfigurasi tagihan rutin ke PocketBase.
 */
export async function upsertHouseholdBillRemote(
  bill: Omit<HouseholdBillConfig, "id"> & { id?: string },
  userId?: string,
): Promise<HouseholdBillConfig> {
  const user = userId || pb.authStore.record?.id;
  if (!user) throw new Error("User tidak terotentikasi");

  let result: HouseholdBillConfig;
  if (bill.id && !bill.id.startsWith("bill-")) {
    const updated = await pb.collection("household_bills").update(bill.id, {
      name: bill.name,
      sub_category: bill.subCategory,
      default_amount: bill.defaultAmount,
      due_day: bill.dueDay,
    });
    result = {
      id: updated.id,
      name: updated.name,
      subCategory: updated.sub_category as HouseholdSubcategory,
      defaultAmount: Number(updated.default_amount || 0),
      dueDay: Number(updated.due_day || 20),
    };
  } else {
    const created = await pb.collection("household_bills").create({
      user,
      name: bill.name,
      sub_category: bill.subCategory,
      default_amount: bill.defaultAmount,
      due_day: bill.dueDay,
    });
    result = {
      id: created.id,
      name: created.name,
      subCategory: created.sub_category as HouseholdSubcategory,
      defaultAmount: Number(created.default_amount || 0),
      dueDay: Number(created.due_day || 20),
    };
  }

  const current = getHouseholdBills(user).filter(
    (b) => b.id !== result.id && b.id !== bill.id,
  );
  const updatedList = [...current, result].sort((a, b) => a.dueDay - b.dueDay);
  saveHouseholdBillsLocal(updatedList, user);
  return result;
}

/**
 * Menghapus konfigurasi tagihan rutin dari PocketBase.
 */
export async function deleteHouseholdBillRemote(
  id: string,
  userId?: string,
): Promise<void> {
  const user = userId || pb.authStore.record?.id;
  if (id && !id.startsWith("bill-")) {
    try {
      await pb.collection("household_bills").delete(id);
    } catch (err) {
      console.error("Failed to delete bill from PocketBase:", err);
    }
  }
  const current = getHouseholdBills(user).filter((b) => b.id !== id);
  saveHouseholdBillsLocal(current, user);
}

// Deprecated alias for backwards compatibility
export const saveHouseholdBills = saveHouseholdBillsLocal;

export interface BillPaymentStatus {
  bill: HouseholdBillConfig;
  isPaid: boolean;
  paidDate?: string;
  paidAmount?: number;
  paidAccount?: string;
  expenseId?: string;
  daysUntilDue: number;
  isNearDue: boolean;
  isOverdue: boolean;
  dueDateStr: string;
}

export interface HouseholdStats {
  hasHouseholdData: boolean;
  personalSpend: number;
  householdSpend: number;
  totalSpend: number;
  personalRatio: number;
  householdRatio: number;
  billStatuses: BillPaymentStatus[];
  paidBillsCount: number;
  totalBillsCount: number;
  nearestDueBill: BillPaymentStatus | null;
  groceriesSpend: number;
  maintenanceSpend: number;
  utilitiesSpend: number;
}

/**
 * Menghitung metrik analitik rumah tangga untuk bulan tertentu (format YYYY-MM).
 */
export function getHouseholdStats(
  expenses: Expense[],
  bills: HouseholdBillConfig[],
  monthKey?: string,
): HouseholdStats {
  const now = new Date();
  const targetMonth =
    monthKey ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = targetMonth.split("-");
  const currentYear = Number(yearStr) || now.getFullYear();
  const currentMonth = Number(monthStr) || now.getMonth() + 1;
  const todayDay = now.getDate();
  const isCurrentMonth =
    now.getFullYear() === currentYear && now.getMonth() + 1 === currentMonth;

  let personalSpend = 0;
  let householdSpend = 0;
  let groceriesSpend = 0;
  let maintenanceSpend = 0;
  let utilitiesSpend = 0;
  let hasHouseholdData = false;

  const targetExpenses: Expense[] = [];

  for (const exp of expenses) {
    if (exp.type !== "Expense") continue;
    const isHh = isHouseholdExpense(exp);
    if (isHh) hasHouseholdData = true;

    const expMonth = (exp.date || "").slice(0, 7);
    if (expMonth === targetMonth) {
      targetExpenses.push(exp);
      const amount = Number(exp.amount || 0);
      if (isHh) {
        householdSpend += amount;
        const sub = extractHouseholdSubcategory(exp);
        if (sub === "Belanja Dapur & Pokok") {
          groceriesSpend += amount;
        } else if (sub === "Perawatan & Servis Rumah") {
          maintenanceSpend += amount;
        } else {
          utilitiesSpend += amount;
        }
      } else {
        personalSpend += amount;
      }
    }
  }

  const totalSpend = personalSpend + householdSpend;
  const personalRatio =
    totalSpend > 0 ? Math.round((personalSpend / totalSpend) * 100) : 0;
  const householdRatio =
    totalSpend > 0 ? Math.round((householdSpend / totalSpend) * 100) : 0;

  // Cek status pembayaran tagihan rutin untuk bulan ini
  const billStatuses: BillPaymentStatus[] = bills.map((bill) => {
    const dueDayClamped = Math.min(bill.dueDay, 28);
    const dueDateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dueDayClamped).padStart(2, "0")}`;
    const daysUntilDue = isCurrentMonth ? dueDayClamped - todayDay : 0;
    const isOverdue = isCurrentMonth && todayDay > dueDayClamped;
    const isNearDue =
      isCurrentMonth && !isOverdue && daysUntilDue >= 0 && daysUntilDue <= 5;

    // Cari transaksi yang cocok di bulan ini
    const paidMatch = targetExpenses.find((exp) => {
      if (!isHouseholdExpense(exp)) return false;
      const notes = exp.notes || "";
      return (
        notes.includes(`[${bill.subCategory}]`) ||
        notes.toLowerCase().includes(bill.name.toLowerCase())
      );
    });

    if (paidMatch) {
      return {
        bill,
        isPaid: true,
        paidDate: paidMatch.date,
        paidAmount: Number(paidMatch.amount || 0),
        paidAccount: paidMatch.account,
        expenseId: paidMatch.id,
        daysUntilDue,
        isNearDue: false,
        isOverdue: false,
        dueDateStr,
      };
    }

    return {
      bill,
      isPaid: false,
      daysUntilDue,
      isNearDue,
      isOverdue,
      dueDateStr,
    };
  });

  const paidBillsCount = billStatuses.filter((b) => b.isPaid).length;
  const totalBillsCount = billStatuses.length;

  // Temukan tagihan belum lunas terdekat dengan jatuh tempo
  const unpaidBills = billStatuses
    .filter((b) => !b.isPaid)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const nearestDueBill = unpaidBills.length > 0 ? unpaidBills[0] : null;

  return {
    hasHouseholdData: hasHouseholdData || paidBillsCount > 0,
    personalSpend,
    householdSpend,
    totalSpend,
    personalRatio,
    householdRatio,
    billStatuses,
    paidBillsCount,
    totalBillsCount,
    nearestDueBill,
    groceriesSpend,
    maintenanceSpend,
    utilitiesSpend,
  };
}
