migrate((app) => {
  function addMissingFields(collection, fields) {
    for (const field of fields) {
      if (!collection.fields.getByName(field.name)) {
        if (field.type === "select") {
          collection.fields.add(new SelectField(field));
        } else if (field.type === "number") {
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

  createOrUpdate("bank_accounts", [
    { name: "user", type: "text", required: true, max: 100 },
    { name: "bank_name", type: "text", required: true, max: 120 },
    { name: "account_name", type: "text", required: true, max: 160 },
    { name: "account_number", type: "text", max: 80 },
    { name: "account_type", type: "select", required: true, values: ["Savings", "Current", "E-Wallet", "Other"], maxSelect: 1 },
    { name: "balance", type: "number", min: 0 },
    { name: "status", type: "select", required: true, values: ["Active", "Inactive"], maxSelect: 1 },
    { name: "notes", type: "text", max: 2000 },
  ]);

  createOrUpdate("investments", [
    { name: "user", type: "text", required: true, max: 100 },
    { name: "mode", type: "select", required: true, values: ["Portfolio", "Watchlist"], maxSelect: 1 },
    { name: "asset_type", type: "select", required: true, values: ["Stock", "Crypto"], maxSelect: 1 },
    { name: "symbol", type: "text", required: true, max: 40 },
    { name: "asset_name", type: "text", required: true, max: 160 },
    { name: "quantity", type: "number", min: 0 },
    { name: "average_price", type: "number", min: 0 },
  ]);
}, (app) => {
  for (const name of ["bank_accounts", "investments"]) {
    try {
      const collection = app.findCollectionByNameOrId(name);
      app.delete(collection);
    } catch {
      // no-op
    }
  }
});
