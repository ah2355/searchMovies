const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const geoTz = require('geo-tz');
const { DateTime } = require('luxon');
const genreMap = require('../misc/genreMap');

router.get("/airing", async (req,res)=>{
    const offsetDays = parseInt(req.query.offset) || 0;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    const country = geo?.country || 'US';
    const timezone = geo?.timezone || 'America/New_York'

    const localDate = DateTime.now().setZone(timezone).plus({ days: offsetDays });
    const dateStr = localDate.toFormat('yyyy-MM-dd');
    let html = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Airing Today</title>
            <meta name="description" content="What's airing today">
            
            <meta property="og:title" content="SearchMovie - Airing Today">
            <meta property="og:description" content="Find out whats airing today">
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
        <body class="air-td-body">
            <nav class="navbar2">
                <span class="nav-title2">Shows Airing</span>
                <div class="nav-links2">
                    <a href="/" class="nav-item">Home</a>
                    <a href="/favorites" class="nav-item">Favorites</a>
                </div>
            </nav>
            <div class="main-cont-td">
                <div id="airDate">
                    <div class="airHeaders">
                        <h1 style="text-align: center; color: red;  animation: dropIn 0.4s ease-out forwards;">Airing Today</h1>
                        <h2 style="color: grey; font-size: 0.8rem; text-align:center">
                        <i class="fa-solid fa-location-dot" style="color:red; margin-right: 2px;"></i> Showing schedule for ${country}
                        </h2>
                    </div>
                    <h2><i>Check TBA section for other shows located all the way down</i></h2>
                    <div id="air-controls">
                        <button id="prev"><i class="fa-solid fa-arrow-left"></i></button>
                        <h2 id="day-display"></h2>
                        <button id="next"><i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
                <div class="airInfo">

    `
    const fetchTMDB = offsetDays === 0
    ? Promise.all([1, 2, 3].map(page =>
        fetch(`https://api.themoviedb.org/3/tv/airing_today?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=${page}`).then(r => r.json())
      )).then(pages => ({ results: pages.flatMap(p => p.results || []) }))
    : Promise.resolve({ results: [] });

    const [network, web, tmdbAiring] = await Promise.all([
        fetch(`https://api.tvmaze.com/schedule?country=${country}&date=${dateStr}`).then(r => r.json()),
        fetch(`https://api.tvmaze.com/schedule/web?country=${country}&date=${dateStr}`).then(r => r.json()),
        fetchTMDB
    ]);

    const data = [...network, ...web];

    const seen = new Set();
    const ALLOWED_TYPES = ['Scripted', 'Animation', 'Reality', 'Documentary', 'Miniseries'];

    const shows = data.filter(entry => {
        const show = entry._embedded?.show ?? entry.show;
        if (!show || !ALLOWED_TYPES.includes(show.type)) return false;
        if (seen.has(show.id)) return false;
        seen.add(show.id);
        return true;
    });

    const tvmazeNames = new Set(shows.map(e => {
        const s = e._embedded?.show ?? e.show;
        return s?.name?.toLowerCase();
    }));

    const tmdbShows = await Promise.all(
        (tmdbAiring.results || [])
            .filter(s => !tvmazeNames.has(s.name?.toLowerCase()))
            .map(async s => {
                let airtime = "";
                try {
                    // Try to find it on TVmaze to get airtime
                    const mazeRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(s.name)}&embed=nextepisode`);
                    const mazeData = await mazeRes.json();
                    airtime = mazeData?._embedded?.nextepisode?.airtime || "";
                } catch (_) {}

                return {
                    airtime,
                    _isTMDB: true,
                    show: {
                        id: `tmdb-${s.id}`,
                        name: s.name,
                        type: 'Scripted',
                        genres: (s.genre_ids || []).map(id => genreMap[id]).filter(Boolean),
                        image: { medium: s.poster_path ? `https://image.tmdb.org/t/p/w185${s.poster_path}` : null },
                        network: { name: "Unknown" },
                        summary: s.overview || "",
                        _tmdbId: s.id
                    }
                };
            })
    );
    const allShows = [...shows, ...tmdbShows];

    const timeSlots = {};
    for (const entry of allShows) {
        const time = entry.airtime || "TBA";
        if (!timeSlots[time]) timeSlots[time] = [];
        timeSlots[time].push(entry);
    }

    const sortedTimes = Object.keys(timeSlots).sort();
    for (const time of sortedTimes) {
        html += `<div class="time-slot">
            <div class="time-label">${time || "TBA"}</div>
            <div class="time-slot-cards">`;

        for (const entry of timeSlots[time]) {
            const show = entry._embedded?.show ?? entry.show;
            const title = show?.name ?? "Unknown";
            const network = show?.network?.name ?? show?.webChannel?.name ?? "Unknown";
            const image = show?.image?.medium ?? '/images/icon.png';
            const genre = show?.genres?.join(", ") || "N/A";
            const summary = show?.summary?.replace(/<[^>]*>/g, "").slice(0, 80) ?? "";
            const tmdbId = show?._tmdbId;
            const href = tmdbId ? `/media/tv/${tmdbId}` : `/results?q=${encodeURIComponent(title)}`;

            html += `
            <div class="air-card" tabindex="0" onclick="window.location.href='${href}'">
                <img src="${image}" alt="${title}">
                <div class="air-card-info">
                    <h3>${title}</h3>
                    <p><i class="fa-solid fa-satellite-dish"></i> ${network}</p>
                    <p><strong>Genre: </strong>${genre}</p>
                    <p class="air-summary"><strong>Summary:  </strong>${summary}...</p>
                </div>
            </div>`;
        }

        html += `</div></div>`;
    }

    html+=`
                </div>
            </div>
        <script>
            let weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let offset = ${offsetDays}; ;

            function updateDisplay() {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const label = offset === 0 
                ? 'Today' 
                : weekdays[d.getDay()] + ' ' + d.getDate();
                document.getElementById('day-display').textContent = label;
            }

            document.getElementById('prev').addEventListener('click', () => {
                offset--;
                window.location.href = '/airing?offset=' + offset;
            });

            document.getElementById('next').addEventListener('click', () => {
                offset++;
               window.location.href = '/airing?offset=' + offset;
            });

            updateDisplay();


        </script>
        </body>
    </html>`;

    res.send(html);
})


module.exports = router;
