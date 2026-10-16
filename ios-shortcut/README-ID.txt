LIFE PLANNER — SHORTCUT iPHONE (v2)
===================================

Isi folder ini
--------------
1. Life Planner Expense.shortcut           -> file siap pakai (sudah ditandatangani)
2. Life Planner Expense.unsigned.shortcut  -> sumber yang bisa diedit
3. sign_life_planner_shortcut.py           -> menandatangani ulang lewat HubSign
4. Sign Shortcut on Windows.bat            -> jalan pintas script di atas (Windows)
5. README-ID.txt                           -> dokumen ini

Yang berubah di versi ini
-------------------------
- Saat dipasang, Shortcut menanyakan dua hal: Server URL dan Life Planner token.
  Tidak ada lagi token atau alamat server yang ditulis manual di dalam Shortcut.
- Header yang dipakai sudah benar: X-Shortcut-Token (bukan Authorization).
- Payload hanya berisi data pengeluaran. Tidak ada user_id atau kunci pengembangan.
- Field source otomatis diisi "shortcut".

Langkah pemasangan (sekali saja)
--------------------------------
1. Jalankan aplikasi: npm run dev:all (PocketBase, API, dan web).
2. Buka web app, masuk, lalu buka menu "Integrated to your device".
3. Salin dua nilai di halaman itu: Server URL dan Device token.
   Server URL default memakai http://127.0.0.1:3001 — ganti bagian host
   menjadi alamat LAN komputer, contoh http://192.168.1.10:3001/api/expense-ingestions
4. Kirim file "Life Planner Expense.shortcut" ke iPhone (AirDrop, iCloud Drive,
   atau email), lalu buka filenya. iOS akan membuka aplikasi Shortcuts.
5. Tekan "Add Shortcut" / "Add Anyway" kalau muncul peringatan sumber tidak dikenal.
6. Saat import, Shortcut meminta:
   - Life Planner server URL  -> tempel Server URL dari langkah 3
   - Life Planner token       -> tempel Device token dari langkah 3
7. Selesai. Jalankan Shortcut: isi Amount, pilih Category, isi Merchant,
   isi Notes (boleh dikosongkan), lalu data terkirim ke Life Planner.

Syarat jaringan
---------------
iPhone hanya bisa menjangkau API kalau:
- iPhone dan komputer berada di jaringan Wi-Fi yang sama, dan
- Server URL memakai IP LAN komputer (bukan 127.0.0.1), dan
- Windows Firewall mengizinkan port 3001 (dan 8090 untuk PocketBase).

Cek cepat dari browser iPhone: buka http://IP-LAN:3001/api/health — kalau
muncul balasan JSON, berarti iPhone sudah bisa menjangkau API.

Kalau ada yang perlu diubah manual
----------------------------------
Buka Shortcut di aplikasi Shortcuts, lalu:
- Action "Text" paling atas  -> isi token (dipakai untuk header X-Shortcut-Token)
- Action "Get Contents of URL" -> URL dan header X-Shortcut-Token

Menandatangani ulang setelah mengedit
-------------------------------------
Setelah mengubah "Life Planner Expense.unsigned.shortcut", jalankan:

    python sign_life_planner_shortcut.py

atau klik dua kali "Sign Shortcut on Windows.bat". Hasilnya menimpa
"Life Planner Expense.shortcut".

Catatan keamanan
----------------
Token perangkat hanya ditampilkan sekali di web app (yang tersimpan di server
hanya hash-nya). Token bisa dipakai untuk menambah pengeluaran, jadi jangan
dibagikan. Membuat token baru di halaman "Integrated to your device" langsung
mematikan token lama.
