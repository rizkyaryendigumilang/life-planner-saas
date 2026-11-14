import assert from "node:assert/strict";
import {
  computeNextDueDate,
  evaluateRecurringSchedules,
  buildExpenseFromRecurring,
} from "../src/lib/recurring-engine.ts";

console.log("=================================================");
console.log("    RECURRING TRANSACTIONS & SCHEDULE TEST       ");
console.log("=================================================\n");

// [1] Test computeNextDueDate
console.log("[1] Testing computeNextDueDate calculations...");
{
  // Daily
  const nextDaily = computeNextDueDate("daily", "2026-11-14");
  assert.equal(nextDaily, "2026-11-15", "Daily should advance 1 day");

  // Monthly on 15th
  const nextMonthly = computeNextDueDate("monthly", "2026-11-14", 20);
  assert.equal(nextMonthly, "2026-12-20", "Monthly should target specified dueDay in next month");

  // Yearly
  const nextYearly = computeNextDueDate("yearly", "2026-11-14", 14);
  assert.equal(nextYearly, "2027-11-14", "Yearly should advance 1 year");

  console.log("  ✓ PASS: computeNextDueDate correctly calculates daily, monthly, yearly dates");
}

// [2] Test evaluateRecurringSchedules
console.log("\n[2] Testing evaluateRecurringSchedules classification...");
{
  const refDate = "2026-11-14";
  const items = [
    {
      id: "rec_overdue",
      user: "u1",
      title: "Tagihan Air",
      amount: 150000,
      category: "Utilities",
      frequency: "monthly",
      startDate: "2026-11-05", // past date
      autoDeduct: false,
      active: true,
    },
    {
      id: "rec_due_soon",
      user: "u1",
      title: "Spotify Family",
      amount: 86000,
      category: "Entertainment",
      frequency: "monthly",
      startDate: "2026-11-16", // 2 days away (within horizon 3)
      autoDeduct: true,
      active: true,
    },
    {
      id: "rec_future",
      user: "u1",
      title: "Gym Membership",
      amount: 300000,
      category: "Health",
      frequency: "monthly",
      startDate: "2026-11-28", // far future
      autoDeduct: false,
      active: true,
    },
    {
      id: "rec_inactive",
      user: "u1",
      title: "Old Subscription",
      amount: 50000,
      category: "Entertainment",
      frequency: "monthly",
      startDate: "2026-11-01",
      autoDeduct: false,
      active: false, // inactive: must be ignored
    },
  ];

  const evalResult = evaluateRecurringSchedules(items, refDate, 3);
  assert.equal(evalResult.overdue.length, 1);
  assert.equal(evalResult.overdue[0].id, "rec_overdue");
  assert.equal(evalResult.totalOverdueAmount, 150000);

  assert.equal(evalResult.dueSoon.length, 1);
  assert.equal(evalResult.dueSoon[0].id, "rec_due_soon");
  assert.equal(evalResult.totalDueSoonAmount, 86000);

  console.log("  ✓ PASS: evaluateRecurringSchedules accurately classifies overdue, dueSoon, and ignores inactive items");
}

// [3] Test buildExpenseFromRecurring
console.log("\n[3] Testing buildExpenseFromRecurring payload generator...");
{
  const item = {
    id: "rec1",
    user: "user_test_99",
    title: "Netflix 4K",
    amount: 186000,
    category: "Entertainment",
    frequency: "monthly",
    autoDeduct: true,
    active: true,
    bankAccountId: "acc_bca_1",
  };

  const payload = buildExpenseFromRecurring(item, "2026-11-14");
  assert.equal(payload.user, "user_test_99");
  assert.equal(payload.amount, 186000);
  assert.equal(payload.type, "expense");
  assert.equal(payload.date, "2026-11-14");
  assert.equal(payload.bank_account, "acc_bca_1");
  assert.match(payload.notes, /Auto-Recurring/i);
  console.log("  ✓ PASS: buildExpenseFromRecurring outputs complete and structured transaction payload");
}

console.log("\n=================================================");
console.log("  ALL RECURRING ENGINE TESTS PASSED (0 FAILURES) ");
console.log("=================================================");
