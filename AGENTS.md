# AGENTS — Absensi Karyawan
Web app absensi karyawan, HTML/CSS/JS murni tanpa build. Data di localStorage (`absensiKaryawan.v1`), selfie di IndexedDB (`absensiKaryawanFoto`). Panduan lengkap: `.claude/skills/ubah-absensi-karyawan/SKILL.md`. Sistem desain: `DESIGN.md` — wajib dijaga: token tema, warna status semantik, kontras AA terang & gelap, fokus terlihat, target ≥44px, responsif 390px–desktop tanpa geser, reduced-motion.
- `index.html` kerangka & 6 halaman + kiosk + dialog, `style.css` gaya, `app.js` logika, `tema.css`/`tema.js` token customizer, `sw.js`/`manifest.json` PWA.
- Field data baru → `dataKosong()` + migrasi di `muat()`; jangan hapus data pengguna. Ubah berkas → naikkan `VERSI` di `sw.js`.

