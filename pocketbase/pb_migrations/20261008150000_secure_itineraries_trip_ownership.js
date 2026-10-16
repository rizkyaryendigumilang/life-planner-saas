/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("itineraries");

  collection.createRule =
    '@request.auth.id != "" && user = @request.auth.id && trip.user = @request.auth.id';

  collection.listRule =
    'user = @request.auth.id && trip.user = @request.auth.id';

  collection.viewRule =
    'user = @request.auth.id && trip.user = @request.auth.id';

  collection.updateRule =
    'user = @request.auth.id && trip.user = @request.auth.id';

  collection.deleteRule =
    'user = @request.auth.id && trip.user = @request.auth.id';

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("itineraries");

  collection.createRule =
    '@request.auth.id != "" && user = @request.auth.id';

  collection.listRule =
    'user = @request.auth.id';

  collection.viewRule =
    'user = @request.auth.id';

  collection.updateRule =
    'user = @request.auth.id';

  collection.deleteRule =
    'user = @request.auth.id';

  app.save(collection);
});
