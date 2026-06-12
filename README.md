# Spotify-Like Music Streaming Platform Backend

A production-ready, feature-rich backend API for a Spotify-like music streaming application.

<div align="center">

  [![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
  [![Google Cloud Storage](https://img.shields.io/badge/GCS-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/storage)
  [![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)](https://jwt.io/)
  [![FFmpeg](https://img.shields.io/badge/FFmpeg-007800?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)

</div>

---

## 🚀 Key Features
- **User Authentication**: Secure JWT-based registration, login, and refresh tokens using HTTP-Only cookies and bcryptjs hashing.
- **Audio Uploads**: MP3 files up to 20MB (users) / 50MB (admins) uploaded directly to GCS via Multer.
- **Automatic Metadata Extraction**: Automatically parses MP3 tags (title, artist, album, genre, duration, bpm, file format, size) upon upload using the `music-metadata` library.
- **YouTube Downloader**: Protected endpoint to download audio from YouTube URLs using `yt-dlp` + `ffmpeg`, convert to MP3, download thumbnails, upload to GCS, and emit progress percent via WebSockets.
- **Playlist Management**: CRUD operations, private/public modes, reordering playlist songs (preserving added timestamps), and dynamic duration accumulation.
- **Personalized Recommendations**: 
  - Generates custom user taste profiles using logarithmic time decay: `match score × (plays + 1) × recency`.
  - Serves trending tracks, new releases, similar song recommendations, and 4 auto-mixes (*Your Top Genre Mix*, *Chill Mix*, *Energy Mix*, and *Discover Mix*).
- **Admin Dashboard**: Comprehensive platform metrics (totals, storage utilization, top charts), user bans/role upgrades, and day-by-day graphs for signups and plays.
- **Real-Time Sockets**: Live updates for YouTube download progress (`download:progress`), new song uploads, and trending lists broadcast every 10 minutes.

---

## 🛠️ Technology Stack
- **Runtime**: Node.js `![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)`
- **Framework**: Express.js `![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)`
- **Database**: MongoDB (Mongoose ODM) `![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)`
- **Authentication**: JWT `![JWT](https://img.shields.io/badge/JWT-black?style=flat&logo=JSON%20web%20tokens)`
- **Storage**: Google Cloud Storage `![GCS](https://img.shields.io/badge/GCS-4285F4?style=flat&logo=googlecloud&logoColor=white)`
- **Audio Processing**: `yt-dlp` & FFmpeg `![FFmpeg](https://img.shields.io/badge/FFmpeg-007800?style=flat&logo=ffmpeg&logoColor=white)`
- **Real-time**: Socket.io `![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socketdotio&logoColor=white)`
- **Security**: Helmet, CORS, and Express rate-limiters `![Security](https://img.shields.io/badge/Security-Shield-success)`

---

## 📁 Project Structure
```text
/backend
  /config
    db.js                → MongoDB database connector
    storage.js           → Google Cloud Storage wrapper
    socket.js            → Socket.io setup & broadcast loop
  /models
    User.js              → User schema (profiles, roles, following)
    Song.js              → Tracks schema (GCS urls, plays, metadata)
    Playlist.js          → Playlists schema (songs list, total duration)
    RefreshToken.js      → Access tokens expiration handler
    UserActivity.js      → User action logs (play, skip, like, search)
    ListeningSession.js  → Chronological listening tracking sessions
  /routes
    auth.js              → Profile / signup / login / password routes
    music.js             → Upload, playback tracking, search endpoints
    playlist.js          → Custom user / public playlist routes
    youtube.js           → Info fetching and background downloader
    recommend.js         → Recommendation feeds and auto-mixes
    activity.js          → Personal logs and stats
    admin.js             → User banning and database analytics
  /controllers
    (corresponds to routes)
  /middleware
    verifyToken.js       → Decodes Bearer token to request
    isAdmin.js           → Role checker (admin override checks)
    uploadMiddleware.js  → Multer config for MP3s & cover images
    rateLimiter.js       → Login limits & YouTube downloads quota
  /utils
    fileNamer.js         → Clean safe file namer (lowercase + underscores)
    metadataExtractor.js → Music-metadata extraction runner
    ytdlpHelper.js       → Child-process yt-dlp & ffmpeg engine
    recommendEngine.js   → Recommendation score builder
  server.js              → Express app bootstrap entrypoint
```

---

## ⚙️ Requirements & Installation

### Prerequites
1. **Node.js**: v16+
2. **MongoDB**: Local or Atlas URI
3. **Google Cloud Storage / Firebase Bucket**: A GCP Service Account Key file (`.json`) and bucket permissions.
4. **System Binaries** (for YouTube conversions):
   - **yt-dlp**: Must be installed and added to the system PATH.
   - **ffmpeg**: Must be installed and added to the system PATH.

### Installation Steps

1. Clone the repository and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` configuration file from the template:
   ```bash
   cp .env.example .env
   ```

4. Configure the environment variables inside `.env`:
   ```ini
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/musicstream
   JWT_SECRET=your_jwt_secret_here
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
   ACCESS_TOKEN_EXPIRY=15m
   REFRESH_TOKEN_EXPIRY=7d
   GCS_PROJECT_ID=your_gcp_project_id
   GCS_BUCKET_NAME=your_gcs_bucket_name
   GCS_KEY_FILE=./gcs-service-account.json
   CLIENT_URL=http://localhost:3000
   NODE_ENV=development
   ```

5. Place your Google Service Account key file at the path set in `GCS_KEY_FILE`.

---

## 🏃 Running the Application

### Development Mode (Nodemon reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## 📡 API Endpoints Summary

### Auth Module (`/api/auth`)
* `POST /register` - Register a new account.
* `POST /login` - Login to account (returns token and sets Refresh Token cookie).
* `POST /logout` - Clear cookie and delete session.
* `POST /refresh` - Read refresh token cookie and issues new access token.
* `GET /me` - Get profile (Protected).
* `PUT /me` - Update profile data (Protected).
* `PUT /me/password` - Change account password (Protected).

### Music Module (`/api/music`)
* `POST /upload` - Upload an MP3 + form-data metadata (Protected, Admin & User).
* `GET /` - Public songs list with pagination and genre/mood filters.
* `GET /search?q=` - Full-text search across titles, artists, genre, and tags.
* `GET /:id` - Get details and lyrics.
* `PUT /:id` - Edit song details (Protected, Owner/Admin).
* `DELETE /:id` - Soft deletes song (Protected, Owner/Admin).
* `POST /:id/play` - Log start playback & increment plays count.
* `POST /:id/complete` - Log completed play (higher weight in score).
* `POST /:id/like` - Toggle like flag.
* `POST /:id/skip` - Log skips with offset details.

### YouTube Module (`/api/youtube`)
* `GET /info?url=` - Preview video title, artist, thumbnail, and duration (Protected).
* `POST /download` - Background downloads audio, uploads to GCS, and maps to Song schema (Protected, Quota rate-limited).

### Playlist Module (`/api/playlist`)
* `POST /` - Create a playlist (Protected).
* `GET /my` - Fetch user's playlists (Protected).
* `GET /public` - Fetch public playlists sorted by size.
* `GET /:id` - Get playlist track list.
* `POST /:id/add` - Add track (Protected, Owner).
* `DELETE /:id/remove/:songId` - Remove track (Protected, Owner).
* `PUT /:id/reorder` - Reorders tracks preserving original added dates (Protected, Owner).

### Recommendations Module (`/api/recommend`)
* `GET /foryou` - Fetch top 30 personalized tracks (Protected).
* `GET /trending` - Hot tracks from active play statistics.
* `GET /new` - Newly uploaded releases.
* `GET /similar/:id` - Top 10 tracks matching genre, mood, bpm, or language.
* `GET /mixes` - Returns 4 custom generated playlists (Protected).

### Activity Module (`/api/activity`)
* `POST /log` - Generic endpoint for streaming activity tracker (Protected).
* `GET /history` - Unique recently played history list (Protected).
* `GET /stats` - Accumulate totals and top genres/artists (Protected).

### Admin Module (`/api/admin`)
* `GET /stats` - Storage usage, user totals, and top genre tables (Protected, Admin).
* `GET /songs` - Full system tracks manager (Protected, Admin).
* `DELETE /songs/:id` - Permanent database + GCS removal (Protected, Admin).
* `GET /users` - Paginated user account viewer (Protected, Admin).
* `PUT /users/:id/ban` - Bans user account (Protected, Admin).
* `PUT /users/:id/role` - Toggle role admin/user (Protected, Admin).
* `GET /analytics/plays` - Daily play data aggregates (Protected, Admin).
* `GET /analytics/signups` - Daily signups data aggregates (Protected, Admin).

---

## 🔌 Socket.io Events

The WebSocket server broadcasts/emits the following events:
1. **`download:progress`** (sent to download owner):
   - Updates download percents and states.
   - Format: `{ songId: string, percent: number, status: 'downloading' | 'completed' | 'failed' }`
2. **`song:uploaded`** (broadcast to all):
   - Notifies online users when a new song is uploaded.
   - Format: `{ song: SongDocument }`
3. **`now:trending`** (broadcast to all every 10 minutes):
   - Broadcasts the updated top 20 trending songs based on play frequencies.
   - Format: `{ songs: SongDocument[] }`
