const mongoose = require("mongoose");

const watchProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    mediaType: { type: String, enum: ["tv", "movie"], required: true },
    mediaId: { type: String, required: true },     // TMDB id (as string, matches your other models)
    aniId: { type: String, default: "" },          // AniList id if it's an anime (for resume links)
    title: { type: String, default: "" },
    poster: { type: String, default: "" },
    watchedEpisodes: { type: [String], default: [] },
    lastSeason: { type: Number, default: null },
    lastEpisode: { type: Number, default: null },
    updatedAt: { type: Date, default: Date.now }
});

watchProgressSchema.index({ user: 1, mediaType: 1, mediaId: 1 }, { unique: true });

module.exports = mongoose.model("WatchProgress", watchProgressSchema);