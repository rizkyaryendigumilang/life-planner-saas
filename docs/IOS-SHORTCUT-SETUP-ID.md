# Setup iOS Shortcut — Life Planner Expense

Shortcut ini mengambil nominal, kategori, merchant dan notes, kemudian mengirim transaksi ke Express API menggunakan token khusus perangkat. Request tidak mengandung `user_id`; server menentukan pemilik transaksi berdasarkan token perangkat.

## A. Buat token perangkat

1. Login ke Life Planner menggunakan akun yang akan menerima transaksi.
2. Buka Settings → iOS Shortcut integration.
3. Beri nama perangkat (contoh `iPhone pribadi`) lalu pilih **Create device token**.
4. Salin token yang muncul. Token hanya ditampilkan sekali. Jangan commit token atau mengirim file Shortcut berisi token melalui grup.

## B. Dapatkan IP LAN PC (khusus pengembangan)

1. Di Windows jalankan `ipconfig`.
2. Cari IPv4 Address adapter Wi-Fi/Ethernet yang terhubung ke jaringan yang sama dengan iPhone (contoh `192.168.1.10`). Hindari IP VPN/virtual adapter.
3. Di `.env`, backend set `API_HOST=0.0.0.0`. Restart Express API. Izinkan inbound TCP port 3001 di Windows Firewall hanya pada Private network bila diperlukan.
4. Di Settings → iOS Shortcut integration, masukkan `http://192.168.1.10:3001` (ganti dengan IP milik PC). Salin endpoint. Jangan gunakan `127.0.0.1`/`localhost` dari iPhone.
5. iPhone dan PC harus berada pada LAN yang saling terhubung. Jangan port-forward API development ke internet.

## C. Buat file signed untuk iPhone

`ios-shortcut/Life Planner Expense.unsigned.shortcut` adalah template plist yang sudah diubah agar tidak mengirim user ID dan tidak menyimpan kunci API bersama. iOS biasanya memerlukan file Shortcut yang valid/ditandatangani untuk import. Karena proses signing memerlukan internet yang tidak tersedia pada lingkungan pembuatan paket, hasil signed final tidak disertakan.

Di komputer Windows dengan Python 3 dan internet:

1. Buka folder `ios-shortcut` di paket.
2. Jalankan `Sign Shortcut on Windows.bat`.
3. Script akan mengirim **template shortcut tanpa token akun** ke layanan signing pihak ketiga HubSign/RoutineHub dan menyimpan `Life Planner Expense.shortcut`. Tinjau dan putuskan sendiri apakah kamu percaya layanan tersebut; script bukan bagian dari Apple. Jika tidak nyaman menggunakan layanan pihak ketiga, import/rekonstruksi workflow secara manual di aplikasi Shortcuts.
4. Buka file signed di iPhone dan pilih Add Shortcut.

## D. Isi URL dan token di action

Sesudah import, buka editor Shortcut dan pilih action `Get Contents of URL`:

- URL: endpoint yang disalin dari Settings (`http://IP-PC:3001/api/expense-ingestions`) untuk LAN, atau domain HTTPS API saat production.
- Method: POST.
- Header `X-Shortcut-Token`: paste token yang dibuat di Settings.
- Header `Content-Type`: `application/json`.
- JSON body berisi `external_id`, `amount`, `category`, `date`, `type`, `merchant`, `notes`, dan `source=shortcut`. Jangan tambahkan `user_id`.

## E. Verifikasi

1. Jalankan Shortcut dengan transaksi kecil/dummy.
2. Pastikan masuk pada akun user yang membuat token saja.
3. Cek daftar perangkat di Settings, kolom `Last used` akan berubah.
4. Pilih Revoke untuk memastikan token yang dicabut gagal mengirim transaksi.

## Catatan

- HTTP hanya untuk jaringan lokal terpercaya selama development; production harus HTTPS.
- Bila IP PC berubah, perbarui URL di Shortcut.
- Jangan memakai file Shortcut lama yang menyimpan `Bearer lp_expense_dev_...` atau `user_id` hardcoded. File lama harus dihapus dari perangkat setelah migrasi.
