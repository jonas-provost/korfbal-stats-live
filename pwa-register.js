if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').then(function (registration) {
            registration.addEventListener('updatefound', function () {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', function () {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner(newWorker);
                    }
                });
            });
        }).catch(function (err) {
            console.warn('Service worker registration failed:', err);
        });
    });

    // Reload once the new service worker actually takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    function showUpdateBanner(newWorker) {
        const banner = document.createElement('div');
        banner.textContent = 'Nieuwe versie beschikbaar - tik om te vernieuwen';
        banner.style.cssText =
            'position:fixed;left:0;right:0;bottom:0;background:#5a5a5a;color:white;' +
            'text-align:center;padding:12px;font-family:"Lato",sans-serif;font-size:14px;' +
            'font-weight:700;cursor:pointer;z-index:99999;box-shadow:0 -2px 8px rgba(0,0,0,0.2);';
        banner.addEventListener('click', function () {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            banner.textContent = 'Bijwerken...';
        });
        document.body.appendChild(banner);
    }
}
