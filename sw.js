// sw.js — Service Worker for throw-nerd-online PWA
// Caches all static assets for offline use

const CACHE_NAME = 'tno-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/models.js',
    '/js/x01Engine.js',
    '/js/cricketEngine.js',
    '/js/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;700&display=swap',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Network-first for navigation, cache-first for assets
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
    } else {
        event.respondWith(
            caches.match(event.request).then(cached => cached || fetch(event.request))
        );
    }
});
