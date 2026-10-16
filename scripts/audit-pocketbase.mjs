import "dotenv/config";
import PocketBase from "pocketbase";

const url = process.env.PB_URL || "http://127.0.0.1:8090";
const email = process.env.PB_SUPERUSER_EMAIL;
const password = process.env.PB_SUPERUSER_PASSWORD;
if (!email || !password) {
  console.error("Missing PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD in .env. The checker does not print credentials.");
  process.exit(2);
}

const pb = new PocketBase(url);
pb.autoCancellation(false);
const issues = [];
const pass = (message) => console.log(`PASS  ${message}`);
const warn = (message) => { issues.push(message); console.log(`WARN  ${message}`); };

try {
  await pb.collection("_superusers").authWithPassword(email, password);
  const collections = await pb.collections.getFullList();
  const byName = new Map(collections.map((c) => [c.name, c]));
  const users = byName.get("users");
  if (!users) {
    warn("Auth collection 'users' was not found.");
  } else {
    const fields = Array.isArray(users.fields) ? users.fields : [];
    const field = (name) => fields.find((f) => f.name === name);
    if (!field("status")) warn("users.status is missing; apply the auth hardening migrations.");
    else pass(`users.status exists (values: ${(field("status").values || []).join(", ") || "not a select field"}).`);
    const passwordIdentityFields = users.passwordAuth?.identityFields || users.options?.passwordAuth?.identityFields || [];
    const authRule = users.authRule ?? users.options?.authRule ?? "";
    if (passwordIdentityFields.includes("email")) pass("Email is enabled as a password-login identity.");
    else warn(`Email is not in passwordAuth.identityFields (currently: ${passwordIdentityFields.join(", ") || "none"}).`);
    if (String(authRule).includes('status = "active"')) pass("Auth rule requires active status.");
    else warn("Auth rule is not restricted to status = active.");
  }

  const personal = [
    "expenses", "goals", "life_planner", "pets", "itineraries", "travel_trips",
    "bank_accounts", "goal_contributions", "experience_expenses", "experiences",
    "itinerary_items", "market_watchlist", "expense_ingestions", "investments",
  ];
  for (const name of personal) {
    const collection = byName.get(name);
    if (!collection) { warn(`Personal collection '${name}' not found (confirm that this module is installed).`); continue; }
    const fields = Array.isArray(collection.fields) ? collection.fields : [];
    const hasUser = fields.some((f) => f.name === "user");
    const nestedOwner = name === "itinerary_items" || name === "experience_expenses";
    if (!hasUser && !nestedOwner) warn(`${name} has no direct 'user' field; verify nested ownership rules manually.`);
    const ruleNames = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
    const publicRules = ruleNames.filter((rule) => collection[rule] === "");
    if (publicRules.length) warn(`${name} has public rule(s): ${publicRules.join(", ")}. Investigate before inviting testers.`);
    else if (ruleNames.every((rule) => collection[rule] == null)) warn(`${name} has all rules locked to superusers; the customer UI may fail to access this collection.`);
    else pass(`${name}: no empty-string (public) collection rules detected.`);
    for (const ruleName of ruleNames) {
      const value = collection[ruleName];
      if (typeof value === "string" && value.trim() && !value.includes('@request.auth.status = "active"')) {
        warn(`${name}.${ruleName} has no active-status guard; check whether the new migration has been applied.`);
      }
      if (typeof value === "string" && value.trim() && !/user\s*=\s*@request\.auth\.id/i.test(value)) {
        warn(`${name}.${ruleName} does not visibly constrain ownership to the authenticated user; inspect relation-aware rules manually.`);
      }
    }
  }

  const bank = byName.get("bank_accounts");
  if (bank) {
    const status = (bank.fields || []).find((f) => f.name === "status");
    if (!status) warn("bank_accounts.status is missing.");
    else if (status.type !== "select" || status.maxSelect !== 1) warn(`bank_accounts.status should be a single-select field; type=${status.type}, maxSelect=${status.maxSelect}.`);
    else pass("bank_accounts.status is single-select (matches the React form). ");
  }

  const goals = byName.get("goals");
  if (goals) {
    const current = (goals.fields || []).find((f) => f.name === "current_amount");
    if (!current) warn("goals.current_amount is missing.");
    else if (typeof current.min === "number" && current.min > 0) warn(`goals.current_amount has min=${current.min}; this prevents creating goals at zero.`);
    else pass("goals.current_amount permits zero or has no positive minimum.");
  }

  if (byName.has("shortcut_tokens")) pass("shortcut_tokens collection exists.");
  else warn("shortcut_tokens collection missing; run the Shortcut-token migration.");

  console.log("\nAudit summary:");
  console.log(`Warnings: ${issues.length}`);
  if (issues.length) {
    console.log("Review every warning. Some may be intentional for modules locked to superusers, but do not invite testers until user-data ownership is confirmed.");
    process.exitCode = 1;
  } else {
    console.log("No issues detected by this static rules/schema checklist. This is not a penetration test.");
  }
} catch (error) {
  console.error("PocketBase audit failed. Confirm PocketBase is running and the .env superuser credentials are valid.");
  console.error(error?.message || String(error));
  process.exitCode = 2;
}
