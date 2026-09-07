/* milestone.js — the back arrow retraces your own steps when you arrived from
   within the milestone (pages with more than one parent need this); otherwise
   it falls back to the page's default parent, the href. */
(() => {
  document.addEventListener('click', (event) => {
    const back = event.target.closest('a.back');
    if (!back || back.dataset.hard !== undefined) return;
    let from = '';
    try { from = new URL(document.referrer).pathname; } catch { return; }
    if (history.length > 1 && from.includes('/milestone/')) {
      event.preventDefault();
      history.back();
    }
  });
})();
