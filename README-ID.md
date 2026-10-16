# Life Planner SaaS — Paket update full code

Paket ini berisi source code frontend React/Vite, backend Express, migration PocketBase, PocketBase hooks, integrasi iOS Shortcut yang memakai token per perangkat, dan dokumentasi pengaturan login. Paket ini disiapkan berdasarkan source snapshot yang tersedia untuk audit. **Tetap uji pada salinan project dan database terlebih dahulu. Paket ini belum dinyatakan lolos build penuh atau pengujian terhadap database lokalmu.**

## Fitur utama dalam paket

- Email + password login dan halaman **Sign Up** (email + password saja); reset password lewat email, dengan respons generik untuk menghindari enumerasi akun.
- Pendaftaran akun dibuat server lewat `POST /api/auth/signup` memakai klien superuser, sehingga `role`/`status` tidak pernah bisa dipaksa dari browser. `createRule` koleksi `users` ditutup lewat migration, jadi klien anonim tidak bisa membuat user langsung.
- Tombol Google, GitHub dan Telegram. Tombol yang providernya belum dikonfigurasi tetap tampil tapi redup dan memberi pesan jelas saat diklik. Statusnya dibaca dari `GET /api/auth/providers`.
- Google dan GitHub memakai OAuth2 bawaan PocketBase; jalankan `npm run setup:oauth` setelah mengisi client ID/secret di `.env`.
- Telegram memakai handshake bot, bukan OAuth2 (PocketBase 0.40.4 tidak punya provider `telegram`). Butuh `TELEGRAM_BOT_TOKEN` dari @BotFather. Akun Telegram memakai alamat non-mailbox `@users.lifeplanner.local` sehingga tidak bisa menerima reset password.
- Kalender bisa di-subscribe dari iPhone lewat feed `.ics`. Untuk akses di luar jaringan rumah, `npm run tunnel` membuka Cloudflare Tunnel dan otomatis menulis alamat publiknya ke `.runtime/public-base.json`.
- Design system light mode yang konsisten, sidebar responsif, page quick-search dengan `Ctrl+K`, login yang responsif, dan feedback di Planner.
- Status akun `active/pending/suspended`, server-side role enforcement untuk akun baru/ubah profil, dan aturan koleksi aktif yang harus diterapkan lewat migration.
- Perbaikan schema login agar login password menerima email dan username; perbaikan legacy `bank_accounts.status` menjadi satu pilihan; index database untuk query yang sering digunakan.
- Integrasi Shortcut iOS dengan token khusus per perangkat: server hanya menyimpan SHA-256 hash; token mentah hanya dikembalikan sekali; token bisa dicabut dan kedaluwarsa.
- Portfolio hanya menampilkan quote jika backend memperoleh data nyata dari Twelve Data; harga tidak dibuat-buat, key provider disimpan di server, respons quote di-cache 60 detik, dan permintaan dibatasi per user/IP.
- Audit checker schema/rules PocketBase: `npm run audit:pb`.

## Folder penting

- `src/` — React pages dan komponen.
- `server/index.mjs` — API Express, admin authorization, expense ingestion dan token Shortcut.
- `pocketbase/pb_migrations/` — migration schema dan security.
- `pocketbase/pb_hooks/life_planner_auth.pb.js` — server-side guard untuk auth collection `users`.
- `ios-shortcut/` — workflow Shortcut XML unsigned dan script untuk menandatanganinya.
- `docs/` — petunjuk setup, security, UX audit, dan test plan.
- `.env.example` — template konfigurasi tanpa kredensial aktif.

## Setup Windows (PowerShell)

1. Buat salinan project dan database lokal. Jangan uji migration di folder/database utama.

   ```powershell
   cd "$HOME\Documents\Dev"
   Copy-Item .\life-planner-saas .\life-planner-saas-test -Recurse
   ```

2. Ekstrak paket ini ke folder `life-planner-saas-test` dan pertahankan struktur foldernya. Jika diminta overwrite, pastikan folder tujuan adalah salinan test, bukan project utama.
3. Salin `.env.example` menjadi `.env`. Isi `PB_SUPERUSER_EMAIL` dan `PB_SUPERUSER_PASSWORD` dengan kredensial superuser PocketBase milikmu. Jangan isi key server di file yang diawali `VITE_`.
4. Jalankan PocketBase menggunakan folder data khusus untuk salinan test. Terapkan migration sesudah membuat backup.
5. Pastikan folder `pocketbase/pb_hooks` ditempatkan di direktori yang dibaca oleh executable PocketBase. Jika executable berada di folder `pocketbase`, subfolder `pb_hooks` harus berdampingan dengan executable.
6. Di root project:

   ```powershell
   npm install
   npm run typecheck
   npm run build
   ```

7. Di terminal backend: `npm run api:dev`. Di terminal frontend lain: `npm run dev`.
8. Login dengan akun customer dan admin terpisah. Jalankan `npm run audit:pb` setelah konfigurasi `.env`.
9. Ikuti `docs/AUTH-SETUP-ID.md`, `docs/CALENDAR-SUBSCRIBE-ID.md`, `docs/IOS-SHORTCUT-SETUP-ID.md`, lalu `docs/TEST-PLAN-ID.md`.

## Environment variable

- `VITE_POCKETBASE_URL`: alamat publik PocketBase yang digunakan browser.
- `VITE_API_BASE_URL`: alamat Express yang digunakan browser.
- `TELEGRAM_BOT_TOKEN`: token bot dari @BotFather; tanpa ini tombol Telegram tampil redup dan `POST /api/auth/telegram/start` menjawab 503.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: dipakai `npm run setup:oauth` untuk mengisi provider OAuth2 di PocketBase.
- `TUNNEL_TARGET`: alamat lokal yang diteruskan `npm run tunnel`; default `http://127.0.0.1:3001`.
- `PB_URL`, `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`: backend only.
- `API_HOST=0.0.0.0`: membuat API bisa dijangkau dari iPhone di jaringan LAN saat uji Shortcut. Jangan mengekspos port dev ke internet. Firewall hanya boleh mengizinkan jaringan privat tepercaya.
- `FRONTEND_ORIGINS`: daftar origin browser yang diperbolehkan, dipisahkan koma.
- `MARKET_DATA_API_KEY`: opsional, API key Twelve Data di backend saja. Jika diisi, set `VITE_MARKET_DATA_ENABLED=true` di file environment frontend agar Portfolio mengambil quote dari API. Jangan menyimpan key di `VITE_TWELVE_DATA_API_KEY`.

## Catatan penting

- Google/GitHub memerlukan OAuth client ID/secret milikmu, Telegram memerlukan bot token. Credential tersebut tidak dapat dibuat otomatis dalam source code.
- `npm run setup:oauth` mengaktifkan provider OAuth2 tanpa menghapus provider yang sudah ada. `npm run tunnel` memerlukan `cloudflared` (`winget install --id Cloudflare.cloudflared`).
- Kalender publik hanya boleh dipakai sementara saat uji; tutup tunnel (Ctrl+C) kalau tidak dipakai karena alamatnya terbuka ke internet.
- SMTP PocketBase perlu dikonfigurasi agar email reset benar-benar terkirim.
- `.env`, `pocketbase/pb_data`, `node_modules` dan `dist` tidak ikut dimasukkan ke ZIP.
- `ios-shortcut/Life Planner Expense.unsigned.shortcut` bukan file bertanda tangan final. Jalankan `Sign Shortcut on Windows.bat` dalam folder Shortcut dengan internet aktif agar dibuatkan file signed melalui layanan signing pihak ketiga. Periksa kepercayaan layanan signing tersebut; shortcut di paket hanya menggunakan placeholder dan tidak berisi token akunmu.
- HTTPS wajib untuk deployment internet. Token Shortcut HTTP hanya untuk jaringan privat lokal saat pengembangan.
