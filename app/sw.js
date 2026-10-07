/* Offline cache for the fair: KITE venues commonly have no WiFi, and a demo
   that needs a network scores zero.
 *
 * CACHE carries a build hash, stamped in by scripts/build-www.mjs. That matters
 * more than it looks: with a fixed cache name, sw.js is byte-identical on every
 * deploy, the browser never re-runs install, and the very first version a
 * device ever loaded is served forever. A tablet installed before the fair
 * would never receive a fix. (This actually happened — the live app sat on
 * stale code through five deploys.)
 *
 * Strategy is stale-while-revalidate: answer instantly from cache so the app
 * works offline and starts fast, but refresh in the background so the next
 * launch is current.
 */
const CACHE = '__BUILD__';
const ASSETS = [
  'index.html', 'style.css', 'app.js', 'scan.js', 'clock.js', 'meds.js', 'reader.js', 'chat.js',
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'tour.js', 'voice.js',
  'manifest.json', 'icon.svg',
  'data/units.json', 'data/bigrams.json', 'data/legal.json',
  'data/gridA.json', 'data/meta.json',
];
/* Only present once sim/build_model.py has run on a real corpus. */
const OPTIONAL = ['data/words.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS).then(() =>
      Promise.all(OPTIONAL.map(u => c.add(u).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;            // never cache POST /write
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(e.request);
      const net = fetch(e.request)
        .then(res => { if (res && res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      return hit || net || fetch(e.request);          // offline: whatever we have
    })
  );
});
