/* Service worker KuliahKu: cache offline + kanal notifikasi */
'use strict';

const CACHE = 'kuliahku-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './css/styles.css',
  './js/utils.js',
  './js/data.js',
  './js/notify.js',
  './js/importer.js',
  './js/views.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './sample-jadwal.csv',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  const cacheFirst = caches.match(e.request, { ignoreSearch: true }).then(hit =>
    hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    })
  );

  if (url.origin === location.origin) {
    // fallback navigasi ke index.html saat offline
    e.respondWith(cacheFirst.catch(() => caches.match('./index.html')));
  } else if (['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.sheetjs.com'].includes(url.hostname)) {
    // CDN (font & SheetJS): simpan saat online agar bisa dipakai offline
    e.respondWith(cacheFirst.catch(() => new Response('', { status: 504 })));
  }
});

/* Notifikasi dari halaman */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'NOTIFY') {
    self.registration.showNotification(d.title, {
      body: d.body,
      tag: d.tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [80, 40, 80],
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
