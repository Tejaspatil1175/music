const Song = require("../models/Song");
const UserActivity = require("../models/UserActivity");
const { getForYouSongs, buildTasteProfile } = require("../utils/recommendEngine");

// GET /foryou
const getForYou = async (req, res) => {
  try {
    const songs = await getForYouSongs(req.user.id);
    return res.status(200).json({
      success: true,
      message: "For You recommendations fetched successfully",
      data: songs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /trending
const getTrending = async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const results = await UserActivity.aggregate([
      { $match: { action: "play", timestamp: { $gte: since } } },
      { $group: { _id: "$songId", count: { $sum: 1 } } },
      { $match: { count: { $gte: 10 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const songIds = results.map((r) => r._id);
    let trendingSongs = [];

    if (songIds.length > 0) {
      trendingSongs = await Song.find({ _id: { $in: songIds }, isActive: true, isPublic: true });
    }

    // Fallback if not enough trending songs from activities in the last 7 days
    if (trendingSongs.length < 20) {
      const remainingCount = 20 - trendingSongs.length;
      const fallbackSongs = await Song.find({
        _id: { $nin: songIds },
        isActive: true,
        isPublic: true,
      })
        .sort({ plays: -1 })
        .limit(remainingCount);

      trendingSongs = [...trendingSongs, ...fallbackSongs];
    }

    // Sort final result by plays descending
    trendingSongs.sort((a, b) => b.plays - a.plays);

    return res.status(200).json({
      success: true,
      message: "Trending songs fetched successfully",
      data: trendingSongs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /new
const getNew = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let newSongs = await Song.find({
      isActive: true,
      isPublic: true,
      createdAt: { $gte: since },
    })
      .sort({ plays: -1 })
      .limit(20);

    // Fallback if no songs uploaded in the last 30 days
    if (newSongs.length === 0) {
      newSongs = await Song.find({ isActive: true, isPublic: true })
        .sort({ createdAt: -1 })
        .limit(20);
    }

    return res.status(200).json({
      success: true,
      message: "New releases fetched successfully",
      data: newSongs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /similar/:id
const getSimilar = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: "Song not found", data: null });
    }

    const filter = {
      _id: { $ne: song._id },
      isActive: true,
      isPublic: true,
    };

    const matchConditions = [];
    if (song.genre) matchConditions.push({ genre: song.genre });
    if (song.mood) matchConditions.push({ mood: song.mood });
    if (song.language) matchConditions.push({ language: song.language });
    if (song.bpm) matchConditions.push({ bpm: { $gte: song.bpm - 20, $lte: song.bpm + 20 } });

    if (matchConditions.length > 0) {
      filter.$or = matchConditions;
    }

    const candidates = await Song.find(filter).lean();

    // Score in memory: match at least 2 of the 4 factors
    const scoredCandidates = candidates
      .map((c) => {
        let matches = 0;
        if (song.genre && c.genre === song.genre) matches++;
        if (song.mood && c.mood === song.mood) matches++;
        if (song.language && c.language === song.language) matches++;
        if (song.bpm && c.bpm >= song.bpm - 20 && c.bpm <= song.bpm + 20) matches++;
        return { ...c, matchCount: matches };
      })
      .filter((c) => c.matchCount >= 2);

    // Sort by plays descending, return top 10
    scoredCandidates.sort((a, b) => b.plays - a.plays);
    const similarSongs = scoredCandidates.slice(0, 10);

    return res.status(200).json({
      success: true,
      message: "Similar songs fetched successfully",
      data: similarSongs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /mixes
const getMixes = async (req, res) => {
  try {
    const profile = await buildTasteProfile(req.user.id);
    const mixes = [];

    // 1. "Your Top Genre Mix"
    const topGenre = profile.topGenres[0]?.key;
    let genreSongs = [];
    if (topGenre) {
      genreSongs = await Song.find({ genre: topGenre, isActive: true, isPublic: true })
        .sort({ plays: -1 })
        .limit(20);
    }
    // Fallback if not enough songs
    if (genreSongs.length < 10) {
      const extra = await Song.find({ isActive: true, isPublic: true })
        .sort({ plays: -1 })
        .limit(20 - genreSongs.length);
      genreSongs = [...genreSongs, ...extra];
    }
    mixes.push({
      name: "Your Top Genre Mix",
      description: topGenre ? `Featuring tracks from your favorite genre: ${topGenre}` : "Personalized mix of top tracks",
      songs: genreSongs,
    });

    // 2. "Chill Mix" (mood: calm + user's top artists)
    const topArtists = profile.topArtists.slice(0, 3).map((a) => a.key);
    let chillSongs = [];
    if (topArtists.length > 0) {
      chillSongs = await Song.find({ mood: "calm", artist: { $in: topArtists }, isActive: true, isPublic: true })
        .sort({ plays: -1 })
        .limit(20);
    }
    if (chillSongs.length < 10) {
      const extra = await Song.find({ mood: "calm", isActive: true, isPublic: true })
        .sort({ plays: -1 })
        .limit(20 - chillSongs.length);
      chillSongs = [...chillSongs, ...extra];
    }
    mixes.push({
      name: "Chill Mix",
      description: "Relaxing vibes featuring artists you listen to",
      songs: chillSongs,
    });

    // 3. "Energy Mix" (mood: energetic + high bpm)
    let energySongs = await Song.find({
      mood: "energetic",
      bpm: { $gte: 110 },
      isActive: true,
      isPublic: true,
    })
      .sort({ plays: -1 })
      .limit(20);

    if (energySongs.length < 10) {
      energySongs = await Song.find({ mood: "energetic", isActive: true, isPublic: true })
        .sort({ plays: -1 })
        .limit(20);
    }
    mixes.push({
      name: "Energy Mix",
      description: "Upbeat high-tempo songs to fuel your activities",
      songs: energySongs,
    });

    // 4. "Discover Mix" (genres user hasn't explored, trending)
    const exploredGenres = profile.topGenres.map((g) => g.key);
    let discoverSongs = await Song.find({
      genre: { $nin: exploredGenres },
      isActive: true,
      isPublic: true,
    })
      .sort({ plays: -1 })
      .limit(20);

    if (discoverSongs.length < 10) {
      discoverSongs = await Song.find({ isActive: true, isPublic: true })
        .sort({ createdAt: -1 })
        .limit(20);
    }
    mixes.push({
      name: "Discover Mix",
      description: "Expand your taste with fresh tracks outside your usual genres",
      songs: discoverSongs,
    });

    return res.status(200).json({
      success: true,
      message: "Personalized mixes generated successfully",
      data: mixes,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = {
  getForYou,
  getTrending,
  getNew,
  getSimilar,
  getMixes,
};
