const express = require('express');
const router = express.Router();
const genreMap = require('../misc/genreMap');
const { fetchFavoritesFromDB, fetchWatchlistFromDB } = require('../misc/db');

router.get("/results", async (req, res) => {
    const isGuest = !(req.session && req.session.userId);
    const searchMovie = req.query.q ? req.query.q.trim() : "";
    const api_key = process.env.TMDB_API_KEY;
    const page = Number(req.query.page) || 1;
    const searchLang = req.query.language || "";
    const allowAdult = req.session.nsfw === true;
    const nsfwFlag = allowAdult ? '?nsfw=true' : '';
    const filterType = req.query.type || '';
    const filterYear = req.query.year ? req.query.year.trim() : '';
    let html;

    if (!searchMovie) {
        const params = new URLSearchParams(req.query).toString();
        return res.redirect(`/discover?${params}`);
    }

    try {
        let movies = [];
        let totalPages = 1;
        let hasNext = false;
        let totalApprox = false;

        if (searchLang) {
            const yearMovieParam = filterYear ? `&primary_release_year=${filterYear}` : '';
            const yearTvParam = filterYear ? `&first_air_date_year=${filterYear}` : '';
            const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${api_key}&with_original_language=${searchLang}&with_text_query=${encodeURIComponent(searchMovie)}&page=${page}&sort_by=popularity.desc&include_adult=${allowAdult}${yearMovieParam}`;
            const tvUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${api_key}&with_original_language=${searchLang}&with_text_query=${encodeURIComponent(searchMovie)}&page=${page}&sort_by=popularity.desc&include_adult=${allowAdult}${yearTvParam}`;

            const wantMovie = !filterType || filterType === 'movie';
            const wantTv = !filterType || filterType === 'tv';
            const fetches = [];
            if (wantMovie) fetches.push(fetch(movieUrl, { method: 'GET', headers: { accept: 'application/json' } }));
            if (wantTv) fetches.push(fetch(tvUrl, { method: 'GET', headers: { accept: 'application/json' } }));
            const responses = await Promise.all(fetches);
            const jsons = await Promise.all(responses.map(r => r.json()));

            let movieData = { results: [], total_pages: 1 }, tvData = { results: [], total_pages: 1 };
            if (wantMovie && wantTv) { movieData = jsons[0]; tvData = jsons[1]; }
            else if (wantMovie) { movieData = jsons[0]; }
            else if (wantTv) { tvData = jsons[0]; }

            totalPages = Math.max(movieData.total_pages || 1, tvData.total_pages || 1);
            hasNext = page < totalPages;
            movies = [
                ...(movieData.results || []).map(m => ({ ...m, media_type: 'movie' })),
                ...(tvData.results || []).map(m => ({ ...m, media_type: 'tv' }))
            ];
        }
        else {
            // Multi search. Accumulate from TMDB page 1, filter people, dedupe the
            // whole list, then slice this display page's window -> each unique item
            // appears on exactly ONE page (no cross-page duplicates).
            const PER_PAGE = 20;
            const FETCH_CAP = 25;
            const need = page * PER_PAGE;
            const seen = new Set();
            const collected = [];
            let tmdbPage = 1;
            let tmdbTotalPages = 1;
            let moreTmdbPages = true;
            let firstRaw = 0, firstFiltered = 0;

            while (moreTmdbPages && tmdbPage <= FETCH_CAP) {
                // Stop early only if the full set is too big to count AND we already
                // have enough for this display page.
                if (tmdbTotalPages > FETCH_CAP && collected.length >= need + 1) break;

                const apiUrl = `https://api.themoviedb.org/3/search/multi?api_key=${api_key}&query=${encodeURIComponent(searchMovie)}&include_adult=${allowAdult}&page=${tmdbPage}`;
                const apiRes = await fetch(apiUrl, { method: 'GET', headers: { accept: 'application/json' } });
                if (!apiRes.ok) break;
                const apiData = await apiRes.json();
                tmdbTotalPages = apiData.total_pages || 1;

                const raw = (apiData.results || []);
                let filteredThisPage = 0;
                for (const item of raw) {
                    if (item.media_type !== "movie" && item.media_type !== "tv") continue;
                    if (filterType && item.media_type !== filterType) continue;
                    if (filterYear) {
                        const d = item.release_date || item.first_air_date || '';
                        if (!d.startsWith(filterYear)) continue;
                    }
                    filteredThisPage++;
                    const key = item.media_type + ':' + item.id;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    collected.push(item);
                }
                if (tmdbPage === 1) { firstRaw = raw.length; firstFiltered = filteredThisPage; }

                moreTmdbPages = tmdbPage < tmdbTotalPages;
                tmdbPage++;
            }

            const startIdx = (page - 1) * PER_PAGE;
            movies = collected.slice(startIdx, startIdx + PER_PAGE);

            if (!moreTmdbPages) {
                totalPages = Math.max(1, Math.ceil(collected.length / PER_PAGE));
                totalApprox = false;
            } else {
                const ratio = firstRaw > 0 ? (firstFiltered / firstRaw) : 1;
                const estRealResults = tmdbTotalPages * 20 * ratio;
                totalPages = Math.min(500, Math.max(1, Math.ceil(estRealResults / PER_PAGE)));
                totalApprox = true;
            }

            hasNext = page < totalPages && movies.length > 0;
        }

        const [favorites, watchlist] = await Promise.all([
            fetchFavoritesFromDB(req.session.userId),
            fetchWatchlistFromDB(req.session.userId)
        ]);
        const favoriteIds = favorites.map(f => String(f.imdbId).trim());
        const watchlistIds = watchlist.map(w => String(w.imdbId).trim());

        html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Search Results — SearchMovie</title>
                <meta name="description" content="Search, discover, and track your favorite movies and TV shows. Find reviews and streaming providers with SearchMovie.">
                <meta property="og:title" content="SearchMovie - Movie & TV Discovery">
                <meta property="og:description" content="Discover, search, and track your favorite movies and TV shows with real-time Rotten Tomatoes scores.">
                <meta property="og:image" content="https://searchmovie.win/images/icon.png">
                <meta property="og:url" content="https://searchmovie.win">
                <meta property="og:type" content="website">
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="SearchMovie - Movie & TV Discovery">
                <meta name="twitter:description" content="Discover, search, and track your favorite movies and TV shows.">
                <meta name="twitter:image" content="https://searchmovie.win/images/icon.png">
                <link rel="icon" type="image/png" href="https://searchmovie.win/images/icon.png">
                <link rel="apple-touch-icon" href="https://searchmovie.win/images/icon.png">
                <link rel="stylesheet" href="/css/style.css">
                <link rel="icon" type="image/x-icon" href="/images/icon.png">
                <link rel="manifest" href="/manifest.json">
                <meta name="theme-color" content="#e50914">
                <link rel="preconnect" href="https://image.tmdb.org">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://cdnjs.cloudflare.com">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <script src="/misc/navMobile.js" defer></script>
                <script src="/misc/tvNav.js" defer></script>
                <script src="/misc/showModal.js"></script>
                <script>(function(){var r=document.documentElement;var c=localStorage.getItem('settingsBgColor');if(c)r.style.setProperty('--sm-bg',c);var a=localStorage.getItem('settingsAccent');if(a)r.style.setProperty('--accent',a);})();</script>
            </head>
            <body>
                <nav class="navbar2">
                    <span class="nav-title2">Search Results</span>
                    <div class="nav-links2">
                    <form id="searchForm" action="/results" method="get" style="position:relative;">
                        <input type="text" name="q" id="movieName" placeholder="Search movies & shows..." value="${searchMovie.replace(/"/g, '&quot;')}">
                        <button id="searchBtn"><i class="fa-solid fa-magnifying-glass"></i></button>
                        <div id="suggestionsBox"></div>
                    </form>
                    <a id="elemNav" href="/" class="nav-item">Home</a>
                    <a href="/favorites" class="nav-item">Favorites</a>
                    </div>
                </nav>
                <div class="results-header">
                    <h1 class="results-title">Results for <span>"${searchMovie.replace(/"/g, '&quot;')}"</span></h1>
                    <form class="results-filters" action="/results" method="get" id="filterForm">
                        <input type="hidden" name="q" value="${searchMovie.replace(/"/g, '&quot;')}">
                        <div class="filter-type-group">
                            <button type="submit" name="type" value="" class="filter-type-btn${!filterType ? ' active' : ''}">All</button>
                            <button type="submit" name="type" value="movie" class="filter-type-btn${filterType === 'movie' ? ' active' : ''}">Movies</button>
                            <button type="submit" name="type" value="tv" class="filter-type-btn${filterType === 'tv' ? ' active' : ''}">TV Shows</button>
                        </div>
                        <div class="filter-row-2">
                            <input type="number" name="year" class="filter-year-input" placeholder="Year" min="1900" max="2030" value="${filterYear}" title="Filter by release year">
                            <select name="language" class="filter-lang-select" onchange="this.form.submit()" title="Filter by language">
                                <option value="">All Languages</option>
                                <option value="en"  ${searchLang === 'en'  ? 'selected' : ''}>English</option>
                                <option value="hi"  ${searchLang === 'hi'  ? 'selected' : ''}>Hindi</option>
                                <option value="ta"  ${searchLang === 'ta'  ? 'selected' : ''}>Tamil</option>
                                <option value="te"  ${searchLang === 'te'  ? 'selected' : ''}>Telugu</option>
                                <option value="kn"  ${searchLang === 'kn'  ? 'selected' : ''}>Kannada</option>
                                <option value="bn"  ${searchLang === 'bn'  ? 'selected' : ''}>Bangla</option>
                                <option value="ko"  ${searchLang === 'ko'  ? 'selected' : ''}>Korean</option>
                                <option value="zh"  ${searchLang === 'zh'  ? 'selected' : ''}>Chinese</option>
                                <option value="ja"  ${searchLang === 'ja'  ? 'selected' : ''}>Japanese</option>
                                <option value="es"  ${searchLang === 'es'  ? 'selected' : ''}>Spanish</option>
                                <option value="fr"  ${searchLang === 'fr'  ? 'selected' : ''}>French</option>
                            </select>
                            ${filterYear || filterType || searchLang ? `<a href="/results?q=${encodeURIComponent(searchMovie)}" class="filter-clear">✕ Clear</a>` : ''}
                        </div>
                    </form>
                </div>
                <div class="movie-grid">
        `;

        if (movies.length === 0) {
            html += `
            </div> <!-- close movie-grid -->
            <div style="display:flex; justify-content:center; align-items:center; height:60vh;">
                <h2 style="color:white; text-align:center;">No matches found for your filter criteria.</h2>
            </div>`;
        } else {
            for (const movie of movies) {
                const movieTitle = movie.media_type === "movie" ? (movie.title || "Unknown Movie") : (movie.name || "Unknown Show");
                const dateString = movie.media_type === "movie" ? (movie.release_date || "") : (movie.first_air_date || "");
                const releaseYear = dateString ? dateString.substring(0, 4) : "N/A";
                const rating = (movie.vote_average && !isNaN(movie.vote_average)) ? Number(movie.vote_average).toFixed(1) : "N/A";
                const posterPath = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
                const posterIcon = movie.media_type === 'tv' ? 'fa-tv' : 'fa-film';

                let genreText = "Unknown";
                if (movie.genre_ids && movie.genre_ids.length > 0) {
                    const names = movie.genre_ids.map(id => genreMap[id]).filter(Boolean);
                    if (names.length > 0) genreText = names.join(", ");
                }

                let ageCertificate = "PG-13";
                const rRatedGenres = [27, 80, 53];
                const isMatureGenre = movie.genre_ids && movie.genre_ids.some(id => rRatedGenres.includes(id));
                const familyGenres = [16, 10751];
                const isFamilyGenre = movie.genre_ids && movie.genre_ids.some(id => familyGenres.includes(id));
                if (isMatureGenre) ageCertificate = "R";
                else if (isFamilyGenre) ageCertificate = "PG";
                else if (movie.genre_ids && movie.genre_ids.includes(10749)) ageCertificate = "PG-13";

                const certClass = ageCertificate.replace(/[^a-zA-Z0-9]/g, '-');
                const escapedTitle = movieTitle.replace(/'/g, "\\'");
                const escapedGenres = genreText.replace(/'/g, "\\'");
                const isFav = favoriteIds.includes(String(movie.id).trim()) ? 'active' : '';
                const displayType = (movie.media_type === "tv") ? "TV Series" : "Movie";
                const isWatchlisted = watchlistIds.includes(String(movie.id).trim()) ? 'active' : '';
                const mtype = movie.media_type || 'movie';

                html += `
                    <div class="movie-card" tabindex="0" onclick="window.location.href='/media/${mtype}/${movie.id}${nsfwFlag}'">
                        <div class="poster-container">
                        <span class="cert-badge ${certClass}">${ageCertificate}</span>
                        ${posterPath
                            ? `<img src="${posterPath}" alt="movie poster">`
                            : `<div class="no-poster"><i class="fa-solid ${posterIcon}"></i></div>`}
                    </div>

                    <h3>${movieTitle}</h3>
                    <p>Year: ${releaseYear || "N/A"}</p>
                    <p><strong>Genre:</strong> ${genreText}</p>
                    <p>
                        <div class="starrt-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                <span style="font-size: 0.85rem;">${rating}</span>
                            </svg>
                        </div>
                    </p>

                    <div class="movie-card-bottom-bar">
                        <p><strong>Type:</strong> ${displayType}</p>
                        <div id="int-btns">
                            <button class="watchlist-btn ${isWatchlisted}" onclick="event.stopPropagation(); addWatchlist(this, '${escapedTitle}', '${releaseYear}', '${movie.id}', '${escapedGenres}', '${rating}', '${posterPath}', '${ageCertificate}', '${mtype}')">
                                <span class="eye-icon"></span>
                            </button>
                            <button class="heart-btn ${isFav}" onclick="event.stopPropagation(); addFavorite(this, '${escapedTitle}', '${releaseYear}', '${movie.id}', '${escapedGenres}', '${rating}', '${posterPath}', '${ageCertificate}')">
                                <span class="heart-icon"></span>
                            </button>
                        </div>
                    </div>
                </div>
                `;
            }
        }

        html += `
            </div>
            <div id="cntrl-btn">
                ${page > 1 ? `<a href="/results?q=${encodeURIComponent(searchMovie)}&page=${page - 1}${searchLang ? '&language=' + encodeURIComponent(searchLang) : ''}${filterType ? '&type=' + filterType : ''}${filterYear ? '&year=' + filterYear : ''}" id="showLess">Previous</a>` : ''}
                <span id="txtPage">Page ${page} of ${totalApprox ? '~' : ''}${totalPages}</span>
                ${hasNext ? `<a href="/results?q=${encodeURIComponent(searchMovie)}&page=${page + 1}${searchLang ? '&language=' + encodeURIComponent(searchLang) : ''}${filterType ? '&type=' + filterType : ''}${filterYear ? '&year=' + filterYear : ''}" id="showMore">Next</a>` : ''}
            </div>
            <script>
                const isGuest = ${isGuest};

                async function addFavorite(btn, title, year, imdbId, genres, rating, image, certification) {
                    if (isGuest) {
                        showLoginModal();
                        return;
                    }
                    const isActive = btn.classList.toggle('active');
                    await fetch("/favorites/add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title, year, imdbId, genres, rating, image, certification })
                    });
                    if (isActive) console.log(title + " toggled (added/removed) in favorites!");
                }

                async function addWatchlist(btn, title, year, imdbId, genres, rating, image, certification, mediaType) {
                    if (isGuest) {
                        showLoginModal();
                        return;
                    }
                    btn.classList.toggle('active');
                    await fetch("/watchlist/add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title, year, imdbId, genres, rating, image, certification, mediaType })
                    });
                }

                window.addEventListener('pageshow', function(event) {
                    if (event.persisted) window.location.reload();
                });

                (function() {
                    var input = document.getElementById('movieName');
                    var box = document.getElementById('suggestionsBox');
                    if (!input || !box) return;
                    var timer, activeIdx = -1;

                    function hideSuggestions() {
                        box.style.display = 'none';
                        box.innerHTML = '';
                        activeIdx = -1;
                    }

                    function showSuggestions(items) {
                        if (!items.length) { hideSuggestions(); return; }
                        box.innerHTML = items.map(function(item) {
                            var img = item.poster
                                ? '<img src="' + item.poster + '" alt="" class="suggestion-img">'
                                : '<div class="suggestion-img suggestion-no-img"></div>';
                            var year = item.year ? ' (' + item.year + ')' : '';
                            var badge = item.type === 'movie' ? 'Movie' : 'TV';
                            return '<div class="suggestion-item" data-href="/media/' + item.type + '/' + item.id + '">'
                                + img
                                + '<div class="suggestion-text">'
                                + '<span class="suggestion-title">' + item.title.replace(/</g,'&lt;') + year + '</span>'
                                + '<span class="suggestion-badge">' + badge + '</span>'
                                + '</div></div>';
                        }).join('');
                        box.style.display = 'block';
                        activeIdx = -1;
                        box.querySelectorAll('.suggestion-item').forEach(function(el) {
                            el.addEventListener('mousedown', function(e) {
                                e.preventDefault();
                                window.location.href = el.getAttribute('data-href');
                            });
                        });
                    }

                    input.addEventListener('input', function() {
                        clearTimeout(timer);
                        var q = input.value.trim();
                        if (q.length < 2) { hideSuggestions(); return; }
                        timer = setTimeout(async function() {
                            try {
                                var r = await fetch('/api/search-suggest?q=' + encodeURIComponent(q));
                                showSuggestions(await r.json());
                            } catch(e) {}
                        }, 220);
                    });

                    input.addEventListener('keydown', function(e) {
                        var items = box.querySelectorAll('.suggestion-item');
                        if (!items.length) return;
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            activeIdx = Math.min(activeIdx + 1, items.length - 1);
                            items.forEach(function(el, i) { el.classList.toggle('suggestion-active', i === activeIdx); });
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            activeIdx = Math.max(activeIdx - 1, -1);
                            items.forEach(function(el, i) { el.classList.toggle('suggestion-active', i === activeIdx); });
                        } else if (e.key === 'Enter' && activeIdx >= 0) {
                            e.preventDefault();
                            window.location.href = items[activeIdx].getAttribute('data-href');
                        } else if (e.key === 'Escape') {
                            hideSuggestions();
                        }
                    });

                    document.addEventListener('click', function(e) {
                        if (!box.contains(e.target) && e.target !== input) hideSuggestions();
                    });
                })();
            </script>
            </body>
            </html>
        `;

        return res.send(html);
    } catch (err) {
        return res.status(500).send("Error reading data.");
    }
});

router.get('/api/search-suggestions', async (req, res) => {
    const query = req.query.q;
    const api_key = process.env.TMDB_API_KEY;
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${api_key}&query=${encodeURIComponent(query)}&page=1`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const suggestions = (data.results || [])
            .filter(m => (m.title || m.name) && m.poster_path) 
            .sort((a, b) => b.popularity - a.popularity)       
            .slice(0, 5)                                       
            .map(m => ({ 
                title: m.title || m.name, 
                id: m.id,
                media_type: m.media_type ,
                poster_path: m.poster_path
            }));
            
        res.json(suggestions);
    } catch (err) {
        res.json([]);
    }
});

const moodMeta = {
    "Action":      { emoji: "💥", label: "Action",      vibe: "High-octane thrills & explosions" },
    "Comedy":      { emoji: "😄", label: "Comedy",      vibe: "Good vibes & big laughs" },
    "Horror":      { emoji: "💀", label: "Horror",      vibe: "Things that go bump in the night" },
    "Romance":     { emoji: "💕", label: "Romance",     vibe: "Love stories that hit different" },
    "Sci-Fi":      { emoji: "🚀", label: "Sci-Fi",      vibe: "The future, space, and beyond" },
    "Thriller":    { emoji: "🎭", label: "Thriller",    vibe: "Edge-of-your-seat suspense" },
    "Crime":       { emoji: "🔍", label: "Crime",       vibe: "Detectives, heists & dark secrets" },
    "Documentary": { emoji: "🎙️", label: "Documentary", vibe: "True stories worth watching" },
    "Animation":   { emoji: "🎨", label: "Animation",   vibe: "Art in motion" },
    "Drama":       { emoji: "🎬", label: "Drama",       vibe: "Real emotions, real stories" },
    "Fantasy":     { emoji: "✨", label: "Fantasy",     vibe: "Magic, myth & other worlds" },
    "Adventure":   { emoji: "🗺️", label: "Adventure",   vibe: "Journey into the unknown" },
    "Mystery":     { emoji: "🕵️", label: "Mystery",     vibe: "Questions that demand answers" },
    "Family":      { emoji: "🏡", label: "Family",      vibe: "For everyone, young and old" },
};

router.get("/discover", async(req, res) => {
    const isGuest = !(req.session && req.session.userId);
    const api_key = process.env.TMDB_API_KEY;
    const ratingSearch = req.query.rating ? req.query.rating.trim() : "";
    const yearSearch = req.query.year ? req.query.year.trim() : "";
    const typeSearch = req.query.media || "movie";
    const normalizedType = (typeSearch === "tvSeries" || typeSearch === "tv") ? "tv" : "movie";
    const page = Number(req.query.page) || 1;
    const genreSearch = req.query.genres ? req.query.genres.split(",").map(g => g.trim()) : [];
    const langFilter = req.query.language || "en";
    const primaryGenre = genreSearch[0] || "";
    const mood = moodMeta[primaryGenre] || null;

    const textToGenreId = normalizedType === "tv" ? {
    "Action": 10759,  "Adventure": 10759,  "Animation": 16, 
    "Comedy": 35, "Crime": 80, "Documentary": 99, "Drama": 18, 
    "Family": 10751, "Fantasy": 10765, "Horror": 10765, // Map Horror to Sci-Fi/Fantasy for TV results
    "Mystery": 9648, // Mystery TV ID is 9648
     "Romance": 10749,  "Sci-Fi": 10765, 
    "Thriller": 10759, // Thrillers are often under Action/Adventure in TV
    "War": 10768, "Western": 37 } :
     {
        "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
        "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
        "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
        "Mystery": 96, "Romance": 10749, "Sci-Fi": 878, "Thriller": 53,
        "War": 10752, "Western": 37
    };

    try {
        let apiUrl = `https://api.themoviedb.org/3/discover/${normalizedType}?api_key=${api_key}&page=${page}&include_adult=false&sort_by=popularity.desc&with_original_language=${encodeURIComponent(langFilter)}`;

        if (ratingSearch) apiUrl += `&vote_average.gte=${parseFloat(ratingSearch)}`;
        if (yearSearch) apiUrl += normalizedType === "movie" ? `&primary_release_date.gte=${yearSearch}-01-01&primary_release_date.lte=${yearSearch}-12-31` : `&first_air_date_year=${yearSearch}`;
        if (genreSearch.length > 0 && genreSearch[0] !== "") {
            const structuralIds = genreSearch.map(name => textToGenreId[name]).filter(Boolean);
            if (structuralIds.length > 0) apiUrl += `&with_genres=${structuralIds.join(",")}`;
        }

        const [apiRes, favorites, watchlist] = await Promise.all([
            fetch(apiUrl, { method: 'GET', headers: { accept: 'application/json', Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` } }),
            fetchFavoritesFromDB(req.session.userId),
            fetchWatchlistFromDB(req.session.userId)
        ]);

        const apiData = await apiRes.json();
        const movies = apiData.results || [];
        const totalPages = Math.min(apiData.total_pages || 1, 500);
        const favoriteIds = favorites.map(f => String(f.imdbId).trim());
        const watchlistIds = watchlist.map(w => String(w.imdbId).trim());

        let html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${mood ? `${mood.label} — SearchMovie` : 'Discover — SearchMovie'}</title>
                <meta name="description" content="Search, discover, and track your favorite movies and TV shows. Find reviews and streaming providers with SearchMovie.">
                
                <meta property="og:title" content="SearchMovie - Movie & TV Discovery">
                <meta property="og:description" content="Discover, search, and track your favorite movies and TV shows with real-time Rotten Tomatoes scores.">
                <meta property="og:image" content="https://searchmovie.win/images/icon.png">
                <meta property="og:url" content="https://searchmovie.win">
                <meta property="og:type" content="website">

                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="SearchMovie - Movie & TV Discovery">
                <meta name="twitter:description" content="Discover, search, and track your favorite movies and TV shows.">
                <meta name="twitter:image" content="https://searchmovie.win/images/icon.png">
                
                <link rel="icon" type="image/png" href="https://searchmovie.win/images/icon.png">
                <link rel="apple-touch-icon" href="https://searchmovie.win/images/icon.png">
                <link rel="icon" type="image/x-icon" href="/images/icon.png">
                <link rel = "stylesheet" href= "/css/style.css">
                <link rel="preconnect" href="https://image.tmdb.org">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://cdnjs.cloudflare.com">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <script src="/misc/navMobile.js" defer></script>
                <script src="/misc/tvNav.js" defer></script>
                <script>(function(){var r=document.documentElement;var c=localStorage.getItem('settingsBgColor');if(c)r.style.setProperty('--sm-bg',c);var a=localStorage.getItem('settingsAccent');if(a)r.style.setProperty('--accent',a);})();</script>
            </head>
            <body>
                <nav class="navbar2">
                    <span class="nav-title2">
                        <a href="/" class="nav-back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                        SearchMovie
                    </span>
                    <div class="nav-links2">
                        <a href="/" class="nav-item">Home</a>
                        <a href="/favorites" class="nav-item">Favorites</a>
                    </div>
                </nav>
                ${mood ? `
                <div class="mood-banner">
                    <div class="mood-banner-emoji">${mood.emoji}</div>
                    <div class="mood-banner-text">
                        <h1 class="mood-banner-title">${mood.label}</h1>
                        <p class="mood-banner-vibe">${mood.vibe}</p>
                    </div>
                </div>` : ''}
                <div class="movie-grid${mood ? ' mood-grid' : ''}">`;

            if (movies.length === 0) {
                html += ` 
                </div> <!-- close movie-grid -->
                <div style="display:flex; justify-content:center; align-items:center; height:60vh;">
                    <h2 style="color:white; text-align:center;">No matches found for your filter criteria.</h2>
                </div>`;
            } else{
                for (const movie of movies) {
                    const movieTitle = movie.title || movie.name || "Unknown";
                    const releaseYear = (movie.release_date || movie.first_air_date || "").substring(0, 4) || "N/A";
                    const posterPath = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
                    const posterIcon = (movie.media_type === 'tv' || normalizedType === 'tv') ? 'fa-tv' : 'fa-film';
                    const rating = (movie.vote_average && !isNaN(movie.vote_average)) ? Number(movie.vote_average).toFixed(1) : "N/A";
                    const genreText = movie.genre_ids ? movie.genre_ids.map(id => genreMap[id]).filter(Boolean).join(", ") : "Unknown";
                    let ageCertificate = "PG-13"; // Default

                    const rRatedGenres = [27, 80, 53]; // Horror, Crime, Thriller
                    const isMatureGenre = movie.genre_ids && movie.genre_ids.some(id => rRatedGenres.includes(id));

                    const familyGenres = [16, 10751]; // Animation, Family
                    const isFamilyGenre = movie.genre_ids && movie.genre_ids.some(id => familyGenres.includes(id));

                    if (isMatureGenre) {
                        ageCertificate = "R";
                    } else if (isFamilyGenre) {
                        ageCertificate = "PG"; // Animation/Family movies are usually G or PG
                    } else if (movie.genre_ids && movie.genre_ids.includes(10749)) { // Romance
                        ageCertificate = "PG-13";
                    }
                    const escapedTitle = movieTitle.replace(/'/g, "\\'");
                    const escapedGenres = genreText.replace(/'/g, "\\'");
                    const isFav = favoriteIds.includes(movie.id.toString()) ? 'active' : '';
                    const isWatchlisted = watchlistIds.includes(movie.id.toString()) ? 'active' : '';
                    const displayType = (normalizedType === 'tv') ? "TV Series" : "Movie";
                    
                    const certClass = ageCertificate.replace(/[^a-zA-Z0-9]/g, '-');
                    html += `
                    <div class="movie-card" tabindex="0" onclick="window.location.href='/media/${movie.media_type || normalizedType}/${movie.id}'">
                        <div class="poster-container">
                            <span class="cert-badge ${certClass}">${ageCertificate}</span>
                            ${posterPath
                                ? `<img src="${posterPath}" alt="movie poster">`
                                : `<div class="no-poster"><i class="fa-solid ${posterIcon}"></i></div>`}
                        </div>
                        
                        <h3>${movieTitle}</h3>
                        <p>Year: ${releaseYear || "N/A"}</p>
                        <p><strong>Genre:</strong> ${genreText}</p>
                        <p>
                            <div class="starrt-container">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    <span style="font-size: 0.85rem;">${rating}</span>
                                </svg>
                            </div>
                        </p>
                
                       <div class="movie-card-bottom-bar">
                            <p><strong>Type:</strong> ${displayType}</p>
                            <div id="int-btns">
                                <button class="watchlist-btn ${isWatchlisted}" onclick="event.stopPropagation(); addWatchlist(this, '${escapedTitle}', '${releaseYear}', '${movie.id}', '${escapedGenres}', '${rating}', '${posterPath}', '${ageCertificate}', '${movie.media_type || normalizedType}')">
                                    <span class="eye-icon"></span>
                                </button>
                                <button class="heart-btn ${isFav}" onclick="event.stopPropagation(); addFavorite(this, '${escapedTitle}', '${releaseYear}', '${movie.id}', '${escapedGenres}', '${rating}', '${posterPath}', '${ageCertificate}')">
                                    <span class="heart-icon"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                    `;
                }
            }


        html += `</div>
        <div id="cntrl-btn">
            ${page > 1 ? `<button id="showLess" onclick="window.location.href='/discover?media=${typeSearch}&genres=${encodeURIComponent(req.query.genres || "")}&rating=${encodeURIComponent(ratingSearch)}&year=${encodeURIComponent(yearSearch)}&language=${encodeURIComponent(langFilter)}&page=${page - 1}'">Prev Page</button>` : ''}
            <span id="txtPage">Page ${page} of ${totalPages}</span>
            ${page < totalPages ? `<button id="showMore" onclick="window.location.href='/discover?media=${typeSearch}&genres=${encodeURIComponent(req.query.genres || "")}&rating=${encodeURIComponent(ratingSearch)}&year=${encodeURIComponent(yearSearch)}&language=${encodeURIComponent(langFilter)}&page=${page + 1}'">Next Page</button>` : ''}
        </div>
        <script>
            const isGuest = ${isGuest};

            async function addFavorite(btn, title, year, imdbId, genres, rating, image, certification) {
    
                if (isGuest) {
                    showLoginModal();
                    return;
                }

                const isActive = btn.classList.toggle('active');
                
                // Send all data that the schema expects
                await fetch("/favorites/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        title, year, imdbId, genres, rating, image, certification 
                    })
                });

                if (isActive) {
                    console.log(title + " toggled (added/removed) in favorites!");
                }
            }
            
            async function addWatchlist(btn, title, year, imdbId, genres, rating, image, certification, mediaType) {
                if (isGuest) {
                    showLoginModal();
                    return;
                }
                btn.classList.toggle('active');
                await fetch("/watchlist/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, year, imdbId, genres, rating, image, certification, mediaType })
                });
            }

            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    window.location.reload();
                }
            });
         </script>
        </body>
        </html>`;

        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error reading data.");
    }
});

module.exports = router;
