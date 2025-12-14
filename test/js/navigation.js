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
    });

    // Initialize on load
    updateActiveNav();
    updateFiltersVisibility();
})();
