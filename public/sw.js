const CACHE_NAME = 'memory98-app-shell-v28';
const APP_SHELL_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo-web-class-98.svg',
  './logo-web-class-98.png',
  './logo-web-class-98-192.png',
  './logo-web-class-98-maskable-192.png',
  './logo-web-class-98-maskable-512.png',
];

const scopedUrl = (path) => new URL(path, self.registration.scope).toString();
const APP_SHELL_URLS = APP_SHELL_PATHS.map(scopedUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL_URLS);
      } catch {
        // A single slow or missing asset must never block app updates.
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.allSettled(
        cacheNames
          .filter((name) => name.startsWith('memory98-app-shell') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const shouldHandleRequest = (request) => {
  const url = new URL(request.url);
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith('/manager.html')) return false;
  if (url.pathname.endsWith('/app-version.json')) return false;
  return true;
};

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
};

const notifyAssetMissing = async (url) => {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clientsList.forEach((client) => {
    client.postMessage({ type: 'MEMORY98_ASSET_MISSING', url });
  });
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.status === 404 && (request.destination === 'script' || request.destination === 'style')) {
        void notifyAssetMissing(request.url);
      }

      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      if (request.destination === 'script' || request.destination === 'style') {
        void notifyAssetMissing(request.url);
      }
      return cached || Promise.reject(error);
    });

  return cached || network.then((response) => response || Response.error());
};

const networkFirstAsset = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.status === 404) {
      void notifyAssetMissing(request.url);
      return cached || response;
    }

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    void notifyAssetMissing(request.url);
    return cached || Promise.reject(error);
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandleRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (
          (await caches.match(request))
          || (await caches.match(scopedUrl('./index.html')))
          || (await caches.match(scopedUrl('./')))
          || Response.error()
        )),
    );
    return;
  }

  if (APP_SHELL_URLS.includes(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if (['image', 'font', 'manifest'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
