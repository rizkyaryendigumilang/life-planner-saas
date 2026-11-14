import assert from "node:assert/strict";
import {
  computeBurnRate,
  computeRunway,
  projectMonthEndBalance,
  detectSpendingAnomalies,
} from "../src/lib/financial-analytics.ts";
import { parseNaturalLanguageTransaction } from "../src/lib/nlp-transaction.ts";

console.log("=================================================");
console.log("   FINANCIAL ANALYTICS & NLP INGESTION TEST      ");
console.log("=================================================\n");

// [1] Test Burn Rate and Runway
console.log("[1] Testing Burn Rate & Cash Runway Calculation...");
{
  const mockExpenses = [
    { date: "2026-11-10", amount: 300000, type: "expense" },
    { date: "2026-11-05", amount: 600000, type: "expense" },
    { date: "2026-10-20", amount: 900000, type: "expense" },
  ];

  const burn = computeBurnRate(mockExpenses, 90, "2026-11-14");
  assert.equal(burn.totalSpent, 1800000);
  assert.equal(burn.dailyBurnRate, 20000); // 1.8M / 90
  assert.ok(burn.monthlyBurnRate > 600000);

  // Runway test
  // Total Liquid = 6,000,000 with monthly burn ~608,000 -> ~9.8 months (healthy)
  const runwayHealthy = computeRunway(6000000, 600000);
  assert.equal(runwayHealthy.status, "healthy");
  assert.equal(runwayHealthy.runwayMonths, 10);

  // Warning (< 6 months)
  const runwayWarning = computeRunway(2000000, 500000);
  assert.equal(runwayWarning.status, "warning");
  assert.equal(runwayWarning.runwayMonths, 4);

  // Critical (< 3 months)
  const runwayCritical = computeRunway(500000, 500000);
  assert.equal(runwayCritical.status, "critical");
  assert.equal(runwayCritical.runwayMonths, 1);

  console.log("  ✓ PASS: computeBurnRate and computeRunway accurately categorize financial runway");
}

// [2] Test Month-End Projection
console.log("\n[2] Testing Month-End Balance Projection...");
{
  const refDate = "2026-11-15"; // day 15 of 30
  const expenses = [
    { date: "2026-11-01", amount: 5000000, type: "income" },
    { date: "2026-11-05", amount: 1500000, type: "expense" },
  ];

  const proj = projectMonthEndBalance(10000000, expenses, refDate);
  assert.equal(proj.mtdIncome, 5000000);
  assert.equal(proj.mtdExpense, 1500000);
  assert.equal(proj.dailyExpenseAvg, 100000); // 1.5M / 15 days
  // 15 days remaining * 100k = 1.5M remaining
  assert.equal(proj.projectedMonthEndExpense, 3000000);
  assert.equal(proj.projectedNetEndingBalance, 8500000);
  console.log("  ✓ PASS: projectMonthEndBalance produces accurate linear extrapolation");
}

// [3] Test Spending Anomalies
console.log("\n[3] Testing Spending Anomaly Detection...");
{
  const refDate = "2026-11-14";
  const expenses = [
    // Baseline cafe spend in last 90 days: very low
    { date: "2026-09-01", amount: 100000, category: "Food & Dining", type: "expense" },
    // Sudden surge in last 14 days
    { date: "2026-11-10", amount: 800000, category: "Food & Dining", type: "expense" },
    { date: "2026-11-12", amount: 900000, category: "Food & Dining", type: "expense" },
  ];

  const anomalies = detectSpendingAnomalies(expenses, 1.35, refDate);
  assert.ok(anomalies.length >= 1, "Should detect Food & Dining surge");
  assert.equal(anomalies[0].category, "Food & Dining");
  assert.ok(anomalies[0].spikePercentage > 50, "Spike percentage should be large");
  console.log("  ✓ PASS: detectSpendingAnomalies flags abnormal spending spikes");
}

// [4] Test Natural Language Transaction Parser
console.log("\n[4] Testing Natural Language Transaction Parser...");
{
  // Test case 1: "Makan siang soto mie 35rb bca"
  const p1 = parseNaturalLanguageTransaction("Makan siang soto mie 35rb bca", "2026-11-14");
  assert.equal(p1.amount, 35000, "Should parse 35rb as 35,000");
  assert.equal(p1.type, "expense");
  assert.equal(p1.category, "Food & Dining");
  assert.equal(p1.accountHint, "BCA");
  assert.ok(p1.confidence >= 0.8);

  // Test case 2: "Gaji bulanan 15jt bca"
  const p2 = parseNaturalLanguageTransaction("Gaji bulanan 15jt bca", "2026-11-14");
  assert.equal(p2.amount, 15000000, "Should parse 15jt as 15,000,000");
  assert.equal(p2.type, "income", "Should resolve income type");
  assert.equal(p2.category, "Salary");

  // Test case 3: "Bensin pertamax 100k kemarin"
  const p3 = parseNaturalLanguageTransaction("Bensin pertamax 100k kemarin", "2026-11-14");
  assert.equal(p3.amount, 100000, "Should parse 100k as 100,000");
  assert.equal(p3.category, "Transportation");
  assert.equal(p3.date, "2026-11-13", "Should resolve kemarin to yesterday");

  console.log("  ✓ PASS: parseNaturalLanguageTransaction extracts amount, category, account, and date with high precision");
}

console.log("\n=================================================");
console.log("  ALL ANALYTICS & NLP TESTS PASSED (0 FAILURES)  ");
console.log("=================================================");
