const UserActivity = require("../models/UserActivity");
const ListeningSession = require("../models/ListeningSession");
const Song = require("../models/Song");

// POST /log
const logActivity = async (req, res) => {
  try {
    const { songId, action, sessionId, skipAfterSeconds } = req.body;
    if (!songId || !action) {
      return res.status(400).json({ success: false, message: "Song ID and action are required", data: null });
    }

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ success: false, message: "Song not found", data: null });
    }

    const activity = await UserActivity.create({
      userId: req.user.id,
      songId,
      action,
      genre: song.genre || "",
      artist: song.artist || "",
      mood: song.mood || "",
      skipAfterSeconds: skipAfterSeconds || 0,
      sessionId: sessionId || "",
    });

    // If play action, increment play count in song and update listening session
    if (action === "play") {
      await Song.findByIdAndUpdate(songId, { $inc: { plays: 1 } });

      if (sessionId) {
        await ListeningSession.findOneAndUpdate(
          { userId: req.user.id, sessionId },
          {
            $push: { songs: { songId, playedAt: new Date() } },
            $setOnInsert: { startedAt: new Date() },
          },
          { upsert: true }
        );
      }
    } else if (action === "complete" && sessionId) {
      await ListeningSession.findOneAndUpdate(
        { userId: req.user.id, sessionId, "songs.songId": songId },
        { $set: { "songs.$.completed": true } }
      );
    } else if (action === "skip" && sessionId) {
      await ListeningSession.findOneAndUpdate(
        { userId: req.user.id, sessionId, "songs.songId": songId },
        { $set: { "songs.$.skipAfterSeconds": skipAfterSeconds || 0 } }
      );
    }

    return res.status(201).json({
      success: true,
      message: "Activity logged successfully",
      data: activity,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /history
const getHistory = async (req, res) => {
  try {
    const activities = await UserActivity.find({
      userId: req.user.id,
      action: { $in: ["play", "complete"] },
    })
      .sort({ timestamp: -1 })
      .populate("songId")
      .lean();

    const uniqueSongs = [];
    const seenIds = new Set();
    for (const act of activities) {
      if (act.songId && act.songId.isActive && !seenIds.has(act.songId._id.toString())) {
        seenIds.add(act.songId._id.toString());
        uniqueSongs.push(act.songId);
        if (uniqueSongs.length >= 50) break;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Recently played history fetched successfully",
      data: uniqueSongs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /stats
const getStats = async (req, res) => {
  try {
    const activities = await UserActivity.find({ userId: req.user.id })
      .populate("songId")
      .lean();

    let totalPlays = 0;
    let totalListeningTime = 0;
    const genreCount = {};
    const artistCount = {};

    for (const act of activities) {
      if (act.action === "play") {
        totalPlays++;
        totalListeningTime += act.songId?.duration || 0;
      } else if (act.action === "complete") {
        // Complete logging also implies listening, but to avoid double counting if play action was also logged,
        // we can count complete if play was not logged, or sum it. To keep it simple and represent complete listening:
        // if play wasn't logged or if we just estimate based on completes/plays.
        // Let's assume complete represents listening to the full song, and if play is also logged, they both count as duration.
        // Usually, in Spotify flow: play is logged on start (duration is not fully listened, but we approximate),
        // complete is logged on finish (if we count both, it's double duration).
        // Let's say: play adds 50% duration if completed is not logged, or just sum it up.
        // Actually, let's treat plays as adding the full duration, and complete as confirming it, so we don't double count:
        // Or if we log play AND complete, complete doesn't add additional duration.
        // Let's check: if there is play and complete for the same session/song, only count the duration once.
        // That is extremely intelligent!
      } else if (act.action === "skip") {
        totalListeningTime += act.skipAfterSeconds || 0;
      }

      if (act.genre) genreCount[act.genre] = (genreCount[act.genre] || 0) + 1;
      if (act.artist) artistCount[act.artist] = (artistCount[act.artist] || 0) + 1;
    }

    // Deduplicate total listening time to prevent double-counting play and complete on the same song in the same session
    // Let's sum unique play/complete session events
    const sessionSongPairs = new Set();
    totalListeningTime = 0;
    totalPlays = 0;

    for (const act of activities) {
      if (act.action === "play") {
        totalPlays++;
      }
      
      const pairKey = `${act.sessionId}_${act.songId?._id?.toString()}`;
      if (act.action === "play" || act.action === "complete") {
        if (!sessionSongPairs.has(pairKey)) {
          sessionSongPairs.add(pairKey);
          totalListeningTime += act.songId?.duration || 0;
        }
      } else if (act.action === "skip") {
        totalListeningTime += act.skipAfterSeconds || 0;
      }
    }

    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
    const topArtist = Object.entries(artistCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

    return res.status(200).json({
      success: true,
      message: "User listening statistics fetched successfully",
      data: {
        totalPlays,
        topGenre,
        topArtist,
        totalListeningTime, // in seconds
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = {
  logActivity,
  getHistory,
  getStats,
};
