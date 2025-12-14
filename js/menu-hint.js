(function () {
    const hint = document.querySelector('.menu-hint');
    const hoverZone = document.getElementById('nav-hover-zone');
    const nav = document.querySelector('.main-nav');
    if (!hint) return;

    let shown = false;

    function showHint() {
        hint.classList.remove('hidden');
        hint.classList.add('visible');
    }

    function hideHint() {
        hint.classList.add('hidden');
    }

    function onFirstInteraction() {
        if (!shown) {
            shown = true;
            showHint();
            attachHoverToggle();
            detachFirstListeners();
        }
    }

    function attachHoverToggle() {
        if (hoverZone) {
            hoverZone.addEventListener('mouseenter', hideHint, { passive: true });
            hoverZone.addEventListener('mouseleave', showHint, { passive: true });
        }
        if (nav) {
            nav.addEventListener('mouseenter', hideHint, { passive: true });
            nav.addEventListener('mouseleave', showHint, { passive: true });
        }
    }

    function detachFirstListeners() {
        window.removeEventListener('mousemove', onFirstInteraction);
        window.removeEventListener('scroll', onFirstInteraction);
        window.removeEventListener('keydown', onFirstInteraction);
        window.removeEventListener('touchstart', onFirstInteraction);
    }

    // Show once user interacts; then keep persistent, fading inversely with nav hover
    window.addEventListener('mousemove', onFirstInteraction, { passive: true });
    window.addEventListener('scroll', onFirstInteraction, { passive: true });
    window.addEventListener('keydown', onFirstInteraction);
    window.addEventListener('touchstart', onFirstInteraction, { passive: true });
})();
