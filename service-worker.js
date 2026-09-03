const CACHE_NAME = "korfbal-tracker-v3";

const CORE_ASSETS = [
    "index.html",
    "main.js",
    "setup.html",
    "setup.js",
    "stats.html",
    "stats.js",
    "verloop.html",
    "verloop.js",
    "pwa-register.js",
    "viewport-fix.js",
    "style.css",
    "KorfbalVeld.png",
    "KorfbalVeldSmall.png",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png",
    "manifest.json"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(CORE_ASSETS);
        })
        // No skipWaiting here on purpose: a newly-installed version waits until the
        // page explicitly asks for it (via the update banner), instead of silently
        // taking over mid-session.
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) { return caches.delete(key); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// Lets the page tell a waiting service worker to activate now (triggered by the update banner)
self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Stale-while-revalidate: instant response from cache (no delay when switching pages),
// while quietly refreshing the cache in the background for next time.
self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then(function (cached) {
            const networkFetch = fetch(event.request).then(function (response) {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(function () {
                return cached;
            });

            return cached || networkFetch;
        })
    );
});
