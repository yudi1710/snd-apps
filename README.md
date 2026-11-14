# SND Apps (PWA)

Workspace tim Supply & Demand Otoklix. Frontend statis di GitHub Pages (bisa di-install di Android/iPhone),
backend data di Google Apps Script (repo `SupplyDemandApps`). Masuk dengan akun Google `@otoklix.com`.

## Struktur

| File | Isi |
|---|---|
| `index.html` | Kerangka: sidebar (desktop), appbar + bottom nav (mobile), layar masuk, bottom sheet, toast |
| `css/app.css` | Design system warna Otoklix, mobile-first |
| `js/config.js` | URL API Apps Script, Client ID Google, domain yang diizinkan |
| `js/app.js` | Inti: login Google (GIS), `App.api()` ke Apps Script, navigasi, toast, sheet, helper |
| `js/page-monitoring.js` | Fitur **Monitoring MRP** |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA: bisa di-install, kerangka app di-cache |
| `tools/buat-ikon.mjs` | Membuat ulang ikon PNG/SVG (`node tools/buat-ikon.mjs`) |

## Menambah fitur

1. Buat `js/page-<nama>.js` berisi `App.daftar({ id, label, ikon, render(el, ui) })`.
2. Tambahkan `<script src="./js/page-<nama>.js"></script>` di `index.html`.
3. Data baru: tambahkan aksi di `WebApp.gs` (repo `SupplyDemandApps`), panggil dari halaman lewat `App.api('namaAksi', ...)`.
4. Naikkan `VERSI` di `sw.js` dan `versi` di `js/config.js` supaya cache pengguna diperbarui.

## Keamanan

- Login memakai Google Identity Services; ID token dikirim ke Apps Script di setiap panggilan.
- Apps Script memverifikasi token (audience = Client ID, belum kedaluwarsa) dan domain `otoklix.com`
  sebelum membaca/menulis data. Token hanya disimpan di `sessionStorage`.
- Tidak ada rahasia di repo ini: Client ID web dan URL `/exec` memang publik.

## Deploy

Push ke `main` otomatis dipublikasikan ke GitHub Pages (Settings > Pages > Source: GitHub Actions).
