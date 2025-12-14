// Scroll hint visibility controller
(function () {
    const scrollHint = document.querySelector('.scroll-hint');
    if (!scrollHint) return;

    let idleTimer;
    let hasShownOnce = false;

    // Show hint after 2 seconds of inactivity or on first mouse movement
    function showHint() {
        if (!hasShownOnce && window.scrollY < 100) {
            scrollHint.classList.add('visible');
            hasShownOnce = true;
        }
    }

    // Hide hint when user scrolls
    function hideHint() {
        scrollHint.classList.remove('visible');
    }

    // Reset idle timer
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(showHint, 2000); // Show after 2 seconds of no movement
    }

    // Initial timer on page load
    idleTimer = setTimeout(showHint, 3000); // Show after 3 seconds of being on page

    // Show hint on mouse movement (first time only)
    document.addEventListener('mousemove', function onFirstMove() {
        if (!hasShownOnce && window.scrollY < 100) {
            showHint();
        }
    }, { once: false });

    // Hide hint when scrolling
    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            hideHint();
        }
    });

    // Show hint again after idle period
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keydown', resetIdleTimer);
})();
