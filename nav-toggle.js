document.addEventListener('DOMContentLoaded', () => {
    const navs = document.querySelectorAll('.top-nav');

    navs.forEach(nav => {
        const toggle = nav.querySelector('.nav-toggle');
        const links = nav.querySelector('.top-nav-links');
        if (!toggle || !links) return;

        toggle.addEventListener('click', event => {
            event.preventDefault();
            const isOpen = nav.classList.toggle('nav-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });

        links.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('nav-open');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    });
});
