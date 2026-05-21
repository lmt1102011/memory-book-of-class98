const CACHE_NAME = 'memory98-app-shell-v5';
const APP_SHELL_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo-web-class-98.svg',
  './favicon.svg',
  './memory98-icon-192.png',
  './memory98-icon-512.png',
  './memory98-maskable-192.png',
  './memory98-maskable-512.png',
  './memory98-apple-touch-icon.png',
];

const scopedUrl = (path) => new URL(path, self.registration.scope).toString();
const APP_SHELL_URLS = APP_SHELL_PATHS.map(scopedUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const shouldHandleRequest = (request) => {
  const url = new URL(request.url);
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith('/manager.html')) return false;
  return true;
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || network.then((response) => response || Response.error());
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandleRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(scopedUrl('./index.html'))) || caches.match(scopedUrl('./')) || Response.error()),
    );
    return;
  }

  if (APP_SHELL_URLS.includes(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
