/// <reference path="../pb_data/types.d.ts" />
// Many custom collections were created without the standard `created` and
// `updated` autodate fields. The frontend sorts by them (for example
// `?sort=-updated,-created` on Portfolio or `sort: "created"` in Settings), and
// PocketBase answers 400 "Something went wrong" when the column is missing.
// This migration adds the two fields to every custom collection that lacks
// them. It is idempotent and safe to run on an already-patched database.
const TARGETS = [
  "expense_ingestions",
  "expenses",
  "experience_expenses",
  "experiences",
  "goal_contributions",
  "goals",
  "investments",
  "itineraries",
  "itinerary_items",
  "life_planner",
  "market_watchlist",
  "pets",
  "travel_trips",
];

function hasField(collection, name) {
  try {
    return !!collection.fields.getByName(name);
  } catch {
    return false;
  }
}

migrate((app) => {
  for (const name of TARGETS) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(name);
    } catch {
      continue;
    }
    if (!collection) continue;

    let changed = false;

    if (!hasField(collection, "created")) {
      collection.fields.add(
        new Field({
          id: `created${name.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`,
          name: "created",
          type: "autodate",
          onCreate: true,
          onUpdate: false,
          system: false,
        }),
      );
      changed = true;
    }

    if (!hasField(collection, "updated")) {
      collection.fields.add(
        new Field({
          id: `updated${name.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`,
          name: "updated",
          type: "autodate",
          onCreate: true,
          onUpdate: true,
          system: false,
        }),
      );
      changed = true;
    }

    if (changed) app.save(collection);
  }
}, (app) => {
  for (const name of TARGETS) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(name);
    } catch {
      continue;
    }
    if (!collection) continue;

    for (const field of ["created", "updated"]) {
      try {
        collection.fields.removeByName(field);
      } catch {
        // field not present, nothing to remove
      }
    }
    app.save(collection);
  }
});
