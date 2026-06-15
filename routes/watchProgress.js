const express = require('express');
const router = express.Router();
const WatchProgress = require('../models/WatchProgress');

router.get("/api/continue-watching", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ items: [] });
    }
    try {
        const docs = await WatchProgress.find({ user: req.session.userId })
            .sort({ updatedAt: -1 })
            .limit(20);
 
        const items = docs.map(d => ({
            mediaType: d.mediaType,
            mediaId: d.mediaId,
            aniId: d.aniId || "",
            title: d.title || "Untitled",
            poster: d.poster || "/images/icon.png",
            lastSeason: d.lastSeason,
            lastEpisode: d.lastEpisode
        }));
 
        return res.json({ items });
    } catch (err) {
        console.log("continue-watching error:", err.message);
        return res.json({ items: [] });
    }
});

router.post("/watch-progress/remove", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ ok: false, guest: true });
    }
    try {
        const { mediaType, mediaId } = req.body;
        if (!mediaType || !mediaId) {
            return res.status(400).json({ ok: false, error: "missing mediaType/mediaId" });
        }
        await WatchProgress.deleteOne({
            user: req.session.userId,
            mediaType,
            mediaId: String(mediaId)
        });
        return res.json({ ok: true });
    } catch (err) {
        console.log("watch-progress/remove error:", err.message);
        return res.status(500).json({ ok: false });
    }
});

router.post("/watch-progress/mark", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ ok: false, guest: true });
    }
    try {
        const { mediaType, mediaId, aniId, title, poster, season, episode } = req.body;
        if (!mediaType || !mediaId) {
            return res.status(400).json({ ok: false, error: "missing mediaType/mediaId" });
        }
 
        const s = Number(season) || 1;
        const e = Number(episode);
        const epKey = (mediaType === "tv" && e) ? `S${s}E${e}` : null;
 
        const update = {
            $set: {
                mediaType,
                mediaId: String(mediaId),
                aniId: aniId ? String(aniId) : "",
                title: title || "",
                poster: poster || "",
                updatedAt: new Date()
            }
        };
        if (epKey) {
            update.$addToSet = { watchedEpisodes: epKey };
            update.$set.lastSeason = s;
            update.$set.lastEpisode = e;
        }
 
        await WatchProgress.findOneAndUpdate(
            { user: req.session.userId, mediaType, mediaId: String(mediaId) },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
 
        return res.json({ ok: true });
    } catch (err) {
        console.log("watch-progress/mark error:", err.message);
        return res.status(500).json({ ok: false });
    }
});
 
router.get("/watch-progress/:mediaType/:mediaId", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ watched: [] });
    }
    try {
        const { mediaType, mediaId } = req.params;
        const doc = await WatchProgress.findOne({
            user: req.session.userId,
            mediaType,
            mediaId: String(mediaId)
        });
        return res.json({ watched: doc ? doc.watchedEpisodes : [] });
    } catch (err) {
        return res.json({ watched: [] });
    }
});

router.post("/watch-progress/unmark", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ ok: false, guest: true });
    }
    try {
        const { mediaType, mediaId, season, episode } = req.body;
        if (!mediaType || !mediaId) {
            return res.status(400).json({ ok: false, error: "missing mediaType/mediaId" });
        }
        const s = Number(season) || 1;
        const e = Number(episode);
        const epKey = (mediaType === "tv" && e) ? `S${s}E${e}` : null;
        if (!epKey) return res.json({ ok: true }); // nothing to remove (e.g. movie)
 
        await WatchProgress.findOneAndUpdate(
            { user: req.session.userId, mediaType, mediaId: String(mediaId) },
            { $pull: { watchedEpisodes: epKey }, $set: { updatedAt: new Date() } }
        );
        return res.json({ ok: true });
    } catch (err) {
        console.log("watch-progress/unmark error:", err.message);
        return res.status(500).json({ ok: false });
    }
});


module.exports = router;
