// Network first for the app's own files (so updates arrive right away), cache as offline fallback.
// Your data is in IndexedDB, not in this cache, so clearing or updating the cache never touches it.
const CACHE = 'nour-os-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'store.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if(isFont){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => hit)));
    return;
  }
  if(url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => { if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
