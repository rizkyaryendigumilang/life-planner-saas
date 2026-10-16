# Security dan database

## Account isolation (satu pengguna hanya melihat datanya sendiri)

Frontend filter bukan batas keamanan. Semua koleksi pribadi perlu menjalankan ownership filter pada aturan PocketBase di server:

- `listRule`/`viewRule`: hanya record milik `@request.auth.id`.
- `createRule`: user pada request harus `@request.auth.id`.
- `updateRule`/`deleteRule`: record yang tersimpan harus milik user terautentikasi.
- Guard status akun membatasi akses kepada `status = active`.
- Nested records seperti `itinerary_items` dan `experience_expenses` harus mengikuti kepemilikan parent relation.

Jalankan `npm run audit:pb` dan baca semua WARN. Null rule umumnya berarti koleksi hanya tersedia untuk superuser; itu melindungi data tetapi bisa membuat UI customer tidak bisa mengakses koleksi. Empty string adalah rule public dan harus diperiksa sebelum tester diundang.

## Migration tambahan

1. `20261010180000_enforce_active_user_status.js`: menambah/mengatur status dan memasang guard aktif, bergantung pada migration yang sudah diterapkan.
2. `20261011120000_create_shortcut_tokens.js`: penyimpanan token perangkat Shortcut dengan rules superuser-only.
3. `20261011130000_harden_users_auth.js`: memperbarui password identity ke email + username dan memperkuat guard status. Ini dibuat karena mengedit migration lama yang sudah diproses tidak akan menjalankannya lagi.
4. `20261011140000_fix_bank_status_and_indexes.js`: meratakan status rekening lama yang multiselect ke nilai tunggal, lalu menambah index query jika field tersedia.

Selalu backup folder `pb_data` dan gunakan database salinan untuk testing migration. Jangan menghapus migration lama atau menulis ulang timestamp migration yang sudah dipakai di database utama.

## Secret management

- Jangan menempatkan PocketBase superuser credential, OAuth client secret, atau admin key di `VITE_*`.
- Backend hanya memegang superuser credential di `.env`.
- Jangan commit `.env` atau `pb_data` ke Git.
- Admin REST route memeriksa bearer token pengguna dan role server-side.
- `shortcut_tokens` hanya menyimpan hash SHA-256 token. Token mentah ditampilkan sekali dan harus dicabut bila iPhone hilang.
- Token Shortcut bukan token admin dan hanya diterima untuk expense ingestion.
- Rate limiter yang disertakan menggunakan memori satu instance. Untuk multi-instance production, pakai shared store seperti Redis dan reverse proxy.
- Gunakan HTTPS, SMTP yang valid, backup terenkripsi, dan firewall saat hosting di internet.

## Status account

- `active`: boleh login.
- `pending`: menunggu admin.
- `suspended`: akses diblokir.

Buat admin pertama melalui setup tepercaya PocketBase. Jangan mempromosikan pengguna melalui request frontend. Role customer dipaksakan server-side pada pembuatan akun OAuth.
