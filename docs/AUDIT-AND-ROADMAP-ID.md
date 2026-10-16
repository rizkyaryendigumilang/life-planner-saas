# Audit gabungan UI/UX + fitur + security + database

Status di bawah adalah hasil audit source snapshot dan rekomendasi. Tampilan browser, state database lokal, dan kredensial OAuth belum bisa diverifikasi hanya dari source. Temuan yang diberi label "perlu live verify" tidak berarti bug tersebut pasti terjadi pada deployment.

## Yang diterapkan pada paket ini

- Login: email/username identity, forgot/reset password flow, provider Google/GitHub/Telegram (memerlukan konfigurasi PocketBase), generic OIDC scope yang sesuai untuk Telegram.
- Server auth: role/status pelanggan dipaksa di PocketBase hook; status missing fail-closed pada App; active-status rule di migration.
- Database: migration identity auth, status bank account scalar, token per-perangkat, dan indexing dasar.
- Shortcut: token scoped dengan hash, expiry, last-used dan revoke; `user_id` dihilangkan dari request; API bind ke LAN untuk pengembangan.
- UI: light visual system dengan permukaan putih, aksen lembut, sidebar responsif, active navigation, route search `Ctrl+K`, dan loading/error/rollback saat Planner gagal menyimpan task.
- Privacy: log debug yang mencetak ID/email/daftar transaksi di Finance dihapus.
- Settings: export data dan panel manajemen Shortcut device.

## Area yang harus diperiksa secara visual/interaksi

### Dashboard dan layout
- Urutan statistik dan aktivitas harus menjawab apa yang paling penting hari ini; hindari kartu dekoratif tanpa makna.
- Pastikan search `Ctrl+K`, nav mobile, active state, empty/loading/error state berfungsi.
- Pastikan header tidak punya tombol dekoratif yang mengarah ke halaman yang tidak terkait.

### Finance dan Bank Accounts
- Grafik dan agregat harus mengikuti filter periode dan tipe Income/Expense.
- Empty state ketika transaksi/akun belum ada.
- Jangan tampilkan nomor rekening lengkap jika hanya perlu 4 digit terakhir.
- Validasi jumlah Rp 0, nomor rekening opsional, status Active/Inactive, serta link transaksi ke rekening milik user yang sama.
- Pastikan saldo tidak disebut sebagai saldo bank aktual jika hanya nilai manual yang dicatat.

### Planner dan Calendar
- Pastikan status Inbox/To-Do/In Progress/Done, priority, due date, search dan board filters berfungsi.
- Drop task harus rollback ke status awal jika API gagal; tanggal selesai tidak boleh tetap muncul di filter Today/Upcoming.
- Periksa kalender di zona waktu Asia/Jakarta dan pada layar sempit.

### Goals, Pets, Travel, Experiences
- Goals harus bisa dibuat dengan `current_amount = 0`; progress harus dibatasi/ditampilkan dengan benar.
- Pets perlu multi-profile/foto; validasi file, ukuran, dan fallback saat foto kosong.
- Trip start/end date, budget/actual, experiences itinerary dan expenses harus mengacu pada owner yang sama.
- Empty state, loading, edit, delete-confirmation, error feedback untuk setiap modul.

### Admin & shared components
- Search/filter/pagination, create/edit/delete user, status pending/active/suspended, generated credentials, dan self-delete protection.
- Hanya admin dapat menambah/mengubah role/status; test dengan customer yang memodifikasi request.
- Modal keyboard/close/Escape, accessible labels, focus, toast dan error messages.

## Ide tambahan yang direkomendasikan

1. Account Security: kelola provider tertaut, sesi dan device token; MFA/OTP opsional setelah email domain dikonfigurasi.
2. Privacy Dashboard: indikator akun terverifikasi, status keamanan, export data, dan permintaan penghapusan akun dengan re-auth.
3. Finance: budget bulanan per kategori, transaksi berulang, deteksi duplikat impor, bukti struk, dan reconciliation saldo manual.
4. Planner: recurring tasks yang sesungguhnya (bukan hanya label), saved filters, bulk actions, dan task overdue summary.
5. Goals: milestone/sub-goals, progress history, contribution log dan forecast sederhana.
6. Pets: jadwal vaksin/grooming/obat dengan reminder, file lampiran, dan riwayat biaya.
7. Travel: checklist packing, booking documents, itinerary item timeline, dan trip expenses.
8. Admin: invite-only tester onboarding, audit log admin, per-user last login, export laporan admin, dan rate-limit dashboard.
9. QA/operations: automated tests untuk dua-user isolation, backup/restore drill, SMTP test, provider smoke tests, uptime/health endpoint dan error monitoring tanpa data sensitif.

## Pekerjaan yang belum dianggap selesai

- Visual regression/tes manual di browser terhadap seluruh halaman.
- Validasi schema/rules pada database lokal lewat `npm run audit:pb`.
- End-to-end login Google/GitHub/Telegram dengan credential milik pengguna.
- Pengiriman email reset melalui SMTP dan URL callback production.
- Build TypeScript/Vite penuh bila dependensi npm tersedia.
- Import file Shortcut signed ke iPhone; template disediakan, tetapi signed final memerlukan signing step lokal.


## Portfolio / market data correction

The quote path is now implemented at the Express API (`/api/market-quotes`). It requires an active user session, uses the `MARKET_DATA_API_KEY` backend variable with Twelve Data, accepts a maximum of 15 validated symbols per request, uses an eight-second timeout and a 60-second in-memory cache, and deliberately returns “unavailable” rather than generating sample/current-looking prices when no verified quote is returned. The API key must never be put in a `VITE_` variable. Portfolio quote lookup now uses a consistent uppercase-symbol key. Provider coverage, symbol formats, plan quota and live/EOD classification still need validation against a real Twelve Data account. Official documentation: https://twelvedata.com/docs
