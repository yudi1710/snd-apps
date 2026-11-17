/* Service worker SND Apps: cache kerangka app (app shell) supaya buka cepat & bisa di-install,
   plus penerima Web Push (notifikasi PO dari Stock Bot).
   Data selalu diambil dari server (tidak di-cache di sini; cache offline data ada di aplikasi). Naikkan VERSI tiap rilis. */
const VERSI = 'snd-apps-2026.11.17k';
const SHELL = ['./', './index.html', './css/app.css', './js/config.js', './js/app.js', './js/ekspor.js', './js/page-beranda.js', './js/page-monitoring.js', './js/page-ks.js', './js/page-cari.js', './js/page-forecast.js', './js/notif.js', './icons/watermark.svg',
  './manifest.webmanifest', './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSI).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // hanya file app sendiri (same-origin, GET) yang di-cache; API Apps Script & Google lewat jaringan
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => { // selalu cek ulang ke server, jangan pakai cache HTTP 10 menit GitHub Pages
      const salinan = res.clone();
      caches.open(VERSI).then(c => c.put(e.request, salinan));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ---------- Web Push ----------
// Payload JSON dari bot: { title, body, url, tag }
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { body: e.data ? e.data.text() : '' }; }
  const judul = p.title || 'SND Apps';
  e.waitUntil(self.registration.showNotification(judul, {
    body: p.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: p.tag || 'snd',
    renotify: true,
    vibrate: [200, 100, 200], // getar membantu notifikasi tampil sebagai popup di sebagian HP
    requireInteraction: false,
    lang: 'id',
    data: { url: p.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tujuan = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(daftar => {
    const ada = daftar.find(c => c.url.startsWith(self.location.origin));
    if (ada) { return ada.focus().then(c => (c && 'navigate' in c ? c.navigate(tujuan).catch(() => {}) : null)); }
    return self.clients.openWindow(tujuan);
  }));
});
