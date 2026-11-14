// Pengaturan SND Apps (bukan rahasia: Client ID web dan URL API memang publik, akses dijaga oleh token Google + domain).
window.SND_CONFIG = {
  // URL web app Apps Script (ujungnya /exec). Diisi saat setup.
  apiUrl: 'https://script.google.com/macros/s/AKfycbz8m3LuAUqx00PNW6jDap528z6EuT49I7YLJaIufJ8Cu99FeXjizgIFoujFRm1Dj6D6Bw/exec',
  // OAuth Client ID tipe "Web application" (ujungnya .apps.googleusercontent.com). Diisi saat setup.
  clientId: '616960285379-9cgqpk3bc4lqd6q11eumg819reihvtvi.apps.googleusercontent.com',
  // Hanya akun domain ini yang boleh masuk (dicek di browser DAN di server).
  domain: 'otoklix.com',
  versi: '2026.11.15a',
};
