const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    imdbId: String,
    title: String,
    year: String,
    genres: String,
    rating: String,
    image: String,
    certification: String,
    watched: { type: Boolean, default: false },
    mediaType: { type: String, default: 'movie' }
});

module.exports = mongoose.model('Watchlist', watchlistSchema);