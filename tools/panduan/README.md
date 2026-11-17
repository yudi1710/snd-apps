# Panduan Forecast Cinere (PDF)

Membuat ulang `Panduan-Forecast-Cinere.pdf`: screenshot diambil dari aplikasi asli (CSS dan JS repo ini) dengan **data contoh**
(`data.mjs`, tanpa login Google; panggilan ke Apps Script dicegat), diberi nomor dan panah, lalu disusun jadi PDF A4.

Butuh Node 20+, `puppeteer-core`, dan Chrome. Atur lewat variabel lingkungan bila lokasinya beda:

- `PUPPETEER_DIR`: folder yang punya `node_modules/puppeteer-core` (bawaan: folder stock-bot)
- `CHROME_PATH`: lokasi `chrome.exe`

```bash
node tools/panduan/shot.mjs                 # screenshot -> tools/panduan/img/
node tools/panduan/build-pdf.mjs [keluaran.pdf]   # PDF (bawaan: tools/panduan/Panduan-Forecast-Cinere.pdf)
```

Kapan diperbarui: tiap ada perubahan tampilan halaman Forecast. Teks panduan ada di `build-pdf.mjs`; kalau langkah atau
tombolnya berubah, sesuaikan juga selektor penanda di `shot.mjs`. Nomor versi di footer dibaca dari `js/config.js`.
