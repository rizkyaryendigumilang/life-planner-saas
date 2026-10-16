# Panduan Otomasi Build Mobile (.apk & .ipa) ke VPS

Skema ini memungkinkan Anda mem-build **`.apk` (Android)** dan **`.ipa` (iOS)** secara otomatis di cloud menggunakan **GitHub Actions**, lalu mengirimkan file hasilnya langsung ke **VPS** Anda melalui SSH/SCP.

---

## 1. Setup GitHub Repository Secrets

Agar GitHub Actions bisa mengirim file ke VPS Anda, tambahkan rahasia (*Secrets*) berikut di GitHub:
Buka: **GitHub Repo Anda** > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.

Tambahkan 4 variabel ini:

| Secret Name | Contoh Nilai | Keterangan |
| :--- | :--- | :--- |
| `VPS_HOST` | `103.xxx.xxx.xxx` atau `domain-anda.com` | IP Address atau domain server VPS Anda |
| `VPS_USERNAME` | `root` atau `ubuntu` | User SSH VPS Anda |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY----- ...` | Private SSH Key untuk login ke VPS Anda (tanpa password) |
| `VPS_PORT` | `22` *(opsional, default 22)* | Port SSH VPS jika bukan port 22 |
| `VPS_TARGET_DIR` | `/var/www/downloads` | Folder di VPS tempat menyimpan file APK & IPA |

> **Catatan Keamanan:** Gunakan SSH Key (bukan password biasa). Pastikan user VPS memiliki hak tulis (*write permission*) ke folder `VPS_TARGET_DIR`.

---

## 2. Setup Folder Download di VPS (Nginx)

Di terminal VPS Anda, siapkan folder untuk menampung file installer:

```bash
# Buat folder penyimpanan
sudo mkdir -p /var/www/downloads

# Beri hak akses agar user bisa menulis file via SCP
sudo chown -R $USER:$USER /var/www/downloads
sudo chmod -R 755 /var/www/downloads
```

Jika Anda menggunakan Nginx, Anda bisa membuat link download statis dengan menambahkan blok ini ke konfigurasi Nginx situs Anda:

```nginx
location /downloads/ {
    alias /var/www/downloads/;
    autoindex on; # Opsional: menampilkan daftar file jika dibuka di browser
}
```

Setelah Nginx di-*reload*, file installer bisa langsung diunduh lewat:
- `https://domain-anda.com/downloads/app-latest.apk`
- `https://domain-anda.com/downloads/app-latest.ipa`

---

## 3. Cara Menjalankan Build

### Opsi 1: Otomatis Setiap Push
Setiap kali Anda menjalankan:
```bash
git add .
git commit -m "update app"
git push origin main
```
GitHub Actions akan otomatis mulai mem-build Android dan iOS secara paralel.

### Opsi 2: Manual Trigger dari GitHub
1. Buka repo Anda di GitHub.
2. Klik tab **Actions**.
3. Pilih workflow **"Build Mobile Apps (APK & IPA) and Sync to VPS"** di sebelah kiri.
4. Klik tombol **Run workflow** > pilih branch `main` > klik **Run workflow**.

---

## 4. Cara Download File Hasil Build

1. **Dari VPS Anda:**
   Buka URL download domain Anda di browser atau HP.
2. **Dari Halaman GitHub Actions Langsung:**
   Jika Anda belum memasang konfigurasi VPS, GitHub Actions tetap mengunggah kedua file ke tab **Summary / Artifacts** di halaman detail build. Anda bisa langsung men-download zip-nya dari sana.

---

## 5. Cara Install ke HP

### Android (`.apk`):
1. Download file `app-latest.apk` di HP Android.
2. Buka file dan pilih **Install** (izinkan *Install from unknown sources* jika diminta).

### iOS (`.ipa`):
Karena file `.ipa` ini dihasilkan tanpa sertifikat akun berbayar (*unsigned*):
1. Download file `app-latest.ipa` ke laptop Windows Anda.
2. Gunakan aplikasi gratis **Sideloadly** (https://sideloadly.io) atau **AltStore**.
3. Sambungkan iPhone ke laptop Windows via kabel USB.
4. Drag & drop file `.ipa` ke Sideloadly, masukkan Apple ID Anda, dan klik **Start**.
5. Aplikasi akan terinstal langsung di layar iPhone Anda!
