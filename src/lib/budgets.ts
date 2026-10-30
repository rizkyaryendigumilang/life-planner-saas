import { pb } from "./pocketbase";

export type CategoryBudgets = Record<string, number>;

const BUDGETS_STORAGE_PREFIX = "lp_category_budgets_";

/**
 * Mengambil konfigurasi batas anggaran kategori untuk user saat ini.
 * Bersifat opsional per kategori: { "Food": 3000000, "Transport": 1000000 }
 */
export function getBudgets(userId?: string): CategoryBudgets {
  try {
    const id = userId || pb.authStore.record?.id || "default";
    const raw = localStorage.getItem(`${BUDGETS_STORAGE_PREFIX}${id}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const cleaned: CategoryBudgets = {};
    for (const [cat, val] of Object.entries(parsed)) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) {
        cleaned[cat] = num;
      }
    }
    return cleaned;
  } catch (err) {
    console.error("Error reading category budgets:", err);
    return {};
  }
}

/**
 * Menyimpan konfigurasi batas anggaran kategori ke localStorage dan menyiarkan event pembaruan.
 */
export function saveBudgets(budgets: CategoryBudgets, userId?: string): void {
  try {
    const id = userId || pb.authStore.record?.id || "default";
    const cleaned: CategoryBudgets = {};
    for (const [cat, val] of Object.entries(budgets)) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) {
        cleaned[cat] = num;
      }
    }
    localStorage.setItem(
      `${BUDGETS_STORAGE_PREFIX}${id}`,
      JSON.stringify(cleaned),
    );
    window.dispatchEvent(
      new CustomEvent("life-planner:budgets-updated", { detail: cleaned }),
    );
  } catch (err) {
    console.error("Error saving category budgets:", err);
  }
}

/**
 * Mengatur batas anggaran untuk satu kategori (atau menghapus jika amount <= 0).
 */
export function setCategoryBudget(
  category: string,
  amount: number,
  userId?: string,
): void {
  const current = getBudgets(userId);
  if (amount > 0) {
    current[category] = amount;
  } else {
    delete current[category];
  }
  saveBudgets(current, userId);
}
