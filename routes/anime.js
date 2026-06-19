const express = require('express');
const router = express.Router();
const { fetchFavoritesFromDB, fetchWatchlistFromDB } = require('../misc/db');
const { anilistQuery } = require('../misc/anilist');

router.get("/anime", async (req, res) => {
    const isGuest = !(req.session && req.session.userId);
    const page = Number(req.query.page) || 1;
    const filter = req.query.filter || 'popular';
    const perPage = 20;
    const genre = req.query.genre || '';
    const allowAdult = req.session.nsfw === true || req.query.nsfw === 'true';
    const view = req.query.view === 'schedule' ? 'schedule' : 'grid';

    const sortMap = {
        popular: 'POPULARITY_DESC',
        top_rated: 'SCORE_DESC',
        airing: 'POPULARITY_DESC',
        movies: 'POPULARITY_DESC',
    };

    const isMovie = filter === 'movies';
    const isAiring = filter === 'airing';

    const genres = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];

    const safeGenre = genres.includes(genre) ? genre : '';

    const animeQuery = `
        query ($page: Int, $sort: [MediaSort])  {
            Page(page: $page, perPage: ${perPage}) {
                pageInfo { total currentPage lastPage hasNextPage }
               media(
                    type: ANIME,
                    sort: $sort,
                    ${isAiring ? 'status: RELEASING,' : ''}
                    ${isMovie ? 'format: MOVIE,' : 'format_in: [TV, TV_SHORT, ONA, OVA],'}
                    ${safeGenre ? `genre_in: ["${safeGenre}"],` : ''}
                    isAdult: ${allowAdult ? 'true' : 'false'}
                ) {
                    id
                    idMal
                    title { romaji english }
                    coverImage { large }
                    averageScore
                    genres
                    episodes
                    status
                    format
                    startDate { year }
                    ${isAiring ? 'nextAiringEpisode { episode timeUntilAiring airingAt }' : ''}
                    description(asHtml: false)
                }
            }
        }
    `;

    const [aniData, favorites, watchlist] = await Promise.all([
        anilistQuery(animeQuery, { page, sort: [sortMap[filter] || 'POPULARITY_DESC'] }),
        fetchFavoritesFromDB(req.session.userId),
        fetchWatchlistFromDB(req.session.userId)
    ]);
    if (aniData.errors) console.log('AniList errors:', JSON.stringify(aniData.errors));

    let items = aniData.data?.Page?.media || [];
    
    const pageInfo = aniData.data?.Page?.pageInfo || {};
    const totalPages = pageInfo.lastPage || 1;

    const favoriteIds = favorites.map(f => String(f.imdbId).trim());
    const watchlistIds = watchlist.map(w => String(w.imdbId).trim());

    const filters = [
        { id: 'popular', label: '<i class="fa-solid fa-fire"></i> Popular' },
        { id: 'top_rated', label: '<i class="fa-solid fa-star"></i> Top Rated' },
        { id: 'airing', label: '<i class="fa-solid fa-satellite-dish"></i> Airing' },
        { id: 'movies', label: '<i class="fa-solid fa-clapperboard"></i> Movies' },
    ];

    

    let html = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Anime - SearchMovie</title>
            <link rel="icon" type="image/x-icon" href="/images/icon.png">
            <link rel="stylesheet" href="/css/style.css">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
            <script src="/misc/navMobile.js" defer></script>
            <script src="/misc/showModal.js"></script>
        </head>
        <body>
            <nav class="navbar2">
                <span class="nav-title2"><img src="/images/dragon-face-svgrepo-com.svg" alt="Anime dino icon" width="48" height="48"> Anime</span>
                <div class="nav-links2">
                    <a href="/" class="nav-item">Home</a>
                    <a href="/favorites" class="nav-item">Favorites</a>
                    <a href="/toggle-nsfw" class="nav-item nsfw-btn" style="border:1px solid ${req.session.nsfw ? '#e50914' : '#555'}; border-radius: 15px"> 
                        🔞 NSFW ${req.session.nsfw ? 'ON' : 'OFF'}
                    </a>
                </div>
            </nav>
            
            <div id="anime-choice-bar">
                <div id="choice-barBtn">
                    ${filters.map(f => `
                        <a href="/anime?filter=${f.id}${safeGenre ? '&genre=' + encodeURIComponent(safeGenre) : ''}${allowAdult ? '&nsfw=true' : ''}"
                        style="background:${filter === f.id ? '#e50914' : '#2a2a2a'};">
                        ${f.label}
                    </a>`).join('')}
                </div>

                <div id="filterBox">
                    <i class="fa-solid fa-sliders" style="color:#aaa;"></i>
                    <select id="filterBtn" onchange="window.location.href='/anime?filter=${filter}${allowAdult ? '&nsfw=true' : ''}' + (this.value ? '&genre=' + encodeURIComponent(this.value) : '')">
                        <option value="">Filter Genres</option>
                        ${genres.map(g => `<option value="${g}" ${safeGenre === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                </div>
            </div>

            ${isAiring ? `
                <div id="viewOption-box">
                    <a href="/anime?filter=airing&view=grid&page=${page}${safeGenre ? '&genre=' + encodeURIComponent(safeGenre) : ''}${allowAdult ? '&nsfw=true' : ''}"
                    style="background:${view === 'grid' ? '#e50914' : '#2a2a2a'}; color:white; padding:8px 14px; border-radius:8px; text-decoration:none; font-size:13px;">
                    <i class="fa-solid fa-grip"></i> Grid View
                    </a>
                    <a href="/anime?filter=airing&view=schedule&page=${page}${safeGenre ? '&genre=' + encodeURIComponent(safeGenre) : ''}${allowAdult ? '&nsfw=true' : ''}"
                    style="background:${view === 'schedule' ? '#e50914' : '#2a2a2a'}; color:white; padding:8px 14px; border-radius:8px; text-decoration:none; font-size:13px;">
                    <i class="fa-solid fa-calendar-days"></i> Schedule View
                    </a>
                </div>` : ''
            }

        `;

    let bodyHtml;
    if (isAiring && view === 'schedule') {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const buckets = {};
        for (const item of items) {
            if (!item.nextAiringEpisode) continue;
            const d = new Date(item.nextAiringEpisode.airingAt * 1000);
            const day = days[d.getDay()];
            (buckets[day] = buckets[day] || []).push({ item, date: d });
        }
        const todayIdx = new Date().getDay();
        const ordered = [...Array(7)].map((_, i) => days[(todayIdx + i) % 7]);

        bodyHtml = ordered.filter(day => buckets[day]).map(day => `
            <div class="schedule-day">
                <h2 style="color:#e50914; padding:16px 20px 8px; border-bottom:1px solid #333;">${day}</h2>
                <div class="movie-grid">
                    ${buckets[day].map(({ item, date }) => {
                        const title = item.title.english || item.title.romaji || "Unknown";
                        const poster = item.coverImage?.large || '/images/icon.png';
                        const rating = item.averageScore ? (item.averageScore/10).toFixed(1) : "N/A";
                        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const ep = item.nextAiringEpisode.episode;
                        const searchTitle = item.title.english || item.title.romaji || title;
                        const cleanTitle = searchTitle.replace(/season\s*\d+/i,'').replace(/[-–—:]/g,' ').replace(/\s+/g,' ').trim();
                        return `
                        <div class="movie-card" onclick="window.location.href='/anime-go?title=${encodeURIComponent(cleanTitle).replace(/'/g, '%27')}&aniId=${item.id}'">
                            <div class="poster-container">
                                <span class="cert-badge PG">EP ${ep}</span>
                                <img src="${poster}" alt="${title}">
                            </div>
                            <h3>${title}</h3>
                            <p style="color:#e50914; font-weight:bold;">${time}</p>
                            <p><strong>Rating:</strong> ${rating}</p>
                        </div>`;
                    }).join('')}
                </div>
            </div>`).join('');
    } else {
        // Grid view — the card loop now lives HERE, building a string instead of appending to html
        bodyHtml = `<div class="movie-grid">` + items.map(item => {
            const title = item.title.english || item.title.romaji || "Unknown";
            const releaseYear = item.startDate?.year || "N/A";
            const posterPath = item.coverImage?.large || '/images/icon.png';
            const rating = item.averageScore ? (item.averageScore / 10).toFixed(1) : "N/A";
            const genreText = (item.genres || []).slice(0, 3).join(", ") || "Anime";
            const escapedTitle = title.replace(/'/g, "\\'");
            const escapedGenres = genreText.replace(/'/g, "\\'");
            const searchTitle = item.title.english || item.title.romaji || title;
            const cleanTitle = searchTitle.replace(/season\s*\d+/i, '').replace(/[-–—:]/g, ' ').replace(/\s+/g, ' ').trim();
            const year = item.startDate?.year || '';
            const href = `/anime-go?title=${encodeURIComponent(cleanTitle).replace(/'/g, '%27')}${year ? '&year=' + year : ''}&aniId=${item.id}${isMovie ? '&type=movie' : ''}`;
            const isFav = favoriteIds.includes(String(item.idMal)) ? 'active' : '';
            const isWatchlisted = watchlistIds.includes(String(item.idMal)) ? 'active' : '';
            const mediaTypeLabel = isMovie ? 'Movie' : 'TV Series';

            let airingInfo = '';
            if (isAiring && item.nextAiringEpisode) {
                const secs = item.nextAiringEpisode.timeUntilAiring;
                const days = Math.floor(secs / 86400);
                const hours = Math.floor((secs % 86400) / 3600);
                const ep = item.nextAiringEpisode.episode;
                airingInfo = `<p style="color:#e50914; font-weight:bold; font-size:13px;">Ep ${ep} • ${days}d ${hours}h</p>`;
            }

            return `
            <div class="movie-card" onclick="window.location.href='${href}'">
                <div class="poster-container">
                    <span class="cert-badge PG">PG</span>
                    <img src="${posterPath}" alt="${title}">
                </div>
                <h3>${title}</h3>
                ${isAiring && item.nextAiringEpisode ? airingInfo : `<p>Year: ${releaseYear}</p>`}
                <p><strong>Genre:</strong> ${genreText}</p>
                <p><strong>Rating:</strong> ${rating}</p>
                <div class="movie-card-bottom-bar">
                    <p><strong>Type:</strong> ${mediaTypeLabel}</p>
                    <div id="int-btns">
                        <button class="watchlist-btn ${isWatchlisted}" onclick="event.stopPropagation(); addWatchlist(this, '${escapedTitle}', '${releaseYear}', '${item.idMal || item.id}', '${escapedGenres}', '${rating}', '${posterPath}', 'PG', 'tv')">
                            <span class="eye-icon"></span>
                        </button>
                        <button class="heart-btn ${isFav}" onclick="event.stopPropagation(); addFavorite(this, '${escapedTitle}', '${releaseYear}', '${item.idMal || item.id}', '${escapedGenres}', '${rating}', '${posterPath}', 'PG')">
                            <span class="heart-icon"></span>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('') + `</div>`;
    }

    html += bodyHtml;

    html += `
    <div id="cntrl-btn">
        ${page > 1 ? `<a href="/anime?filter=${filter}&page=${page - 1}${safeGenre ? '&genre=' + encodeURIComponent(safeGenre) : ''}${allowAdult ? '&nsfw=true' : ''}${isAiring ? '&view=' + view : ''}" id="showLess">Previous</a>` : ''}
        <span id="txtPage">Page ${page} of ${totalPages}</span>
        ${pageInfo.hasNextPage ? `<a href="/anime?filter=${filter}&page=${page + 1}${safeGenre ? '&genre=' + encodeURIComponent(safeGenre) : ''}${allowAdult ? '&nsfw=true' : ''}${isAiring ? '&view=' + view : ''}" id="showMore">Next</a>` : ''}
    </div>
    <script>
        const isGuest = ${isGuest};
        async function addFavorite(btn, title, year, imdbId, genres, rating, image, certification) {
            if (isGuest) { showLoginModal(); return; }
            btn.classList.toggle('active');
            await fetch("/favorites/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, year, imdbId, genres, rating, image, certification })
            });
        }
        async function addWatchlist(btn, title, year, imdbId, genres, rating, image, certification, mediaType) {
            if (isGuest) { showLoginModal(); return; }
            btn.classList.toggle('active');
            await fetch("/watchlist/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, year, imdbId, genres, rating, image, certification, mediaType })
            });
        }
    </script>
    </body>
    </html>`;

    res.send(html);
});


router.get("/anime-go", async (req, res) => {
    const api_key = process.env.TMDB_API_KEY;
    const rawTitle = (req.query.title || "").trim();
    const year = req.query.year || "";
    const aniId = req.query.aniId || "";
    const isMovie = req.query.type === 'movie';   // <-- new: movie vs tv
    if (!rawTitle) return res.redirect('/');
 
    const mediaType = isMovie ? 'movie' : 'tv';
    const dateField = isMovie ? 'primary_release_year' : 'first_air_date_year';
 
    const norm = s => s.replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
 
    const candidates = [];
    const base = norm(rawTitle);
    candidates.push(base);
    const cutWords = base.split(' ');
    if (cutWords.length > 3) candidates.push(cutWords.slice(0, 3).join(' '));
    if (cutWords.length > 2) candidates.push(cutWords.slice(0, 2).join(' '));
 
    async function searchTMDB(q, useYear) {
        let url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${api_key}&query=${encodeURIComponent(q)}`;
        if (useYear && year) url += `&${dateField}=${year}`;
        try {
            const r = await fetch(url);
            const d = await r.json();
            return d.results || [];
        } catch { return []; }
    }
 
    try {
        let hit = null;
        for (const cand of candidates) {
            let results = await searchTMDB(cand, true);
            if (!results.length) results = await searchTMDB(cand, false);
            if (results.length) {
                hit = results.find(x => x.original_language === 'ja') || results[0];
                if (hit) break;
            }
        }
 
        if (hit) {
            const nsfwFlag = req.session.nsfw ? 'nsfw=true' : '';
            const params = [aniId ? 'aniId=' + aniId : '', nsfwFlag].filter(Boolean).join('&');
            return res.redirect(`/media/${mediaType}/${hit.id}${params ? '?' + params : ''}`);
        }
        return res.redirect(`/results?q=${encodeURIComponent(rawTitle)}`);
    } catch (err) {
        return res.redirect(`/results?q=${encodeURIComponent(rawTitle)}`);
    }
});
 
router.get("/toggle-nsfw", (req, res) => {
    req.session.nsfw = !req.session.nsfw;
    res.redirect(req.get('referer') || '/');
});


module.exports = router;
