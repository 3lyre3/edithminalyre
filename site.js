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

    // ─── Foyer title ripple — shudder/shimmer on hover, with cooldown ───
    // CSS animates body.foyer-rippling > main. This script adds the
    // class on mouseenter, removes it on the animationend of the
    // second of the two parallel animations (using animationend
    // instead of setTimeout avoids the timing slop that can otherwise
    // strip the class mid-iteration and snap the page), then waits
    // out a 4s cooldown before allowing another trigger.
    const titleEl = document.querySelector('body.foyer h1.title');
    const mainEl  = document.querySelector('body.foyer main');
    if (titleEl && mainEl) {
        const COOLDOWN_MS = 4000;
        let onCooldown = false;
        titleEl.addEventListener('mouseenter', () => {
            if (onCooldown) return;
            onCooldown = true;
            document.body.classList.add('foyer-rippling');
            let endsSeen = 0;
            const handler = (e) => {
                if (e.target !== mainEl) return;
                endsSeen += 1;
                if (endsSeen >= 2) {
                    mainEl.removeEventListener('animationend', handler);
                    document.body.classList.remove('foyer-rippling');
                    setTimeout(() => { onCooldown = false; }, COOLDOWN_MS);
                }
            };
            mainEl.addEventListener('animationend', handler);
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
