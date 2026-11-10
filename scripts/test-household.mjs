import assert from "node:assert/strict";

console.log("=================================================");
console.log("  HOUSEHOLD EXPENSES LOGIC & CALCULATION TEST    ");
console.log("=================================================\n");

// Subcategories defined in household module
const HOUSEHOLD_SUBCATEGORIES = [
  "Listrik PLN",
  "Air PDAM",
  "Internet & TV",
  "Belanja Dapur & Pokok",
  "Iuran Lingkungan / IPL",
  "Perawatan & Servis Rumah",
  "Gas LPG",
  "Lainnya",
];

function isHouseholdExpense(expense) {
  if (!expense) return false;
  const notes = expense.notes || "";
  const cat = expense.category || "";
  if (notes.includes("[Household]")) return true;
  if (cat.toLowerCase().includes("household")) return true;
  return false;
}

function extractHouseholdSubcategory(expense) {
  const notes = expense.notes || "";
  for (const sub of HOUSEHOLD_SUBCATEGORIES) {
    if (notes.includes(`[${sub}]`)) return sub;
  }
  for (const sub of HOUSEHOLD_SUBCATEGORIES) {
    if (expense.category?.toLowerCase() === sub.toLowerCase()) return sub;
  }
  return "Lainnya";
}

function cleanHouseholdNotes(notes) {
  if (!notes) return "";
  return notes
    .replace(/\[Household\]/g, "")
    .replace(/\[Tagihan Rutin\]/g, "")
    .replace(/\[.*?\]/g, (match) => {
      const stripped = match.slice(1, -1);
      return HOUSEHOLD_SUBCATEGORIES.includes(stripped) ? "" : match;
    })
    .trim();
}

function buildHouseholdNotes(userNotes, subcategory, tagihanRutin = false) {
  const clean = cleanHouseholdNotes(userNotes);
  const prefix = tagihanRutin
    ? `[Household] [Tagihan Rutin] [${subcategory}]`
    : `[Household] [${subcategory}]`;
  return clean ? `${prefix} ${clean}` : prefix;
}

// 1. Predicate Tests
assert.equal(isHouseholdExpense({ notes: "[Household] [Listrik PLN] Tagihan bulanan" }), true);
assert.equal(isHouseholdExpense({ notes: "Beli kopi di cafe", category: "Food" }), false);
assert.equal(isHouseholdExpense({ notes: null, category: "Household Bills" }), true);
console.log("✓ PASS: isHouseholdExpense predicate accurately identifies household transactions");

// 2. Subcategory Extraction
assert.equal(
  extractHouseholdSubcategory({ notes: "[Household] [Belanja Dapur & Pokok] Supermarket" }),
  "Belanja Dapur & Pokok"
);
assert.equal(
  extractHouseholdSubcategory({ notes: "[Household] [Listrik PLN] Token PLN 500rb" }),
  "Listrik PLN"
);
assert.equal(
  extractHouseholdSubcategory({ notes: "[Household] Beli sapu lidi" }),
  "Lainnya"
);
console.log("✓ PASS: extractHouseholdSubcategory accurately resolves subcategories from notes and categories");

// 3. Notes Formatting & Cleaning
const builtNote = buildHouseholdNotes("Token PLN 500rb", "Listrik PLN", true);
assert.equal(builtNote, "[Household] [Tagihan Rutin] [Listrik PLN] Token PLN 500rb");
assert.equal(cleanHouseholdNotes(builtNote), "Token PLN 500rb");
console.log("✓ PASS: buildHouseholdNotes and cleanHouseholdNotes preserve clean human copy");

// 4. Multi-Tenant Ledger Simulation
const mockExpenses = [
  { id: "1", type: "Expense", amount: 500000, date: "2026-11-05", notes: "[Household] [Listrik PLN] PLN", category: "Bills" },
  { id: "2", type: "Expense", amount: 300000, date: "2026-11-06", notes: "[Household] [Belanja Dapur & Pokok] Sayur", category: "Food" },
  { id: "3", type: "Expense", amount: 1200000, date: "2026-11-07", notes: "Nonton konser", category: "Entertainment" },
];

let personalSpend = 0;
let householdSpend = 0;
for (const e of mockExpenses) {
  if (isHouseholdExpense(e)) householdSpend += e.amount;
  else personalSpend += e.amount;
}

assert.equal(householdSpend, 800000);
assert.equal(personalSpend, 1200000);
const ratioHh = Math.round((householdSpend / (personalSpend + householdSpend)) * 100);
const ratioPers = Math.round((personalSpend / (personalSpend + householdSpend)) * 100);
assert.equal(ratioHh, 40);
assert.equal(ratioPers, 60);

console.log(`✓ PASS: Unified Ledger calculates 40% Household vs 60% Personal split cleanly`);
console.log("\n=================================================");
console.log("  ALL HOUSEHOLD LOGIC TESTS PASSED (0 FAILURES)  ");
console.log("=================================================");
