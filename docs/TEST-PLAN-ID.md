# Test plan sebelum undang teman

Gunakan dua customer test (`A`, `B`) dan satu superadmin. Data tiap akun harus benar-benar berbeda.

## Build dan runtime
- [ ] `npm install` selesai, `npm run typecheck` lulus, `npm run build` lulus.
- [ ] PocketBase dan Express aktif; frontend tidak menerima secret backend melalui `VITE_*`.
- [ ] `.env` hanya di folder test, tidak ada kredensial produksi.
- [ ] `npm run audit:pb` sudah direview; semua warning dipahami.

## Auth
- [ ] Login dengan email + password berhasil.
- [ ] Login dengan username + password (bila dipakai) tetap berhasil.
- [ ] Email salah, password salah, status pending/suspended tidak bisa masuk.
- [ ] Reset password email dikirim, link menuju frontend, token valid berhasil dipakai satu kali, token kadaluarsa ditolak.
- [ ] Google OAuth berhasil (akun baru dan lama).
- [ ] GitHub OAuth berhasil (email publik dan privat jika sesuai setup).
- [ ] Telegram OIDC berhasil dengan `openid profile`; record tanpa email terlihat sebagai placeholder non-routable, tidak mencoba password reset lewat placeholder.
- [ ] OAuth baru tidak dapat memilih role `superadmin` dari browser.
- [ ] Periksa account linking dengan hati-hati; akun provider yang belum diverifikasi tidak boleh mengambil alih akun email yang ada.

## Account isolation
- [ ] A tidak dapat list/read/update/delete record milik B lewat UI.
- [ ] Ulangi secara langsung via API dengan mengganti record ID dan body `user`.
- [ ] Customer tidak dapat update field `role`, `status`, `verified`, atau hak admin.
- [ ] A tidak dapat mereferensikan bank account/pet/trip milik B pada expense ingestion.
- [ ] Admin endpoint ditolak untuk bearer token customer dan diterima untuk superadmin.

## Modul UI
- [ ] Dashboard statistics sesuai source records dan empty state saat dataset kosong.
- [ ] Finance: Income/Expense, filter month, search, CRUD, rekening, kategori dan pet.
- [ ] Bank Accounts: `status` satu nilai, balance zero, account number masked.
- [ ] Planner: filter Today/Upcoming/Inbox/Board, task create/edit/delete/toggle, drag/drop sukses, rollback jika API gagal.
- [ ] Calendar: tanggal/timezone dan mobile layout.
- [ ] Goals: `current_amount=0`, contribution, progress, pause/complete.
- [ ] Pets: beberapa profil, foto, edit/delete.
- [ ] Travel/Experiences: date range, budget, itinerary, costs.
- [ ] Portfolio: watchlist/portfolio dan indikasi data harga real-time vs data manual.
- [ ] Admin: search, refresh, create/edit, suspend/activate, delete confirmation.
- [ ] Settings: change password, verification email, export data, device token create/revoke.

## iOS Shortcut
- [ ] Token dibuat untuk perangkat khusus, lalu dipasang pada header `X-Shortcut-Token`.
- [ ] Shortcut tidak menyertakan `user_id`, password, atau server master key.
- [ ] Setelah transaksi test, `Last used` berubah dan expense muncul hanya di akun pemilik token.
- [ ] Token dicabut; request berikutnya mendapat 401/403.
- [ ] Token kadaluwarsa ditolak.

## Final gate
Jangan undang tester sebelum build lulus, `audit:pb` direview, SMTP dites, OAuth callback cocok, backup database dibuat, dan dua-user isolation terbukti baik melalui UI **dan** request API langsung.


## Market quotes (optional provider)

- Without `MARKET_DATA_API_KEY`, Portfolio displays “Price unavailable” and does not invent prices.
- With the backend key and `VITE_MARKET_DATA_ENABLED=true`, try a valid symbol, an unsupported symbol, and more than 15 symbols. Ensure the latter returns a validation error and provider secrets never appear in browser devtools/network requests.
- Check that unauthenticated requests receive 401, provider timeouts/errors do not leak upstream payloads, and quote results refresh after cache expiry.
