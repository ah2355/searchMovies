const express = require('express');
const router = express.Router();
const { fetchWatchlistFromDB } = require('../misc/db');

router.get("/my-watchlist", async (req, res) => {
    const watchlist = await fetchWatchlistFromDB(req.session.userId);

    let html = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Watchlist</title>
            <link rel="stylesheet" href="/css/style.css">
            <link rel="icon" type="image/x-icon" href="/images/icon.png">
            <link rel="preconnect" href="https://image.tmdb.org">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://cdnjs.cloudflare.com">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
            <script src="/misc/navMobile.js" defer></script>
        </head>
        <body>
            <nav class="navbar2">
                <span class="nav-title2">My Watchlist</span>
                <div class="nav-links2">
                    <a href="/" class="nav-item">Home</a>
                    <a href="/favorites" class="nav-item">Favorites</a>
                </div>
            </nav>
            <div class="movie-grid">`;

    if (watchlist.length === 0) {
       html += `
        </div> <!-- -->
        <div style="display:flex; justify-content:center; align-items:center; height:60vh;">
            <h2 style="color:white; text-align:center;">Your watchlist is empty. Start adding shows and movies!</h2>
        </div>`;
    } else {
        for (const item of watchlist) {
            const certClass = (item.certification || "PG-13").replace(/[^a-zA-Z0-9]/g, '-');
            html += `
            <div class="movie-card" onclick="window.location.href='/media/${item.mediaType || 'movie'}/${item.imdbId}'">
                <div class="poster-container">
                    <span class="cert-badge ${certClass}">${item.certification || "PG-13"}</span>
                    <img src="${item.image}" alt="${item.title}">
                    ${item.watched ? `<span class="watched-badge">✓ Watched</span>` : ''}
                </div>
                <h3>${item.title}</h3>
                <p>Year: ${item.year || "N/A"}</p>
                <p><strong>Genre:</strong> ${item.genres || "N/A"}</p>
                <p><strong>Rating:</strong> ${item.rating || "N/A"}</p>
                <div class="movie-card-bottom-bar-watch-page">
                    <button class="watched-btn ${item.watched ? 'active' : ''}" onclick="event.stopPropagation(); markWatched(this, '${item.imdbId}')">
                        ${item.watched ? '✓ Watched' : 'Mark Watched'}
                    </button>
                    <button class="remove-btn" onclick="event.stopPropagation(); removeFromWatchlist(this, '${item.imdbId}')">✕</button>
                </div>
            </div>`;
        }
    }

    html += `</div>
        <script>
            async function markWatched(btn, imdbId) {
                const res = await fetch('/watchlist/watched/' + imdbId, { method: 'POST' });
                const data = await res.json();
                if (data.watched) {
                    btn.classList.add('active');
                    btn.textContent = '✓ Watched';
                } else {
                    btn.classList.remove('active');
                    btn.textContent = '👁 Mark Watched';
                }
            }

            async function removeFromWatchlist(btn, imdbId) {
                await fetch('/watchlist/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imdbId })
                });
                btn.closest('.movie-card').remove();
            }
        </script>
        </body>
    </html>`;

    res.send(html);
});



module.exports = router;
