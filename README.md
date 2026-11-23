# Absensi Karyawan (Laravel 12 + SQL Database)

Aplikasi web absensi karyawan yang dirancang untuk UMKM, toko, dan kantor kecil. Sekarang telah di-upgrade menggunakan backend **Laravel 12** dan **SQL Database (SQLite / MySQL)** agar data tersinkronisasi antar perangkat (HP karyawan, Tablet Kiosk, dan Laptop Admin) secara aman dan anti-manipulasi.

---

## Fitur Utama

- **Absensi Multi-Perangkat:** Karyawan dapat absen dari HP masing-masing atau melalui **Mode Kiosk** (tablet kantor).
- **Validasi Server-Side:**
  - Waktu absensi mengacu pada jam server hosting (mencegah manipulasi waktu perangkat).
  - Validasi radius kantor (**Geofencing GPS**) dihitung langsung di backend.
  - Foto selfie absensi disimpan otomatis di storage server (`storage/app/public/selfie/`).
- **Pengaturan Jam Kerja & Shift:** Dukungan multi-shift (Pagi, Siang, Malam) dengan toleransi keterlambatan.
- **Rekap Kehadiran & Perkiraan Gaji:**
  - Perhitungan otomatis kehadiran, keterlambatan, alpa, dan lembur.
  - Simulasi tunjangan (uang makan, lembur) dan potongan (telat, alpa).
  - Ekspor laporan ke **CSV / Excel**.
- **Pengajuan Izin / Sakit / Cuti:** Karyawan dapat mengajukan izin lengkap dengan alasan dan foto surat dokter; admin dapat menyetujui atau menolak.
- **Desain Responsif & PWA:** Mendukung tema Terang/Gelap, responsif di HP (390px) hingga monitor desktop, serta dapat dipasang di layar utama perangkat.

---

## Persyaratan Sistem

- PHP >= 8.2
- Ekstensi PHP: `pdo_sqlite`, `pdo_mysql`, `mbstring`, `fileinfo`, `openssl`, `curl`
- Composer 2.x
- Database: **SQLite** (bawaan lokal) atau **MySQL / MariaDB** (rekomendasi hosting)

---

## Cara Menjalankan di Lokal

1. **Jalankan Migration & Seeder (jika baru pertama kali):**
   ```bash
   php artisan migrate --seed
   ```
   *Data awal akan berisi 9 contoh karyawan, 3 shift, dan akun admin default.*

2. **Pastikan Symlink Storage Aktif:**
   ```bash
   php artisan storage:link
   ```

3. **Jalankan Server Lokal:**
   ```bash
   php artisan serve --port=8000
   ```
   Buka di browser: `http://localhost:8000`

---

## Konfigurasi Database (Pindah ke MySQL untuk Hosting)

Untuk menghubungkan ke MySQL (misal di cPanel / VPS / XAMPP):

1. Buat database baru di phpMyAdmin atau MySQL CLI:
   ```sql
   CREATE DATABASE absensi_karyawan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Buka berkas `.env`, ubah bagian database:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=absensi_karyawan
   DB_USERNAME=root
   DB_PASSWORD=
   ```
3. Jalankan migrasi:
   ```bash
   php artisan migrate --seed
   ```

---

## Panduan Hosting

### Pilihan A: Shared Hosting (cPanel)
1. Unggah seluruh folder proyek ke direktori **di luar `public_html`** (misal `/home/user/absensi/`).
2. Pindahkan seluruh isi folder `public/` ke dalam folder `public_html/`.
3. Buka `public_html/index.php`, sesuaikan path bootstrap:
   ```php
   require __DIR__.'/../absensi/vendor/autoload.php';
   $app = require_once __DIR__.'/../absensi/bootstrap/app.php';
   ```
4. Sesuaikan `.env` dengan kredensial database MySQL hosting Anda.
5. Jalankan `php artisan storage:link` atau buat symlink dari cPanel Terminal.

### Pilihan B: Cloud VPS (Ubuntu / Debian / aaPanel / CloudPanel)
1. Clone repositori ke server VPS Anda (`/var/www/absensi`).
2. Pasang dependensi: `composer install --no-dev --optimize-autoloader`.
3. Salin `.env.example` ke `.env` lalu set `APP_ENV=production` dan `APP_DEBUG=false`.
4. Jalankan `php artisan key:generate` dan `php artisan migrate --seed --force`.
5. Arahkan root Nginx/Apache ke folder `/var/www/absensi/public`.

---
