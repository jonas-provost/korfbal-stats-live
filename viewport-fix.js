(function () {
    const htmlElement = document.documentElement;

    function updateHeight() {
        // clientHeight op het html-element geeft de nettohoogte binnen de PWA,
        // exclusief de ruimte die Android-systeembalken innemen.
        const actualHeight = htmlElement.clientHeight;
        htmlElement.style.setProperty('--app-height', actualHeight + 'px');
    }

    // ResizeObserver vuurt zodra het html-element van grootte verandert
    // (bijv. bij openen, rotatie, of het in-/uitschuiven van systeembalken).
    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(function () {
            // Android heeft soms 1-2 frames nodig om de juiste hoogte te bepalen
            requestAnimationFrame(function () {
                requestAnimationFrame(updateHeight);
            });
        });
        ro.observe(htmlElement);
    } else {
        // Fallback voor browsers zonder ResizeObserver
        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);
    }

    // Extra vangnet: dit is specifiek het moment waarop de bug in de video optrad
    // (terugkeren via de app-switcher) - ResizeObserver zou dit al moeten opvangen,
    // maar dit kost niets extra als achtervang.
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            requestAnimationFrame(updateHeight);
        }
    });

    // Voer direct uit bij het laden
    updateHeight();
})();
