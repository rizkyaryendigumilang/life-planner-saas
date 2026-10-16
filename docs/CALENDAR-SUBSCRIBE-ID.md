# Subscribe kalender ke iPhone / device

Ada dua alamat yang bisa dipakai, dan halaman **Calendar** di aplikasi selalu menampilkan yang benar beserta badge **Internet** atau **LAN only**.

## 1. Di rumah saja (LAN)

API sudah listen di `0.0.0.0:3001`, jadi iPhone di Wi-Fi yang sama bisa memakai `http://<IP-LAN>:3001/api/calendar.ics`. Aplikasi mengambil IP-nya dari `GET /api/network-info`, bukan menebak.

Syarat: iPhone dan komputer di jaringan yang sama, dan firewall Windows mengizinkan port 3001 untuk jaringan privat.

## 2. Dari jaringan mana pun (Cloudflare Tunnel)

1. Pasang tunnel helper:

   ```powershell
   winget install --id Cloudflare.cloudflared
   ```

2. Jalankan:

   ```powershell
   npm run tunnel
   ```

   Script membuka quick tunnel ke `http://127.0.0.1:3001`, menangkap alamat `https://*.trycloudflare.com`, lalu menuliskannya ke `.runtime/public-base.json`.

3. Buka halaman Calendar. Badge berubah menjadi **Internet** dan URL subscribe otomatis memakai alamat publik itu. Tempel URL tersebut di iPhone:

   Settings → Apps → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar

4. Biarkan terminal tunnel tetap terbuka selama feed dipakai. Tekan Ctrl+C untuk menutup; script menghapus `.runtime/public-base.json` dan aplikasi kembali ke alamat LAN.

Catatan:

- Quick tunnel memakai hostname acak yang berganti setiap kali dijalankan, jadi ulangi langkah 3 kalau tunnel di-restart.
- Sementara tunnel hidup, API terbuka ke internet pada hostname itu. Semua endpoint tetap memerlukan token; kalau tidak dipakai, matikan tunnelnya.
- Alamat publik bisa juga diisi manual lewat `POST /api/public-base` (butuh login). Nilai kosong menghapusnya, nilai yang bukan `http://`/`https://` ditolak dengan 400.

## Autentikasi feed

- `GET /api/calendar.ics` menerima Bearer token sesi aplikasi, atau `?token=<shortcut-token>`.
- iPhone tidak bisa mengirim header, jadi pakai URL berisi `?token=...`. Buat token di halaman Settings/Device lalu tempel ke URL.
- Tanpa token, feed menjawab 401.

## Isi feed

- `Task:` dari `life_planner` (`due_date`), `Trip:` dari `travel_trips` (`start_date`–`end_date`), `Goal:` dari `goals` (`target_date`), `Experience:` dari `experiences` (`start_date`–`end_date`).
- Pengeluaran tidak dimasukkan karena bukan kejadian kalender.
- Ringkasan memakai prefix huruf biasa, tanpa emoji, supaya aman di semua klien kalender.