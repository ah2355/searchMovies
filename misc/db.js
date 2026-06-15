const Favorite = require("../models/Favorite");
const Watchlist = require("../models/Watchlist");

async function fetchFavoritesFromDB(userId) {
    try {
        return await Favorite.find({ user: userId });
    } catch (err) {
        console.error("Database Fetch Error:", err);
        return [];
    }
}

async function fetchWatchlistFromDB(userId) {
    try {
        return await Watchlist.find({ user: userId });
    } catch (err) {
        return [];
    }
}

module.exports = { fetchFavoritesFromDB, fetchWatchlistFromDB };
