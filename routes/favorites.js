const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Favorite = require("../models/Favorite"); 


router.get("/", async (req, res) => {
  if (!req.session.userId) return res.redirect("/users/login");

  const favorites = await Favorite.find({ user: req.session.userId });
  console.log("Fetching favorites for user:", req.session.userId);
  console.log("Favorites found:", favorites.length); 
  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset = "utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="/css/style.css">
        <link rel="icon" type="image/x-icon" href="images/icon.png">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
        <script src="/misc/tvNav.js" defer></script>
        <title>Favorite List</title>
      </head>
      <body>
        <nav class="navbar3">
          <span class="nav-title3">Favorite List</span>
          <div class="nav-item3">
            <a href="/">Back Home</a>
          </div>
        </nav>

        <div style="text-align:center; margin:20px;">
            <button id="deleteAllBtn" onclick="deleteAllFavorites()">
                <i class="fa-regular fa-trash-can"></i> Remove All Favorites
            </button>
        </div>
        <div class="movie-grid">
    `;
  
    favorites.forEach(movie => {
        const cert = movie.certification || "PG";
        html += `
          <div class="movie-card" style="cursor: pointer;" tabindex="0" onclick="window.location.href='/media/movie/${movie.imdbId}'">
            <div class="poster-container">
              <span class="cert-badge ${cert.replace(/[^a-zA-Z0-9]/g, '-')}">${cert}</span>
              <img src="${movie.image || ''}" alt="movie poster">
            </div>
            <h3>${movie.title}</h3>
            <p><strong>Year:</strong> ${movie.year || "N/A"}</p>
            <p><strong>Genre:</strong> ${movie.genres || "Unknown"}</p>
            <p><strong>Rating:</strong> ${movie.rating || "N/A"}</p>
            
            <form id="dltForm" action="/favorites/delete/${movie._id}" method="POST" onclick="event.stopPropagation()">
              <button type="submit" id="deleteBtn">Delete</button>
            </form>
          </div>
        `;
    });

    html += `
    </div>

    <div class="modal-overlay" id="deleteAllModal">
        <div class="modal-box">
            <div class="modal-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <p class="modal-title">Remove All Favorites?</p>
            <p class="modal-text">This will remove every movie and show from your favorites list. This cannot be undone.</p>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-cancel" onclick="document.getElementById('deleteAllModal').classList.remove('active')">Cancel</button>
                <button class="modal-btn modal-btn-confirm" id="confirmDeleteAllBtn">Remove All</button>
            </div>
        </div>
    </div>

    <script>
      function deleteAllFavorites() {
          document.getElementById('deleteAllModal').classList.add('active');
      }
      document.getElementById('confirmDeleteAllBtn').addEventListener('click', async function() {
          this.textContent = 'Removing...';
          this.disabled = true;
          await fetch("/favorites/deleteAll", { method: "POST" });
          location.reload();
      });
      document.getElementById('deleteAllModal').addEventListener('click', function(e) {
          if (e.target === this) this.classList.remove('active');
      });
    </script>
  </body>
  </html>`;

  res.send(html);
});

router.post("/add", async (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);
    
    const { title, year, imdbId, genres, rating, image, certification } = req.body;
    
    const existing = await Favorite.findOne({ user: req.session.userId, imdbId: imdbId });
    
    if (existing) {
        await Favorite.findByIdAndDelete(existing._id);
        res.sendStatus(200);
    } else {
        await Favorite.create({
            user: req.session.userId,
            title, year, imdbId, genres, rating, image, certification
        });
        res.sendStatus(200);
    }
});

router.post("/delete/:id", async (req, res) => {
  try {
    const deleted = await Favorite.findOneAndDelete({ 
        _id: req.params.id, 
        user: req.session.userId 
    });
    
    if (!deleted) return res.send("Favorite not found or access denied.");
    res.redirect("/favorites");
  } catch (err) {
    console.log(err);
    res.send("Error deleting movie");
  }
});

router.post("/deleteAll", async (req, res) => {
    if (!req.session.userId) return res.sendStatus(401);

    await Favorite.deleteMany({ user: req.session.userId });
    
    res.sendStatus(200);
});
module.exports = router;