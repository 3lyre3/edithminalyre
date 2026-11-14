(() => {
    'use strict';

    const facts = document.querySelector('.foyer .facts');
    const pool = document.getElementById('faerieland-pool');
    if (!facts || !pool) return;

    const items = Array.from(pool.content.querySelectorAll('.fact'));
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }

    const chosen = items.slice(0, 11);
    const track = document.createElement('div');
    track.className = 'facts-track';
    for (const item of [...chosen, ...chosen]) {
        track.appendChild(item.cloneNode(true));
    }

    facts.replaceChildren(track);
    facts.classList.add('carousel');

    requestAnimationFrame(() => {
        const setWidth = Array.from(track.children)
            .slice(0, chosen.length)
            .reduce((width, item) => {
                const styles = getComputedStyle(item);
                return width + item.offsetWidth + Number.parseFloat(styles.marginRight || 0);
            }, 0);
        if (!Number.isFinite(setWidth) || setWidth === 0) return;

        const animationName = `faerieland-scroll-${Math.floor(Math.random() * 1e9)}`;
        const style = document.createElement('style');
        style.textContent = `@keyframes ${animationName} { to { transform: translateX(-${setWidth}px); } }`;
        document.head.appendChild(style);
        track.style.animationName = animationName;
    });
})();
