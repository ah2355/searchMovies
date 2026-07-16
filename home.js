require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const mongoose = require('mongoose');
const path = require('path');

const port = process.env.PORT || 3001;
const app = express();

mongoose.connect(process.env.MONGO_CONNECTION_STRING, { dbName: 'CMSC335DB' })
    .then(() => console.log('Connected To MongoDB'))
    .catch(err => console.log('MongoDB error:', err));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_CONNECTION_STRING,
        dbName: 'CMSC335DB'
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(express.static(__dirname));

const { requireAuth } = require('./middleware/auth');

app.use('/users', require('./routes/users'));
app.use('/favorites', requireAuth, require('./routes/favorites'));
app.use('/watchlist', requireAuth, require('./routes/watchlist'));
app.use('/media', require('./routes/media'));
app.use('/watch', require('./routes/watch'));
app.use('/', require('./routes/homePage'));
app.use('/', require('./routes/search'));
app.use('/', require('./routes/airing'));
app.use('/', require('./routes/anime'));
app.use('/', require('./routes/watchProgress'));
app.get('/health', async (req, res) => {
    const checks = { server: true, database: false, tmdb: false };
    try {
        checks.database = mongoose.connection.readyState === 1;
    } catch {}
    try {
        const r = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${process.env.TMDB_API_KEY}`);
        checks.tmdb = r.ok;
    } catch {}
    const healthy = checks.server && checks.database && checks.tmdb;
    res.status(healthy ? 200 : 503).json(checks);
});

app.use('/', requireAuth, require('./routes/myWatchlist'));

app.use((req, res) => {
    res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 — SearchMovie</title>
    <link rel="icon" type="image/x-icon" href="/images/icon.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#e50914">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background: #141414;
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
        }
        .num {
            font-size: clamp(90px, 20vw, 180px);
            font-weight: 900;
            line-height: 1;
            background: linear-gradient(135deg, #e50914, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        h1 { font-size: clamp(20px, 4vw, 28px); font-weight: 600; margin: 16px 0 8px; }
        p { color: #888; font-size: 15px; margin-bottom: 32px; max-width: 360px; }
        .search-row {
            display: flex;
            gap: 8px;
            width: 100%;
            max-width: 380px;
            margin-bottom: 16px;
        }
        input {
            flex: 1;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 10px;
            color: #fff;
            font-size: 15px;
            padding: 12px 16px;
            outline: none;
            font-family: inherit;
        }
        input:focus { border-color: rgba(229,9,20,0.6); }
        button {
            background: #e50914;
            border: none;
            border-radius: 10px;
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            padding: 12px 20px;
            cursor: pointer;
            font-family: inherit;
        }
        button:hover { background: #c0070f; }
        a.home-link {
            color: #888;
            font-size: 14px;
            text-decoration: none;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 8px 20px;
        }
        a.home-link:hover { color: #fff; border-color: rgba(255,255,255,0.4); }
        .logo { font-size: 15px; color: #e50914; font-weight: 700; margin-bottom: 40px; letter-spacing: 0.5px; }
    </style>
</head>
<body>
    <div class="logo">SearchMovie</div>
    <div class="num">404</div>
    <h1>Page not found</h1>
    <p>The page you're looking for doesn't exist or was moved.</p>
    <form class="search-row" action="/results" method="get">
        <input type="text" name="q" placeholder="Search movies & shows..." autofocus>
        <button type="submit">Search</button>
    </form>
    <a href="/" class="home-link">← Back to Home</a>
</body>
</html>`);
});

app.listen(port, err => {
    if (err) console.log('Server failed:', err);
    else console.log(`http://localhost:${port}`);
});
