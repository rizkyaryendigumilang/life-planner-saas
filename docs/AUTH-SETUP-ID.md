# Setup authentication — email, Google, GitHub, Telegram

## 1. Email/password, daftar akun, dan lupa password

1. Buka PocketBase Admin UI → Collections → `users` → Options.
2. Pastikan Password auth aktif. Migration menambahkan `email` dan `username` sebagai identity fields.
3. Buka Settings → Mail settings dan konfigurasi SMTP dengan alamat pengirim yang kamu kontrol. Lakukan test email.
4. Collections → `users` → Options → Reset password template. Ubah tombol reset agar menuju halaman frontend:

   ```html
   <p>Hello,</p>
   <p>We received a request to reset the password for your Life Planner account.</p>
   <p><a class="btn" href="http://localhost:5173/?mode=reset&amp;token={TOKEN}" target="_blank" rel="noopener">Reset password</a></p>
   <p>If you did not request this, you can ignore this email.</p>
   ```

   Ganti `http://localhost:5173` dengan alamat frontend yang benar saat production. Jangan mengarahkan tautan ke halaman admin PocketBase.
5. Password reset token PocketBase memiliki masa berlaku; untuk keamanan, jangan salin atau membagikan tokennya. Tampilan login memberi respons yang sama baik email ada maupun tidak untuk mengurangi enumerasi akun.

### Daftar akun (Sign Up)

- Halaman Sign Up hanya meminta **email + password** (minimal 8 karakter).
- Akun dibuat oleh server lewat `POST /api/auth/signup`, memakai klien superuser. Server sendiri yang menetapkan `role: customer`, `status: active`, `emailVisibility: false`, dan membuat `username` unik dari bagian depan email.
- Kolom `role`/`status` tidak pernah diterima dari browser, jadi tidak ada cara mendaftar sebagai `superadmin`.
- Migration `20261011160000_lock_users_create.js` menutup `createRule` koleksi `users`, sehingga klien anonim tidak bisa membuat baris user langsung lewat REST PocketBase. Login OAuth2 tetap berjalan karena PocketBase membuat record-nya sendiri di sisi server.
- Setelah akun dibuat, frontend langsung login dengan `authWithPassword` supaya pengguna tidak perlu mengisi form dua kali.

## 2. Google dan GitHub (OAuth2 PocketBase)

Google dan GitHub adalah provider OAuth2 bawaan PocketBase. Isi `.env`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Lalu jalankan:

```powershell
npm run setup:oauth
```

Script itu mengaktifkan OAuth2 pada koleksi `users` dan menambahkan provider `google`/`github` yang credential-nya terisi, tanpa menghapus provider lain yang sudah ada. Di akhir, script mencetak redirect URI yang harus didaftarkan:

- Local: `http://127.0.0.1:8090/api/oauth2-redirect`
- Production: `https://YOUR-POCKETBASE-DOMAIN/api/oauth2-redirect`

Buat OAuth client di Google Cloud Console (Authorized redirect URI) dan GitHub OAuth App (Authorization callback URL) memakai URI di atas — bukan URL frontend React.

Beberapa akun GitHub tidak mempublikasikan email. Uji dengan akun yang email-nya privat untuk memastikan perilakunya.

## 3. Telegram (handshake bot, bukan OAuth2)

PocketBase 0.40.4 **tidak** punya provider `telegram` (`Invalid or missing provider with name telegram`). Karena itu Telegram memakai handshake bot:

1. Buka `@BotFather` di Telegram, buat bot, salin tokennya.
2. Isi `.env`:

   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC...
   ```

3. Restart API (`npm run api:dev`). Tombol Telegram otomatis aktif.

Cara kerjanya:

- Browser memanggil `POST /api/auth/telegram/start`. Server membuat kode acak berumur 5 menit dan mengembalikan `https://t.me/<bot>?start=<kode>`.
- Server memanggil `getUpdates` (long poll, `timeout: 20`) hanya selama ada percobaan login yang menunggu, lalu mencocokkan `/start <kode>`.
- Browser menanyakan `GET /api/auth/telegram/poll?code=<kode>` tiap 2 detik. Setelah cocok, server membuat/menemukan user `telegram_<id>@users.lifeplanner.local`, menerbitkan token lewat `impersonate`, dan browser menyimpannya ke `pb.authStore`.

Catatan:

- Akun Telegram tidak punya email sungguhan, jadi alamatnya memakai domain non-routable `@users.lifeplanner.local`. Alamat itu **bukan** mailbox dan tidak bisa menerima reset password. Sarankan Google/GitHub/email untuk akun yang perlu recovery.
- Tanpa `TELEGRAM_BOT_TOKEN`, endpoint `start` menjawab 503 dan tombolnya tampil redup di halaman login.

## 4. Status tombol sosial

Halaman login menanyakan `GET /api/auth/providers` (tanpa autentikasi). Endpoint itu melaporkan `google`, `github`, dan `telegram` mana yang benar-benar siap. Tombol yang belum dikonfigurasi tetap tampil, tapi redup dan memberi pesan jelas saat diklik.

## 5. Production (VPS)

Nilai produksi yang dipakai saat ini:

| Item | Nilai |
| --- | --- |
| Frontend | `https://43.156.236.102/life-planner/` |
| API | `https://43.156.236.102/life-planner-api` |
| PocketBase | `https://43.156.236.102/life-planner-pb` |
| Redirect OAuth (GitHub/Google) | `https://43.156.236.102/life-planner-pb/api/oauth2-redirect` |

File environment API ada di `/etc/life-planner/api.env` (root only, `600`), sudah
berisi slot kosong:

```env
TELEGRAM_BOT_TOKEN=
```

Cara mengisi token Telegram:

```bash
sudo -n nano /etc/life-planner/api.env     # tempel token setelah '='
sudo -n systemctl restart life-planner-api
curl -s https://43.156.236.102/life-planner-api/api/auth/providers
```

Hasil yang diharapkan: `"telegram":true`.

Cara mengisi GitHub (OAuth2, bukan lewat file env VPS):

1. Buka <https://github.com/settings/developers> → **New OAuth App**.
2. Application name: bebas, mis. `Life Planner`.
3. Homepage URL: `https://43.156.236.102/life-planner/`.
4. Authorization callback URL: `https://43.156.236.102/life-planner-pb/api/oauth2-redirect`.
5. Salin **Client ID**, lalu **Generate a new client secret** dan salin secret-nya.
6. Jalankan dari checkout di VPS:

```bash
cd /home/ubuntu/platform-repos/life-planner-saas
PB_URL=http://127.0.0.1:8091 \
GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... \
PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... \
npm run setup:oauth
sudo -n systemctl restart life-planner-api
```

Konfigurasi OAuth disimpan di database PocketBase, jadi tidak hilang saat deploy
berikutnya. Yang perlu diulang hanya bila client ID/secret diganti.

## 6. Catatan account linking

PocketBase dapat menghubungkan provider OAuth dengan akun yang mempunyai email yang sama, tergantung data provider. Uji setiap skenario menggunakan akun test yang terpisah. Jangan pernah mengaktifkan auto-link berbasis email yang tidak diverifikasi oleh provider. Jangan mengubah role menjadi `superadmin` melalui `createData` frontend; hook server memaksa akun baru menjadi `customer`.

> Catatan hook: helper di `pb_hooks/*.pb.js` harus dideklarasikan **di dalam** callback. PocketBase menjalankan setiap handler pada scope-nya sendiri, sehingga fungsi top-level di file hook tidak terlihat dan akan melempar `ReferenceError`.

Referensi resmi:
- PocketBase OAuth2: https://pocketbase.io/docs/authentication/
- PocketBase auth records/reset: https://pocketbase.io/docs/api-records/
- Telegram bot API: https://core.telegram.org/bots/api
