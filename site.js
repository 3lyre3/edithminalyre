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

    // ─── Foyer title spark — unfurling heptagonal fan, with cooldown ───
    // On title hover: seven stars spawn one at a time at the seven
    // points of a regular heptagon around the cursor, starting from
    // a random one of those points and proceeding clockwise around
    // the rest. The full fan holds briefly. Then the stars despawn
    // in the same order they appeared (oldest first). The last
    // star's despawn coincides with a small outward splash of fainter
    // stars — the same burst the last star vanishes into.
    // 4s cooldown after each fire.
    const titleEl = document.querySelector('body.foyer h1.title');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (titleEl && !reduceMotion) {
        const COOLDOWN_MS    = 4000;
        const FAN_N          = 7;                       // seven stars per fan
        const FAN_ARC        = (2 * Math.PI) / 3;       // arc span = 1/3 of a full circle (120°)
        const FAN_DIR        = -1;                      // -1 = counter-clockwise (in screen coords), +1 = clockwise
        const FAN_R_INNER    = 32;                      // first star's distance from cursor
        const FAN_R_OUTER    = 96;                      // last star's distance — they spiral outward
        const FAN_START_DIRS = 7;                       // seven possible orientations for the arc's start
        const SPAWN_STAGGER  = 140;   // ms between successive spawns
        const SPAWN_FADE     = 240;   // ms for each star to fade in / scale up
        const HOLD_MS        = 260;   // ms the full fan holds before despawn
        const DESPAWN_FADE   = 240;   // ms for each star to fade out / scale down
        const SPLASH_N       = 8;     // small stars in the closing burst
        const SPLASH_R       = 70;    // average splash distance in px
        const SPLASH_MS      = 700;   // splash burst duration
        let onCooldown = false;

        titleEl.addEventListener('mouseenter', () => {
            if (onCooldown) return;
            onCooldown = true;

            // Snapshot cursor position at trigger time and pick which
            // of the seven possible start orientations the arc takes.
            const cx = _mouseX;
            const cy = _mouseY;
            const startDir = Math.floor(Math.random() * FAN_START_DIRS);
            const startAngle = (startDir / FAN_START_DIRS) * 2 * Math.PI - Math.PI / 2;

            // SPAWN PHASE: each star sits at a point along a 120°
            // arc, with radius increasing from FAN_R_INNER to
            // FAN_R_OUTER as the spiral proceeds. FAN_DIR = -1
            // unfurls counter-clockwise in screen coordinates.
            for (let i = 0; i < FAN_N; i++) {
                const t = i / (FAN_N - 1);                  // 0 → 1 across the fan
                const angle = startAngle + FAN_DIR * t * FAN_ARC;
                const radius = FAN_R_INNER + t * (FAN_R_OUTER - FAN_R_INNER);
                const dx = Math.cos(angle) * radius;
                const dy = Math.sin(angle) * radius;
                const star = document.createElement('div');
                star.className = 'title-spark';
                star.setAttribute('aria-hidden', 'true');
                star.textContent = '✶';
                star.style.left = (cx + dx) + 'px';
                star.style.top  = (cy + dy) + 'px';
                star.style.opacity = '0';
                document.body.appendChild(star);

                // Fade in, then hold, then fade out — one timeline per
                // star, each shifted by SPAWN_STAGGER * i so the fan
                // unfurls in order and despawns in the same order.
                const spawnAt   = i * SPAWN_STAGGER;
                const despawnAt = (FAN_N - 1) * SPAWN_STAGGER + SPAWN_FADE + HOLD_MS + i * SPAWN_STAGGER;

                star.animate([
                    { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' },
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
                ], {
                    delay: spawnAt,
                    duration: SPAWN_FADE,
                    easing: 'ease-out',
                    fill: 'forwards'
                });

                const out = star.animate([
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' }
                ], {
                    delay: despawnAt,
                    duration: DESPAWN_FADE,
                    easing: 'ease-in',
                    fill: 'forwards'
                });
                out.onfinish = () => star.remove();
            }

            // SPLASH PHASE: timed to fire as the LAST star begins its
            // despawn — the last star vanishes into the burst.
            const splashAt = (FAN_N - 1) * SPAWN_STAGGER + SPAWN_FADE + HOLD_MS + (FAN_N - 1) * SPAWN_STAGGER;
            setTimeout(() => {
                for (let i = 0; i < SPLASH_N; i++) {
                    const splash = document.createElement('div');
                    splash.className = 'title-spark-splash';
                    splash.setAttribute('aria-hidden', 'true');
                    splash.textContent = '✶';
                    splash.style.left = cx + 'px';
                    splash.style.top  = cy + 'px';
                    document.body.appendChild(splash);
                    const a = (i / SPLASH_N) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
                    const d = SPLASH_R + (Math.random() - 0.5) * 30;
                    const dx = Math.cos(a) * d;
                    const dy = Math.sin(a) * d;
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
            }, splashAt);

            // Release the cooldown gate after the entire sequence is
            // done, plus the 4s rest.
            const totalMs = splashAt + SPLASH_MS;
            setTimeout(() => { onCooldown = false; }, totalMs + COOLDOWN_MS);
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
