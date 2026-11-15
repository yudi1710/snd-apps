// Pengaturan SND Apps (bukan rahasia: Client ID web, URL API, dan kunci publik VAPID memang publik, akses dijaga oleh token Google + domain).
window.SND_CONFIG = {
  // URL web app Apps Script (ujungnya /exec). Diisi saat setup.
  apiUrl: 'https://script.google.com/macros/s/AKfycbz8m3LuAUqx00PNW6jDap528z6EuT49I7YLJaIufJ8Cu99FeXjizgIFoujFRm1Dj6D6Bw/exec',
  // OAuth Client ID tipe "Web application" (ujungnya .apps.googleusercontent.com). Diisi saat setup.
  clientId: '616960285379-9cgqpk3bc4lqd6q11eumg819reihvtvi.apps.googleusercontent.com',
  // Kunci PUBLIK Web Push (VAPID). Pasangan kunci privatnya hanya ada di .env Stock Bot.
  vapidPublicKey: 'BKqSJSBYCxK_zKvQKdHWfp6bb71rTUa_kCEKyWnrTJF4oSaNDL1EF_oqBrCHthyac34kKTCSjxPOBeT_8Oz4UbA',
  // Hanya akun domain ini yang boleh masuk (dicek di browser DAN di server).
  domain: 'otoklix.com',
  versi: '2026.11.16d',
};
