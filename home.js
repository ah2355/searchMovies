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
app.use('/', require('./routes/homePage'));
app.use('/', require('./routes/search'));
app.use('/', require('./routes/airing'));
app.use('/', require('./routes/anime'));
app.use('/', require('./routes/watchProgress'));
app.use('/', requireAuth, require('./routes/myWatchlist'));

app.listen(port, err => {
    if (err) console.log('Server failed:', err);
    else console.log(`http://localhost:${port}`);
});
