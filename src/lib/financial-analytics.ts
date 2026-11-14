export interface ExpenseRecord {
  id?: string;
  amount: number | string;
  type?: string;
  category?: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface RunwayAnalysis {
  totalLiquidAssets: number;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  runwayMonths: number;
  status: "critical" | "warning" | "healthy" | "infinite";
  message: string;
}

export interface MonthEndProjection {
  currentBalance: number;
  mtdIncome: number;
  mtdExpense: number;
  dailyExpenseAvg: number;
  projectedMonthEndExpense: number;
  projectedNetEndingBalance: number;
  isPositiveTrajectory: boolean;
}

export interface SpendingAnomaly {
  category: string;
  baselineDailyAverage: number;
  recentDailyAverage: number;
  spikePercentage: number;
  recentTotal: number;
}

/**
 * Calculates daily and monthly burn rate over a given period (default: 90 days)
 */
export function computeBurnRate(
  expenses: ExpenseRecord[],
  days: number = 90,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): { dailyBurnRate: number; monthlyBurnRate: number; totalSpent: number } {
  const ref = new Date(referenceDate);
  const cutoff = new Date(ref);
  cutoff.setDate(cutoff.getDate() - days);

  const relevantExpenses = expenses.filter((e) => {
    if (String(e.type || "").toLowerCase() === "income") return false;
    const d = new Date(e.date);
    return d >= cutoff && d <= ref;
  });

  const totalSpent = relevantExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const dailyBurnRate = days > 0 ? totalSpent / days : 0;
  const monthlyBurnRate = dailyBurnRate * 30.4375; // average days in a month

  return { dailyBurnRate, monthlyBurnRate, totalSpent };
}

/**
 * Calculates Cash Runway (how many months liquid savings will last)
 */
export function computeRunway(
  totalLiquidAssets: number,
  monthlyBurnRate: number
): RunwayAnalysis {
  if (totalLiquidAssets <= 0) {
    return {
      totalLiquidAssets: 0,
      dailyBurnRate: monthlyBurnRate / 30.4375,
      monthlyBurnRate,
      runwayMonths: 0,
      status: "critical",
      message: "Saldo kas habis. Perlu pemulihan likuiditas segera.",
    };
  }

  if (monthlyBurnRate <= 0) {
    return {
      totalLiquidAssets,
      dailyBurnRate: 0,
      monthlyBurnRate: 0,
      runwayMonths: 999,
      status: "infinite",
      message: "Tidak ada pengeluaran rutin terdeteksi.",
    };
  }

  const runwayMonths = Math.round((totalLiquidAssets / monthlyBurnRate) * 10) / 10;

  let status: "critical" | "warning" | "healthy" = "healthy";
  let message = `Dana kas aman untuk ${runwayMonths} bulan ke depan.`;

  if (runwayMonths < 3) {
    status = "critical";
    message = `Perhatian: Dana likuid Anda hanya tersisa untuk ${runwayMonths} bulan.`;
  } else if (runwayMonths < 6) {
    status = "warning";
    message = `Dana likuid cukup untuk ${runwayMonths} bulan (target minimal ideal: 6 bulan).`;
  }

  return {
    totalLiquidAssets,
    dailyBurnRate: monthlyBurnRate / 30.4375,
    monthlyBurnRate,
    runwayMonths,
    status,
    message,
  };
}

/**
 * Projects month-end balance based on Month-To-Date (MTD) pace
 */
export function projectMonthEndBalance(
  currentBalance: number,
  expenses: ExpenseRecord[],
  referenceDate: string = new Date().toISOString().slice(0, 10)
): MonthEndProjection {
  const parts = referenceDate.split("-").map(Number);
  const year = parts[0];
  const month = parts[1]; // 1-12
  const currentDay = parts[2]; // 1-31

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const daysRemaining = Math.max(0, totalDaysInMonth - currentDay);

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const mtdExpenses = expenses.filter((e) => e.date?.startsWith(prefix));

  let mtdIncome = 0;
  let mtdExpense = 0;

  for (const item of mtdExpenses) {
    const amt = Number(item.amount) || 0;
    if (String(item.type || "").toLowerCase() === "income") {
      mtdIncome += amt;
    } else {
      mtdExpense += amt;
    }
  }

  const dailyExpenseAvg = currentDay > 0 ? mtdExpense / currentDay : 0;
  const projectedRemainingExpense = dailyExpenseAvg * daysRemaining;
  const projectedMonthEndExpense = mtdExpense + projectedRemainingExpense;
  const projectedNetEndingBalance = currentBalance - projectedRemainingExpense;

  return {
    currentBalance,
    mtdIncome,
    mtdExpense,
    dailyExpenseAvg: Math.round(dailyExpenseAvg),
    projectedMonthEndExpense: Math.round(projectedMonthEndExpense),
    projectedNetEndingBalance: Math.round(projectedNetEndingBalance),
    isPositiveTrajectory: projectedNetEndingBalance >= currentBalance * 0.7,
  };
}

/**
 * Detects spending spikes across categories by comparing last 14 days against 90-day baseline
 */
export function detectSpendingAnomalies(
  expenses: ExpenseRecord[],
  thresholdRatio: number = 1.35,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): SpendingAnomaly[] {
  const ref = new Date(referenceDate);

  const d14 = new Date(ref);
  d14.setDate(d14.getDate() - 14);

  const d90 = new Date(ref);
  d90.setDate(d90.getDate() - 90);

  const baselineTotals: Record<string, number> = {};
  const recentTotals: Record<string, number> = {};

  for (const e of expenses) {
    if (String(e.type || "").toLowerCase() === "income") continue;
    const cat = e.category || "General";
    const amt = Number(e.amount) || 0;
    const d = new Date(e.date);

    if (d >= d90 && d <= ref) {
      baselineTotals[cat] = (baselineTotals[cat] || 0) + amt;
    }
    if (d >= d14 && d <= ref) {
      recentTotals[cat] = (recentTotals[cat] || 0) + amt;
    }
  }

  const anomalies: SpendingAnomaly[] = [];

  for (const [cat, recentAmt] of Object.entries(recentTotals)) {
    const recentDaily = recentAmt / 14;
    const baselineAmt = baselineTotals[cat] || 0;
    const baselineDaily = baselineAmt / 90;

    if (baselineDaily > 5000 && recentDaily > baselineDaily * thresholdRatio) {
      const spikePercentage = Math.round(((recentDaily - baselineDaily) / baselineDaily) * 100);
      anomalies.push({
        category: cat,
        baselineDailyAverage: Math.round(baselineDaily),
        recentDailyAverage: Math.round(recentDaily),
        spikePercentage,
        recentTotal: recentAmt,
      });
    }
  }

  return anomalies.sort((a, b) => b.spikePercentage - a.spikePercentage);
}
