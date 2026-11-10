/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  function addMissingFields(collection, fields) {
    for (const field of fields) {
      if (!collection.fields.getByName(field.name)) {
        if (field.type === "number") {
          collection.fields.add(new NumberField(field));
        } else {
          collection.fields.add(new TextField(field));
        }
      }
    }
    app.save(collection);
  }

  function createOrUpdate(name, fields) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(name);
      addMissingFields(collection, fields);
      return;
    } catch {
      collection = new Collection({
        type: "base",
        name,
        listRule: "user = @request.auth.id",
        viewRule: "user = @request.auth.id",
        createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
        updateRule: "@request.auth.id != '' && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
        deleteRule: "user = @request.auth.id",
        fields,
      });
      app.save(collection);
    }
  }

  createOrUpdate("household_bills", [
    { name: "user", type: "text", required: true, max: 100 },
    { name: "name", type: "text", required: true, max: 160 },
    { name: "sub_category", type: "text", required: true, max: 100 },
    { name: "default_amount", type: "number", min: 0 },
    { name: "due_day", type: "number", min: 1, max: 31 },
  ]);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("household_bills");
    app.delete(collection);
  } catch {
    // no-op
  }
});
