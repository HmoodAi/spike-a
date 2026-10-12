const CACHE = 'spike-a-0.1.3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

// Install: fetch the shell bypassing the HTTP cache (GitHub Pages sends max-age=600,
// which otherwise lets a brand-new SW cache a stale index.html).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((u) =>
        fetch(new Request(u, { cache: 'reload' })).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;

  // Navigations: network first (3 s), so updates arrive on the first open when online;
  // fall back to the cached shell when offline (airplane mode).
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const fresh = await fetch(e.request.url, { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        if (fresh.ok) { await cache.put('./index.html', fresh.clone()); await cache.put('./', fresh.clone()); }
        return fresh;
      } catch (_) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Other same-origin assets: cache first.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
