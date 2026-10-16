migrate((app) => {
  const collection = app.findCollectionByNameOrId(
    "expenses",
  );

  collection.fields.add(
    new RelationField({
      name: "account",
      collectionId: "pbc_314358106",
      cascadeDelete: false,
      required: false,
      maxSelect: 1,
    }),
  );

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId(
    "expenses",
  );

  collection.fields.removeByName(
    "account",
  );

  app.save(collection);
});