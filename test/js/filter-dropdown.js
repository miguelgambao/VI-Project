// Filter dropdown functionality for responsive design
(function () {
    'use strict';

    const filters = document.getElementById('global-filters');
    const toggleBtn = document.getElementById('filterToggleBtn');

    // Enable dropdown mode on screens smaller than 768px
    function updateFilterMode() {
        if (window.innerWidth <= 768) {
            filters.classList.add('dropdown-mode');
        } else {
            filters.classList.remove('dropdown-mode');
            filters.classList.remove('open');
        }
    }

    // Toggle filter panel open/close on button click
    toggleBtn.addEventListener('click', () => {
        filters.classList.toggle('open');
    });

    // Close filter panel when clicking outside
    document.addEventListener('click', (e) => {
        if (filters.classList.contains('dropdown-mode') &&
            filters.classList.contains('open') &&
            !filters.contains(e.target) &&
            !toggleBtn.contains(e.target)) {
            filters.classList.remove('open');
        }
    });

    // Update filter mode on window resize
    window.addEventListener('resize', updateFilterMode);

    // Initial check
    updateFilterMode();
})();
