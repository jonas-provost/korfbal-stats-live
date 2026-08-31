const CACHE_NAME = "korfbal-tracker-v1";

const CORE_ASSETS = [
    "index.html",
    "main.js",
    "setup.html",
    "setup.js",
    "stats.html",
    "stats.js",
    "verloop.html",
    "verloop.js",
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
        }).then(function () {
            return self.skipWaiting();
        })
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

// Network-first: always try to fetch the latest version when online, so updates show up
// immediately on next open. Only falls back to the cached copy when the network fails (offline).
self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request).then(function (response) {
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(function () {
            return caches.match(event.request);
        })
    );
});
