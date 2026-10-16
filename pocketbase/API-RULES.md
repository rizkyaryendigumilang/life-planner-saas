# API Rules

The exact rule strings below are the security boundary. Do not loosen them to `""` in production.

## `users`

Because the app uses a single auth collection:

- List: `@request.auth.role = "superadmin"`
- View: `id = @request.auth.id || @request.auth.role = "superadmin"`
- Create: `@request.auth.role = "superadmin"`
- Update: `id = @request.auth.id || @request.auth.role = "superadmin"`
- Delete: `@request.auth.role = "superadmin"`

For `users`, protect the role field in the frontend and consider a server-side policy if your deployment exposes PocketBase's admin UI to untrusted operators.

## Owner collections

For `expenses`, `life_planner`, `goals`, and `travel_trips`:

- List: `user = @request.auth.id`
- View: `user = @request.auth.id`
- Create: `@request.auth.id != "" && user = @request.auth.id`
- Update: `user = @request.auth.id`
- Delete: `user = @request.auth.id`

## `itineraries`

- List/View/Update/Delete: `user = @request.auth.id`
- Create: `@request.auth.id != "" && user = @request.auth.id`

If you want an additional relational guard, enforce the selected trip's owner in application code and in a server-side hook.

## Important

`@request.auth.role = "superadmin"` is an application role, not PocketBase's internal `_superusers` role. Keep your actual PocketBase superuser credentials separate and never ship them to the browser.
