document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if (!el || el === document.body) return;
    if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    if (el.hasAttribute('tabindex')) {
        e.preventDefault();
        el.click();
    }
});
