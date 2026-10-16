# Life Planner SaaS architecture

## Frontend

Vite + React SPA is used because the product is a logged-in productivity application rather than an SEO-first public site. Navigation is client-side and data comes from PocketBase.

```text
Browser
  ├─ React Router-like state navigation
  ├─ UI primitives / shadcn style
  ├─ dnd-kit
  ├─ Recharts
  └─ PocketBase JS SDK
             │
             ▼
      HTTPS PocketBase
             │
             ▼
          SQLite
```

## Security model

The browser only receives the authenticated user's token. Every user-owned record contains `user`. PocketBase API rules are the authoritative tenant boundary.

Do not trust a `user` value supplied by a client without the corresponding API rule.

## Modules

The Excel source contains these domains:

- Goals
- Calendar
- Budget / expense tracking
- Savings
- Habit tracker
- To-do
- Weight tracker
- Meals / meal planner
- Grocery list

The commercial MVP implements:

- Life Planner / tasks
- Expense Tracking
- Traveling Hub
- Dashboard
- Goal and Calendar placeholders
- Superadmin account provisioning

The remaining Excel domains are deliberately left as bounded modules so they can be added without rewriting the data layer.

## Production notes

1. Put PocketBase behind HTTPS.
2. Back up `pb_data` frequently.
3. Keep PocketBase superuser credentials out of the browser and repository.
4. Use a strong application superadmin password in production; the requested `kiky123` is only a bootstrap/default credential.
5. Add rate limiting at the reverse proxy.
6. Add CSP, HSTS and secure cookies at the reverse proxy.
7. Add audit logs for account creation, password resets and role changes.
