const SHELL_CACHE = 'console-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL_CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (
    url.pathname.startsWith('/projects/') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put(event.request, response.clone()))
            .catch((e) => console.warn('Shell cache put failed:', e));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached !== undefined) {
          return cached;
        }
        const root = await caches.match('/');
        if (root !== undefined) {
          return root;
        }
        return Response.error();
      }),
  );
});
