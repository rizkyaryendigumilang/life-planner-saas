/// <reference path="../pb_data/types.d.ts" />
// Add performance composite indexes for high-frequency user-scoped queries and relations
migrate((app) => {
  const candidates = [
    { collection: "investments", name: "idx_lp_investments_user_mode", fields: ["user", "mode"] },
    { collection: "expenses", name: "idx_lp_expenses_user_cat_date", fields: ["user", "category", "date"] },
    { collection: "admin_audit_logs", name: "idx_lp_audit_action_created", fields: ["action", "created"] },
    { collection: "goal_contributions", name: "idx_lp_contributions_goal_date", fields: ["goal", "date"] },
    { collection: "itineraries", name: "idx_lp_itineraries_trip_date", fields: ["trip", "date"] },
    { collection: "itinerary_items", name: "idx_lp_itinerary_items_exp_date", fields: ["experience", "date"] },
  ];

  for (const candidate of candidates) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(candidate.collection);
    } catch {
      continue;
    }

    if (!collection) continue;

    let allFieldsExist = true;
    for (const fieldName of candidate.fields) {
      if (fieldName === "created" || fieldName === "updated") continue;
      try {
        const field = collection.fields.getByName(fieldName);
        if (!field) {
          allFieldsExist = false;
          break;
        }
      } catch {
        allFieldsExist = false;
        break;
      }
    }
    if (!allFieldsExist) continue;

    // Check if index with same name or same field list already exists
    const quotedFields = candidate.fields.map((name) => `\`${name}\``).join(", ");
    const fieldPattern = candidate.fields.join(".*");
    if (
      collection.indexes &&
      collection.indexes.some((sql) => sql.includes(candidate.name) || new RegExp(fieldPattern, "i").test(sql))
    ) {
      continue;
    }

    if (!collection.indexes) {
      collection.indexes = [];
    }
    collection.indexes.push(`CREATE INDEX \`${candidate.name}\` ON \`${candidate.collection}\` (${quotedFields})`);
    app.save(collection);
  }
}, (app) => {
  const names = [
    "idx_lp_investments_user_mode",
    "idx_lp_expenses_user_cat_date",
    "idx_lp_audit_action_created",
    "idx_lp_contributions_goal_date",
    "idx_lp_itineraries_trip_date",
    "idx_lp_itinerary_items_exp_date",
  ];
  for (const name of names) {
    try {
      app.db().newQuery(`DROP INDEX IF EXISTS \`${name}\``).execute();
    } catch {}
  }
});
