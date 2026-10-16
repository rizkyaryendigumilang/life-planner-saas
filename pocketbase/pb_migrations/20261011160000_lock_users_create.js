/// <reference path="../pb_data/types.d.ts" />
// Sign-up now goes through the API server (`POST /api/auth/signup`), which uses
// a superuser client and assigns role/status itself. Closing the public create
// rule stops anonymous clients from creating user rows directly, while OAuth2
// sign-in keeps working because PocketBase creates those records internally.
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  users.createRule = null;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  users.createRule = "";
  app.save(users);
});
