(() => {
    'use strict';

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // The puzzle remains usable when storage is blocked.
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // Nothing else to clear.
        }
    }

    const password = 'asterion';
    const sessionKey = 'forsaken_archives_session';
    const sessionDuration = 4 * 60 * 60 * 1000;
    const gate = document.getElementById('passwordGate');
    const gateForm = document.getElementById('gateForm');
    const passwordInput = document.getElementById('passwordInput');
    const gateError = document.getElementById('gateError');

    function hideGate() {
        gate.classList.add('hidden');
    }

    function restoreSession() {
        const stored = readStorage(sessionKey);
        if (!stored) return;

        try {
            const { timestamp } = JSON.parse(stored);
            if (Number.isFinite(timestamp) && Date.now() - timestamp < sessionDuration) {
                hideGate();
                return;
            }
        } catch {
            // Invalid state is simply treated as an expired session.
        }
        removeStorage(sessionKey);
    }

    gateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (passwordInput.value.toLowerCase().trim() === password) {
            writeStorage(sessionKey, JSON.stringify({ timestamp: Date.now() }));
            hideGate();
            return;
        }
        gateError.classList.add('visible');
        passwordInput.value = '';
        passwordInput.focus();
    });
    passwordInput.addEventListener('input', () => gateError.classList.remove('visible'));
    restoreSession();

    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = readStorage('theme');
    root.dataset.theme = savedTheme === 'day' || savedTheme === 'night'
        ? savedTheme
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day');

    function labelThemeToggle() {
        const next = root.dataset.theme === 'day' ? 'night' : 'day';
        themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
    }

    labelThemeToggle();
    themeToggle.addEventListener('click', () => {
        root.dataset.theme = root.dataset.theme === 'day' ? 'night' : 'day';
        writeStorage('theme', root.dataset.theme);
        labelThemeToggle();
    });

    if (!reduceMotion) {
        const glow = document.getElementById('glow');
        const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        let glowX = pointer.x;
        let glowY = pointer.y;

        document.addEventListener('mousemove', (event) => {
            pointer.x = event.clientX;
            pointer.y = event.clientY;
        }, { passive: true });

        const animateGlow = () => {
            glowX += (pointer.x - glowX) * 0.08;
            glowY += (pointer.y - glowY) * 0.08;
            glow.style.left = `${glowX}px`;
            glow.style.top = `${glowY}px`;
            requestAnimationFrame(animateGlow);
        };
        requestAnimationFrame(animateGlow);
    }

    const navHamburger = document.getElementById('navHamburger');
    const navSidebar = document.getElementById('navSidebar');
    const navOverlay = document.getElementById('navOverlay');

    function setMenu(open) {
        navSidebar.classList.toggle('mobile-visible', open);
        navOverlay.classList.toggle('visible', open);
        navHamburger.setAttribute('aria-expanded', String(open));
    }

    navHamburger.addEventListener('click', () => {
        setMenu(!navSidebar.classList.contains('mobile-visible'));
    });
    navOverlay.addEventListener('click', () => setMenu(false));

    function filterNavigation(query, container) {
        const needle = query.trim().toLowerCase();
        const links = Array.from(container.querySelectorAll('.chapter-link, .section-link'));
        for (const link of links) {
            link.hidden = Boolean(needle) && !link.textContent.toLowerCase().includes(needle);
        }
        for (const section of container.querySelectorAll('.nav-section, .newest-work')) {
            section.hidden = Boolean(needle)
                && !Array.from(section.querySelectorAll('.chapter-link, .section-link')).some((link) => !link.hidden);
        }
    }

    const centeredNav = document.getElementById('centeredNav');
    document.getElementById('navSearch').addEventListener('input', (event) => {
        filterNavigation(event.target.value, navSidebar);
    });
    document.getElementById('centeredSearch').addEventListener('input', (event) => {
        filterNavigation(event.target.value, centeredNav);
    });

    const navLinks = document.querySelectorAll('.nav-sidebar .chapter-link');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                for (const link of navLinks) {
                    link.classList.toggle('active', link.hash === `#${entry.target.id}`);
                }
            }
        }, { rootMargin: '-20% 0px -80% 0px' });
        document.querySelectorAll('.chapter').forEach((chapter) => observer.observe(chapter));
    }

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
            const target = document.querySelector(anchor.hash);
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            setMenu(false);
        });
    });

    let activePopup = null;

    function dismissFootnote() {
        if (!activePopup) return;
        const popup = activePopup;
        activePopup = null;
        popup.classList.remove('visible');
        window.setTimeout(() => popup.remove(), 300);
    }

    function showFootnote(reference) {
        dismissFootnote();
        const noteId = reference.dataset.note;
        const note = document.getElementById(`footnote-${noteId}`);
        const popup = document.createElement('div');
        popup.className = 'footnote-popup';
        popup.setAttribute('role', 'note');
        popup.innerHTML = `<button type="button" class="footnote-popup-close" aria-label="Close footnote">×</button><p>${note?.innerHTML ?? `Footnote ${noteId}`}</p>`;
        document.body.appendChild(popup);

        const bounds = reference.getBoundingClientRect();
        let left = bounds.left + window.scrollX;
        popup.style.left = `${left}px`;
        popup.style.top = `${bounds.bottom + window.scrollY + 10}px`;
        popup.style.position = 'absolute';

        requestAnimationFrame(() => {
            if (left + popup.offsetWidth > document.documentElement.clientWidth - 20) {
                left = Math.max(20, document.documentElement.clientWidth - popup.offsetWidth - 20);
            }
            popup.style.left = `${left}px`;
            popup.classList.add('visible');
        });

        activePopup = popup;
        popup.querySelector('button').addEventListener('click', (event) => {
            event.stopPropagation();
            dismissFootnote();
        });
        popup.addEventListener('mouseleave', dismissFootnote);
    }

    document.addEventListener('click', (event) => {
        const reference = event.target.closest('.footnote-ref');
        if (reference) {
            event.stopPropagation();
            showFootnote(reference);
        } else if (!event.target.closest('.footnote-popup')) {
            dismissFootnote();
        }
    }, true);

    document.addEventListener('mouseenter', (event) => {
        const reference = event.target.closest('.footnote-ref');
        if (reference) showFootnote(reference);
    }, true);

    document.addEventListener('mouseleave', (event) => {
        if (!event.target.classList?.contains('footnote-ref')) return;
        window.setTimeout(() => {
            if (activePopup && !activePopup.matches(':hover')) dismissFootnote();
        }, 200);
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        setMenu(false);
        dismissFootnote();
    });
})();
