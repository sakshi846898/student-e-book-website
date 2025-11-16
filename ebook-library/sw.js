// minimal service worker (prevents aggressive caching)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => clients.claim());
self.addEventListener('fetch', () => {});
