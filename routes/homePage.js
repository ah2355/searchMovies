const express = require('express');
const router = express.Router();
const { fetchFavoritesFromDB, fetchWatchlistFromDB } = require('../misc/db');
const { anilistQuery } = require('../misc/anilist');
const WatchProgress = require('../models/WatchProgress');

let animeCacheData = null;
let animeCacheTime = 0;
let trendingAnimeCache = [];
let trendingAnimeCacheTime = 0;
let airingAnimeCache = [];
let airingAnimeCacheTime = 0;
const ANIME_ROW_CACHE_MS = 1000 * 60 * 10;
const ANIME_CACHE_MS = 1000 * 60 * 30;

router.get('/', async (req,res) => {
    const isGuest = !(req.session && req.session.userId);
    const username = isGuest ? "Guest" : req.session.username;
    let displayName = (username !== "Guest" && username.includes('@')) 
        ? username.split('@')[0] 
        : username;
    displayName = displayName.charAt(0).toUpperCase() + displayName.substring(1);
    
    const authAction = isGuest
        ? `<a href="/users/login" class="nav-item" id="login-link"><i class="fa-solid fa-arrow-right-to-bracket"></i> Log In</a>`
        : `<a href="/users/login" class="nav-item"><i class="fa-solid fa-user"></i> Account</a>`;
    
    const api_key = process.env.TMDB_API_KEY;
    const page = Number(req.query.page) || 1;
    const [moviesData, seriesData, trendingData, airingData, animePopular, animeClassic] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${api_key}&language=en-US&page=1`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${api_key}&language=en-US&page=1`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${api_key}&language=en-US&page=1`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/airing_today?api_key=${api_key}`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${api_key}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${api_key}&with_genres=16&with_original_language=ja&sort_by=vote_count.desc&page=1`).then(r => r.json()),
    ]);

  
    let trendingAnime = [];
    try {
        const trendingQuery = `
            query {
                Page(page: 1, perPage: 20) {
                    media(type: ANIME, sort: TRENDING_DESC, format_in: [TV, TV_SHORT], isAdult: ${req.session.nsfw ? 'true' : 'false'}) {
                        id
                        title { romaji english }
                        coverImage { large }
                        averageScore
                        startDate { year }
                    }
                }
            }
        `;
        const td = await anilistQuery(trendingQuery);
        const fetched = td.data?.Page?.media || [];
        if (fetched.length) {
            trendingAnime = fetched;
            trendingAnimeCache = fetched;          // remember last good
            trendingAnimeCacheTime = Date.now();
        } else if (Date.now() - trendingAnimeCacheTime < ANIME_ROW_CACHE_MS) {
            trendingAnime = trendingAnimeCache;    // fall back to cache
        }
    } catch (err) {
        console.log('Trending anime fetch failed:', err.message);
        if (Date.now() - trendingAnimeCacheTime < ANIME_ROW_CACHE_MS) {
            trendingAnime = trendingAnimeCache;    // fall back to cache on error
        }
    }
       
    
    const seen = new Set();
    const adultKeywords = ['hentai', 'ero ', 'ecchi', 'overflow', 'kiss x sis', 'domestic na kanojo', 'yosuga', 'indoor', 'secret journey', 'peter grill', 'interspecies reviewers', 'sweet agony', 'sweet punishment', 'personal pet', 'guard\'s personal', 'fire in his fingertips', 'secret mission - undercover agents never back down!'];    
    let animeResults = [...(animePopular.results || []), ...(animeClassic.results || [])]  
        .filter(a => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            const titleLower = (a.name || a.original_name || '').toLowerCase();
            if (adultKeywords.some(w => titleLower.includes(w))) return false;
            if (a.adult) return false;
            return true;
        });

   
    if (animeCacheData && (Date.now() - animeCacheTime < ANIME_CACHE_MS)) {
        animeResults = animeCacheData;
    } else {
        const batchQuery = `{
            ${animeResults.map((a, i) => {
                const safe = (a.name || a.original_name || '').replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 50);
                return `a${i}: Media(search: "${safe}", type: ANIME) { isAdult genres }`;
            }).join('\n')}
        }`;
        try {
            const d = await anilistQuery(batchQuery);
            animeResults = animeResults.filter((a, i) => {
                const ani = d.data?.[`a${i}`];
                if (ani?.isAdult) return false;
                if (ani?.genres?.some(g => g.toLowerCase() === 'hentai')) return false;
                return true;
            });
            animeCacheData = animeResults;
            animeCacheTime = Date.now();
        } catch (err) {
            console.log('Home AniList batch failed:', err.message);
            // fall back to unfiltered-by-anilist (keyword filter already applied if you keep it)
        }
    }

    let airingAnime = [];
    try {
        const airingQuery = `
            query {
                Page(page: 1, perPage: 20) {
                    media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: ${req.session.nsfw ? 'true' : 'false'}) {
                        id
                        idMal
                        title { romaji english }
                        coverImage { large }
                        averageScore
                        nextAiringEpisode { episode timeUntilAiring }
                    }
                }
            }
        `;
        const ad = await anilistQuery(airingQuery);
        const fetched = ad.data?.Page?.media || [];
        if (fetched.length) {
            airingAnime = fetched;
            airingAnimeCache = fetched;            // remember last good
            airingAnimeCacheTime = Date.now();
        } else if (Date.now() - airingAnimeCacheTime < ANIME_ROW_CACHE_MS) {
            airingAnime = airingAnimeCache;        // fall back to cache
        }
    } catch (err) {
        console.log('Airing anime fetch failed:', err.message);
        if (Date.now() - airingAnimeCacheTime < ANIME_ROW_CACHE_MS) {
            airingAnime = airingAnimeCache;        // fall back to cache on error
        }
    }
    const firstBackdrop = moviesData.results?.find(m => m.backdrop_path)?.backdrop_path;

    const featured = trendingData.results?.find(m => m.backdrop_path);
    const featuredType = featured?.media_type || 'movie';
    const featuredTitle = (featured?.title || featured?.name || '').replace(/</g, '&lt;');
    const featuredOverview = (featured?.overview || '').slice(0, 200).replace(/</g, '&lt;');
    const featuredRating = featured?.vote_average ? Number(featured.vote_average).toFixed(1) : 'N/A';
    const featuredYear = (featured?.release_date || featured?.first_air_date || '').substring(0, 4);
    const featuredBackdrop = featured?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${featured.backdrop_path}` : '';
    const featuredUrl = featured ? `/media/${featuredType}/${featured.id}` : '/';

    let recTitle = '';
    let recResults = [];
    if (!isGuest) {
        try {
            const recentWatch = await WatchProgress.findOne({ user: req.session.userId })
                .sort({ updatedAt: -1 });
            if (recentWatch) {
                recTitle = recentWatch.title;
                const recRes = await fetch(`https://api.themoviedb.org/3/${recentWatch.mediaType}/${recentWatch.mediaId}/recommendations?api_key=${api_key}&page=1`);
                const recData = await recRes.json();
                recResults = (recData.results || []).filter(r => r.poster_path).slice(0, 20);
            }
        } catch (err) {
            console.log('Recommendations fetch failed:', err.message);
        }
    }

    let html = ` 
    <!DOCTYPE html>
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>SearchMovie | Discover & Track Movies</title>
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
                
                ${firstBackdrop ? `<link rel="preload" as="image" href="https://image.tmdb.org/t/p/w1280${firstBackdrop}" fetchpriority="high">` : ''}
                <link rel="icon" type="image/png" href="https://searchmovie.win/images/icon.png">
                <link rel="apple-touch-icon" href="https://searchmovie.win/images/icon.png">
                <link rel="icon" type="image/x-icon" href="/images/icon.png">
                <link rel="manifest" href="/manifest.json">
                <meta name="theme-color" content="#e50914">
                <link rel="stylesheet" href="/css/style.css">
                <link rel="preconnect" href="https://image.tmdb.org">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://cdnjs.cloudflare.com">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <script type="application/ld+json">
                    {
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    "name": "SearchMovie",
                    "url": "https://searchmovie.win/"
                    }
                </script>
                <script src="misc/genreFunc.js" defer></script>
                <script src="/misc/tvNav.js" defer></script>
                <script src="/misc/customSelect.js" defer></script>
            </head>
            <body>
            <div class="app-container">
                    <main class="main-content">
                        <div id="movieBody">
                            <div id="announcements">
                                <p></p>
                            </div>

                            <div class="content-bg">
                                <nav class="navbar-main">
                                    <div id="item-left">
                                        <span class="nav-title">SearchMovie</span>
                                    </div>
                                    <button class="hamburger" id="hamburger">
                                        <span class="bar"></span>
                                        <span class="bar"></span>
                                        <span class="bar"></span>
                                    </button>

                                    <div class="nav-links" id="navLinks">
                                        <span class="nav-greeting">Hello, ${displayName}!</span>
                                        <a href="/favorites" id="fav-list" class="nav-item"><i class="fa-solid fa-heart"></i> Favorite List</a>
                                        <div class="genre-wrapper">
                                            <button type="button" class="nav-item" id="browseBtn"><p><i class="fa-solid fa-border-all"></i> Browse</p></button>
                                            <div id="browseBox" class="browse-box hidden">
                                                <a href="/my-watchlist"><i class="fa-solid fa-bookmark"></i> My Watchlist</a>
                                                <a href="/airing"><i class="fa-solid fa-tv"></i> Airing Today</a>
                                                <a href="/discover?media=movie"><i class="fa-solid fa-film"></i> Movies</a>
                                                <a href="/discover?media=tv"><i class="fa-solid fa-satellite-dish"></i> TV Shows</a>
                                                <a href="/discover?genres=Action"><i class="fa-solid fa-explosion"></i> Action</a>
                                                <a href="/discover?genres=Comedy"><i class="fa-solid fa-face-laugh"></i> Comedy</a>
                                                <a href="/discover?genres=Horror"><i class="fa-solid fa-skull"></i> Horror</a>
                                                <a href="/discover?genres=Animation"><i class="fa-solid fa-wand-magic-sparkles"></i> Animation</a>
                                                <a href="/anime"><i class="fa-solid fa-dragon"></i> Anime</a>
                                                <a href="/discover?genres=Documentary"><i class="fa-solid fa-microphone"></i> Documentary</a>
                                            </div>
                                        </div>
                                        ${authAction}
                                    </div>
                                </nav>
                                <div id="backdrop-slider"></div>
                                <div class="content-overlay">
                                    <h2 id="main-header">Find your next obsession.</h2>
                                    <form id="movieForm" action="/results" method="get">
                                        <div class="search-container" style="position: relative; display: inline-block;">
                                            <input type="text" name="q" id="movieName" placeholder="Search movies...">
                                            <button id="searchBtn"><img id="srchImg" src="images/clipart2603165.png" alt="Search"></button>
                                            <div id="suggestionsBox"></div>
                                        </div>

                                        <br><br>
                                        
                                        <div class = "rec-box">
                                            <h3>Not sure what to search? Just fill up these and get recommendations!</h3>

                                            <div class="rec-container">
                                                <input type="number" name="rating" id="movieRating" max="10" min="0" step="0.1" placeholder="Minimum Rating">
                                                <div class="genre-wrapper">
                                                    <button type="button" id="genreBtn">Select Genre</button>
                                                    <div id="genreBox" class="genre-box hidden">
                                                        <label><input type="checkbox" value="Action"> Action</label>
                                                        <label><input type="checkbox" value="Comedy"> Comedy</label>
                                                        <label><input type="checkbox" value="Drama"> Drama</label>
                                                        <label><input type="checkbox" value="Horror"> Horror</label>
                                                        <label><input type="checkbox" value="Romance"> Romance</label>
                                                        <label><input type="checkbox" value="Sci-Fi"> Sci-Fi</label>
                                                        <label><input type="checkbox" value="Thriller"> Thriller</label>
                                                        <label><input type="checkbox" value="Animation"> Animation</label>
                                                        <label><input type="checkbox" value="Crime"> Crime</label>
                                                        <label><input type="checkbox" value="Adventure"> Adventure</label>
                                                    </div>
                                                    <input type="hidden" name="genres" id="selectedGenres">
                                                </div>
                                                <input type="text" name="year" id="yearRelease" placeholder="Year">
                                                <select name="media" id="mediaSelect" class="enhance-select">
                                                    <option value="multi">Movie & TV</option>
                                                    <option value="movie">Movie</option>
                                                    <option value="tv">TV</option>
                                                </select>
                                                <select name="language" id="langSelect" class="enhance-select">
                                                    <option value="">All Languages</option>
                                                    <option value="en">English</option>
                                                    <option value="es">Spanish</option>
                                                    <option value="fr">French</option>
                                                    <option value="bn">Bangla</option>
                                                    <option value="ko">Korean</option>
                                                    <option value="zh">Chinese</option>
                                                    <option value="ja">Japanese</option>
                                                    <option value="hi">Hindi</option>
                                                    <option value="ta">Tamil</option>
                                                    <option value="te">Telugu</option>
                                                    <option value="kn">Kannada</option>
                                                </select>
                                                <br><br>
                                            </div>
                                            <input type="submit" id="submit" value="Search">
                                        </div>
                                    </form>
                                </div>
                            </div>
                            <br><br>
                        </div>
                        <br><br>`;

    if (featured) {
        html += `
        <div class="featured-spotlight section-hidden" onclick="window.location.href='${featuredUrl}'" tabindex="0" role="button" aria-label="Watch ${featuredTitle}">
            <div class="featured-bg" style="background-image:url('${featuredBackdrop}')"></div>
            <div class="featured-gradient"></div>
            <div class="featured-content">
                <span class="featured-label">✦ Featured Today</span>
                <h2 class="featured-title">${featuredTitle}</h2>
                <div class="featured-meta">
                    <span class="featured-rating">★ ${featuredRating}</span>
                    ${featuredYear ? `<span class="featured-year">${featuredYear}</span>` : ''}
                    <span class="featured-type">${featuredType === 'movie' ? 'Movie' : 'TV Series'}</span>
                </div>
                ${featuredOverview ? `<p class="featured-overview">${featuredOverview}${(featured.overview?.length || 0) > 200 ? '…' : ''}</p>` : ''}
                <a href="${featuredUrl}" class="featured-btn" onclick="event.stopPropagation()">Watch Now →</a>
            </div>
        </div>`;
    }

    html += `
        <div class="mood-row section-hidden">
            <a href="/discover?genres=Action" class="mood-pill">💥 Action</a>
            <a href="/discover?genres=Comedy" class="mood-pill">😄 Comedy</a>
            <a href="/discover?genres=Horror" class="mood-pill">💀 Horror</a>
            <a href="/discover?genres=Romance" class="mood-pill">💕 Romance</a>
            <a href="/discover?genres=Sci-Fi" class="mood-pill">🚀 Sci-Fi</a>
            <a href="/anime" class="mood-pill">⚔️ Anime</a>
            <a href="/discover?genres=Thriller" class="mood-pill">🎭 Thriller</a>
            <a href="/discover?genres=Crime" class="mood-pill">🔍 Crime</a>
            <a href="/discover?genres=Documentary" class="mood-pill">🎙️ Documentary</a>
            <a href="/discover?genres=Animation" class="mood-pill">🎨 Animation</a>
        </div>`;

                        html+= `
                        <div id="continue-watching-wrap" style="display:none;">
                            <div id="popular-movie">
                                <div id="cw-section" class="slider-container section-hidden">
                                    <h2>Continue Watching</h2>
                                    <button type="button" class="slide-btn left" onclick="scrollGrid('cw-grid', -300)">❮</button>
                                    <div id="cw-grid" class="popular-movie-grid"></div>
                                    <button type="button" class="slide-btn right" onclick="scrollGrid('cw-grid', 300)">❯</button>
                                </div>
                            </div>
                        </div>
                        <div id="recently-viewed-wrap" style="display:none;">
                            <div id="popular-movie">
                                <div class="slider-container">
                                    <div class="rv-header">
                                        <h2>Recently Viewed</h2>
                                        <button type="button" id="rv-toggle-btn" class="rv-toggle-btn">Turn off</button>
                                    </div>
                                    <button type="button" class="slide-btn left" onclick="scrollGrid('rv-grid', -300)">❮</button>
                                    <div id="rv-grid" class="rv-grid"></div>
                                    <button type="button" class="slide-btn right" onclick="scrollGrid('rv-grid', 300)">❯</button>
                                </div>
                                <div id="rv-disabled-notice" style="display:none; padding: 12px 20px 20px;">
                                    <span style="color:#555; font-size:13px;">Recently Viewed is turned off.</span>
                                    <button type="button" id="rv-enable-btn" class="rv-toggle-btn" style="margin-left:12px;">Turn on</button>
                                </div>
                            </div>
                        </div>`;

    if (recResults.length > 0) {
        html += `
            <div id="popular-movie">
                <div class="slider-container section-hidden">
                    <h2>Because You Watched ${recTitle}</h2>
                    <button type="button" class="slide-btn left" onclick="scrollGrid('rec-grid', -300)">❮</button>
                    <div id="rec-grid" class="popular-movie-grid">`;

        for (const rec of recResults) {
            const recPoster = `https://image.tmdb.org/t/p/w500${rec.poster_path}`;
            const recType = rec.media_type || (rec.title ? 'movie' : 'tv');
            const recName = rec.title || rec.name || 'Unknown';
            const recReleaseYear = (rec.release_date || rec.first_air_date || '').substring(0, 4) || 'N/A';
            const rating = rec.vote_average ? Number(rec.vote_average).toFixed(1) : "N/A";
            html += `
                <div class="popular-movie-card" tabindex="0" onclick="window.location.href='/media/${recType}/${rec.id}'">
                    <div class="popular-poster-container">
                        <img class="popular-movie-img" src="${recPoster}" alt="${recName}">
                        <div class="play-overlay">
                            <div class="play-icon"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>
                     <div class="movieInfo">
                        <p class="movieTitleText">${recName}</p>
                        <p class="movieReleaseYear">${recReleaseYear}</p>
                        <p class="mediaTypeInfo">${recType === 'movie' ? "Movie" : "TV"}</p>                     
                        <div class="starrt-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                <span class="star-rating">${rating}</span>
                            </svg>
                        </div>
                     </div>
                </div>`;
        }
        html += `
                    <button type="button" class="slide-btn right" onclick="scrollGrid('rec-grid', 300)">❯</button>
                </div>
            </div>`;
    }

    html += `<div id="popular-movie">
        <div id="movie-section" class="slider-container section-hidden">
            <h2>Trending Movies</h2>
            <button type="button" class="slide-btn left" onclick="scrollGrid('movie-grid', -300)">❮</button>
        <div id="movie-grid" class="popular-movie-grid"> `;

    // Trending Movies Section
    for (const movie of moviesData.results || []) {
        const movieTitle = movie.title;
        const posterPath = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'images/icon.png';
        const dateString = movie.release_date || ""
        const releaseYear = dateString ? dateString.substring(0, 4) : "N/A";
        const rating = movie.vote_average ? Number(movie.vote_average).toFixed(1) : "N/A";


        html += `
                <div class="popular-movie-card" tabindex="0" onclick="window.location.href='/media/movie/${movie.id}'">
                    <div class="popular-poster-container"> 
                        <img class="popular-movie-img" src="${posterPath}" alt="${movieTitle} poster">
                        <div class="play-overlay">
                            <div class="play-icon"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>
                    <div class="movieInfo">
                        <p class="movieTitleText">${movieTitle}</p>
                        <p class="movieReleaseYear">${releaseYear}</p>
                        <div class="starrt-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                <span class="star-rating">${rating}</span>
                            </svg>
                        </div>
                    </div>
                </div>
        `;
    }
    html += `
                <button type="button" class="slide-btn right" onclick="scrollGrid('movie-grid', 300)">❯</button>
            </div>
        </div>`;

    // End of Trending Movies Section

    // Trending Shows Section
     html+= ` <div id="popular-movie">
                        <div id="show-section" class="slider-container section-hidden">
                            <h2>Trending Shows</h2>
                            <button type="button" class="slide-btn left" onclick="scrollGrid('show-grid', -300)">❮</button>
                        <div id="show-grid" class="popular-movie-grid">`;

    for (const series of seriesData.results || []) {
        const seriesTitle = series.name;
        const posterPath = series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : 'images/icon.png';
        const dateString = series.first_air_date || ""
        const releaseYear = dateString ? dateString.substring(0, 4) : "N/A";
        const rating = series.vote_average ? Number(series.vote_average).toFixed(1) : "N/A";


        html += `
                <div class="popular-movie-card" tabindex="0" onclick="window.location.href='/media/tv/${series.id}'">
                    <div class="popular-poster-container"> 
                        <img class="popular-movie-img" src="${posterPath}" alt="${seriesTitle} poster">
                        <div class="play-overlay">
                            <div class="play-icon"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>
                    <div class="movieInfo">
                        <p class="movieTitleText">${seriesTitle}</p>
                        <p class="movieReleaseYear">${releaseYear}</p>
                        <div class="starrt-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                <span class="star-rating">${rating}</span>
                            </svg>
                        </div>
                    </div>
                </div>
        `;
    }


    html+= `
                <button type="button" class="slide-btn right" onclick="scrollGrid('show-grid', 300)">❯</button>
            </div>
        </div>`
    //End of Trending Shows Section
    
    // Trending Today Section
    html+= ` <div id="popular-movie">
                        <div id="show-section" class="slider-container section-hidden">
                            <h2>Trending Today</h2>
                            <button type="button" class="slide-btn left" onclick="scrollGrid('td-grid', -300)">❮</button>
                        <div id="td-grid" class="popular-movie-grid">`;

    for (const trendingM of trendingData.results || []) {
        const mediaTypeTD = trendingM.media_type;
        const seriesTitle = mediaTypeTD == "movie" ? trendingM.title : trendingM.name;
        const posterPath = trendingM.poster_path ? `https://image.tmdb.org/t/p/w500${trendingM.poster_path}` : 'images/icon.png';
        const dateString = mediaTypeTD == "movie" ? trendingM.release_date : trendingM.first_air_date;
        const releaseYear = dateString ? dateString.substring(0, 4) : "N/A";
        const rating = trendingM.vote_average ? Number(trendingM.vote_average).toFixed(1) : "N/A";


        html += `
                <div class="popular-movie-card" tabindex="0" onclick="window.location.href='/media/${mediaTypeTD}/${trendingM.id}'">
                    <div class="popular-poster-container"> 
                        <img class="popular-movie-img" src="${posterPath}" alt="${seriesTitle} poster">
                        <div class="play-overlay">
                            <div class="play-icon"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>
                    <div class="movieInfo">
                        <p class="movieTitleText">${seriesTitle}</p>
                        <p class="movieReleaseYear">${releaseYear}</p>
                        <p class="mediaTypeInfo">${mediaTypeTD == "movie" ? "Movie" : "TV"}</p>
                        <div class="starrt-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                <span class="star-rating">${rating}</span>
                            </svg>
                        </div>
                    </div>
                </div>
        `;
    }

    html+= `
                <button type="button" class="slide-btn right" onclick="scrollGrid('td-grid', 300)">❯</button>
            </div>
        </div>`
    
    // End of Trending Today Section

    // Airing Today Section
    html+= ` <div id="popular-movie">
                        <div id="show-section" class="slider-container section-hidden">
                            <a href="/airing" id="air-td-link"<h2 class="airtdHead">Airing Today ⬈</h2></a>
                            <button type="button" class="slide-btn left" onclick="scrollGrid('airtd-grid', -300)">❮</button>
                        <div id="airtd-grid" class="popular-movie-grid">`;
    

    for (const air of airingData.results || []) {
        const mediaTypeTD = air.media_type;
        const seriesTitle = air.name;
        const posterPath = air.poster_path ? `https://image.tmdb.org/t/p/w500${air.poster_path}` : 'images/icon.png';
        const dateString = air.first_air_date;
        const releaseYear = dateString ? dateString.substring(0, 4) : "N/A";
        const rating = air.vote_average ? Number(air.vote_average).toFixed(1) : "N/A";


        html += `
                <div class="popular-movie-card" tabindex="0" onclick="window.location.href='/media/tv/${air.id}'">
                    <div class="popular-poster-container">
                        <img class="popular-movie-img" src="${posterPath}" alt="${seriesTitle} poster">
                        <div class="play-overlay">
                            <div class="play-icon"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>
                    <div class="movieInfo">
                        <p class="movieTitleText">${seriesTitle}</p>
                        <p class="movieReleaseYear">${releaseYear}</p>
                        <div class="starrt-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                <span class="star-rating">${rating}</span>
                            </svg>
                        </div>
                    </div>
                </div>
        `;
    }

    html+= `
                <button type="button" class="slide-btn right" onclick="scrollGrid('airtd-grid', 300)">❯</button>
            </div>
        </div>`
    // End of Airing Today Section

    html += `<div id="popular-movie">
    <div id="show-section" class="slider-container section-hidden">
        <a href="/anime" id="air-td-link"><h2 class="airtdHead">Trending Anime ⬈</h2></a>
        <button type="button" class="slide-btn left" onclick="scrollGrid('anime-grid', -300)">❮</button>
        <div id="anime-grid" class="popular-movie-grid">`;

     for (const anime of trendingAnime) {
        const title = anime.title.english || anime.title.romaji || "Unknown";
        const posterPath = anime.coverImage?.large || 'images/icon.png';
        const releaseYear = anime.startDate?.year || "N/A";
        const rating = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A";
        const searchTitle = anime.title.english || anime.title.romaji || "";
        const cleanTitle = searchTitle.replace(/season\s*\d+/i, '').replace(/[-–—:]/g, ' ').replace(/\s+/g, ' ').trim();
        const href = `/anime-go?title=${encodeURIComponent(cleanTitle).replace(/'/g, '%27')}&aniId=${anime.id}`;
 
        html += `
            <div class="popular-movie-card" tabindex="0" onclick="window.location.href='${href}'">
                <div class="popular-poster-container">
                    <img class="popular-movie-img" src="${posterPath}" alt="${title} poster">
                    <div class="play-overlay"><div class="play-icon"><i class="fa-solid fa-play"></i></div></div>
                </div>
                <div class="movieInfo">
                    <p class="movieTitleText">${title}</p>
                    <p class="movieReleaseYear">${releaseYear}</p>
                    <div class="starrt-container">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            <span class="star-rating">${rating}</span>
                        </svg>
                    </div>
                </div>
            </div>`;
    }

    html += `
            <button type="button" class="slide-btn right" onclick="scrollGrid('anime-grid', 300)">❯</button>
        </div>
    </div>`;

    html += `<div id="popular-movie">
    <div id="show-section" class="slider-container section-hidden">
        <a href="/anime?filter=airing" id="air-td-link"><h2 class="airtdHead">Airing Anime ⬈</h2></a>
        <button type="button" class="slide-btn left" onclick="scrollGrid('airing-anime-grid', -300)">❮</button>
        <div id="airing-anime-grid" class="popular-movie-grid">`;

    for (const anime of airingAnime) {
        const title = anime.title.english || anime.title.romaji || "Unknown";
        const poster = anime.coverImage?.large || 'images/icon.png';
        const rating = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A";
        const next = anime.nextAiringEpisode;
        let countdown = "";
        if (next) {
            const days = Math.floor(next.timeUntilAiring / 86400);
            const hours = Math.floor((next.timeUntilAiring % 86400) / 3600);
            countdown = `Ep ${next.episode} • ${days}d ${hours}h`;
        }
        const searchTitle = anime.title.english || anime.title.romaji || "";
        const cleanTitle = searchTitle.replace(/season\s*\d+/i, '').replace(/[-–—:]/g, ' ').replace(/\s+/g, ' ').trim();
        const href = `/anime-go?title=${encodeURIComponent(cleanTitle).replace(/'/g, '%27')}&aniId=${anime.id}`;        
        html += `
            <div class="popular-movie-card" tabindex="0" onclick="window.location.href='${href}'">
                <div class="popular-poster-container">
                    <img class="popular-movie-img" src="${poster}" alt="${title} poster">
                    <div class="play-overlay"><div class="play-icon"><i class="fa-solid fa-play"></i></div></div>
                </div>
                <div class="movieInfo">
                    <p class="movieTitleText">${title}</p>
                    ${countdown ? `<p class="movieReleaseYear">${countdown}</p>` : ''}
                    <div class="starrt-container">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            <span class="star-rating">${rating}</span>
                        </svg>
                    </div>
                </div>
            </div>`;
    }

    html += `
            <button type="button" class="slide-btn right" onclick="scrollGrid('airing-anime-grid', 300)">❯</button>
        </div>
    </div>`;

   html+= `
            </div>
         </main>
        </div>
        <script>
            async function initBackdropSlider() {
                try {
                    const res = await fetch('/api/backdrops');
                    const movies = await res.json();
                    const slider = document.getElementById('backdrop-slider');

                    movies.forEach(function(movie, i) {
                        const slide = document.createElement('div');
                        slide.className = 'slide' + (i === 0 ? ' active' : '');
                        slide.style.backgroundImage = 'url(https://image.tmdb.org/t/p/w1280' + movie.backdrop + ')';
                        slide.innerHTML = '<span class="slide-title">' + movie.title + '</span>';
                        slider.appendChild(slide);
                    });

                    let current = 0;
                    setInterval(function() {
                        const slides = slider.querySelectorAll('.slide');
                        slides[current].classList.remove('active');
                        current = (current + 1) % slides.length;
                        slides[current].classList.add('active');
                    }, 5000);
                } catch(err) {
                    console.error('Backdrop slider error:', err);
                }
            }
            initBackdropSlider();
            async function loadContinueWatching() {
                try {
                    const res = await fetch('/api/continue-watching');
                    const data = await res.json();
                    const items = data.items || [];
                    if (!items.length) return; // leave the row hidden

                    const grid = document.getElementById('cw-grid');
                    grid.innerHTML = items.map(function (it) {
                            const isTv = it.mediaType === 'tv';
                            let resume = '';
                            if (isTv && it.lastSeason && it.lastEpisode) {
                                resume = 'S' + it.lastSeason + 'E' + it.lastEpisode;
                            }
                            const params = [];
                            if (it.aniId) params.push('aniId=' + encodeURIComponent(it.aniId));
                            if (resume) params.push('resume=' + resume);
                            const href = '/media/' + it.mediaType + '/' + it.mediaId
                                + (params.length ? '?' + params.join('&') : '');

                            const badge = isTv && it.lastSeason && it.lastEpisode
                                ? ('S' + it.lastSeason + ' • E' + it.lastEpisode)
                                : 'Movie';

                            const safeTitle = (it.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                            const safeHref = href.replace(/"/g, '&quot;');

                            return ''
                            + '<div class="cw-card-big" data-href="' + safeHref + '">'
                            +   '<div class="cw-big-poster">'
                            +     '<img src="' + it.poster + '" alt="' + safeTitle + ' poster">'
                            +     '<div class="cw-big-play">▶</div>'
                            +   '</div>'
                            +   '<div class="cw-big-info">'
                            +     '<p class="cw-big-sub">Continue watching</p>'
                            +     '<p class="cw-big-title">' + safeTitle + '</p>'
                            +     '<span class="cw-big-badge">' + badge + '</span>'
                            +   '</div>'
                            +   '<button class="cw-remove" title="Remove" data-mt="' + it.mediaType + '" data-mid="' + it.mediaId + '">✕</button>'
                            + '</div>';
                        }).join('');

                    // Attach handlers (no inline onclick -> no quote-escaping issues).
                    grid.querySelectorAll('.cw-card-big').forEach(function (card) {
                        card.addEventListener('click', function () {
                            window.location.href = card.getAttribute('data-href');
                        });
                    });
                    grid.querySelectorAll('.cw-remove').forEach(function (btn) {
                        btn.addEventListener('click', function (ev) {
                            ev.stopPropagation();
                            removeContinueWatching(btn, btn.getAttribute('data-mt'), btn.getAttribute('data-mid'));
                        });
                    });

                    document.getElementById('continue-watching-wrap').style.display = 'block';
                } catch (err) {
                    console.error('Continue Watching load error:', err);
                }
            }

            async function removeContinueWatching(btn, mediaType, mediaId) {
                // Find the card regardless of its exact class name.
                let card = btn.closest('.cw-card-big') || btn.closest('.cw-card');
                if (!card) {
                    // Fallback: climb to whichever ancestor is a direct child of the grid.
                    const g0 = document.getElementById('cw-grid');
                    let n = btn;
                    while (n && n.parentElement !== g0) n = n.parentElement;
                    card = n;
                }
                if (card) card.remove();

                const grid = document.getElementById('cw-grid');
                if (grid && grid.children.length === 0) {
                    document.getElementById('continue-watching-wrap').style.display = 'none';
                }
                try {
                    await fetch('/watch-progress/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mediaType: mediaType, mediaId: mediaId })
                    });
                } catch (err) { /* card already removed from UI; best-effort */ }
            }

            loadContinueWatching();

            // Instant search suggestions
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

                input.addEventListener('focus', function() {
                    if (input.value.trim().length >= 2 && !box.innerHTML) {
                        input.dispatchEvent(new Event('input'));
                    }
                });
            })();

            // PWA service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(function(){});
            }

            // Recently Viewed row
            (function() {
                try {
                    var wrap = document.getElementById('recently-viewed-wrap');
                    var grid = document.getElementById('rv-grid');
                    var toggleBtn = document.getElementById('rv-toggle-btn');
                    var notice = document.getElementById('rv-disabled-notice');
                    var enableBtn = document.getElementById('rv-enable-btn');
                    if (!wrap || !grid) return;

                    var enabled = localStorage.getItem('recentlyViewedEnabled') !== 'false';

                    function renderGrid() {
                        var items = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
                        if (!items.length && enabled) return;
                        wrap.style.display = 'block';
                        if (!enabled) {
                            grid.style.display = 'none';
                            if (notice) notice.style.display = 'block';
                            if (toggleBtn) toggleBtn.style.display = 'none';
                            document.querySelectorAll('.slide-btn').forEach(function(b) {
                                if (b.closest('#recently-viewed-wrap')) b.style.display = 'none';
                            });
                            return;
                        }
                        grid.innerHTML = items.map(function(it) {
                            var imgSrc = it.poster || '/images/icon.png';
                            var safetitle = (it.title || '').replace(/</g,'&lt;').replace(/"/g,'&quot;');
                            var href = '/media/' + it.type + '/' + it.id;
                            return '<div class="rv-card" data-href="' + href + '">'
                                + '<div class="rv-poster"><img src="' + imgSrc + '" alt="' + safetitle + '" loading="lazy"></div>'
                                + '<div class="rv-info">'
                                + '<p class="rv-card-title">' + safetitle + '</p>'
                                + '<p class="rv-card-year">' + (it.year || '') + '</p>'
                                + '</div>'
                                + '</div>';
                        }).join('');
                        grid.querySelectorAll('.rv-card').forEach(function(card) {
                            card.addEventListener('click', function() {
                                window.location.href = card.getAttribute('data-href');
                            });
                        });
                        wrap.style.display = 'block';
                    }

                    renderGrid();

                    if (toggleBtn) {
                        toggleBtn.addEventListener('click', function() {
                            localStorage.setItem('recentlyViewedEnabled', 'false');
                            enabled = false;
                            grid.style.display = 'none';
                            if (notice) notice.style.display = 'block';
                            toggleBtn.style.display = 'none';
                            document.querySelectorAll('.slide-btn').forEach(function(b) {
                                if (b.closest('#recently-viewed-wrap')) b.style.display = 'none';
                            });
                        });
                    }

                    if (enableBtn) {
                        enableBtn.addEventListener('click', function() {
                            localStorage.setItem('recentlyViewedEnabled', 'true');
                            enabled = true;
                            if (notice) notice.style.display = 'none';
                            if (toggleBtn) toggleBtn.style.display = '';
                            grid.style.display = '';
                            document.querySelectorAll('.slide-btn').forEach(function(b) {
                                if (b.closest('#recently-viewed-wrap')) b.style.display = '';
                            });
                            renderGrid();
                        });
                    }
                } catch(e) {}
            })();

            // Trailer: morph card to landscape on hover (desktop only)
            (function() {
                if (!window.matchMedia('(hover: hover)').matches) return;
                var cache = {};
                var hoverTimers = {};
                var idx = 0;

                function expandCard(card, key) {
                    if (card.querySelector('.card-exp-frame')) return;
                    var container = card.querySelector('.popular-poster-container');
                    if (!container) return;
                    card.classList.add('card-expanded');

                    var frame = document.createElement('iframe');
                    frame.className = 'card-exp-frame';
                    frame.src = 'https://www.youtube-nocookie.com/embed/' + key
                        + '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + key
                        + '&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1';
                    frame.allow = 'autoplay; fullscreen';
                    frame.setAttribute('allowfullscreen', '');
                    container.appendChild(frame);

                    var muteBtn = document.createElement('button');
                    muteBtn.className = 'card-mute-btn';
                    muteBtn.innerHTML = '&#128263;';
                    muteBtn.title = 'Unmute';
                    var muted = true;
                    muteBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        muted = !muted;
                        var cmd = muted ? 'mute' : 'unMute';
                        frame.contentWindow.postMessage('{"event":"command","func":"' + cmd + '","args":""}', '*');
                        muteBtn.innerHTML = muted ? '&#128263;' : '&#128266;';
                        muteBtn.title = muted ? 'Unmute' : 'Mute';
                    });
                    container.appendChild(muteBtn);

                    var maxBtn = document.createElement('button');
                    maxBtn.className = 'card-max-btn';
                    maxBtn.innerHTML = '&#x26F6;';
                    maxBtn.title = 'Fullscreen';
                    maxBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (frame.requestFullscreen) frame.requestFullscreen();
                        else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
                    });
                    container.appendChild(maxBtn);

                    var qualityMenu = document.createElement('div');
                    qualityMenu.className = 'card-quality-menu';
                    var qualities = [
                        {label: '1080p', val: 'hd1080'},
                        {label: '720p',  val: 'hd720'},
                        {label: '480p',  val: 'large'},
                        {label: '360p',  val: 'medium'},
                        {label: 'Auto',  val: 'default'}
                    ];
                    qualities.forEach(function(q) {
                        var opt = document.createElement('button');
                        opt.textContent = q.label;
                        opt.addEventListener('click', function(e) {
                            e.stopPropagation();
                            frame.contentWindow.postMessage(
                                '{"event":"command","func":"setPlaybackQuality","args":["' + q.val + '"]}', '*'
                            );
                            qualityBtn.textContent = q.label;
                            qualityMenu.classList.remove('open');
                        });
                        qualityMenu.appendChild(opt);
                    });
                    container.appendChild(qualityMenu);

                    var qualityBtn = document.createElement('button');
                    qualityBtn.className = 'card-quality-btn';
                    qualityBtn.textContent = 'HD';
                    qualityBtn.title = 'Quality';
                    qualityBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        qualityMenu.classList.toggle('open');
                    });
                    container.appendChild(qualityBtn);

                    setTimeout(function() { frame.classList.add('ready'); }, 350);
                }

                function collapseCard(card) {
                    card.classList.remove('card-expanded');
                    var frame = card.querySelector('.card-exp-frame');
                    if (frame) {
                        frame.classList.remove('ready');
                        setTimeout(function() {
                            if (frame.parentNode) frame.parentNode.removeChild(frame);
                        }, 350);
                    }
                    var muteBtn = card.querySelector('.card-mute-btn');
                    if (muteBtn && muteBtn.parentNode) muteBtn.parentNode.removeChild(muteBtn);
                    var maxBtn = card.querySelector('.card-max-btn');
                    if (maxBtn && maxBtn.parentNode) maxBtn.parentNode.removeChild(maxBtn);
                    var qualityBtn = card.querySelector('.card-quality-btn');
                    if (qualityBtn && qualityBtn.parentNode) qualityBtn.parentNode.removeChild(qualityBtn);
                    var qualityMenu = card.querySelector('.card-quality-menu');
                    if (qualityMenu && qualityMenu.parentNode) qualityMenu.parentNode.removeChild(qualityMenu);
                }

                async function getKey(id, type) {
                    var k = type + ':' + id;
                    if (k in cache) return cache[k];
                    try {
                        var r = await fetch('/api/card-trailer?id=' + id + '&type=' + type);
                        var d = await r.json();
                        cache[k] = d.key || null;
                    } catch(e) { cache[k] = null; }
                    return cache[k];
                }

                document.querySelectorAll('.popular-movie-card').forEach(function(card) {
                    var ci = ++idx;
                    card.addEventListener('mouseenter', function() {
                        hoverTimers[ci] = setTimeout(async function() {
                            var oc = card.getAttribute('onclick') || '';
                            var ps = oc.split('/media/');
                            if (ps.length < 2) return;
                            var sg = ps[1].split('/');
                            var tp = sg[0], mid = (sg[1] || '').replace(/[^0-9]/g, '');
                            if ((tp !== 'movie' && tp !== 'tv') || !mid) return;
                            var key = await getKey(mid, tp);
                            if (key && card.matches(':hover')) expandCard(card, key);
                        }, 900);
                    });
                    card.addEventListener('mouseleave', function() {
                        clearTimeout(hoverTimers[ci]);
                        collapseCard(card);
                    });
                });
            })();

            // Scroll reveal
            (function() {
                var els = document.querySelectorAll('.section-hidden');
                if (!els.length) return;
                var io = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('section-visible');
                            io.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.08 });
                els.forEach(function(el) { io.observe(el); });
            })();
        </script>

        <footer style="margin-top:40px; padding:24px 20px; border-top:1px solid rgba(255,255,255,0.08); text-align:center;">
            <p style="color:#555; font-size:13px; margin:0;">
                &copy; ${new Date().getFullYear()} SearchMovie&trade; &mdash; All rights reserved &middot;
                <a href="/users/privacy" style="color:#777; text-decoration:none;">Privacy Policy</a>
            </p>
            <p style="color:#444; font-size:11px; margin:6px 0 0;">
                SearchMovie does not host any media content. All streaming is provided by independent third-party sources.
            </p>
        </footer>
     </body>
    </html>`;


return res.send(html);
});

router.get('/api/search-suggest', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const api_key = process.env.TMDB_API_KEY;
    try {
        const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${api_key}&query=${encodeURIComponent(q)}&page=1&include_adult=false`);
        const data = await r.json();
        const items = (data.results || [])
            .filter(x => x.media_type === 'movie' || x.media_type === 'tv')
            .slice(0, 6)
            .map(x => ({
                id: x.id,
                type: x.media_type,
                title: x.media_type === 'movie' ? (x.title || '') : (x.name || ''),
                year: (x.release_date || x.first_air_date || '').substring(0, 4),
                poster: x.poster_path ? `https://image.tmdb.org/t/p/w92${x.poster_path}` : null
            }));
        res.json(items);
    } catch { res.json([]); }
});

router.get('/api/card-trailer', async (req, res) => {
    const id = req.query.id;
    const type = req.query.type === 'tv' ? 'tv' : 'movie';
    if (!id || !/^\d+$/.test(id)) return res.json({ key: null });
    const api_key = process.env.TMDB_API_KEY;
    try {
        const r = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${api_key}`);
        const data = await r.json();
        const trailer = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')
            || (data.results || []).find(v => v.site === 'YouTube');
        res.json({ key: trailer ? trailer.key : null });
    } catch { res.json({ key: null }); }
});

router.get('/api/backdrops', async (req, res) => {
    const api_key = process.env.TMDB_API_KEY;
    const apiRes = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${api_key}&language=en-US&page=1`);
    const data = await apiRes.json();
    const backdrops = data.results
        .filter(m => m.backdrop_path)
        .slice(0, 10)
        .map(m => ({ title: m.title, backdrop: m.backdrop_path }));

    res.json(backdrops);
});


module.exports = router;
