// Service Worker route handler — serves /sw.js for PWA + Push Notifications
// Using a route handler avoids the Next.js dev server crash that occurs
// when sw.js exists as a static file in public/

import { NextResponse } from 'next/server'

const SW_CODE = `
// GNECT Service Worker — PWA + Push Notifications
// Robust: never blocks uploads, never fails on install, skips all API/media
const CACHE_NAME = 'gnect-v2';

// Install event — cache static assets, but DON'T fail if any are unavailable
self.addEventListener('install', (event) => {
  // Use addAll with fallback — if any asset fails, we still install
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache each asset individually so one failure doesn't block the rest
      return Promise.allSettled([
        cache.add('/'),
        cache.add('/manifest.json'),
        cache.add('/logo.svg'),
      ]);
    }).catch(() => {
      // Even if caching fails completely, install the SW
    })
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
// CRITICAL: Skip ALL non-GET requests (uploads, etc.) and ALL API calls
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests — uploads use POST and must NEVER be intercepted
  if (event.request.method !== 'GET') return;
  
  // Skip API calls — always fresh, never cache
  if (event.request.url.includes('/api/')) return;

  // Skip media proxy requests — these have their own caching via ETags
  if (event.request.url.includes('/api/media/')) return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline use
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {
              // Cache write failure is non-critical — ignore
            });
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
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
`

export async function GET() {
  return new NextResponse(SW_CODE, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Service-Worker-Allowed': '/',
    },
  })
}
