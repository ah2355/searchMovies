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

// Detect Smart TV browsers by UA string — CSS hover/pointer media features
// are unreliable on Silk (FireTV) and LG webOS, so stamp a class instead.
(function detectTV() {
    var ua = navigator.userAgent;
    var isTV =
        /Silk/i.test(ua) ||              // Amazon Fire TV / Fire Stick (Silk / Amazon Internet)
        /Web0S|webOS/i.test(ua) ||       // LG webOS
        /SmartTV|SMART-TV/i.test(ua) ||  // Generic smart TV
        /Tizen/i.test(ua) ||             // Samsung Tizen
        /Android TV/i.test(ua);          // Android TV / NVIDIA Shield
    if (isTV) document.documentElement.classList.add('tv-device');
})();
