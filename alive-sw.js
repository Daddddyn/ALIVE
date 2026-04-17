/* ══════════════════════════════════════════
   ALive Service Worker — alive-sw.js
   Caches the app shell for offline launch.
   Stream/media requests always go to network.
══════════════════════════════════════════ */

const CACHE_NAME = 'alive-v1';

const SHELL_FILES = [
  './',
  './alive.html',
  './alive-manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.7/hls.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES.map(url => {
        if (url.startsWith('http')) return new Request(url, { mode: 'no-cors' });
        return url;
      })).catch(err => console.warn('[ALive SW] Shell cache failed:', err));
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  const networkOnly = [
    'raw.githubusercontent.com', 'corsproxy.io', 'iptv-org.github.io',
    'tvpass.org', 'youtube.com', 'youtu.be', 'api.', '.m3u8', '.ts'
  ];
  if (networkOnly.some(h => url.href.includes(h) || url.hostname.includes(h))) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  if (url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(response => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./alive.html');
        return new Response('', { status: 503 });
      });
    })
  );
});
