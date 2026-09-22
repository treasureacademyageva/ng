/* Treasure Academy offline support — key pages keep working without internet */
const CACHE = 'treasure-v46';
const CORE = [
  'index.html', 'contact.html', 'calendar.html', 'admissions.html', 'news.html',
  'assets/css/main.css', 'assets/css/extra.css', 'assets/css/corporate.css',
  'assets/js/store.js', 'assets/js/site.js', 'assets/js/sync.js',
  'assets/img/logo.jpg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico)$/)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match('index.html'))));
  } else {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html'))));
  }
});
