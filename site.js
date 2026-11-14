(() => {
    'use strict';

    const root = document.documentElement;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
    };

    function readTheme() {
        try {
            return localStorage.getItem('theme');
        } catch {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem('theme', theme);
        } catch {
            // A blocked storage API should not break the switch itself.
        }
    }

    const savedTheme = readTheme();
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'night'
        : 'day';
    root.dataset.theme = savedTheme === 'day' || savedTheme === 'night'
        ? savedTheme
        : systemTheme;

    document.addEventListener('mousemove', (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
    }, { passive: true });

    function mountChrome() {
        const grain = document.createElement('div');
        grain.className = 'grain';
        grain.setAttribute('aria-hidden', 'true');

        const glow = document.createElement('div');
        glow.id = 'glow';
        glow.className = 'cursor-glow';
        glow.setAttribute('aria-hidden', 'true');

        const toggle = document.createElement('button');
        toggle.id = 'themeToggle';
        toggle.className = 'theme-toggle';
        toggle.type = 'button';
        toggle.innerHTML = `
            <svg class="sun" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="5"></circle>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
            <svg class="moon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>`;

        const labelToggle = () => {
            const next = root.dataset.theme === 'day' ? 'night' : 'day';
            toggle.setAttribute('aria-label', `Switch to ${next} theme`);
        };

        labelToggle();
        toggle.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'day' ? 'night' : 'day';
            saveTheme(root.dataset.theme);
            labelToggle();
        });

        document.body.prepend(toggle);
        document.body.prepend(glow);
        document.body.prepend(grain);
        return glow;
    }

    function animateGlow(glow) {
        if (motionQuery.matches) return;

        let x = pointer.x;
        let y = pointer.y;
        const frame = () => {
            x += (pointer.x - x) * 0.08;
            y += (pointer.y - y) * 0.08;
            glow.style.left = `${x}px`;
            glow.style.top = `${y}px`;
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    function mountWisp() {
        if (motionQuery.matches) return;

        const wisp = document.createElement('div');
        wisp.id = 'wisp';
        wisp.className = 'wisp';
        wisp.setAttribute('aria-hidden', 'true');
        wisp.textContent = '✶';
        document.body.appendChild(wisp);

        let time = Math.random() * 1000;
        const drift = () => {
            time += 0.0025;
            const x = window.innerWidth * (0.5 + 0.43 * Math.sin(time * 0.61));
            const y = window.innerHeight * (0.5 + 0.4 * Math.sin(time * 0.43 + 1.3));
            wisp.style.transform = `translate(${x}px, ${y}px)`;
            wisp.classList.toggle('dim', Math.hypot(x - pointer.x, y - pointer.y) < 140);
            requestAnimationFrame(drift);
        };
        requestAnimationFrame(drift);
    }

    function splash(x, y) {
        const count = 8;
        for (let index = 0; index < count; index += 1) {
            const star = document.createElement('div');
            star.className = 'title-spark-splash';
            star.setAttribute('aria-hidden', 'true');
            star.textContent = '✶';
            star.style.left = `${x}px`;
            star.style.top = `${y}px`;
            document.body.appendChild(star);

            const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const distance = 70 + (Math.random() - 0.5) * 30;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            const animation = star.animate([
                { opacity: 1, transform: 'translate(-50%, -50%) scale(0.7)' },
                {
                    opacity: 0,
                    transform: `translate(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px)) scale(0.3)`,
                },
            ], { duration: 700, easing: 'ease-out', fill: 'forwards' });
            animation.onfinish = () => star.remove();
        }
    }

    function bindFoyerSpark() {
        const title = document.querySelector('body.foyer h1.title');
        if (!title || motionQuery.matches) return;

        let coolingDown = false;
        title.addEventListener('mouseenter', () => {
            if (coolingDown) return;
            coolingDown = true;

            const { x, y } = pointer;
            const count = 7;
            const stagger = 140;
            const fade = 240;
            const hold = 260;
            const start = (Math.floor(Math.random() * count) / count) * Math.PI * 2 - Math.PI / 2;

            for (let index = 0; index < count; index += 1) {
                const progress = index / (count - 1);
                const angle = start - progress * ((2 * Math.PI) / 3);
                const radius = 32 + progress * 64;
                const star = document.createElement('div');
                star.className = 'title-spark';
                star.setAttribute('aria-hidden', 'true');
                star.textContent = '✶';
                star.style.left = `${x + Math.cos(angle) * radius}px`;
                star.style.top = `${y + Math.sin(angle) * radius}px`;
                document.body.appendChild(star);

                star.animate([
                    { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' },
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                ], {
                    delay: index * stagger,
                    duration: fade,
                    easing: 'ease-out',
                    fill: 'forwards',
                });

                const out = star.animate([
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
                ], {
                    delay: (count - 1) * stagger + fade + hold + index * stagger,
                    duration: fade,
                    easing: 'ease-in',
                    fill: 'forwards',
                });
                out.onfinish = () => star.remove();
            }

            const splashAt = (count - 1) * stagger * 2 + fade + hold;
            window.setTimeout(() => splash(x, y), splashAt);
            window.setTimeout(() => {
                coolingDown = false;
            }, splashAt + 700 + 4000);
        });
    }

    function init() {
        const glow = mountChrome();
        animateGlow(glow);
        mountWisp();
        bindFoyerSpark();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
