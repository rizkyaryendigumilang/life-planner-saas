/// <reference path="../pb_data/types.d.ts" />
// Prevent privilege escalation: Disallow users from tampering with role and status via client update
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (!users) return;

  // Enforce that callers can only update their own record, and MUST NOT modify role, status, or verified.
  // role, status, and verification can only be managed by administrators or verified system workflows.
  users.updateRule = '@request.auth.id != "" && id = @request.auth.id && @request.body.role:isset = false && @request.body.status:isset = false && @request.body.verified:isset = false';
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (!users) return;

  users.updateRule = 'id = @request.auth.id';
  app.save(users);
});
