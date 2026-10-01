/* Offline cache. KITE venues commonly have no WiFi; a demo that needs a
   network is a demo that scores zero. Bump CACHE on every release. */
const CACHE = 'aksharascan-v1';
const ASSETS = [
  'index.html', 'style.css', 'app.js', 'manifest.json', 'icon.svg',
  'data/units.json', 'data/bigrams.json', 'data/legal.json',
  'data/gridA.json', 'data/meta.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;                 // never cache POST /write
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
