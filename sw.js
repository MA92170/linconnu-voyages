// Service Worker — L'Inconnu Voyages
// Cache the shell + images after first visit for offline access and instant reloads.

const CACHE = 'linconnu-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// Install — pre-cache core shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategies:
//   - Navigation / HTML → network-first, fallback cache
//   - Same-origin static → cache-first
//   - Images (Unsplash etc.) → stale-while-revalidate
//   - Formspree / WhatsApp / analytics → bypass cache (network only)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Bypass POST-like endpoints
  if(url.host.includes('formspree.io') || url.host.includes('wa.me')) return;

  // HTML navigation — network first
  if(req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Images & fonts — stale-while-revalidate
  if(req.destination === 'image' || req.destination === 'font' || url.host.includes('fonts.gstatic.com') || url.host.includes('images.unsplash.com')) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if(res && res.status === 200) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Same-origin static — cache first
  if(sameOrigin) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
    return;
  }

  // Default: network, fallback cache
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
