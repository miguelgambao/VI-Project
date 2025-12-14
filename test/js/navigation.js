// Navigation functionality
(function () {
    'use strict';

    // Smooth scroll navigation
    document.querySelectorAll(".main-nav a").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute("href"));
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });

    // Active nav highlighting
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".main-nav a");

    function updateActiveNav() {
        let current = "";
        sections.forEach((section) => {
            const sectionTop = section.offsetTop - 100;
            if (pageYOffset >= sectionTop) {
                current = section.getAttribute("id");
            }
        });

        navLinks.forEach((link) => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${current}`) {
                link.classList.add("active");
            }
        });
    }

    // Scroll direction tracking for nav visibility
    let lastScrollTop = 0;
    const nav = document.querySelector(".main-nav");
    const scrollThreshold = 100; // Start hiding after scrolling 100px

    function updateNavVisibility() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Always show at the top of the page
        if (currentScrollTop < scrollThreshold) {
            nav.classList.remove("nav-hidden");
        }
        // Show when scrolling up
        else if (currentScrollTop < lastScrollTop) {
            nav.classList.remove("nav-hidden");
        }
        // Hide when scrolling down
        else if (currentScrollTop > lastScrollTop) {
            nav.classList.add("nav-hidden");
        }
        
        lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
    }

    // Show filters only after passing the Home section
    function updateFiltersVisibility() {
        const about = document.getElementById("home");
        const filters = document.getElementById("global-filters");
        if (about && filters) {
            const aboutBottom = about.offsetTop + about.offsetHeight;
            if (window.pageYOffset + 100 >= aboutBottom) {
                filters.classList.remove("hidden");
            } else {
                filters.classList.add("hidden");
            }
        }
    }

    window.addEventListener("scroll", () => {
        updateActiveNav();
        updateFiltersVisibility();
        updateNavVisibility();
    });

    // Initialize on load
    updateActiveNav();
    updateFiltersVisibility();
    updateNavVisibility();
})();
