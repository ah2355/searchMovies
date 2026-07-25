const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/api/status', async (req, res) => {
    const api_key = process.env.TMDB_API_KEY;

    function fetchT(url, opts, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { ...opts, signal: ctrl.signal })
            .catch(() => ({ ok: false, status: 0 }))
            .finally(() => clearTimeout(timer));
    }

    const results = {};

    // MongoDB — synchronous state check
    const rs = mongoose.connection.readyState;
    results.mongodb = {
        name: 'MongoDB',
        status: rs === 1 ? 'ok' : rs === 2 ? 'slow' : 'down',
        detail: rs === 1 ? 'Connected' : rs === 2 ? 'Connecting…' : 'Disconnected'
    };

    // Google OAuth — config check
    results.google = {
        name: 'Google OAuth',
        status: process.env.GOOGLE_CLIENT_ID ? 'ok' : 'unconfigured',
        detail: process.env.GOOGLE_CLIENT_ID ? 'Client ID configured' : 'GOOGLE_CLIENT_ID not set'
    };

    // OMDB — config check
    results.omdb = {
        name: 'OMDB (RT Scores)',
        status: process.env.OMDB_API_KEY ? 'ok' : 'unconfigured',
        detail: process.env.OMDB_API_KEY ? 'API key configured' : 'OMDB_API_KEY not set'
    };

    // TMDB and AniList — live pings in parallel
    const [tmdbRes, anilistRes] = await Promise.allSettled([
        (async () => {
            if (!api_key) return { status: 'unconfigured', detail: 'TMDB_API_KEY not set' };
            const t = Date.now();
            const r = await fetchT(`https://api.themoviedb.org/3/configuration?api_key=${api_key}`, {}, 7000);
            const ms = Date.now() - t;
            if (!r.ok) return { status: 'down', detail: r.status ? `HTTP ${r.status}` : 'Timeout / unreachable' };
            return { status: ms > 2500 ? 'slow' : 'ok', detail: `${ms}ms` };
        })(),
        (async () => {
            const t = Date.now();
            const r = await fetchT('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: '{ Page(page:1,perPage:1) { media { id } } }' })
            }, 6000);
            const ms = Date.now() - t;
            if (!r.ok) return { status: 'down', detail: r.status ? `HTTP ${r.status}` : 'Timeout / unreachable' };
            return { status: ms > 2500 ? 'slow' : 'ok', detail: `${ms}ms` };
        })()
    ]);

    results.tmdb    = { name: 'TMDB',    ...(tmdbRes.value    || { status: 'down', detail: 'Error' }) };
    results.anilist = { name: 'AniList', ...(anilistRes.value || { status: 'down', detail: 'Error' }) };

    res.json(results);
});

router.get('/settings', (req, res) => {
    const isGuest = !(req.session && req.session.userId);
    const username = isGuest ? 'Guest' : (req.session.username || 'User');
    const displayName = (!isGuest && username.includes('@')) ? username.split('@')[0] : username;
    const nsfwEnabled = req.session.nsfw === true;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - SearchMovie</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/settings-page.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="icon" type="image/x-icon" href="/images/icon.png">
    <style>.sp-mobile-tabs{display:none}.sp-card{display:none}</style>
    <script>(function(){var r=document.documentElement;var c=localStorage.getItem('settingsBgColor');if(c)r.style.setProperty('--sm-bg',c);var a=localStorage.getItem('settingsAccent');if(a)r.style.setProperty('--accent',a);var s=localStorage.getItem('settingsCardSize');if(s){var sizes={compact:'120px',normal:'160px',large:'200px'};var h={compact:'180px',normal:'240px',large:'300px'};if(sizes[s]){r.style.setProperty('--card-w',sizes[s]);r.style.setProperty('--card-h',h[s]);}}})();</script>
</head>
<body>
    <nav class="sp-nav">
        <a href="/" class="sp-nav-back"><i class="fa-solid fa-chevron-left"></i> SearchMovie</a>
        <span class="sp-nav-title"><i class="fa-solid fa-gear"></i> Settings</span>
        <span></span>
    </nav>

    <div class="sp-mobile-tabs">
        <button class="sp-mobile-tab" data-tab="account">Account</button>
        <button class="sp-mobile-tab" data-tab="appearance">Appearance</button>
        <button class="sp-mobile-tab" data-tab="homepage">Home Page</button>
        <button class="sp-mobile-tab" data-tab="content">Content</button>
        <button class="sp-mobile-tab" data-tab="status">Status</button>
    </div>

    <div class="sp-layout">
        <aside class="sp-sidebar">
            <a href="#account"    class="sp-sidelink" data-tab="account"><i class="fa-solid fa-user"></i> Account</a>
            <a href="#appearance" class="sp-sidelink" data-tab="appearance"><i class="fa-solid fa-palette"></i> Appearance</a>
            <a href="#homepage"   class="sp-sidelink" data-tab="homepage"><i class="fa-solid fa-house"></i> Home Page</a>
            <a href="#content"    class="sp-sidelink" data-tab="content"><i class="fa-solid fa-shield-halved"></i> Content</a>
            <a href="#status"     class="sp-sidelink" data-tab="status"><i class="fa-solid fa-circle-check"></i> Service Status</a>
        </aside>

        <main class="sp-main">

            <!-- Account -->
            <section class="sp-card" id="account">
                <h2 class="sp-card-title">Account</h2>
                <div class="settings-user-card" style="margin-bottom:16px">
                    <div class="settings-avatar">${displayName.charAt(0).toUpperCase()}</div>
                    <div>
                        <p class="settings-username">${displayName}</p>
                        <p class="settings-user-sub">${isGuest ? 'Guest &mdash; not signed in' : 'Signed in'}</p>
                    </div>
                </div>
                ${isGuest
                    ? `<a href="/users/login" class="settings-link-row"><i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In</a>
                       <a href="/users/register" class="settings-link-row"><i class="fa-solid fa-user-plus"></i> Create Account</a>`
                    : `<a href="/users/login"   class="settings-link-row"><i class="fa-solid fa-user"></i> My Profile</a>
                       <a href="/favorites"      class="settings-link-row"><i class="fa-solid fa-heart"></i> Favourites</a>
                       <a href="/my-watchlist"   class="settings-link-row"><i class="fa-solid fa-bookmark"></i> Watchlist</a>
                       <form action="/users/logout" method="POST" style="margin-top:16px">
                           <button type="submit" class="settings-logout-btn">Log Out</button>
                       </form>`
                }
            </section>

            <!-- Appearance -->
            <section class="sp-card" id="appearance">
                <h2 class="sp-card-title">Appearance</h2>

                <div class="sp-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Background Colour</span>
                        <span class="sp-row-sub">Page background across the site</span>
                    </div>
                    <div class="settings-swatches" id="bg-swatches">
                        <button class="swatch" data-color="#0d0d0d" title="Default Dark"  style="background:#3a3a3a"></button>
                        <button class="swatch" data-color="#000000" title="Pure Black"    style="background:#1e1e1e"></button>
                        <button class="swatch" data-color="#1a1a1a" title="Charcoal"      style="background:#555"></button>
                        <button class="swatch" data-color="#0d1117" title="Midnight Blue" style="background:#1e4a7a"></button>
                        <button class="swatch" data-color="#0a0f1a" title="Dark Navy"     style="background:#1a3870"></button>
                        <button class="swatch" data-color="#120d1a" title="Deep Purple"   style="background:#5a2090"></button>
                        <button class="swatch" data-color="#1a1008" title="Warm Dark"     style="background:#7a4010"></button>
                        <button class="swatch" data-color="#0a1a16" title="Dark Teal"     style="background:#0a6848"></button>
                    </div>
                </div>

                <div class="sp-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Accent Colour</span>
                        <span class="sp-row-sub">Buttons, highlights, and active states</span>
                    </div>
                    <div class="settings-swatches" id="accent-swatches">
                        <button class="accent-swatch" data-accent="#e50914" title="Netflix Red" style="background:#e50914"></button>
                        <button class="accent-swatch" data-accent="#e87c1e" title="Orange"      style="background:#e87c1e"></button>
                        <button class="accent-swatch" data-accent="#f5c518" title="IMDb Yellow" style="background:#f5c518"></button>
                        <button class="accent-swatch" data-accent="#1db954" title="Green"       style="background:#1db954"></button>
                        <button class="accent-swatch" data-accent="#0ea5e9" title="Sky Blue"    style="background:#0ea5e9"></button>
                        <button class="accent-swatch" data-accent="#6366f1" title="Indigo"      style="background:#6366f1"></button>
                        <button class="accent-swatch" data-accent="#a855f7" title="Purple"      style="background:#a855f7"></button>
                        <button class="accent-swatch" data-accent="#ec4899" title="Pink"        style="background:#ec4899"></button>
                    </div>
                </div>

                <div class="sp-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Card Size</span>
                        <span class="sp-row-sub">Size of movie and show cards on the home page</span>
                    </div>
                    <div class="card-size-btns" id="card-size-btns">
                        <button class="card-size-btn" data-size="compact" title="Compact (120px)">S</button>
                        <button class="card-size-btn" data-size="normal"  title="Normal (160px)">M</button>
                        <button class="card-size-btn" data-size="large"   title="Large (200px)">L</button>
                    </div>
                </div>

                <div class="sp-row sp-row-right">
                    <button id="reset-appearance" class="sp-text-btn"><i class="fa-solid fa-rotate-left"></i> Reset to defaults</button>
                </div>
            </section>

            <!-- Home Page -->
            <section class="sp-card" id="homepage">
                <h2 class="sp-card-title">Home Page</h2>

                <div class="sp-row sp-toggle-row sp-desktop-only">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Trailer Preview on Hover</span>
                        <span class="sp-row-sub">Expand cards to play trailers when hovering</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-trailer"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>

                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Recently Viewed</span>
                        <span class="sp-row-sub">Show your watch history on the home page</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-rv"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>

                <p class="sp-subsection-label">Visible Sections</p>

                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Trending Movies</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-sec-movie" data-section="movie-grid"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Trending Shows</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-sec-show" data-section="show-grid"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Trending Today</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-sec-td" data-section="td-grid"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Airing Today</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-sec-air" data-section="airtd-grid"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Trending Anime</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-sec-anime" data-section="anime-grid"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Airing Anime</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-sec-airing-anime" data-section="airing-anime-grid"><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
            </section>

            <!-- Content Preferences -->
            <section class="sp-card" id="content">
                <h2 class="sp-card-title">Content Preferences</h2>

                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Block Adult / NSFW Content</span>
                        <span class="sp-row-sub">Hide explicit content across all pages including anime and search</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-block-adult" ${nsfwEnabled ? '' : 'checked'}><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
                <div class="sp-row sp-toggle-row">
                    <div class="sp-row-info">
                        <span class="sp-row-label">Safe Search</span>
                        <span class="sp-row-sub">Exclude adult titles from movie and TV search results</span>
                    </div>
                    <label class="st-toggle"><input type="checkbox" id="st-safe-search" ${nsfwEnabled ? '' : 'checked'}><span class="st-track"><span class="st-thumb"></span></span></label>
                </div>
            </section>

            <!-- Service Status -->
            <section class="sp-card" id="status">
                <h2 class="sp-card-title">Service Status</h2>

                <div class="svc-row" data-svc="tmdb">
                    <div class="svc-left">
                        <span class="svc-dot checking"></span>
                        <div class="svc-info">
                            <span class="svc-name">TMDB</span>
                            <span class="svc-detail">Movie &amp; TV data</span>
                        </div>
                    </div>
                    <span class="svc-badge checking">Checking…</span>
                </div>

                <div class="svc-row" data-svc="anilist">
                    <div class="svc-left">
                        <span class="svc-dot checking"></span>
                        <div class="svc-info">
                            <span class="svc-name">AniList</span>
                            <span class="svc-detail">Anime data &amp; season chains</span>
                        </div>
                    </div>
                    <span class="svc-badge checking">Checking…</span>
                </div>

                <div class="svc-row" data-svc="mongodb">
                    <div class="svc-left">
                        <span class="svc-dot checking"></span>
                        <div class="svc-info">
                            <span class="svc-name">Database</span>
                            <span class="svc-detail">User accounts &amp; watchlists</span>
                        </div>
                    </div>
                    <span class="svc-badge checking">Checking…</span>
                </div>

                <div class="svc-row" data-svc="google">
                    <div class="svc-left">
                        <span class="svc-dot checking"></span>
                        <div class="svc-info">
                            <span class="svc-name">Google OAuth</span>
                            <span class="svc-detail">Sign in with Google</span>
                        </div>
                    </div>
                    <span class="svc-badge checking">Checking…</span>
                </div>

                <div class="svc-row" data-svc="omdb">
                    <div class="svc-left">
                        <span class="svc-dot checking"></span>
                        <div class="svc-info">
                            <span class="svc-name">OMDB</span>
                            <span class="svc-detail">Rotten Tomatoes scores</span>
                        </div>
                    </div>
                    <span class="svc-badge checking">Checking…</span>
                </div>

                <div class="svc-footer">
                    <span class="svc-last-checked" id="svc-last">Checking…</span>
                    <button class="sp-text-btn" id="svc-refresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
                </div>
            </section>

        </main>
    </div>

    <div id="sp-toast" class="sp-toast">Saved</div>

    <script>
    (function() {
        // Toast helper
        function toast(msg) {
            var t = document.getElementById('sp-toast');
            t.textContent = msg || 'Saved';
            t.classList.add('show');
            setTimeout(function() { t.classList.remove('show'); }, 1800);
        }

        // Tab switching
        var sideLinks = document.querySelectorAll('.sp-sidelink[data-tab]');
        var mobileTabs = document.querySelectorAll('.sp-mobile-tab[data-tab]');
        function showTab(id) {
            document.querySelectorAll('.sp-card').forEach(function(s) {
                s.classList.toggle('sp-active', s.id === id);
            });
            sideLinks.forEach(function(l) {
                l.classList.toggle('active', l.getAttribute('data-tab') === id);
            });
            mobileTabs.forEach(function(t) {
                t.classList.toggle('active', t.getAttribute('data-tab') === id);
            });
            history.replaceState(null, '', '#' + id);
            window.scrollTo(0, 0);
        }
        sideLinks.forEach(function(l) {
            l.addEventListener('click', function(e) {
                e.preventDefault();
                showTab(l.getAttribute('data-tab'));
            });
        });
        mobileTabs.forEach(function(t) {
            t.addEventListener('click', function() {
                showTab(t.getAttribute('data-tab'));
            });
        });
        var initial = (location.hash || '#account').slice(1);
        showTab(document.getElementById(initial) ? initial : 'account');

        // Background swatches
        var savedBg = localStorage.getItem('settingsBgColor') || '#0d0d0d';
        document.querySelectorAll('#bg-swatches .swatch').forEach(function(sw) {
            if (sw.getAttribute('data-color') === savedBg) sw.classList.add('active');
            sw.addEventListener('click', function() {
                var color = sw.getAttribute('data-color');
                document.documentElement.style.setProperty('--sm-bg', color);
                localStorage.setItem('settingsBgColor', color);
                document.querySelectorAll('#bg-swatches .swatch').forEach(function(s) { s.classList.remove('active'); });
                sw.classList.add('active');
                toast('Background updated');
            });
        });

        // Accent swatches
        var savedAccent = localStorage.getItem('settingsAccent') || '#e50914';
        document.querySelectorAll('.accent-swatch').forEach(function(sw) {
            if (sw.getAttribute('data-accent') === savedAccent) sw.classList.add('active');
            sw.addEventListener('click', function() {
                var color = sw.getAttribute('data-accent');
                document.documentElement.style.setProperty('--accent', color);
                localStorage.setItem('settingsAccent', color);
                document.querySelectorAll('.accent-swatch').forEach(function(s) { s.classList.remove('active'); });
                sw.classList.add('active');
                toast('Accent colour updated');
            });
        });

        // Card size
        var savedSize = localStorage.getItem('settingsCardSize') || 'normal';
        var cardSizes = { compact: { w: '120px', h: '180px' }, normal: { w: '160px', h: '240px' }, large: { w: '200px', h: '300px' } };
        document.querySelectorAll('.card-size-btn').forEach(function(btn) {
            if (btn.getAttribute('data-size') === savedSize) btn.classList.add('active');
            btn.addEventListener('click', function() {
                var size = btn.getAttribute('data-size');
                var dims = cardSizes[size];
                if (!dims) return;
                document.documentElement.style.setProperty('--card-w', dims.w);
                document.documentElement.style.setProperty('--card-h', dims.h);
                localStorage.setItem('settingsCardSize', size);
                document.querySelectorAll('.card-size-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                toast('Card size updated');
            });
        });

        // Reset appearance
        document.getElementById('reset-appearance').addEventListener('click', function() {
            localStorage.removeItem('settingsBgColor');
            localStorage.removeItem('settingsAccent');
            localStorage.removeItem('settingsCardSize');
            var r = document.documentElement;
            r.style.removeProperty('--sm-bg');
            r.style.removeProperty('--accent');
            r.style.removeProperty('--card-w');
            r.style.removeProperty('--card-h');
            document.querySelectorAll('#bg-swatches .swatch').forEach(function(s) {
                s.classList.toggle('active', s.getAttribute('data-color') === '#0d0d0d');
            });
            document.querySelectorAll('.accent-swatch').forEach(function(s) {
                s.classList.toggle('active', s.getAttribute('data-accent') === '#e50914');
            });
            document.querySelectorAll('.card-size-btn').forEach(function(b) {
                b.classList.toggle('active', b.getAttribute('data-size') === 'normal');
            });
            toast('Appearance reset');
        });

        // Trailer toggle
        var trailerCb = document.getElementById('st-trailer');
        trailerCb.checked = localStorage.getItem('trailerOnHover') !== 'false';
        trailerCb.addEventListener('change', function() {
            localStorage.setItem('trailerOnHover', trailerCb.checked ? 'true' : 'false');
            toast('Saved');
        });

        // Recently viewed toggle
        var rvCb = document.getElementById('st-rv');
        rvCb.checked = localStorage.getItem('recentlyViewedEnabled') !== 'false';
        rvCb.addEventListener('change', function() {
            localStorage.setItem('recentlyViewedEnabled', rvCb.checked ? 'true' : 'false');
            toast('Saved');
        });

        // Section visibility toggles
        var sectionIds = ['st-sec-movie','st-sec-show','st-sec-td','st-sec-air','st-sec-anime','st-sec-airing-anime'];
        var hiddenSections = JSON.parse(localStorage.getItem('hiddenSections') || '[]');
        sectionIds.forEach(function(cbId) {
            var cb = document.getElementById(cbId);
            if (!cb) return;
            var sectionKey = cb.getAttribute('data-section');
            cb.checked = hiddenSections.indexOf(sectionKey) === -1;
            cb.addEventListener('change', function() {
                var hidden = JSON.parse(localStorage.getItem('hiddenSections') || '[]');
                if (cb.checked) {
                    hidden = hidden.filter(function(s) { return s !== sectionKey; });
                } else {
                    if (hidden.indexOf(sectionKey) === -1) hidden.push(sectionKey);
                }
                localStorage.setItem('hiddenSections', JSON.stringify(hidden));
                toast('Saved');
            });
        });

        // Service status
        var statusLabels = { ok: 'Operational', slow: 'Degraded', down: 'Down', unconfigured: 'Not Set', checking: 'Checking…' };
        function loadStatus() {
            document.querySelectorAll('.svc-row[data-svc]').forEach(function(row) {
                row.querySelector('.svc-dot').className = 'svc-dot checking';
                var badge = row.querySelector('.svc-badge');
                badge.className = 'svc-badge checking';
                badge.textContent = 'Checking…';
            });
            document.getElementById('svc-last').textContent = 'Checking…';

            fetch('/api/status')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    Object.keys(data).forEach(function(key) {
                        var row = document.querySelector('.svc-row[data-svc="' + key + '"]');
                        if (!row) return;
                        var svc = data[key];
                        var s = svc.status;
                        row.querySelector('.svc-dot').className = 'svc-dot ' + s;
                        var badge = row.querySelector('.svc-badge');
                        badge.className = 'svc-badge ' + s;
                        badge.textContent = statusLabels[s] || s;
                        if (svc.detail) row.querySelector('.svc-detail').textContent = svc.detail;
                    });
                    document.getElementById('svc-last').textContent = 'Last checked: ' + new Date().toLocaleTimeString();
                })
                .catch(function() {
                    document.getElementById('svc-last').textContent = 'Could not reach status endpoint';
                });
        }
        var svcTimer = null;
        function scheduleStatusRefresh() {
            clearInterval(svcTimer);
            svcTimer = setInterval(loadStatus, 30 * 60 * 1000);
        }
        loadStatus();
        scheduleStatusRefresh();
        document.getElementById('svc-refresh').addEventListener('click', function() {
            loadStatus();
            scheduleStatusRefresh();
        });

        // Content preferences
        function setNsfw(enabled) {
            fetch('/api/set-nsfw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: enabled })
            });
        }
        var blockAdultCb = document.getElementById('st-block-adult');
        blockAdultCb.addEventListener('change', function() {
            setNsfw(!blockAdultCb.checked);
            document.getElementById('st-safe-search').checked = blockAdultCb.checked;
            toast('Saved');
        });
        var safeSearchCb = document.getElementById('st-safe-search');
        safeSearchCb.addEventListener('change', function() {
            setNsfw(!safeSearchCb.checked);
            document.getElementById('st-block-adult').checked = safeSearchCb.checked;
            toast('Saved');
        });
    })();
    </script>
</body>
</html>`);
});

module.exports = router;
