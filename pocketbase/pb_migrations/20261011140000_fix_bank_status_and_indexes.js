/// <reference path="../pb_data/types.d.ts" />
// Normalize legacy bank-account status values and add indexes for frequent
// account-scoped queries. The migration is safe when older schemas differ.
migrate((app) => {
  let bankAccounts = null;
  try { bankAccounts = app.findCollectionByNameOrId("bank_accounts"); } catch { bankAccounts = null; }
  if (bankAccounts) {
    // A legacy migration allowed 2 selected status values, while the UI expects
    // one scalar. Flatten old JSON arrays before reducing maxSelect to 1.
    app.db().newQuery(`
      UPDATE bank_accounts
      SET status = CASE
        WHEN json_valid(status) THEN
          CASE WHEN json_type(status) = 'array'
            THEN COALESCE(json_extract(status, '$[0]'), 'Active')
            ELSE status
          END
        ELSE status
      END
      WHERE status IS NOT NULL
    `).execute();
    app.db().newQuery("UPDATE bank_accounts SET status = 'Active' WHERE status IS NULL OR TRIM(status) = ''").execute();

    try {
      const status = bankAccounts.fields.getByName("status");
      if (status.type === "select") {
        status.values = ["Active", "Inactive"];
        status.maxSelect = 1;
        status.required = true;
      }
    } catch {
      bankAccounts.fields.add(new SelectField({
        name: "status", type: "select", required: true, maxSelect: 1,
        values: ["Active", "Inactive"],
      }));
    }
    app.save(bankAccounts);
  }

  const candidates = [
    { collection: "expenses", name: "idx_lp_expenses_user_date", fields: ["user", "date"] },
    { collection: "life_planner", name: "idx_lp_tasks_user_status_due", fields: ["user", "status", "due_date"] },
    { collection: "bank_accounts", name: "idx_lp_bank_accounts_user", fields: ["user"] },
    { collection: "goals", name: "idx_lp_goals_user", fields: ["user"] },
    { collection: "pets", name: "idx_lp_pets_user", fields: ["user"] },
    { collection: "travel_trips", name: "idx_lp_travel_trips_user_start", fields: ["user", "start_date"] },
    { collection: "experiences", name: "idx_lp_experiences_user_start", fields: ["user", "start_date"] },
    { collection: "expense_ingestions", name: "idx_lp_ingestions_user_date", fields: ["user", "transaction_date"] },
    { collection: "market_watchlist", name: "idx_lp_watchlist_user_active", fields: ["user", "is_active"] },
  ];

  for (const candidate of candidates) {
    let collection;
    try { collection = app.findCollectionByNameOrId(candidate.collection); } catch { continue; }
    let allFieldsExist = true;
    for (const fieldName of candidate.fields) {
      try { collection.fields.getByName(fieldName); } catch { allFieldsExist = false; break; }
    }
    if (!allFieldsExist) continue;
    if (collection.indexes.some((sql) => sql.includes(candidate.name))) continue;
    const quotedFields = candidate.fields.map((name) => `\`${name}\``).join(", ");
    collection.indexes.push(`CREATE INDEX \`${candidate.name}\` ON \`${candidate.collection}\` (${quotedFields})`);
    app.save(collection);
  }
}, (app) => {
  // Indexes are performance-only; rollback does not revert normalized records.
  const names = [
    "idx_lp_expenses_user_date", "idx_lp_tasks_user_status_due",
    "idx_lp_bank_accounts_user", "idx_lp_goals_user", "idx_lp_pets_user",
    "idx_lp_travel_trips_user_start", "idx_lp_experiences_user_start",
    "idx_lp_ingestions_user_date", "idx_lp_watchlist_user_active",
  ];
  for (const name of names) {
    try { app.db().newQuery(`DROP INDEX IF EXISTS \`${name}\``).execute(); } catch {}
  }
  let bankAccounts = null;
  try { bankAccounts = app.findCollectionByNameOrId("bank_accounts"); } catch { bankAccounts = null; }
  if (bankAccounts) {
    try {
      const status = bankAccounts.fields.getByName("status");
      if (status.type === "select") status.maxSelect = 2;
      app.save(bankAccounts);
    } catch {}
  }
});
