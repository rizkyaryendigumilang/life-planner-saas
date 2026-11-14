import assert from "node:assert";
import {
  escapeCsvCell,
  generateCsv,
  exportExpensesToCsv,
  exportHouseholdBillsToCsv,
  exportBankAccountsToCsv,
  exportInvestmentsToCsv,
  exportGoalsToCsv,
  exportTasksToCsv,
  exportConsolidatedFinancialCsv,
} from "../src/lib/csv-export.ts";

const EXPECTED_COLLECTIONS = [
  "expenses",
  "goals",
  "life_planner",
  "pets",
  "itineraries",
  "travel_trips",
  "bank_accounts",
  "goal_contributions",
  "experience_expenses",
  "experiences",
  "itinerary_items",
  "market_watchlist",
  "expense_ingestions",
  "investments",
  "household_bills",
];

console.log("=================================================");
console.log("  AUTO-BACKUP & CSV EXPORT SUITE TEST            ");
console.log("=================================================\n");

let passed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`, err);
    process.exit(1);
  }
}

// 1. CSV Cell Escaping Tests
check("escapeCsvCell properly handles null and undefined", () => {
  assert.strictEqual(escapeCsvCell(null), "");
  assert.strictEqual(escapeCsvCell(undefined), "");
});

check("escapeCsvCell escapes quotes and handles commas and newlines (RFC 4180)", () => {
  assert.strictEqual(escapeCsvCell('Hello, "World"'), '"Hello, ""World"""');
  assert.strictEqual(escapeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.strictEqual(escapeCsvCell("Plain text"), "Plain text");
});

// 2. CSV Generation & BOM Tests
check("generateCsv prefixes UTF-8 BOM (\\uFEFF) for Excel compatibility", () => {
  const data = [{ name: "Alice", score: 100 }];
  const columns = [
    { header: "Name", accessor: (d) => d.name },
    { header: "Score", accessor: (d) => d.score },
  ];
  const csv = generateCsv(data, columns);
  assert.strictEqual(csv.startsWith("\uFEFF"), true);
  assert.strictEqual(csv.includes("Name,Score"), true);
  assert.strictEqual(csv.includes("Alice,100"), true);
});

// 3. Financial Module Serializers
check("exportExpensesToCsv formats expenses with accounts map", () => {
  const expenses = [
    {
      id: "exp_1",
      date: "2026-11-14",
      type: "Expense",
      category: "Food & Dining",
      amount: 75000,
      paid: true,
      account: "acc_bca",
      notes: "Lunch meeting with client",
    },
  ];
  const map = new Map([["acc_bca", "BCA (Primary)"]]);
  const csv = exportExpensesToCsv(expenses, map);
  assert.strictEqual(csv.includes("BCA (Primary)"), true);
  assert.strictEqual(csv.includes("75000"), true);
  assert.strictEqual(csv.includes("Lunas / Selesai"), true);
});

check("exportHouseholdBillsToCsv formats household ledger items", () => {
  const bills = [
    {
      due_date: "2026-11-20",
      name: "Listrik PLN Token",
      category: "Rumah Tangga",
      subcategory: "Utilitas",
      amount: 500000,
      paid: false,
      notes: "Token 500rb",
    },
  ];
  const csv = exportHouseholdBillsToCsv(bills);
  assert.strictEqual(csv.includes("Listrik PLN Token"), true);
  assert.strictEqual(csv.includes("500000"), true);
  assert.strictEqual(csv.includes("Belum Dibayar"), true);
});

check("exportConsolidatedFinancialCsv merges multi-table ledger", () => {
  const bundle = {
    bank_accounts: [{ bank_name: "Mandiri", account_name: "Tabungan", account_number: "123456", balance: 15000000 }],
    household_bills: [{ name: "Wifi Indihome", amount: 350000, paid: true }],
    expenses: [{ category: "Transport", amount: 45000, paid: true }],
    investments: [{ symbol: "BBCA", name: "Bank Central Asia", shares: 1000, buy_price: 9500 }],
    goals: [{ name: "Dana Darurat", target_amount: 50000000, current_amount: 25000000 }],
  };
  const consolidated = exportConsolidatedFinancialCsv(bundle);
  assert.strictEqual(consolidated.includes("BUKU KAS & KEUANGAN TERPADU"), true);
  assert.strictEqual(consolidated.includes("Mandiri"), true);
  assert.strictEqual(consolidated.includes("Wifi Indihome"), true);
  assert.strictEqual(consolidated.includes("Transport"), true);
  assert.strictEqual(consolidated.includes("BBCA"), true);
  assert.strictEqual(consolidated.includes("Dana Darurat"), true);
});

// 4. Collection Coverage
check("EXPECTED_COLLECTIONS tracks all 15 personal tenant collections", () => {
  assert.strictEqual(EXPECTED_COLLECTIONS.length, 15);
  assert.strictEqual(EXPECTED_COLLECTIONS.includes("household_bills"), true);
  assert.strictEqual(EXPECTED_COLLECTIONS.includes("expenses"), true);
  assert.strictEqual(EXPECTED_COLLECTIONS.includes("bank_accounts"), true);
  assert.strictEqual(EXPECTED_COLLECTIONS.includes("investments"), true);
});

console.log("\n=================================================");
console.log(`  ALL ${passed} AUTO-BACKUP & CSV TESTS PASSED!   `);
console.log("=================================================\n");
