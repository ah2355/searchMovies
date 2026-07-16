const express = require('express');
const router = express.Router();
const { anilistQuery } = require('../misc/anilist');

const TMDB = process.env.TMDB_API_KEY;

function toSlug(title) {
    return (title || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// ── Anime watch page ──────────────────────────────────────────────────────────
router.get('/anime/:anilistId', async (req, res) => {
    const { anilistId } = req.params;
    const episode  = Math.max(1, parseInt(req.query.episode)  || 1);
    const tmdbId   = req.query.tmdbId || '';           // passed by media page for back-nav fallback
    const backFallback = tmdbId ? `/media/tv/${tmdbId}` : '/';

    try {
        const data = await anilistQuery(`
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                title { romaji english }
                episodes
                nextAiringEpisode { episode }
                isAdult
              }
            }`, { id: parseInt(anilistId) });

        const media        = data?.data?.Media;
        const title        = media?.title?.english || media?.title?.romaji || 'Anime';
        const episodeCount = media?.episodes
            || (media?.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : 24);
        const isAdult      = !!media?.isAdult;

        const slug         = toSlug(title);
        const defaultSrv   = isAdult ? 'nsfw1' : 'tryembed';
        const initialSrc   = isAdult
            ? `https://hentaiocean.com/embed/${slug}-${episode}?la=1`
            : `https://tryembed.us.cc/embed/anime/${anilistId}/${episode}/sub`;

        const sfwServers = [
            { id: 'tryembed', label: 'Server 1' },
            { id: 'megaplay', label: 'Server 2' },
            { id: 'vidplus',  label: 'Server 3' },
        ];
        const nsfwServers = [
            { id: 'nsfw1', label: 'Server 1' },
            { id: 'nsfw2', label: 'Server 2' },
        ];
        const servers = isAdult ? nsfwServers : sfwServers;

        const serverBtns = servers.map((s, i) =>
            `<button class="wsrv-btn anime-srv${i === 0 ? ' active' : ''}" onclick="setServer('${s.id}',this)" tabindex="0">${s.label}</button>`
        ).join('');

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} – Watch</title>
    <link rel="icon" href="/img/logo.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/css/watch.css">
    <script src="/misc/tvNav.js"></script>
</head>
<body>

<div class="watch-header">
    <button class="watch-back" onclick="goBack()" tabindex="0">
        <i class="fa-solid fa-arrow-left"></i> ${title}
    </button>
    <div class="watch-server-bar">
        ${serverBtns}
        ${!isAdult ? `
        <span class="wsrv-sep"></span>
        <button class="wsrv-btn waud-btn active" onclick="setAudio(false,this)" tabindex="0">Sub</button>
        <button class="wsrv-btn waud-btn" onclick="setAudio(true,this)" tabindex="0">Dub</button>` : ''}
        <button class="wsrv-btn wsrv-fs" onclick="goFullscreen()" tabindex="0">
            <i class="fa-solid fa-expand"></i> Fullscreen
        </button>
    </div>
</div>

<div class="watch-player-wrap">
    <iframe id="watch-iframe" src="${initialSrc}"
            allowfullscreen referrerpolicy="origin" frameborder="0"></iframe>
</div>

<div class="watch-ep-section">
    <div class="watch-ep-header">
        <select id="range-sel" class="watch-season-sel" onchange="renderRange(+this.value)" style="display:none"></select>
        <span class="watch-ep-count">${episodeCount} episodes</span>
    </div>
    <div class="watch-anime-chips" id="anime-chips"></div>
</div>

<script>
    const anilistId    = '${anilistId}';
    const episodeCount = ${episodeCount};
    const isAdult      = ${isAdult};
    const titleSlug    = '${slug.replace(/'/g, "\\'")}';
    let currentEpisode = ${episode};
    let currentServer  = '${defaultSrv}';
    let animeDub       = false;

    function getSrc(ep) {
        const lang = animeDub ? 'dub' : 'sub';
        if (currentServer === 'nsfw1') return \`https://hentaiocean.com/embed/\${titleSlug}-\${ep}?la=1\`;
        if (currentServer === 'nsfw2') return \`https://hentaiocean.com/embed/\${titleSlug}?la=1\`;
        if (currentServer === 'vidplus')  return \`https://player.vidplus.to/embed/anime/\${anilistId}/\${ep}?dub=\${animeDub}&autonext=true&nextbutton=true\`;
        if (currentServer === 'megaplay') return \`https://megaplay.buzz/stream/ani/\${anilistId}/\${ep}/\${lang}\`;
        return \`https://tryembed.us.cc/embed/anime/\${anilistId}/\${ep}/\${lang}\`;
    }

    function selectEpisode(ep) {
        currentEpisode = ep;
        document.getElementById('watch-iframe').src = getSrc(ep);
        document.querySelectorAll('.wac').forEach(c => c.classList.toggle('active', +c.dataset.ep === ep));
        document.querySelector('.watch-player-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
        const url = new URL(window.location.href);
        url.searchParams.set('episode', ep);
        history.replaceState({}, '', url);
    }

    function setServer(srv, btn) {
        currentServer = srv;
        document.getElementById('watch-iframe').src = getSrc(currentEpisode);
        document.querySelectorAll('.anime-srv').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    function setAudio(dub, btn) {
        animeDub = dub;
        document.getElementById('watch-iframe').src = getSrc(currentEpisode);
        document.querySelectorAll('.waud-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    function renderChips(from, to) {
        let html = '';
        for (let i = from; i <= to; i++) {
            html += \`<div class="wac\${i === currentEpisode ? ' active' : ''}" data-ep="\${i}" tabindex="0" onclick="selectEpisode(\${i})">\${i}</div>\`;
        }
        document.getElementById('anime-chips').innerHTML = html;
    }

    function renderRange(idx) {
        const r = window._animeRanges[idx];
        if (r) renderChips(r.from, r.to);
    }

    (function init() {
        if (episodeCount > 100) {
            const ranges = [];
            for (let s = 1; s <= episodeCount; s += 100) {
                const end = Math.min(s + 99, episodeCount);
                ranges.push({ label: 'Episodes ' + s + '\\u2013' + end, from: s, to: end });
            }
            window._animeRanges = ranges;
            const sel = document.getElementById('range-sel');
            sel.innerHTML = ranges.map((r, i) => \`<option value="\${i}">\${r.label}</option>\`).join('');
            sel.style.display = '';
            const cur = ranges.findIndex(r => currentEpisode >= r.from && currentEpisode <= r.to);
            sel.value = cur >= 0 ? cur : 0;
            renderChips(ranges[+sel.value].from, ranges[+sel.value].to);
        } else {
            renderChips(1, episodeCount);
        }
    })();

    const _histStart = history.length;
    history.replaceState({ watchPage: true }, '');

    function goBack() {
        const extra = history.length - _histStart;
        if (extra > 0) {
            window.addEventListener('popstate', function once() {
                window.removeEventListener('popstate', once);
                window.location.replace('${backFallback}');
            });
            history.go(-(extra + 1));
        } else {
            window.location.replace('${backFallback}');
        }
    }

    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.watchPage) {
            window.location.replace('${backFallback}');
        }
    });

    function goFullscreen() {
        const iframe = document.getElementById('watch-iframe');
        (iframe.requestFullscreen || iframe.webkitRequestFullscreen || iframe.mozRequestFullScreen || function(){}).call(iframe);
    }
</script>
</body>
</html>`);
    } catch (err) {
        console.error('Anime watch error:', err);
        res.status(500).send('Something went wrong loading the watch page.');
    }
});

function movieSrc(server, tmdbId, imdbId) {
    if (server === 'vidsrcembed') return imdbId ? `https://vidsrc-embed.ru/embed/movie/${imdbId}` : null;
    if (server === 'videasy')     return `https://player.videasy.net/movie/${tmdbId}`;
    if (server === 'multiembed')  return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
    if (server === 'vidsrcxyz')   return `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`;
    if (server === 'autoembed')   return `https://autoembed.co/movie/tmdb/${tmdbId}`;
    return `https://vidlink.pro/movie/${tmdbId}`;
}

function tvSrc(server, tmdbId, imdbId, season, episode) {
    if (server === 'vidsrcembed') return imdbId ? `https://vidsrc-embed.ru/embed/tv/${imdbId}/${season}-${episode}` : null;
    if (server === 'videasy')     return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
    if (server === 'multiembed')  return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
    if (server === 'vidsrcxyz')   return `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
    if (server === 'autoembed')   return `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`;
    return `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
}

router.get('/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (type !== 'movie' && type !== 'tv') return res.status(404).send('Not found');

    const season = Math.max(1, parseInt(req.query.season) || 1);
    const episode = Math.max(1, parseInt(req.query.episode) || 1);

    try {
        const infoRes = await fetch(
            `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB}&append_to_response=external_ids`
        );
        if (!infoRes.ok) return res.status(404).send('Not found');
        const info = await infoRes.json();

        const title = type === 'movie' ? (info.title || 'Movie') : (info.name || 'Show');
        const imdbId = info.imdb_id || info.external_ids?.imdb_id || '';
        const totalSeasons = info.number_of_seasons || 1;
        const hasImdb = !!imdbId;

        let episodes = [];
        if (type === 'tv') {
            const epRes = await fetch(
                `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB}`
            );
            if (epRes.ok) {
                const epData = await epRes.json();
                episodes = (epData.episodes || []).filter(e => e.episode_type !== 'special');
            }
        }

        let seasonOpts = '';
        for (let s = 1; s <= totalSeasons; s++) {
            seasonOpts += `<option value="${s}"${s === season ? ' selected' : ''}>Season ${s}</option>`;
        }

        const epListHtml = episodes.map(ep => {
            const thumb = ep.still_path
                ? `<img src="https://image.tmdb.org/t/p/w300${ep.still_path}" class="wep-thumb" alt="" loading="lazy">`
                : `<div class="wep-thumb wep-no-thumb"><i class="fa-solid fa-tv"></i></div>`;
            return `
            <div class="wep-card${ep.episode_number === episode ? ' active' : ''}"
                 data-ep="${ep.episode_number}" tabindex="0"
                 onclick="selectEpisode(${ep.episode_number})">
                ${thumb}
                <div class="wep-info">
                    <div class="wep-num">Episode ${ep.episode_number}</div>
                    <div class="wep-title">${(ep.name || '').replace(/</g, '&lt;')}</div>
                    ${ep.overview ? `<div class="wep-overview">${ep.overview.replace(/</g, '&lt;').slice(0, 130)}${ep.overview.length > 130 ? '…' : ''}</div>` : ''}
                </div>
            </div>`;
        }).join('');

        const initialSrc = type === 'movie'
            ? movieSrc('vidlink', id, imdbId)
            : tvSrc('vidlink', id, imdbId, season, episode);

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} – Watch</title>
    <link rel="icon" href="/img/logo.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/css/watch.css">
    <script src="/misc/tvNav.js"></script>
</head>
<body>

<div class="watch-header">
    <button class="watch-back" onclick="goBack()" tabindex="0">
        <i class="fa-solid fa-arrow-left"></i> ${title}
    </button>
    <div class="watch-server-bar">
        <button class="wsrv-btn active" onclick="setServer('vidlink', this)" tabindex="0">Server 1</button>
        <button class="wsrv-btn" onclick="setServer('videasy', this)" tabindex="0">Server 2</button>
        ${hasImdb ? `<button class="wsrv-btn" onclick="setServer('vidsrcembed', this)" tabindex="0">Server 3</button>` : ''}
        <button class="wsrv-btn" onclick="setServer('multiembed', this)" tabindex="0">Server 4</button>
        <button class="wsrv-btn" onclick="setServer('vidsrcxyz', this)" tabindex="0">Server 5</button>
        <button class="wsrv-btn" onclick="setServer('autoembed', this)" tabindex="0">Server 6</button>
        <button class="wsrv-btn wsrv-fs" onclick="goFullscreen()" tabindex="0">
            <i class="fa-solid fa-expand"></i> Fullscreen
        </button>
    </div>
</div>

<div class="watch-player-wrap">
    <iframe id="watch-iframe" src="${initialSrc}"
            allowfullscreen referrerpolicy="origin" frameborder="0"></iframe>
</div>

${type === 'tv' ? `
<div class="watch-ep-section">
    <div class="watch-ep-header">
        <select class="watch-season-sel" onchange="changeSeason(this.value)">
            ${seasonOpts}
        </select>
        <span class="watch-ep-count">${episodes.length} episode${episodes.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="watch-ep-list">
        ${epListHtml}
    </div>
</div>` : ''}

<script>
    const tmdbId = '${id}';
    const imdbId = '${imdbId}';
    const mediaType = '${type}';
    let currentSeason = ${season};
    let currentEpisode = ${episode};
    let currentServer = 'vidlink';

    function movieSrc(server) {
        if (server === 'vidsrcembed') return imdbId ? \`https://vidsrc-embed.ru/embed/movie/\${imdbId}\` : null;
        if (server === 'videasy')     return \`https://player.videasy.net/movie/\${tmdbId}\`;
        if (server === 'multiembed')  return \`https://multiembed.mov/?video_id=\${tmdbId}&tmdb=1\`;
        if (server === 'vidsrcxyz')   return \`https://vidsrc.xyz/embed/movie?tmdb=\${tmdbId}\`;
        if (server === 'autoembed')   return \`https://autoembed.co/movie/tmdb/\${tmdbId}\`;
        return \`https://vidlink.pro/movie/\${tmdbId}\`;
    }

    function tvSrc(server, s, e) {
        if (server === 'vidsrcembed') return imdbId ? \`https://vidsrc-embed.ru/embed/tv/\${imdbId}/\${s}-\${e}\` : null;
        if (server === 'videasy')     return \`https://player.videasy.net/tv/\${tmdbId}/\${s}/\${e}\`;
        if (server === 'multiembed')  return \`https://multiembed.mov/?video_id=\${tmdbId}&tmdb=1&s=\${s}&e=\${e}\`;
        if (server === 'vidsrcxyz')   return \`https://vidsrc.xyz/embed/tv?tmdb=\${tmdbId}&season=\${s}&episode=\${e}\`;
        if (server === 'autoembed')   return \`https://autoembed.co/tv/tmdb/\${tmdbId}-\${s}-\${e}\`;
        return \`https://vidlink.pro/tv/\${tmdbId}/\${s}/\${e}\`;
    }

    function getSrc(server) {
        return mediaType === 'movie'
            ? movieSrc(server)
            : tvSrc(server, currentSeason, currentEpisode);
    }

    function setServer(server, btn) {
        const src = getSrc(server);
        if (!src) { alert('Server not available for this title.'); return; }
        currentServer = server;
        document.getElementById('watch-iframe').src = src;
        document.querySelectorAll('.wsrv-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    function selectEpisode(ep) {
        currentEpisode = ep;
        const src = getSrc(currentServer);
        if (src) document.getElementById('watch-iframe').src = src;
        document.querySelectorAll('.wep-card').forEach(c => c.classList.toggle('active', +c.dataset.ep === ep));
        document.querySelector('.watch-player-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
        const url = new URL(window.location.href);
        url.searchParams.set('season', currentSeason);
        url.searchParams.set('episode', ep);
        history.replaceState({}, '', url);
    }

    function changeSeason(s) {
        window.location.href = '/watch/' + mediaType + '/' + tmdbId + '?season=' + s + '&episode=1';
    }

    const _histStart = history.length;
    history.replaceState({ watchPage: true }, '');

    function goBack() {
        const extra = history.length - _histStart;
        if (extra > 0) {
            window.addEventListener('popstate', function once() {
                window.removeEventListener('popstate', once);
                window.location.replace('/media/${type}/${id}');
            });
            history.go(-(extra + 1));
        } else {
            window.location.replace('/media/${type}/${id}');
        }
    }

    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.watchPage) {
            window.location.replace('/media/${type}/${id}');
        }
    });

    function goFullscreen() {
        const iframe = document.getElementById('watch-iframe');
        (iframe.requestFullscreen || iframe.webkitRequestFullscreen || iframe.mozRequestFullScreen || function(){}).call(iframe);
    }
</script>
</body>
</html>`);
    } catch (err) {
        console.error('Watch page error:', err);
        res.status(500).send('Something went wrong loading the watch page.');
    }
});

module.exports = router;
