/// <reference path="../pb_data/types.d.ts" />
// Idempotent follow-up migration. Use this migration even if an earlier status
// migration was already applied: modifying an applied migration will not rerun it.
migrate((app) => {
  const auth = app.findCollectionByNameOrId("_pb_users_auth_");

  let statusField = null;
  try { statusField = auth.fields.getByName("status"); } catch { statusField = null; }
  if (!statusField) {
    auth.fields.add(new Field({
      id: "selectlpstatus02",
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

  // Existing project migration had username-only password identity. Enable both
  // email and username without removing compatibility for existing users.
  unmarshal({
    "passwordAuth": {
      "enabled": true,
      "identityFields": ["email", "username"]
    },
    "authRule": 'status = "active"'
  }, auth);
  app.save(auth);

  // Normalize a legacy multi-select status JSON array before interpreting it.
  app.db().newQuery(`
    UPDATE users SET status = CASE
      WHEN json_valid(status) AND json_type(status) = 'array' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM json_each(users.status)
          WHERE LOWER(CAST(value AS TEXT)) IN ('inactive', 'disabled', 'suspended')
        ) THEN 'suspended' ELSE COALESCE(json_extract(status, '$[0]'), '') END
      WHEN json_valid(status) AND json_type(status) = 'text' THEN json_extract(status, '$')
      ELSE TRIM(status)
    END WHERE status IS NOT NULL
  `).execute();
  app.db().newQuery("UPDATE users SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''").execute();
  app.db().newQuery("UPDATE users SET status = 'suspended' WHERE LOWER(status) IN ('inactive', 'disabled')").execute();
  app.db().newQuery("UPDATE users SET status = LOWER(status) WHERE LOWER(status) IN ('active', 'pending', 'suspended')").execute();
  app.db().newQuery("UPDATE users SET status = 'suspended' WHERE LOWER(status) NOT IN ('active', 'pending', 'suspended') OR status IS NULL OR TRIM(status) = ''").execute();

  // Set canonical owner guards even for legacy collections that accidentally
  // had empty-string (public) or null (superuser-only) rules. These are all
  // user-owned collections used by the customer UI, so ownership is explicit.
  const ownership = {
    expenses: { owner: "user" },
    goals: { owner: "user" },
    life_planner: { owner: "user" },
    pets: { owner: "user" },
    itineraries: { owner: "user" },
    travel_trips: { owner: "user" },
    bank_accounts: { owner: "user" },
    experiences: { owner: "user" },
    market_watchlist: { owner: "user" },
    expense_ingestions: { owner: "user" },
    investments: { owner: "user" },
    goal_contributions: { owner: "goal.user" },
    experience_expenses: { owner: "experience.user" },
    itinerary_items: { owner: "experience.user" },
  };
  for (const [name, config] of Object.entries(ownership)) {
    let collection;
    try { collection = app.findCollectionByNameOrId(name); } catch { continue; }
    const owner = config.owner;
    const active = '@request.auth.id != "" && @request.auth.status = "active"';
    if (owner === "user") {
      collection.listRule = `${active} && user = @request.auth.id`;
      collection.viewRule = `${active} && user = @request.auth.id`;
      collection.createRule = `${active} && @request.body.user = @request.auth.id`;
      collection.updateRule = `${active} && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`;
      collection.deleteRule = `${active} && user = @request.auth.id`;
    } else {
      // Child rows are visible only when the referenced parent belongs to the
      // authenticated active account. This prevents relation-based IDOR.
      collection.listRule = `${active} && ${owner} = @request.auth.id`;
      collection.viewRule = `${active} && ${owner} = @request.auth.id`;
      collection.createRule = `${active} && ${owner} = @request.auth.id`;
      collection.updateRule = `${active} && ${owner} = @request.auth.id`;
      collection.deleteRule = `${active} && ${owner} = @request.auth.id`;
    }
    app.save(collection);
  }

}, (app) => {
  // Conservative rollback: restores password auth to the legacy username-only
  // identity and removes the auth rule. Data and ownership conditions are kept.
  const auth = app.findCollectionByNameOrId("_pb_users_auth_");
  unmarshal({ "passwordAuth": { "enabled": true, "identityFields": ["username"] }, "authRule": "" }, auth);
  app.save(auth);
});
