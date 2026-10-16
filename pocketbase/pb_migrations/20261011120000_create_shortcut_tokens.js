/// <reference path="../pb_data/types.d.ts" />
// Per-device iOS Shortcut credentials. The Express API stores only a SHA-256
// hash; this collection is superuser-only and is never exposed directly to a client.
migrate((app) => {
  let collection = null;
  try { collection = app.findCollectionByNameOrId("shortcut_tokens"); } catch { collection = null; }
  if (collection) return;

  collection = new Collection({
    name: "shortcut_tokens",
    type: "base",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        id: "text3208210256",
        name: "id",
        type: "text",
        system: true,
        primaryKey: true,
        required: true,
        min: 15,
        max: 15,
        autogeneratePattern: "[a-z0-9]{15}",
        pattern: "^[a-z0-9]+$",
      },
      {
        id: "relationlpuser001",
        name: "user",
        type: "relation",
        collectionId: "_pb_users_auth_",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        cascadeDelete: true,
      },
      { id: "textlplabel001", name: "label", type: "text", required: true, min: 1, max: 80 },
      { id: "textlphash001", name: "token_hash", type: "text", required: true, min: 64, max: 64, pattern: "^[a-f0-9]{64}$" },
      { id: "textlplast4001", name: "last_four", type: "text", required: true, min: 4, max: 4 },
      { id: "boollpactive1", name: "revoked", type: "bool", required: false },
      { id: "datelpexpire1", name: "expires_at", type: "date", required: false },
      { id: "datelplastuse1", name: "last_used_at", type: "date", required: false },
      { id: "autodate2990389176", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false },
      { id: "autodate3332085495", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_shortcut_tokens_hash` ON `shortcut_tokens` (`token_hash`)",
      "CREATE INDEX `idx_shortcut_tokens_user` ON `shortcut_tokens` (`user`)",
    ],
  });
  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("shortcut_tokens");
    app.delete(collection);
  } catch {}
});
