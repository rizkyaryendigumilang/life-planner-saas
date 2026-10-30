/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection = null;
  try { collection = app.findCollectionByNameOrId("admin_audit_logs"); } catch { collection = null; }
  if (collection) return;

  collection = new Collection({
    name: "admin_audit_logs",
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
      { id: "textlpadm001", name: "admin_id", type: "text", required: true },
      { id: "textlpadm002", name: "admin_email", type: "text", required: true },
      { id: "textlpadm003", name: "action", type: "text", required: true },
      { id: "textlpadm004", name: "target_id", type: "text", required: false },
      { id: "textlpadm005", name: "target_label", type: "text", required: false },
      { id: "jsonlpadm006", name: "details", type: "json", required: false },
      { id: "textlpadm007", name: "ip_address", type: "text", required: false },
      { id: "textlpadm008", name: "user_agent", type: "text", required: false },
      { id: "autodate2990389176", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false },
      { id: "autodate3332085495", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false },
    ],
    indexes: [
      "CREATE INDEX `idx_audit_logs_action` ON `admin_audit_logs` (`action`)",
      "CREATE INDEX `idx_audit_logs_created` ON `admin_audit_logs` (`created`)",
      "CREATE INDEX `idx_audit_logs_target` ON `admin_audit_logs` (`target_id`)",
    ],
  });
  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("admin_audit_logs");
    app.delete(collection);
  } catch {}
});
