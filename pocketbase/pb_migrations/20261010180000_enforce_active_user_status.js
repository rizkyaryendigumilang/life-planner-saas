/// <reference path="../pb_data/types.d.ts" />
// Enforce active account status consistently across authentication and data APIs.
// This migration intentionally preserves null rules (PocketBase superuser-only rules)
// and wraps existing non-null rules rather than replacing their ownership conditions.
migrate((app) => {
  const auth = app.findCollectionByNameOrId("_pb_users_auth_");

  // Some older local schemas created this field manually and therefore do not
  // have it in the migration history. Add/update it idempotently before using
  // it in auth/collection rules.
  let statusField = null;
  try { statusField = auth.fields.getByName("status"); } catch { statusField = null; }
  if (!statusField) {
    auth.fields.add(new Field({
      id: "selectlpstatus01",
      name: "status",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["active", "pending", "suspended"],
      system: false,
    }));
  } else if (statusField.type === "select") {
    statusField.values = ["active", "pending", "suspended"];
    statusField.maxSelect = 1;
    statusField.required = true;
  }
  app.save(auth);

  // Normalize legacy single-select strings and older multi-select JSON arrays
  // before applying the fail-closed status policy. Any array containing an
  // inactive/suspended marker remains blocked rather than accidentally active.
  app.db().newQuery(`
    UPDATE users SET status = CASE
      WHEN json_valid(status) AND json_type(status) = 'array' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM json_each(users.status)
          WHERE LOWER(CAST(value AS TEXT)) IN ('inactive', 'disabled', 'suspended')
        ) THEN 'suspended' ELSE COALESCE(json_extract(status, '$[0]'), '') END
      WHEN json_valid(status) AND json_type(status) = 'text' THEN json_extract(status, '$')
      ELSE TRIM(status)
    END
    WHERE status IS NOT NULL
  `).execute();
  // Preserve legacy Active/Inactive values and make unclassified records safe.
  app.db().newQuery("UPDATE users SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''").execute();
  app.db().newQuery("UPDATE users SET status = 'suspended' WHERE LOWER(status) IN ('inactive', 'disabled')").execute();
  app.db().newQuery("UPDATE users SET status = LOWER(status) WHERE LOWER(status) IN ('active', 'pending', 'suspended')").execute();
  app.db().newQuery("UPDATE users SET status = 'suspended' WHERE LOWER(status) NOT IN ('active', 'pending', 'suspended')").execute();

  auth.authRule = 'status = "active"';
  app.save(auth);

  const names = [
    "expenses", "goals", "life_planner", "pets", "itineraries",
    "travel_trips", "bank_accounts", "goal_contributions",
    "experience_expenses", "experiences", "itinerary_items",
    "market_watchlist", "expense_ingestions", "investments",
  ];

  for (const name of names) {
    let collection;
    try { collection = app.findCollectionByNameOrId(name); }
    catch { continue; }

    for (const ruleName of ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]) {
      const current = collection[ruleName];
      if (typeof current === "string" && current.trim()) {
        const guard = '@request.auth.status = "active"';
        if (!current.includes(guard)) {
          collection[ruleName] = `${guard} && (${current})`;
        }
      }
    }
    app.save(collection);
  }
}, (app) => {
  // Rollback removes the active-status guard while retaining the original ownership
  // clauses. The original rules are reconstructed by stripping the exact wrapper.
  const auth = app.findCollectionByNameOrId("_pb_users_auth_");
  auth.authRule = null;
  app.save(auth);

  const names = [
    "expenses", "goals", "life_planner", "pets", "itineraries",
    "travel_trips", "bank_accounts", "goal_contributions",
    "experience_expenses", "experiences", "itinerary_items",
    "market_watchlist", "expense_ingestions", "investments",
  ];
  for (const name of names) {
    let collection;
    try { collection = app.findCollectionByNameOrId(name); }
    catch { continue; }
    for (const ruleName of ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]) {
      const current = collection[ruleName];
      const prefix = '@request.auth.status = "active" && (';
      if (typeof current === "string" && current.startsWith(prefix) && current.endsWith(")")) {
        collection[ruleName] = current.slice(prefix.length, -1);
      }
    }
    app.save(collection);
  }
});
