// navMobile.js — auto-adds a hamburger button to every .navbar2 and toggles
// the .nav-links2 menu on mobile. No per-page markup needed beyond loading this file.
(function () {
    function setupNavbar(nav) {
        const links = nav.querySelector('.nav-links2');
        if (!links) return;
        if (nav.querySelector('.hamburger2')) return; // already set up

        // Build the hamburger button.
        const btn = document.createElement('button');
        btn.className = 'hamburger2';
        btn.setAttribute('aria-label', 'Menu');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span class="bar"></span><span class="bar"></span><span class="bar"></span>';

        // Insert it as the last child of the navbar (CSS positions it).
        nav.appendChild(btn);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const open = links.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.classList.toggle('active', open);
        });

        // Close the menu when tapping outside it.
        document.addEventListener('click', function (e) {
            if (!nav.contains(e.target) && links.classList.contains('open')) {
                links.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
                btn.classList.remove('active');
            }
        });
    }

    function init() {
        document.querySelectorAll('.navbar2').forEach(setupNavbar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();