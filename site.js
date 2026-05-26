// site.js — shared behavior across the labyrinth
// Theme toggle, cursor glow, the wisp.

// Mouse tracking (shared between cursor glow and wisp).
let _mouseX = 0, _mouseY = 0;
document.addEventListener('mousemove', (e) => {
    _mouseX = e.clientX;
    _mouseY = e.clientY;
});

// Set theme as early as possible (before paint) from saved preference or system preference.
(function() {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
    } else if (!prefersDark) {
        html.setAttribute('data-theme', 'day');
    }
})();

// Wire up everything once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;

    // ─── Theme toggle ───
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            const next = current === 'day' ? 'night' : 'day';
            html.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    // ─── Cursor glow ───
    const glow = document.getElementById('glow');
    if (glow) {
        let glowX = 0, glowY = 0;
        function animateGlow() {
            glowX += (_mouseX - glowX) * 0.08;
            glowY += (_mouseY - glowY) * 0.08;
            glow.style.left = glowX + 'px';
            glow.style.top = glowY + 'px';
            requestAnimationFrame(animateGlow);
        }
        animateGlow();
    }

    // ─── Foyer title spark — focal effect on hover, with cooldown ───
    // A single star spawns at the cursor on title hover, orbits it
    // briefly, returns, then bursts into a small splash that fades.
    // No page-wide brightness/blur (gentler on photosensitivity than
    // the earlier strobe). 4s cooldown after each fire.
    const titleEl = document.querySelector('body.foyer h1.title');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (titleEl && !reduceMotion) {
        const COOLDOWN_MS = 4000;
        const ORBIT_MS    = 1100;
        const SPLASH_MS   = 700;
        const ORBIT_R     = 46;            // orbit radius in pixels
        const SPLASH_R    = 70;            // average splash distance
        const SPLASH_N    = 8;             // number of splash stars
        const ORBIT_LOOPS = 1.5;           // full revolutions during orbit
        let onCooldown = false;

        titleEl.addEventListener('mouseenter', () => {
            if (onCooldown) return;
            onCooldown = true;

            // Snapshot the cursor position at trigger time.
            const x = _mouseX;
            const y = _mouseY;

            // The orbiting star.
            const star = document.createElement('div');
            star.className = 'title-spark';
            star.setAttribute('aria-hidden', 'true');
            star.textContent = '✶';
            star.style.left = x + 'px';
            star.style.top  = y + 'px';
            document.body.appendChild(star);

            // Build orbit keyframes: emerge, sweep ORBIT_LOOPS rotations
            // along a circle of radius ORBIT_R, then return to centre.
            const steps = 24;
            const kf = [
                { transform: 'translate(-50%, -50%) scale(0)', opacity: 0, offset: 0 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.08 }
            ];
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const angle = t * Math.PI * 2 * ORBIT_LOOPS - Math.PI / 2;
                const dx = Math.cos(angle) * ORBIT_R;
                const dy = Math.sin(angle) * ORBIT_R;
                kf.push({
                    transform: `translate(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px)) scale(1)`,
                    opacity: 1,
                    offset: 0.08 + t * 0.82
                });
            }
            kf.push({ transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.94 });
            kf.push({ transform: 'translate(-50%, -50%) scale(0)', opacity: 0, offset: 1 });

            const orbit = star.animate(kf, {
                duration: ORBIT_MS,
                easing: 'ease-in-out',
                fill: 'forwards'
            });

            orbit.onfinish = () => {
                star.remove();
                // Splash phase — N small stars fan out and fade.
                for (let i = 0; i < SPLASH_N; i++) {
                    const splash = document.createElement('div');
                    splash.className = 'title-spark-splash';
                    splash.setAttribute('aria-hidden', 'true');
                    splash.textContent = '✶';
                    splash.style.left = x + 'px';
                    splash.style.top  = y + 'px';
                    document.body.appendChild(splash);
                    const angle = (i / SPLASH_N) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
                    const dist  = SPLASH_R + (Math.random() - 0.5) * 30;
                    const dx = Math.cos(angle) * dist;
                    const dy = Math.sin(angle) * dist;
                    const sanim = splash.animate([
                        { transform: 'translate(-50%, -50%) scale(0.7)', opacity: 1 },
                        { transform: `translate(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px)) scale(0.3)`, opacity: 0 }
                    ], {
                        duration: SPLASH_MS,
                        easing: 'ease-out',
                        fill: 'forwards'
                    });
                    sanim.onfinish = () => splash.remove();
                }
                setTimeout(() => { onCooldown = false; }, COOLDOWN_MS);
            };
        });
    }

    // ─── The wisp — a figure that never closes ───
    // She belongs to the site, not the page. Injected on every page that loads site.js.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
        let wisp = document.getElementById('wisp');
        if (!wisp) {
            wisp = document.createElement('div');
            wisp.id = 'wisp';
            wisp.className = 'wisp';
            wisp.setAttribute('aria-hidden', 'true');
            wisp.textContent = '✶';
            document.body.appendChild(wisp);
        }
        let t = Math.random() * 1000;
        function drift() {
            t += 0.0025;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const wx = w * (0.5 + 0.43 * Math.sin(t * 0.61));
            const wy = h * (0.5 + 0.40 * Math.sin(t * 0.43 + 1.3));
            wisp.style.transform = 'translate(' + wx + 'px, ' + wy + 'px)';
            const dx = wx - _mouseX, dy = wy - _mouseY;
            const near = Math.sqrt(dx * dx + dy * dy) < 140;
            wisp.classList.toggle('dim', near);
            requestAnimationFrame(drift);
        }
        drift();
    }
});
