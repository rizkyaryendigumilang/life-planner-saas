# Life Planner SaaS

A mobile-first React + PocketBase personal operating system for:

- Life Planner / Notion-style tasks
- Expense Tracking
- Traveling Hub
- Dashboard
- Superadmin customer provisioning
- `.ics` calendar export, subscribable from the iPhone calendar app
- Email/password sign-up, plus Google, GitHub and Telegram sign-in

The UI intentionally avoids noisy dashboard patterns: no gradient hero, no glassmorphism, no emoji-heavy navigation, and no giant decorative cards.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- shadcn/ui-style primitives
- PocketBase
- @dnd-kit
- Recharts
- ics
- Sonner
- Lucide React

## 1. Requirements

- Node.js 20+ recommended
- npm 10+
- PocketBase 0.26+ recommended

## 2. Install frontend

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Set:

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

## 3. Start PocketBase

Download PocketBase from the official release page and run:

```bash
./pocketbase serve
```

Windows:

```powershell
.\pocketbase.exe serve
```

Open the PocketBase admin UI at:

```text
http://127.0.0.1:8090/_/
```

Create your first PocketBase superuser.

## 4. Create collections

Use `pocketbase/collections.reference.json` as the field checklist.

Then apply the API rules from:

```text
pocketbase/API-RULES.md
```

PocketBase's built-in auth collection should be named `users`.

Recommended fields:

### users

- role: select — `superadmin`, `customer`
- is_password_temp: bool

### expenses

- user: relation -> users
- date: date
- amount: number
- category: text
- type: select — `Income`, `Expense`
- notes: text
- due_date: date
- paid: bool

### life_planner

- user: relation -> users
- title: text
- description: text
- due_date: date
- status: select — `To-Do`, `In Progress`, `Done`
- priority: select — `Low`, `Medium`, `High`
- category: text
- order: number

### goals

- user: relation -> users
- title: text
- why: text
- progress: number
- due_date: date

### travel_trips

- user: relation -> users
- name: text
- destination: text
- start_date: date
- end_date: date
- budget: number
- actual: number
- notes: text

### itineraries

- user: relation -> users
- trip: relation -> travel_trips
- date: date
- start_time: text
- end_time: text
- title: text
- location: text
- notes: text

## 5. Create the PocketBase schema

After creating the PocketBase superuser, run the schema bootstrap:

```powershell
$env:PB_URL="http://127.0.0.1:8090"
$env:PB_SUPERUSER_EMAIL="your-pocketbase-superuser@example.com"
$env:PB_SUPERUSER_PASSWORD="your-pocketbase-superuser-password"
node pocketbase/setup-schema.mjs
```

This creates the auth collection and application collections with the owner rules described in `pocketbase/API-RULES.md`.

## 6. Create the requested `kiky` account

The requested credentials are a bootstrap default. Change them before commercial deployment.

Set the PocketBase superuser credentials in your shell:

PowerShell:

```powershell
$env:PB_URL="http://127.0.0.1:8090"
$env:PB_SUPERUSER_EMAIL="your-pocketbase-superuser@example.com"
$env:PB_SUPERUSER_PASSWORD="your-pocketbase-superuser-password"
node pocketbase/bootstrap-admin.mjs
```

The result creates:

```text
username: kiky
password: kiky123
role: superadmin
```

Do not commit the superuser credentials.

## 7. Run the app

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Production build:

```bash
npm run typecheck
npm run build
npm run preview
```

### Optional setup scripts

```bash
npm run setup:oauth   # enable Google/GitHub OAuth2 from .env
npm run tunnel        # Cloudflare quick tunnel so the .ics feed works off-LAN
```

`npm run tunnel` needs `cloudflared` (`winget install --id Cloudflare.cloudflared`). It writes the public base URL to `.runtime/public-base.json`, which `GET /api/network-info` picks up so the Calendar page hands out the public feed URL. See `docs/CALENDAR-SUBSCRIBE-ID.md`.

## 8. Production deployment

Build:

```bash
npm run build
```

Serve `dist/` with Nginx, Caddy or another static web server.

Recommended:

```text
https://app.example.com  -> dist/
https://api.example.com  -> PocketBase
```

Use HTTPS for both.

## 9. Project structure

```text
src/
  components/
    layout.tsx
    ui.tsx
  hooks/
    use-pocketbase.ts
  lib/
    calendar.ts
    pocketbase.ts
    utils.ts
  pages/
    Admin.tsx
    ChangePassword.tsx
    Dashboard.tsx
    Finance.tsx
    Login.tsx
    Planner.tsx
    Travel.tsx
  types/
    index.ts
  App.tsx
  index.css
  main.tsx

pocketbase/
  API-RULES.md
  README.md
  bootstrap-admin.mjs
  collections.reference.json

docs/
  ARCHITECTURE.md
  IMPLEMENTATION-NOTES.md
```

## 10. Roadmap

Phase 2 can migrate the remaining Excel domains:

1. Goals + goal progress
2. Full calendar
3. Savings goals and contribution tracker
4. Habit tracker
5. Meals / weekly meal planner
6. Grocery list
7. Weight tracker
8. Advanced finance: recurring bills, credit-card due dates, subscriptions
9. CSV/XLSX import from the existing Life Planner
10. PWA install/offline support
11. audit log and subscription/billing layer

## 11. Reference projects

The implementation was informed by the requested open-source references. They are not bundled into the app:

- https://github.com/DavidHDev/react-bits
- https://github.com/BolajiAyodeji/awesome-technical-writing
- https://github.com/conorbronsdon/avoid-ai-writing
- https://github.com/emilkowalski/skills
- https://github.com/yetone/kill-ai-slop
