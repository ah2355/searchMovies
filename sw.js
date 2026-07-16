const CACHE = 'searchmovie-v1';
const STATIC = [
    '/css/style.css',
    '/css/media.css',
    '/misc/navMobile.js',
    '/misc/tvNav.js',
    '/misc/showModal.js',
    '/images/icon.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    // Only cache same-origin GET requests for static assets
    if (e.request.method !== 'GET') return;
    if (url.origin !== location.origin) return;
    const isStatic = url.pathname.startsWith('/css/') ||
                     url.pathname.startsWith('/misc/') ||
                     url.pathname.startsWith('/images/');
    if (!isStatic) return;
    e.respondWith(
        caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
        }))
    );
});
