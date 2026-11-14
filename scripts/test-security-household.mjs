import assert from "node:assert/strict";
import {
  validatePasswordStrength,
  detectCurrentClientDevice,
} from "../src/lib/security-sessions.ts";
import {
  generateHouseholdInviteCode,
  isValidHouseholdCode,
  calculateHouseholdSettlements,
} from "../src/lib/household-collaboration.ts";

console.log("=================================================");
console.log("   SECURITY SESSIONS & HOUSEHOLD SHARING TEST    ");
console.log("=================================================\n");

// [1] Test Password Strength Validation
console.log("[1] Testing Password Strength Validation...");
{
  const weak = validatePasswordStrength("abc");
  assert.equal(weak.isValid, false, "Should reject short passwords");

  const medium = validatePasswordStrength("password123");
  assert.equal(medium.isValid, false, "Should reject passwords without uppercase and symbols");

  const strong = validatePasswordStrength("P@ssw0rdSecure2026");
  assert.equal(strong.isValid, true, "Should accept strong passwords");
  assert.equal(strong.score, 4);
  console.log("  ✓ PASS: validatePasswordStrength enforces modern security criteria");
}

// [2] Test Device Detection
console.log("\n[2] Testing Device Detection Logic...");
{
  const dev = detectCurrentClientDevice();
  assert.ok(dev.os, "Should detect OS");
  assert.ok(dev.browser, "Should detect browser");
  assert.ok(["desktop", "mobile", "tablet"].includes(dev.deviceType));
  console.log(`  ✓ PASS: detectCurrentClientDevice resolved ${dev.deviceType} (${dev.os} - ${dev.browser})`);
}

// [3] Test Household Invite Code Generation & Validation
console.log("\n[3] Testing Household Invite Codes...");
{
  const code = generateHouseholdInviteCode();
  assert.match(code, /^HOME-[A-Z0-9]{6}$/, "Must match HOME-XXXXXX format");
  assert.equal(isValidHouseholdCode(code), true);
  assert.equal(isValidHouseholdCode("INVALID-CODE-FORMAT"), false);
  assert.equal(isValidHouseholdCode("HOME-1234"), false);
  console.log(`  ✓ PASS: generateHouseholdInviteCode produced valid code '${code}'`);
}

// [4] Test Household Debt Settlement Calculator
console.log("\n[4] Testing Household Debt Settlement Calculator...");
{
  // Alice pays 300,000 for Belanja Bulanan (split Alice & Bob = 150k each)
  // Bob pays 100,000 for Tagihan Wifi (split Alice & Bob = 50k each)
  // Net: Alice paid 300k, consumed 200k -> +100k
  // Net: Bob paid 100k, consumed 200k -> -100k
  const bills = [
    {
      id: "b1",
      title: "Belanja Dapur",
      amount: 300000,
      paidBy: "Alice",
      splitBetween: ["Alice", "Bob"],
      date: "2026-11-10",
    },
    {
      id: "b2",
      title: "Internet Fiber",
      amount: 100000,
      paidBy: "Bob",
      splitBetween: ["Alice", "Bob"],
      date: "2026-11-12",
    },
  ];

  const { balances, settlements } = calculateHouseholdSettlements(bills, ["Alice", "Bob"]);

  const aliceBal = balances.find((b) => b.member === "Alice");
  const bobBal = balances.find((b) => b.member === "Bob");

  assert.equal(aliceBal.totalPaid, 300000);
  assert.equal(aliceBal.totalShare, 200000);
  assert.equal(aliceBal.netBalance, 100000);

  assert.equal(bobBal.totalPaid, 100000);
  assert.equal(bobBal.totalShare, 200000);
  assert.equal(bobBal.netBalance, -100000);

  assert.equal(settlements.length, 1, "Should resolve in exactly 1 transfer");
  assert.equal(settlements[0].from, "Bob");
  assert.equal(settlements[0].to, "Alice");
  assert.equal(settlements[0].amount, 100000);

  console.log("  ✓ PASS: calculateHouseholdSettlements computes net balances and minimal debt settlement transfer");
}

console.log("\n=================================================");
console.log("  ALL SECURITY & HOUSEHOLD TESTS PASSED (0 FAIL) ");
console.log("=================================================");
