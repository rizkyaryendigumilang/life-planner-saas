export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringScheduleItem {
  id: string;
  user: string;
  title: string;
  amount: number;
  category: string;
  frequency: RecurringFrequency;
  dueDay?: number; // 1-31 for monthly/quarterly/yearly, 0-6 for weekly (0=Sunday)
  bankAccountId?: string;
  autoDeduct: boolean;
  active: boolean;
  lastProcessedDate?: string; // YYYY-MM-DD
  startDate?: string;
  notes?: string;
}

export interface DueRecurringSummary {
  overdue: RecurringScheduleItem[];
  dueSoon: RecurringScheduleItem[];
  totalOverdueAmount: number;
  totalDueSoonAmount: number;
}

function formatYmd(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Computes the next due date based on frequency and base date
 */
export function computeNextDueDate(
  frequency: RecurringFrequency,
  baseDate: string | Date = new Date(),
  dueDay?: number
): string {
  // Parse YYYY-MM-DD components directly to avoid timezone offsets
  let year: number;
  let month: number;
  let day: number;

  if (typeof baseDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(baseDate)) {
    const parts = baseDate.slice(0, 10).split("-").map(Number);
    year = parts[0];
    month = parts[1] - 1;
    day = parts[2];
  } else {
    const d = new Date(baseDate);
    if (isNaN(d.getTime())) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
      day = now.getDate();
    } else {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  }

  switch (frequency) {
    case "daily": {
      const d = new Date(year, month, day + 1);
      return formatYmd(d.getFullYear(), d.getMonth(), d.getDate());
    }
    case "weekly": {
      const d = new Date(year, month, day + 7);
      if (typeof dueDay === "number" && dueDay >= 0 && dueDay <= 6) {
        const currentDow = d.getDay();
        const diff = (dueDay - currentDow + 7) % 7;
        d.setDate(d.getDate() + diff);
      }
      return formatYmd(d.getFullYear(), d.getMonth(), d.getDate());
    }
    case "monthly": {
      const targetDay = typeof dueDay === "number" && dueDay >= 1 && dueDay <= 31 ? dueDay : day;
      const targetMonth = month + 1;
      const maxDaysInNextMonth = new Date(year, targetMonth + 1, 0).getDate();
      const validDay = Math.min(targetDay, maxDaysInNextMonth);
      const d = new Date(year, targetMonth, validDay);
      return formatYmd(d.getFullYear(), d.getMonth(), d.getDate());
    }
    case "quarterly": {
      const targetDay = typeof dueDay === "number" && dueDay >= 1 && dueDay <= 31 ? dueDay : day;
      const targetMonth = month + 3;
      const maxDays = new Date(year, targetMonth + 1, 0).getDate();
      const validDay = Math.min(targetDay, maxDays);
      const d = new Date(year, targetMonth, validDay);
      return formatYmd(d.getFullYear(), d.getMonth(), d.getDate());
    }
    case "yearly": {
      const targetDay = typeof dueDay === "number" && dueDay >= 1 && dueDay <= 31 ? dueDay : day;
      const targetYear = year + 1;
      const maxDays = new Date(targetYear, month + 1, 0).getDate();
      const validDay = Math.min(targetDay, maxDays);
      const d = new Date(targetYear, month, validDay);
      return formatYmd(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }
}

/**
 * Evaluates a list of recurring schedules and classifies overdue and upcoming bills
 */
export function evaluateRecurringSchedules(
  items: RecurringScheduleItem[],
  referenceDateStr: string = new Date().toISOString().slice(0, 10),
  horizonDays: number = 3
): DueRecurringSummary {
  const refDate = new Date(referenceDateStr);
  const horizonDate = new Date(refDate);
  horizonDate.setDate(horizonDate.getDate() + horizonDays);

  const overdue: RecurringScheduleItem[] = [];
  const dueSoon: RecurringScheduleItem[] = [];

  let totalOverdueAmount = 0;
  let totalDueSoonAmount = 0;

  for (const item of items) {
    if (!item.active) continue;

    // Determine the relevant date to compare
    let checkDateStr = item.lastProcessedDate
      ? computeNextDueDate(item.frequency, item.lastProcessedDate, item.dueDay)
      : item.startDate || referenceDateStr;

    const checkDate = new Date(checkDateStr);

    if (checkDate < refDate) {
      overdue.push(item);
      totalOverdueAmount += item.amount;
    } else if (checkDate >= refDate && checkDate <= horizonDate) {
      dueSoon.push(item);
      totalDueSoonAmount += item.amount;
    }
  }

  return {
    overdue,
    dueSoon,
    totalOverdueAmount,
    totalDueSoonAmount,
  };
}

/**
 * Builds an expense payload to insert when a recurring item is executed
 */
export function buildExpenseFromRecurring(
  item: RecurringScheduleItem,
  executionDate: string = new Date().toISOString().slice(0, 10)
): {
  user: string;
  amount: number;
  type: "expense";
  category: string;
  date: string;
  notes: string;
  bank_account?: string;
} {
  const periodLabel = new Date(executionDate).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return {
    user: item.user,
    amount: item.amount,
    type: "expense",
    category: item.category || "Subscriptions",
    date: executionDate,
    notes: `[Auto-Recurring] ${item.title} (${periodLabel})`,
    bank_account: item.bankAccountId || undefined,
  };
}
