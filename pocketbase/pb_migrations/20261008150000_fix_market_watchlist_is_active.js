/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId(
    "pbc_3208564161",
  );

  const field = collection.fields.getByName(
    "is_active",
  );

  field.required = false;

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId(
    "pbc_3208564161",
  );

  const field = collection.fields.getByName(
    "is_active",
  );

  field.required = true;

  return app.save(collection);
});
