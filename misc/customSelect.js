(function () {
    function buildCustomSelect(select) {
        if (select.dataset.enhanced) return;
        select.dataset.enhanced = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        if (select.id) wrapper.id = select.id + '-wrapper';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-select-btn';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', 'false');

        const label = document.createElement('span');
        label.className = 'custom-select-label';
        btn.appendChild(label);
        btn.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-chevron-down"></i>');

        const list = document.createElement('div');
        list.className = 'custom-select-list';
        list.setAttribute('role', 'listbox');

        let items = [];

        function openList() {
            wrapper.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
        }
        function closeList() {
            wrapper.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
        function toggleList() {
            wrapper.classList.contains('open') ? closeList() : openList();
        }

        function rebuildOptions() {
            list.innerHTML = '';
            items = [];
            const selectedOption = select.options[select.selectedIndex];
            label.textContent = selectedOption ? selectedOption.textContent : '';

            Array.from(select.options).forEach((opt, idx) => {
                const item = document.createElement('div');
                item.className = 'custom-select-option' + (opt.selected ? ' selected' : '');
                item.setAttribute('role', 'option');
                item.setAttribute('tabindex', '0');
                item.textContent = opt.textContent;
                item.dataset.value = opt.value;
                items.push(item);

                function selectThis() {
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    label.textContent = opt.textContent;
                    items.forEach(o => o.classList.remove('selected'));
                    item.classList.add('selected');
                    closeList();
                    btn.focus();
                }

                item.addEventListener('click', selectThis);
                item.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectThis();
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = items[idx + 1];
                        if (next) next.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (idx === 0) { closeList(); btn.focus(); }
                        else items[idx - 1].focus();
                    } else if (e.key === 'Escape') {
                        closeList();
                        btn.focus();
                    }
                });

                list.appendChild(item);
            });
        }

        function syncVisibility() {
            // App code controls visibility via select.style.display. The real
            // <select> is always force-hidden via CSS, so mirror its intended
            // display value onto our wrapper instead.
            wrapper.style.display = (select.style.display === 'none') ? 'none' : '';
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleList();
            if (wrapper.classList.contains('open') && items.length) items[0].focus();
        });

        btn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                openList();
                if (items.length) items[0].focus();
            }
        });

        document.addEventListener('click', function (e) {
            if (!wrapper.contains(e.target)) closeList();
        });

        // Keep the custom UI synced when app code changes the select directly
        // (innerHTML, .value, .style.display) — no changes needed in app code.
        select.addEventListener('change', function () {
            const selectedOption = select.options[select.selectedIndex];
            label.textContent = selectedOption ? selectedOption.textContent : '';
            items.forEach(o => o.classList.remove('selected'));
            const match = items.find(o => o.dataset.value === select.value);
            if (match) match.classList.add('selected');
        });

        const observer = new MutationObserver(function (mutations) {
            for (const m of mutations) {
                if (m.type === 'childList') rebuildOptions();
                if (m.type === 'attributes' && m.attributeName === 'style') syncVisibility();
            }
        });
        observer.observe(select, { childList: true, attributes: true, attributeFilter: ['style'] });

        rebuildOptions();
        syncVisibility();

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(btn);
        wrapper.appendChild(list);
        wrapper.appendChild(select);
    }

    function init() {
        document.querySelectorAll('select.enhance-select').forEach(buildCustomSelect);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.refreshCustomSelects = init;
})();
