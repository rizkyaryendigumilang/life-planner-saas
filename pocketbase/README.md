# PocketBase setup

This project uses one PocketBase auth collection named `users` for both customer and superadmin accounts.

## Collections

- `users` (auth): role, is_password_temp
- `expenses`: user, date, amount, category, type, notes, due_date, paid, optional pet relation
- `pets`: user, name, species, breed, sex, birth_date, profile photo, notes
- `life_planner`: user, title, description, due_date, status, priority, category, order, list, tags, recurrence, reminder, parent task
- `goals`: user, title, why, progress, due_date
- `travel_trips`: user, name, destination, start_date, end_date, budget, actual, notes
- `itineraries`: user, trip, date, start_time, end_time, title, location, notes

All customer-owned collections use the owner relation for list/view/create/update/delete rules. A customer can only access records where `user = @request.auth.id`.

The `itineraries` collection also checks that the linked trip belongs to the authenticated user.

## Recommended deployment

Run PocketBase on the same VPS as the frontend or behind a reverse proxy:

```text
https://app.example.com       -> static Vite build
https://api.example.com      -> PocketBase :8090
```

Enable HTTPS, backups of `pb_data`, and a restricted admin surface.

## Schema

`collections.json` is the declarative reference. If you prefer the PocketBase Admin UI, create the collections using the field definitions and rules in that file.

`bootstrap-admin.mjs` uses a PocketBase superuser credential to create the application-level `kiky` account. Do not put that credential in source control.

## Updating an existing installation

If PocketBase already has the earlier schema, run `npm run migrate:task-pets` with the same superuser environment variables. It adds the Pet collection, optional pet relation on expenses, and the new task fields/status.
