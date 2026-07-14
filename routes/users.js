const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Favorite = require("../models/Favorite");
const Watchlist = require("../models/Watchlist");
const WatchProgress = require("../models/WatchProgress");

router.get("/login", (req,res) => {
    if (req.session && req.session.userId) {
        const username = req.session.username || 'User';
        let displayName = (username !== "Guest" && username.includes('@')) 
        ? username.split('@')[0] 
        : username;
        displayName = displayName.charAt(0).toUpperCase() + displayName.substring(1);
        const initial = username.charAt(0).toUpperCase();
        return res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/css/login.css">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                <link rel="icon" type="image/x-icon" href="/images/icon.png">
                <title>My Account - SearchMovie</title>
            </head>
            <body class="loginBody">
                <nav class="navbar">
                    <div class="nav-left">
                        <img src="/images/icon.png" alt="Logo" class="logoImg2">
                        <a href="/" id="titleLink">
                            <span class="nav-title">SearchMovie</span>
                        </a>
                    </div>
                </nav>

                <div class="auth-wrapper">
                    <div id="loginContainer" style="text-align:center;">
                        <div class="profile-avatar">${initial}</div>
                        <p class="profile-username">${displayName}</p>
                        <p class="profile-label">SearchMovie Account</p>

                        <div class="profile-actions">
                            <a href="/" class="profile-btn profile-btn-primary">
                                <i class="fa-solid fa-house"></i> Home
                            </a>
                            <a href="/favorites" class="profile-btn profile-btn-outline">
                                <i class="fa-solid fa-heart"></i> My Favorites
                            </a>
                            <a href="/my-watchlist" class="profile-btn profile-btn-outline">
                                <i class="fa-solid fa-bookmark"></i> My Watchlist
                            </a>
                            <form action="/users/logout" method="POST" style="width:100%; max-width:280px; margin:0;">
                                <button type="submit" class="profile-btn profile-btn-outline" style="width:100%;">
                                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                                </button>
                            </form>

                            <hr class="profile-divider">

                            <button class="profile-btn profile-btn-danger" onclick="document.getElementById('deleteModal').classList.add('active')">
                                <i class="fa-solid fa-trash"></i> Delete Account
                            </button>
                        </div>
                    </div>
                </div>

                <div class="modal-overlay" id="deleteModal">
                    <div class="modal-box">
                        <div class="modal-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        <p class="modal-title">Delete Account?</p>
                        <p class="modal-text">This will permanently delete your account, favorites, watchlist, and watch progress. This cannot be undone.</p>
                        <div class="modal-actions">
                            <button class="modal-btn modal-btn-cancel" onclick="document.getElementById('deleteModal').classList.remove('active')">Cancel</button>
                            <button class="modal-btn modal-btn-confirm" id="confirmDeleteBtn">Delete</button>
                        </div>
                    </div>
                </div>

                <script>
                    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
                        this.textContent = 'Deleting...';
                        this.disabled = true;
                        fetch('/users/delete-account', { method: 'POST' })
                            .then(() => window.location.href = '/users/login');
                    });
                    document.getElementById('deleteModal').addEventListener('click', function(e) {
                        if (e.target === this) this.classList.remove('active');
                    });
                </script>
            </body>
        </html>
        `);
    } 

    res.send(`<!DOCTYPE html>
        <html>
            <head>
                <meta charset = "utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="description" content="SearchMovie is a fast, intelligent movie discovery platform. Search for your favorite films, filter by genre, and manage your personalized favorites list.">
                <meta property="og:site_name" content="SearchMovie">
                <link rel = "stylesheet" href= "/css/login.css">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <link rel="icon" type="image/png" href="/images/icon.png">
                <title>SearchMovie</title>
                <script type="application/ld+json">
                    {
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "name": "SearchMovie",
                        "alternateName": ["SearchMovie Win"],
                        "url": "https://searchmovie.win/"
                    }
                </script>
            </head>
            <body class="loginBody">
                <nav class = "navbar">
                    <div class="nav-left">
                        <img src="/images/icon.png" alt="Log" class="logoImg2">  
                        <a href="/users/login" id="titleLink">
                            <span class="nav-title">SearchMovie</span>
                        </a>
                    </div>

                    <button class="hamburger" id="hamburger">
                        <span class="bar"></span>
                        <span class="bar"></span>
                        <span class="bar"></span>
                    </button>

                    <div class="nav-right" id="navLinks">
                        <a href="/" class="nav-item"><i class="fa-solid fa-house"></i> Home</a>
                        <a href="#feature-heading" class="nav-item"><i class="fa-solid fa-wand-magic-sparkles"></i> Features</a>
                        <a href="#tools-heading" class="nav-item"><i class="fa-solid fa-screwdriver-wrench"></i> Tools Used</a>
                        <a href="https://github.com/ah2355/searchMovies" target="_blank" class="nav-item"><i class="fa-brands fa-github"></i> GitHub</a>
                        <a href="/users/privacy" class="nav-item"><i class="fa-solid fa-circle-info"></i> Privacy Notice</a>

                    </div>
                </nav>
                <div class="auth-wrapper">
                    <div id = "loginContainer">
                        <div id="loginHeader">
                            <img src="/images/icon-removebg.png" alt="Logo" class="logoImg">
                            <h1>SearchMovies</h1>
                        </div>
                        <h2 style="margin-top:18px;">Sign in</h2>
                        <form action="/users/login" id="loginForm" method="post">
                            <div class="input-group">
                                <label class="input-label" for="userName">Username or Email</label>
                                <input type="text" id="userName" name="username" placeholder="Enter your username" autocomplete="username" required>
                            </div>
                            <div class="input-group">
                                <label class="input-label" for="password">Password</label>
                                <div class="pw-wrap">
                                    <input type="password" id="password" name="password" placeholder="Enter your password" autocomplete="current-password" required>
                                    <button type="button" class="pw-toggle" onclick="togglePw()" tabindex="-1" aria-label="Show password">
                                        <i class="fa-solid fa-eye" id="pw-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <input type="submit" id="submit" value="Sign In">
                        </form>
                        <p style="margin-top:20px; text-align:center; color:rgba(255,255,255,0.6);">Don't have an account? <a href="/users/register" id="hereBtn">Create one</a></p>
                        <script>
                            function togglePw() {
                                var pw = document.getElementById('password');
                                var eye = document.getElementById('pw-eye');
                                if (pw.type === 'password') { pw.type = 'text'; eye.className = 'fa-solid fa-eye-slash'; }
                                else { pw.type = 'password'; eye.className = 'fa-solid fa-eye'; }
                            }
                        </script>
                    </div>
                </div>


                <h1 id="feature-heading" class="reveal">Why SearchMoive</h1>
                <br>
                <div class="feature-container reveal">
                    <div id="feature-section">
                        <div class="feature-icon">
                            <i class="fa-solid fa-magnifying-glass" style="color:black"></i>
                        </div>
                        <h2>Find Stuff Quickly</h2>
                        <p>Not sure what to watch? Filter by genre, rating, year, and language to surface hidden gems perfectly tuned to your mood.</p>
                    </div>
                    <div id="feature-section">
                         <div class="feature-icon">
                            <i class="fa-solid fa-heart" style="color: red;"></i>
                        </div>
                        <h2>Your Personal Library</h2>
                         <p>Heart the ones you love and build a watchlist you can track across every device. Your taste, saved and synced wherever you log in.</p>
                    </div>
                    <div id="feature-section">
                        <div class="feature-icon">
                            <i class="fa-brands fa-d-and-d" style="color:green;"></i>
                        </div>
                         <h2>A Home for Anime</h2>
                         <p>Browse trending and airing anime, check the weekly schedule, and dive into full series — a dedicated hub built for fans, not an afterthought.</p>
                    </div>
                    <div id="feature-section">
                        <div class="feature-icon">
                            <i class="fa-regular fa-face-grin-beam" style="color: yellow;"></i>                        
                        </div>
                        <h2>Watch Without the Hassle</h2>
                        <p>Stream right from the details page with a built-in player and multiple sources, so when one's down you're never stuck.</p>
                    </div>
                </div>
                <br>
                <div class = "tools-container reveal">
                    <h2 id="tools-heading">Built With</h2>
                    <div class="tools-container">
                        <div class="tool-chip"><i class="fa-brands fa-node-js" style="color: green"></i><span>Node.js</span></div>
                        <div class="tool-chip"><i class="fa-brands fa-js" style="color:yellow;"></i><span>JavaScript</span></div>
                        <div class="tool-chip"><i class="fa-brands fa-html5" style="color: #ffa500"></i><span>HTML5</span></div>
                        <div class="tool-chip"><i class="fa-brands fa-css3-alt" style="color: #5bd3ff"></i><span>CSS3</span></div>
                        <div class="tool-chip"><svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M126.67 98.44c-4.56 1.16-7.38.05-9.91-3.75-5.68-8.51-11.95-16.63-18-24.9-.78-1.07-1.59-2.12-2.6-3.45C89 76 81.85 85.2 75.14 94.77c-2.4 3.42-4.92 4.91-9.4 3.7l26.92-36.13L67.6 29.71c4.31-.84 7.29-.41 9.93 3.45 5.83 8.52 12.26 16.63 18.67 25.21 6.45-8.55 12.8-16.67 18.8-25.11 2.41-3.42 5-4.72 9.33-3.46-3.28 4.35-6.49 8.63-9.72 12.88-4.36 5.73-8.64 11.53-13.16 17.14-1.61 2-1.35 3.3.09 5.19C109.9 76 118.16 87.1 126.67 98.44zM1.33 61.74c.72-3.61 1.2-7.29 2.2-10.83 6-21.43 30.6-30.34 47.5-17.06C60.93 41.64 63.39 52.62 62.9 65H7.1c-.84 22.21 15.15 35.62 35.53 28.78 7.15-2.4 11.36-8 13.47-15 1.07-3.51 2.84-4.06 6.14-3.06-1.69 8.76-5.52 16.08-13.52 20.66-12 6.86-29.13 4.64-38.14-4.89C5.26 85.89 3 78.92 2 71.39c-.15-1.2-.46-2.38-.7-3.57q.03-3.04.03-6.08zm5.87-1.49h50.43c-.33-16.06-10.33-27.47-24-27.57-15-.12-25.78 11.02-26.43 27.57z"/></svg><span>Express</span></div>
                        <div class="tool-chip"><svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path fill-rule="evenodd" clip-rule="evenodd" fill="#439934" d="M88.038 42.812c1.605 4.643 2.761 9.383 3.141 14.296.472 6.095.256 12.147-1.029 18.142-.035.165-.109.32-.164.48-.403.001-.814-.049-1.208.012-3.329.523-6.655 1.065-9.981 1.604-3.438.557-6.881 1.092-10.313 1.687-1.216.21-2.721-.041-3.212 1.641-.014.046-.154.054-.235.08l.166-10.051-.169-24.252 1.602-.275c2.62-.429 5.24-.864 7.862-1.281 3.129-.497 6.261-.98 9.392-1.465 1.381-.215 2.764-.412 4.148-.618z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#45A538" d="M61.729 110.054c-1.69-1.453-3.439-2.842-5.059-4.37-8.717-8.222-15.093-17.899-18.233-29.566-.865-3.211-1.442-6.474-1.627-9.792-.13-2.322-.318-4.665-.154-6.975.437-6.144 1.325-12.229 3.127-18.147l.099-.138c.175.233.427.439.516.702 1.759 5.18 3.505 10.364 5.242 15.551 5.458 16.3 10.909 32.604 16.376 48.9.107.318.384.579.583.866l-.87 2.969z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#46A037" d="M88.038 42.812c-1.384.206-2.768.403-4.149.616-3.131.485-6.263.968-9.392 1.465-2.622.417-5.242.852-7.862 1.281l-1.602.275-.012-1.045c-.053-.859-.144-1.717-.154-2.576-.069-5.478-.112-10.956-.18-16.434-.042-3.429-.105-6.857-.175-10.285-.043-2.13-.089-4.261-.185-6.388-.052-1.143-.236-2.28-.311-3.423-.042-.657.016-1.319.029-1.979.817 1.583 1.616 3.178 2.456 4.749 1.327 2.484 3.441 4.314 5.344 6.311 7.523 7.892 12.864 17.068 16.193 27.433z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#409433" d="M65.036 80.753c.081-.026.222-.034.235-.08.491-1.682 1.996-1.431 3.212-1.641 3.432-.594 6.875-1.13 10.313-1.687 3.326-.539 6.652-1.081 9.981-1.604.394-.062.805-.011 1.208-.012-.622 2.22-1.112 4.488-1.901 6.647-.896 2.449-1.98 4.839-3.131 7.182a49.142 49.142 0 01-6.353 9.763c-1.919 2.308-4.058 4.441-6.202 6.548-1.185 1.165-2.582 2.114-3.882 3.161l-.337-.23-1.214-1.038-1.256-2.753a41.402 41.402 0 01-1.394-9.838l.023-.561.171-2.426c.057-.828.133-1.655.168-2.485.129-2.982.241-5.964.359-8.946z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#4FAA41" d="M65.036 80.753c-.118 2.982-.23 5.964-.357 8.947-.035.83-.111 1.657-.168 2.485l-.765.289c-1.699-5.002-3.399-9.951-5.062-14.913-2.75-8.209-5.467-16.431-8.213-24.642a4498.887 4498.887 0 00-6.7-19.867c-.105-.31-.407-.552-.617-.826l4.896-9.002c.168.292.39.565.496.879a6167.476 6167.476 0 016.768 20.118c2.916 8.73 5.814 17.467 8.728 26.198.116.349.308.671.491 1.062l.67-.78-.167 10.052z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#4AA73C" d="M43.155 32.227c.21.274.511.516.617.826a4498.887 4498.887 0 016.7 19.867c2.746 8.211 5.463 16.433 8.213 24.642 1.662 4.961 3.362 9.911 5.062 14.913l.765-.289-.171 2.426-.155.559c-.266 2.656-.49 5.318-.814 7.968-.163 1.328-.509 2.632-.772 3.947-.198-.287-.476-.548-.583-.866-5.467-16.297-10.918-32.6-16.376-48.9a3888.972 3888.972 0 00-5.242-15.551c-.089-.263-.34-.469-.516-.702l3.272-8.84z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#57AE47" d="M65.202 70.702l-.67.78c-.183-.391-.375-.714-.491-1.062-2.913-8.731-5.812-17.468-8.728-26.198a6167.476 6167.476 0 00-6.768-20.118c-.105-.314-.327-.588-.496-.879l6.055-7.965c.191.255.463.482.562.769 1.681 4.921 3.347 9.848 5.003 14.778 1.547 4.604 3.071 9.215 4.636 13.813.105.308.47.526.714.786l.012 1.045c.058 8.082.115 16.167.171 24.251z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#60B24F" d="M65.021 45.404c-.244-.26-.609-.478-.714-.786-1.565-4.598-3.089-9.209-4.636-13.813-1.656-4.93-3.322-9.856-5.003-14.778-.099-.287-.371-.514-.562-.769 1.969-1.928 3.877-3.925 5.925-5.764 1.821-1.634 3.285-3.386 3.352-5.968.003-.107.059-.214.145-.514l.519 1.306c-.013.661-.072 1.322-.029 1.979.075 1.143.259 2.28.311 3.423.096 2.127.142 4.258.185 6.388.069 3.428.132 6.856.175 10.285.067 5.478.111 10.956.18 16.434.008.861.098 1.718.152 2.577z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#A9AA88" d="M62.598 107.085c.263-1.315.609-2.62.772-3.947.325-2.649.548-5.312.814-7.968l.066-.01.066.011a41.402 41.402 0 001.394 9.838c-.176.232-.425.439-.518.701-.727 2.05-1.412 4.116-2.143 6.166-.1.28-.378.498-.574.744l-.747-2.566.87-2.969z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#B6B598" d="M62.476 112.621c.196-.246.475-.464.574-.744.731-2.05 1.417-4.115 2.143-6.166.093-.262.341-.469.518-.701l1.255 2.754c-.248.352-.59.669-.728 1.061l-2.404 7.059c-.099.283-.437.483-.663.722l-.695-3.985z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#C2C1A7" d="M63.171 116.605c.227-.238.564-.439.663-.722l2.404-7.059c.137-.391.48-.709.728-1.061l1.215 1.037c-.587.58-.913 1.25-.717 2.097l-.369 1.208c-.168.207-.411.387-.494.624-.839 2.403-1.64 4.819-2.485 7.222-.107.305-.404.544-.614.812-.109-1.387-.22-2.771-.331-4.158z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#CECDB7" d="M63.503 120.763c.209-.269.506-.508.614-.812.845-2.402 1.646-4.818 2.485-7.222.083-.236.325-.417.494-.624l-.509 5.545c-.136.157-.333.294-.398.477-.575 1.614-1.117 3.24-1.694 4.854-.119.333-.347.627-.525.938-.158-.207-.441-.407-.454-.623-.051-.841-.016-1.688-.013-2.533z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#DBDAC7" d="M63.969 123.919c.178-.312.406-.606.525-.938.578-1.613 1.119-3.239 1.694-4.854.065-.183.263-.319.398-.477l.012 3.64-1.218 3.124-1.411-.495z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#EBE9DC" d="M65.38 124.415l1.218-3.124.251 3.696-1.469-.572z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#CECDB7" d="M67.464 110.898c-.196-.847.129-1.518.717-2.097l.337.23-1.054 1.867z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="#4FAA41" d="M64.316 95.172l-.066-.011-.066.01.155-.559-.023.56z"/></svg>
                        <span>MongoDB</span></div>
                        <div class="tool-chip"><svg width="35" height="35" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path style="fill:#850000;fill-opacity:1;fill-rule:nonzero;stroke:none" d="M69.953.309c-1.676.07-4.508.52-4.508.71 0 .079 1.996 1.079 2.149 1.079.14 0 2.457 1.156 2.972 1.476.672.43 1.153.82 1.012.82-.09 0-2.469-.921-3.371-1.308-.734-.309-3.785-1.219-5.27-1.57-.804-.188-1.144-.258-2.511-.508C58.41.64 56.039.618 55.008.957c-1.477.48-1.809 1.07-1.809 3.246 0 1.2.059 1.707.32 2.785.114.469.434 1.5.583 1.848.043.11.183.45.3.75.121.297.485 1.066.805 1.695 1.797 3.567 4.488 6.54 8.281 9.156 1.196.82 4.446 2.375 5.75 2.747.332.09.442.277.172.277-.3 0-3.05-.758-3.613-.996a9.982 9.982 0 0 0-.652-.262c-1.957-.789-4.457-2.414-6.524-4.262a21.38 21.38 0 0 1-5.312-7.257c-.793-1.79-1.332-3.875-1.465-5.692-.078-1.039-.16-1.289-.43-1.277-.09 0-.945-.031-1.887-.082-2.562-.11-6.062.172-9.527.77-6.625 1.128-13.773 3.734-21.129 7.706a94.93 94.93 0 0 0-3.625 2.067c-.14.082-.582.351-.984.601-.399.25-.871.528-1.043.637-.38.223-4.586 3.078-5.09 3.457-.188.137-.711.527-1.152.848C4.98 21.195.633 24.742.383 25.102c-.121.18.07.27.328.18.133-.052.473-.122.746-.16.281-.044 1.004-.231 1.605-.43.61-.192 1.266-.391 1.454-.442 1.488-.348 2.09-.469 2.96-.598.395-.05.977-.14 1.305-.191 4.078-.598 6.024-.746 7.84-.61 3.945.32 7.719.993 9.879 1.758 1.617.582 4.906 2.36 6.352 3.426.836.63 3.523 3.305 4.117 4.113.46.641.972 1.2 1.093 1.2.04 0 .09-2.04.102-4.524l.027-4.512 5.282-.03c4.156-.02 5.308.011 5.379.1.101.13.343.56 1.136 2.024.754 1.41 1.125 2.09 1.356 2.496.12.223.398.739.633 1.149.218.41.628 1.168.91 1.687.281.52.511.961.511.98 0 .09.414.63.485.63.039 0 .14-.153.21-.32.079-.18.29-.579.462-.88.18-.3.5-.886.722-1.296.223-.41.524-.98.684-1.25.441-.79.902-1.645 1.285-2.344A84.813 84.813 0 0 1 58.5 24.96c.129-.25.29-.512.34-.578.082-.09 1.265-.121 5.543-.102l5.43.031.03 8.817c.02 6.945.048 8.805.15 8.805.058-.012.46-.243.874-.532.582-.406.832-.656 1.102-1.117.613-1.047 2.351-2.695 3.515-3.336A16.556 16.556 0 0 1 80 35.254c1.605-.34 2.078-.39 5.723-.52 6.652-.23 7.636-.27 7.687-.32.031-.027-.058-.289-.191-.59-.14-.289-.38-.828-.551-1.187-.633-1.367-.633-1.825.031-2.496.45-.47 1.613-.88 3.613-1.278.329-.07.743-.16.91-.218.173-.051.383-.09.473-.09.254 0 2.25-.489 2.672-.649.29-.12 1.856-.46 3.723-.82.812-.16 2.922-.578 4.668-.93 1.105-.218 2.258-.449 2.558-.508.301-.058.735-.148.954-.187.222-.05.511-.113.652-.133.14-.027.844-.168 1.558-.316a33.704 33.704 0 0 1 1.614-.313c.504-.047 4.289-.957 5.16-1.238 1.387-.45 1.797-.629 2.672-1.215.941-.64 1.203-.988 2.136-2.848 1.036-2.066 1.184-2.414 1.477-3.285.45-1.386.422-1.914-.152-2.496-.403-.398-1.266-.808-1.895-.898-.472-.059-.535-.04-.765.21-.141.15-.262.329-.262.391 0 .09-.16.528-.61 1.606-.043.11-.132.379-.203.597-.058.223-.18.532-.25.7-.129.28-.14.23-.09-.547.051-.77.18-1.418.473-2.399.051-.187.121-.507.149-.707l.05-.36-1.043-.417c-1.085-.45-2.02-.84-2.558-1.082-.184-.066-.633-.246-1.004-.387-.383-.14-.844-.32-1.035-.41a23.9 23.9 0 0 0-1.055-.437c-.672-.262-3.02-1.059-5.02-1.688a458.117 458.117 0 0 0-4.011-1.21 36.162 36.162 0 0 1-1.406-.388c-.16-.043-.555-.152-.856-.23-1.766-.488-2.226-.61-2.86-.79a26.367 26.367 0 0 0-1.054-.28c-.191-.047-.71-.168-1.152-.278-.774-.191-4.016-.937-5.774-1.34l-1.254-.289c-.222-.05-.62-.129-.902-.18-.273-.05-.844-.16-1.258-.25-.41-.077-1.293-.25-1.957-.359-.66-.117-1.453-.257-1.754-.308-2.773-.5-2.96-.528-7.93-1.078-3.062-.348-7.18-.641-8.183-.59-.16 0-1.05.039-1.965.09zM58.348 5.23c2.652.86 5.23 2.028 6.996 3.168 1.406.907 3.152 2.356 3.625 3.004l.199.27-.379-.149c-.21-.09-.652-.28-.984-.441-1.766-.82-1.957-.887-1.957-.707 0 .047.41.707.902 1.445.504.75.902 1.41.902 1.47 0 .05-.187-.032-.422-.192-.902-.618-3.02-1.508-3.14-1.328-.031.05.62.878 1.457 1.847.82.969 1.504 1.797 1.504 1.86 0 .148-.16.128-.922-.153-.785-.277-.984-.308-.984-.117 0 .129 1.695 2.414 2.367 3.203.191.219.343.43.343.48 0 .239-2.351-1.288-4.015-2.605-2.38-1.898-4.68-4.445-5.89-6.55-.997-1.72-1.337-2.645-1.337-3.665 0-.597.028-.718.25-.93.13-.136.293-.25.352-.25.058 0 .562.153 1.133.34zm31.691 3.555c.961.172 2.277.399 2.91.512.633.11 1.406.238 1.707.289.301.059.73.137.953.187.22.051.653.141.954.211.992.22 1.234.27 2.859.649 1.746.41 2.129.488 2.66.597.453.09.902.262.902.34 0 .032-.328.223-.73.43-.824.41-.996.441-4.387.57-2.308.098-3.543.07-4.668-.11-2.27-.35-3.441-.987-4.355-2.366-.32-.469-.531-.61-1.266-.797-.27-.082-.683-.192-.902-.262-.223-.07-.602-.18-.844-.25-.723-.187-.312-.297 1.145-.297 1.003 0 1.707.067 3.062.297zm12.074 13.95a.54.54 0 0 1-.25 0c-.07-.032-.02-.051.121-.051.137 0 .188.02.13.05zm-.433.117c0 .05-.117.12-.27.152-.312.078-1.535.43-1.937.558-.141.051-.594.192-1.004.31-1.035.3-3.543 1.116-4.215 1.378-1.266.48-4.238 2.055-4.656 2.477-.625.609-.817 1.265-.723 2.523.027.531.098 1.2.16 1.488.121.63.05.801-.191.489-.242-.309-.754-1.426-.903-1.977-.082-.246-.171-.578-.222-.738-.18-.567-.11-1.239.172-1.645.379-.582 1.746-1.508 3.351-2.277.762-.371 2.98-1.13 5.02-1.727.41-.12.863-.261 1.004-.3 1.445-.489 4.414-.958 4.414-.711zm-31.746.671c-.032.028-.121.04-.192.008-.082-.027-.05-.058.059-.058.113-.012.172.02.133.05zm0 0" transform="translate(0 39)"/>
  <path style="fill:#850000;fill-opacity:1;fill-rule:nonzero;stroke:none" d="M48.883 42.832v6.988h5c3.754 0 5.027-.03 5.117-.12.152-.15.184-13.856.031-13.856-.05 0-.12.078-.152.168-.04.09-1.133 1.797-2.438 3.793-2.066 3.156-2.64 3.925-2.64 3.535 0-.07-3.422-5.41-4.297-6.7a3.725 3.725 0 0 1-.309-.527c-.082-.152-.18-.27-.23-.27-.043 0-.082 3.145-.082 6.989zm0 0" transform="translate(0 39)"/>
</svg>
<span>Mongoose</span></div>
                        <div class="tool-chip"><i class="fa-solid fa-robot" style="color: silver"></i><span>Puppeteer</span></div>
                        <div class="tool-chip"><i class="fa-brands fa-npm" style="color: red"></i><span>npm</span></div>
                        <div class="tool-chip"><i class="fa-brands fa-github"></i><span>GitHub</span></div>
                        <div class="tool-chip"><i class="fa-solid fa-film"></i><span>TMDB API</span></div>
                        <div class="tool-chip"><i class="fa-solid fa-dragon"></i><span>AniList API</span></div>
                    </div>
                </div>
                
                <script>
                    const hamburger = document.getElementById('hamburger');
                    const navLinks = document.getElementById('navLinks');

                    hamburger.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navLinks.classList.toggle('active');
                        hamburger.classList.toggle('active');
                    });

                    document.addEventListener('click', (e) => {
                        if (!hamburger.contains(e.target) && !navLinks.contains(e.target) && navLinks.classList.contains('active')) {
                            navLinks.classList.remove('active');
                            hamburger.classList.remove('active');
                        }
                    });

                    const revealEls = document.querySelectorAll('.reveal');
                    const observer = new IntersectionObserver(function (entries) {
                        entries.forEach(function (entry) {
                            if (entry.isIntersecting) {
                                entry.target.classList.add('in-view');
                                observer.unobserve(entry.target); // animate once, then stop watching
                            }
                        });
                    }, { threshold: 0.15 });

                    revealEls.forEach(function (el) { observer.observe(el); });
                </script>
            </body>
        </html>`);
})

router.post("/login", async (req,res) =>{
    const {username, password} = req.body;
    try{
        const user = await User.findOne({username});
        if (user && await user.comparePassword(password)) {
            req.session.userId = user._id;
            req.session.username = user.username;
            return req.session.save((err) => {
                if (err) console.log("Session sync error: ", err);
                res.redirect("/"); 
            });
        }else {
            res.send(`<!DOCTYPE html>
                 <html>
                    <head>
                        <meta charset = "utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <link rel = "stylesheet" href= "/css/login.css">
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                        <link rel="icon" type="image/x-icon" href="/images/icon.png">
                        <title>SearchMovie</title>
                    </head>
                    <body class="errorBody">
                        <div id="message">
                            <h1>Oooopssss....</h1>
                            <img src="/images/sad-doggoo.png" alt="sad-doggooo" class="sadDoggo">
                            <p>The username or password doesn't exist. <a href='/users/login'> Please try again</a><p>
                        </div>
                    </body>
                 </html>`);
        }
    } catch(err){
        // console.error("DETAILED LOGIN ERROR:", err);
        res.status(500).send("Login Error");
    }
})

router.get("/register", (req, res) => {
    res.send(`<!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/css/login.css">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <link rel="icon" type="image/x-icon" href="/images/icon.png">
                <title>Create Account - SearchMovie</title>
            </head>
            <body class="loginBody">
                <nav class="navbar">
                    <div class="nav-left">
                        <img src="/images/icon.png" alt="Logo" class="logoImg2">
                        <a href="/" id="titleLink"><span class="nav-title">SearchMovie</span></a>
                    </div>
                    <div class="nav-right">
                        <a href="/users/login" class="nav-item"><i class="fa-solid fa-arrow-left"></i> Sign In</a>
                    </div>
                </nav>
                <div class="auth-wrapper">
                    <div id="loginContainer">
                        <div id="loginHeader">
                            <img src="/images/icon-removebg.png" alt="Logo" class="logoImg">
                            <h1>SearchMovies</h1>
                        </div>
                        <h2 style="margin-top:18px;">Create Account</h2>
                        <form action="/users/register" method="post" id="loginForm">
                            <div class="input-group">
                                <label class="input-label" for="userName">Username or Email</label>
                                <input type="text" id="userName" name="username" placeholder="Choose a username" autocomplete="username" required>
                            </div>
                            <div class="input-group">
                                <label class="input-label" for="password">Password</label>
                                <div class="pw-wrap">
                                    <input type="password" id="password" name="password" placeholder="Create a password" autocomplete="new-password" required>
                                    <button type="button" class="pw-toggle" onclick="togglePw()" tabindex="-1" aria-label="Show password">
                                        <i class="fa-solid fa-eye" id="pw-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <input type="submit" id="submitAccnt" value="Create Account">
                        </form>
                        <p style="margin-top:20px; text-align:center; color:rgba(255,255,255,0.6);">
                            Already have an account? <a href="/users/login" id="hereBtn">Sign in</a>
                        </p>
                        <script>
                            function togglePw() {
                                var pw = document.getElementById('password');
                                var eye = document.getElementById('pw-eye');
                                if (pw.type === 'password') { pw.type = 'text'; eye.className = 'fa-solid fa-eye-slash'; }
                                else { pw.type = 'password'; eye.className = 'fa-solid fa-eye'; }
                            }
                        </script>
                    </div>
                </div>
            </body>
        </html>`);
});

router.post("/register", async (req,res) =>{
    const {username, password} = req.body;
    try{
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.send("Username taken. <a href='/users/register'>Try again</a>");

        const newUser = new User({ username, password });
        await newUser.save();
        res.redirect("/users/login");
    } catch (err) {
        // console.error("DETAILED REGISTER ERROR:", err);
        res.status(500).send("Error creating account.");
    }
})

router.post("/logout", (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.log("Error destroying session: ", err);
                return res.status(500).send("Error signing out.");
            }
            res.clearCookie('connect.sid'); 
            
            res.redirect("/users/login");
        });
    } else {
        res.redirect("/users/login");
    }
});

router.post("/delete-account", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Not logged in" });
    }
    const userId = req.session.userId;
    try {
        await Promise.all([
            User.findByIdAndDelete(userId),
            Favorite.deleteMany({ user: userId }),
            Watchlist.deleteMany({ user: userId }),
            WatchProgress.deleteMany({ user: userId })
        ]);
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    } catch (err) {
        console.log("Error deleting account:", err);
        res.status(500).json({ error: "Failed to delete account" });
    }
});

router.get("/privacy", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="/css/login.css">
            <link rel="icon" type="image/x-icon" href="/images/icon.png">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
            <title>Privacy Policy - SearchMovie</title>
        </head>
        <body class="loginBody">
            <nav class="navbar">
                <div class="nav-left">
                    <img src="/images/icon.png" alt="Logo" class="logoImg2">
                    <a href="/users/login" id="titleLink">
                        <span class="nav-title">SearchMovie</span>
                    </a>
                </div>
                <button class="hamburger" id="privacyHamburger">
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                </button>
                <div class="nav-right" id="privacyNavLinks">
                    <button onclick="window.history.back()" class="nav-item" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:7px; font-size:14px; font-weight:500; color:#fff; padding:8px 16px; transition:background 0.2s, border-color 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.borderColor='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='rgba(255,255,255,0.15)'">
                        <i class="fa-solid fa-arrow-left" style="font-size:13px;"></i> Back
                    </button>
                </div>
            </nav>
            <script>
                var ph = document.getElementById('privacyHamburger');
                var pn = document.getElementById('privacyNavLinks');
                ph.addEventListener('click', function(e) {
                    e.stopPropagation();
                    pn.classList.toggle('active');
                    ph.classList.toggle('active');
                });
                document.addEventListener('click', function(e) {
                    if (!ph.contains(e.target) && !pn.contains(e.target)) {
                        pn.classList.remove('active');
                        ph.classList.remove('active');
                    }
                });
            </script>

            <div class="auth-wrapper" style="align-items:flex-start; margin-top:20px;">
                <div id="loginContainer" style="max-width:700px; width:90%; text-align:left;">
                    <h2 style="text-align:center; font-size:28px;">Privacy Policy</h2>
                    <p style="color:#aaa; text-align:center; margin-bottom:25px;">Last updated: July 14, 2026</p>

                    <h3 style="margin-top:20px;">1. Information We Collect</h3>
                    <p style="color:#ccc; line-height:1.7;">SearchMovie collects only the information necessary to provide our service:</p>
                    <ul style="color:#ccc; line-height:1.9; padding-left:20px;">
                        <li>Account credentials (username and password) for authentication</li>
                        <li>Favorites and watchlist data you choose to save</li>
                        <li>Watch progress to enable the "continue watching" feature</li>
                    </ul>

                    <h3 style="margin-top:20px;">2. How We Use Your Information</h3>
                    <p style="color:#ccc; line-height:1.7;">Your data is used solely to provide and improve the SearchMovie experience, including maintaining your favorites, watchlist, and watch progress across sessions.</p>

                    <h3 style="margin-top:20px;">3. Data Storage</h3>
                    <p style="color:#ccc; line-height:1.7;">Your data is stored securely in our database. Passwords are hashed and never stored in plain text.</p>

                    <h3 style="margin-top:20px;">4. No Media Storage</h3>
                    <p style="color:#ccc; line-height:1.7;">SearchMovie does <strong>not</strong> host, store, or distribute any movies, TV shows, anime, or other media files. We have no media content on our servers.</p>
                    <p style="color:#ccc; line-height:1.7;">All video content streamed through this site is sourced entirely from independent third-party embedding services. We act only as an index that links to these external sources — similar to how a search engine links to external websites. We are not responsible for the content, availability, or legality of any media served by those third-party providers.</p>

                    <h3 style="margin-top:20px;">5. Third-Party Services</h3>
                    <p style="color:#ccc; line-height:1.7;">SearchMovie uses the following third-party services:</p>
                    <ul style="color:#ccc; line-height:1.9; padding-left:20px;">
                        <li>TMDB (The Movie Database) — movie and TV show metadata</li>
                        <li>AniList — anime metadata</li>
                        <li>Various third-party embed providers — video playback (we do not control or store this content)</li>
                    </ul>
                    <p style="color:#ccc; line-height:1.7;">We do not sell, share, or transfer your personal data to any third parties.</p>
                    

                    <h3 style="margin-top:20px;">6. Copyright &amp; DMCA</h3>
                    <p style="color:#ccc; line-height:1.7;">SearchMovie does not host or distribute any copyrighted content. All media is streamed from independent third-party sources that are not under our control. We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA).</p>
                    <p style="color:#ccc; line-height:1.7;">If you are a copyright holder and believe that content accessible through this site infringes your rights, please contact us at <a style="text-decoration:none; color:violet;" href="mailto:wolfro979@gmail.com">wolfro979@gmail.com</a> with the following information:</p>
                    <ul style="color:#ccc; line-height:1.9; padding-left:20px;">
                        <li>Identification of the copyrighted work you claim is being infringed</li>
                        <li>The specific URL or link on our site pointing to the infringing content</li>
                        <li>Your contact information</li>
                        <li>A statement that you have a good faith belief the use is not authorised by the copyright owner</li>
                    </ul>
                    <p style="color:#ccc; line-height:1.7;">We will review valid DMCA requests and remove the relevant links promptly.</p>

                    <h3 style="margin-top:20px;">7. Open Source</h3>
                    <p style="color:#ccc; line-height:1.7;">The SearchMovie application code is open source. The open source license applies <strong>only to the source code</strong> of this application — it does not grant any rights to the movies, TV shows, anime, or other media content that may be accessible through the site. All media content remains the property of its respective copyright holders.</p>

                    <h3 style="margin-top:20px;">8. Cookies</h3>
                    <p style="color:#ccc; line-height:1.7;">We use a session cookie to keep you logged in. No tracking or advertising cookies are used.</p>

                    <h3 style="margin-top:20px;">9. Data Deletion</h3>
                    <p style="color:#ccc; line-height:1.7;">You can delete your account and all associated data at any time from the account page. Once deleted, your username, favorites, watchlist, and watch progress are permanently removed and cannot be recovered.</p>

                    <h3 style="margin-top:20px;">10. Contact</h3>
                    <p style="color:#ccc; line-height:1.7;">If you have questions about this privacy policy, contact us at <a style="text-decoration: none; color: violet;" href="mailto:wolfro979@gmail.com">wolfro979@gmail.com</a></p>

                    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:36px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.08);">
                        <span style="display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:7px 14px; font-size:13px; color:#ccc;">
                            <i class="fa-solid fa-shield-halved" style="color:#7c3aed;"></i> DMCA Compliant
                        </span>
                        <span style="display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:7px 14px; font-size:13px; color:#ccc;">
                            <i class="fa-brands fa-github" style="color:#ccc;"></i> Open Source
                        </span>
                        <span style="display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:7px 14px; font-size:13px; color:#ccc;">
                            <i class="fa-solid fa-ban" style="color:#e50914;"></i> No Ads
                        </span>
                        <span style="display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:7px 14px; font-size:13px; color:#ccc;">
                            <i class="fa-solid fa-eye-slash" style="color:#e50914;"></i> No Tracking
                        </span>
                        <span style="display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:7px 14px; font-size:13px; color:#ccc;">
                            <i class="fa-solid fa-server" style="color:#22c55e;"></i> No Media Stored
                        </span>
                        <span style="display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:7px 14px; font-size:13px; color:#ccc;">
                            <i class="fa-solid fa-lock" style="color:#22c55e;"></i> Passwords Hashed
                        </span>
                    </div>
                </div>
            </div>
        </body>
    </html>
    `);
});

module.exports = router;