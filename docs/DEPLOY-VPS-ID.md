# Deploy Otomatis: GitHub Actions → VPS

Dokumen ini menjelaskan alur deploy yang dipakai repository ini: satu `push` ke
`main` mengirim **frontend** dan **backend** ke VPS, lalu menyalakan ulang
service dengan aman.

## 1. Apa yang terjadi saat push ke `main`

Workflow `.github/workflows/ci-cd-web-vps.yml` menjalankan tiga job berurutan:

| Job | Isi |
| --- | --- |
| `build` | `npm ci`, `npm test`, `npm run typecheck`, build dengan `--base=/life-planner/`, lalu memeriksa prefix path di `dist/index.html`. |
| `deploy-production` | Mengirim `dist/` ke `/srv/www/life-planner` secara atomik (backup + rollback), lalu health check HTTPS. |
| `deploy-backend` | Mengirim `server/`, `pocketbase/pb_hooks/`, `pocketbase/pb_migrations/`, `scripts/`, `package.json`, `package-lock.json`, menginstal dependency bila lock berubah, menyalakan ulang PocketBase lalu API, lalu health check publik. |

`npm test` bukan lagi sekadar cek sintaks: `scripts/smoke-api.mjs` benar-benar
menjalankan server dengan kredensial dummy dan menunggu `/api/health`. Ini
menangkap error yang lolos `node --check`, misalnya variabel yang belum
dideklarasikan atau pola route Express 5 yang tidak valid.

## 2. Yang perlu diisi sekali di GitHub

**Settings → Secrets and variables → Actions**

Secrets:

| Nama | Keterangan |
| --- | --- |
| `VPS_HOST` | IP atau domain VPS. |
| `VPS_USERNAME` | User SSH, bukan `root` (workflow menolak `root`). |
| `VPS_SSH_KEY` | Private key SSH untuk user tersebut. |
| `VPS_SSH_KNOWN_HOSTS` | Isi `known_hosts` untuk host VPS; dipakai agar koneksi strict. |
| `VPS_PORT` | Opsional, default `22`. |

Variables (opsional, kalau nilainya berbeda dari default):

| Nama | Default |
| --- | --- |
| `VITE_API_BASE_URL` | `https://43.156.236.102/life-planner-api` |
| `VITE_POCKETBASE_URL` | `https://43.156.236.102/life-planner-pb` |
| `VPS_WEB_ROOT` | `/srv/www/life-planner` |
| `VPS_BACKEND_DIR` | `/home/ubuntu/platform-repos/life-planner-saas` |

`VPS_BACKEND_DIR` harus berada di bawah `/home/ubuntu`; job backend menolak
path lain supaya tidak salah menimpa direktori.

## 3. Layout VPS yang diasumsikan

Alur ini mengikuti kondisi server saat ini:

```text
/home/ubuntu/platform-repos/life-planner-saas   # checkout kode backend
  server/index.mjs
  pocketbase/pb_hooks/
  pocketbase/pb_migrations/
/etc/life-planner/api.env                       # environment API (root only)
/srv/life-planner/pb_data                       # database PocketBase
/srv/www/life-planner                           # hasil build frontend
```

Service systemd:

- `life-planner-pocketbase.service` → `127.0.0.1:8091`, membaca migration dan
  hooks langsung dari folder repo di atas.
- `life-planner-api.service` → `127.0.0.1:3001`, `Requires=` PocketBase.

Caddy memetakan `/life-planner-api/*` → `3001`, `/life-planner-pb/*` → `8091`,
dan `/life-planner/*` → `/srv/www/life-planner`.

## 4. Cara job backend bekerja

1. **Backup** `server/`, `pb_hooks/`, `pb_migrations/`, `scripts/` menjadi
   `~/.deploy-life-planner-backend/backend-<waktu>.tar.gz`, plus salinan
   `data.db` PocketBase.
2. **Ganti kode** `server/`, `scripts/`, `pb_hooks/` dengan versi baru.
3. **Gabung migration tanpa duplikasi.** File migration yang belum ada
   disalin; file yang isinya identik dengan migration yang sudah ada (walau
   namanya berbeda) dilewati. File lama **tidak pernah dihapus atau diganti
   nama**, karena PocketBase mencatat migration yang sudah jalan berdasarkan
   nama file — rename akan membuat migration dijalankan ulang dan gagal.
4. **Install dependency** hanya kalau `package-lock.json` berubah.
5. **Restart PocketBase** (menerapkan migration), tunggu `/api/health` di port
   8091, lalu **restart API** dan tunggu `/api/health` di port 3001, kemudian
   pastikan `/api/auth/providers` merespons.
6. Kalau salah satu langkah gagal, trap otomatis mengembalikan file lama,
   menghapus migration baru yang belum sempat dipakai, dan menyalakan ulang
   service. Backup terbaru disimpan 5 buah.
7. Setelah itu job memeriksa endpoint publik lewat HTTPS.

Deploy bersifat **forward-only**: migration yang sudah pernah dijalankan jangan
diubah isinya. Tambahkan file migration baru dengan timestamp lebih besar.

## 5. Konfigurasi setelah deploy pertama

Di VPS, isi `/etc/life-planner/api.env` (root only) sesuai kebutuhan:

```bash
sudo -n nano /etc/life-planner/api.env
```

- `TELEGRAM_BOT_TOKEN` — wajib untuk tombol Telegram. Tanpa ini
  `POST /api/auth/telegram/start` menjawab 503 dan tombol tampil redup.
- `PUBLIC_BASE` — opsional, alamat publik API; dipakai untuk mengizinkan
  origin dan membentuk URL feed kalender.

Lalu:

```bash
sudo systemctl restart life-planner-api
```

Untuk Google/GitHub, jalankan `npm run setup:oauth` dari checkout di VPS dengan
`PB_URL=http://127.0.0.1:8091` dan kredensial OAuth terisi di `.env` lokal
checkout tersebut. Cek hasilnya:

```bash
curl -s https://<host>/life-planner-api/api/auth/providers
```

## 6. Cek cepat bila deploy bermasalah

```bash
systemctl is-active life-planner-pocketbase life-planner-api
sudo journalctl -u life-planner-pocketbase -n 50 --no-pager
sudo journalctl -u life-planner-api -n 50 --no-pager
ls -1t ~/.deploy-life-planner-backend/ | head
```

Jika PocketBase gagal start karena migration, pesan di journal menyebut nama
file migration-nya. Pulihkan file lama dari arsip backup di
`~/.deploy-life-planner-backend/`, lalu restart kedua service.
