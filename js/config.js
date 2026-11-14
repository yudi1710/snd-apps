// Pengaturan SND Apps (bukan rahasia: Client ID web dan URL API memang publik, akses dijaga oleh token Google + domain).
window.SND_CONFIG = {
  // URL web app Apps Script (ujungnya /exec). Diisi saat setup.
  apiUrl: 'GANTI_DENGAN_URL_EXEC',
  // OAuth Client ID tipe "Web application" (ujungnya .apps.googleusercontent.com). Diisi saat setup.
  clientId: 'GANTI_DENGAN_CLIENT_ID',
  // Hanya akun domain ini yang boleh masuk (dicek di browser DAN di server).
  domain: 'otoklix.com',
  versi: '2026.11.14',
};
