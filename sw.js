/* Service worker SND Apps: cache kerangka app (app shell) supaya buka cepat & bisa di-install.
   Data selalu diambil dari server (tidak di-cache). Naikkan VERSI tiap rilis supaya cache lama dibuang. */
const VERSI = 'snd-apps-2026.11.14e';
const SHELL = ['./', './index.html', './css/app.css', './js/config.js', './js/app.js', './js/page-beranda.js', './js/page-monitoring.js', './js/page-ks.js',
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
    fetch(e.request).then(res => {
      const salinan = res.clone();
      caches.open(VERSI).then(c => c.put(e.request, salinan));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
