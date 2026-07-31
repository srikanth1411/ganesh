document.addEventListener('DOMContentLoaded', () => {
    const navs = document.querySelectorAll('.top-nav');

    navs.forEach(nav => {
        const toggle = nav.querySelector('.nav-toggle');
        const links = nav.querySelector('.top-nav-links');
        if (!toggle || !links) return;

        const closeMenu = () => {
            nav.classList.remove('nav-open');
            toggle.setAttribute('aria-expanded', 'false');
        };

        toggle.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const isOpen = nav.classList.toggle('nav-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });

        links.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => closeMenu());
        });

        document.addEventListener('click', event => {
            if (!nav.contains(event.target)) closeMenu();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) closeMenu();
        });
    });
});
