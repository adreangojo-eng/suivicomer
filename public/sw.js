const CACHE_NAME = 'suivicomer-v3';
const OFFLINE_FALLBACK_URL = '/index.html';

// Fichiers critiques essentiels pour le fallback offline
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Pré-mise en cache partielle:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Suppression ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignorer les requêtes non-GET et les requêtes externes Supabase
  if (req.method !== 'GET' || req.url.includes('supabase.co') || req.url.startsWith('chrome-extension:')) {
    return;
  }

  // 1. Pour les navigations HTML (index.html) : STRATÉGIE NETWORK FIRST
  // Cela garantit que chaque nouveau déploiement Vercel est visible immédiatement sans page blanche !
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // En cas de coupure réseau réelle (hors ligne) -> servir la version en cache
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match(OFFLINE_FALLBACK_URL);
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // 2. Pour les assets statiques (JS, CSS, images) : NETWORK FIRST avec FALLBACK CACHE
  // Si le réseau est disponible, on récupère le nouveau fichier déployé et on met à jour le cache
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        // Hors ligne -> utiliser le cache local
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Request Timeout Offline' });
      })
  );
});
