// GNECT Service Worker — PWA + Push Notifications + Offline + Background Sync
const CACHE_NAME = 'gnect-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
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

// Fetch event — network first for pages/API, cache first for static assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API calls — always fresh
  if (url.pathname.includes('/api/')) return;

  // For navigation requests (HTML pages) — network first, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // For static assets (images, CSS, JS) — cache first, network fallback
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js|woff2?)$/i) ||
    url.pathname.includes('/_next/static/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background Sync — retry failed form submissions when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'gnect-sync') {
    event.waitUntil(
      // Replay any queued requests from IndexedDB
      replayQueuedRequests()
    );
  }
});

// Simple request queue using IndexedDB for background sync
async function replayQueuedRequests() {
  try {
    const db = await openDB();
    const requests = await getAllRequests(db);
    for (const req of requests) {
      try {
        await fetch(req.url, {
          method: req.method,
          headers: JSON.parse(req.headers || '{}'),
          body: req.body,
          credentials: 'same-origin',
        });
        await deleteRequest(db, req.id);
      } catch {
        // Will retry on next sync
        break;
      }
    }
  } catch {
    // IndexedDB not available, skip
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('gnect-sync-queue', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function getAllRequests(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('requests', 'readonly');
    const store = tx.objectStore('requests');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteRequest(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('requests', 'readwrite');
    const store = tx.objectStore('requests');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

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
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'gnect-notification',
      data: data.data || {},
      vibrate: [100, 50, 100],
      silent: data.silent || false,
      actions: data.url ? [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ] : undefined,
    })
  );
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

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
