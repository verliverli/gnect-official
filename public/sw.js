// GNECT Service Worker — PWA + Push Notifications
const CACHE_NAME = 'gnect-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
];

// Install event — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch event — network first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls — always fresh
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = { title: 'GNECT', body: 'You have a new notification', icon: '/icon-512.png' };
  
  try {
    data = { ...data, ...event.data.json() };
  } catch {}

  // Discreet notification — no explicit content
  const discreetBody = data.discreet 
    ? 'You have a new message' 
    : data.body;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: discreetBody,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: data.tag || 'gnect-notification',
      data: data.data || {},
      vibrate: [100, 50, 100],
      silent: data.silent || false,
    })
  );
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(targetUrl);
    })
  );
});
