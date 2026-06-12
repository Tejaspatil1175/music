const UserActivity = require("../models/UserActivity");
const Song = require("../models/Song");

const WEIGHTS = {
  complete: 3,
  play: 2,
  like: 4,
  add_to_playlist: 3,
  skip_hard: -2,  // < 10 sec
  skip_soft: -1,  // 10-30 sec
};

const buildTasteProfile = async (userId) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const activities = await UserActivity.find({
    userId,
    timestamp: { $gte: since },
  }).lean();

  const genreScore = {};
  const artistScore = {};
  const moodScore = {};
  const songSkips = {};
  const playedSongs = new Set();

  for (const act of activities) {
    const { action, genre, artist, mood, songId, skipAfterSeconds } = act;

    let weight = 0;
    if (action === "complete") weight = WEIGHTS.complete;
    else if (action === "play") weight = WEIGHTS.play;
    else if (action === "like") weight = WEIGHTS.like;
    else if (action === "add_to_playlist") weight = WEIGHTS.add_to_playlist;
    else if (action === "skip") {
      weight = skipAfterSeconds < 10 ? WEIGHTS.skip_hard : WEIGHTS.skip_soft;
      songSkips[songId] = (songSkips[songId] || 0) + 1;
    }

    if (genre) genreScore[genre] = (genreScore[genre] || 0) + weight;
    if (artist) artistScore[artist] = (artistScore[artist] || 0) + weight;
    if (mood) moodScore[mood] = (moodScore[mood] || 0) + weight;

    if (action === "play" || action === "complete") {
      playedSongs.add(songId.toString());
    }
  }

  const sort = (obj) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([key, score]) => ({ key, score }));

  const dislikedSongs = Object.entries(songSkips)
    .filter(([, count]) => count >= 2)
    .map(([id]) => id);

  return {
    topGenres: sort(genreScore).slice(0, 5),
    topArtists: sort(artistScore).slice(0, 5),
    topMoods: sort(moodScore).slice(0, 3),
    dislikedSongs,
    playedSongs: Array.from(playedSongs),
  };
};

const getForYouSongs = async (userId) => {
  const profile = await buildTasteProfile(userId);

  const activityCount = await UserActivity.countDocuments({ userId });

  // New user fallback
  if (activityCount < 5) {
    return Song.find({ isActive: true, isPublic: true })
      .sort({ plays: -1 })
      .limit(30)
      .lean();
  }

  const since14Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const recentPlayed = await UserActivity.find({
    userId,
    action: { $in: ["play", "complete"] },
    timestamp: { $gte: since14Days },
  })
    .distinct("songId")
    .lean();

  const excludeIds = [
    ...recentPlayed.map((id) => id.toString()),
    ...profile.dislikedSongs,
  ];

  const top3Genres = profile.topGenres.slice(0, 3).map((g) => g.key);
  const top3Artists = profile.topArtists.slice(0, 3).map((a) => a.key);
  const top2Moods = profile.topMoods.slice(0, 2).map((m) => m.key);

  const candidates = await Song.find({
    isActive: true,
    isPublic: true,
    _id: { $nin: excludeIds },
    $or: [
      { genre: { $in: top3Genres } },
      { artist: { $in: top3Artists } },
      { mood: { $in: top2Moods } },
    ],
  })
    .limit(150)
    .lean();

  const genreScoreMap = new Map(profile.topGenres.map((g) => [g.key, g.score]));
  const artistScoreMap = new Map(profile.topArtists.map((a) => [a.key, a.score]));
  const moodScoreMap = new Map(profile.topMoods.map((m) => [m.key, m.score]));

  const scoredSongs = candidates.map((song) => {
    const genreMatchScore = genreScoreMap.get(song.genre) || 0;
    const artistMatchScore = artistScoreMap.get(song.artist) || 0;
    const moodMatchScore = moodScoreMap.get(song.mood) || 0;
    const matchScore = genreMatchScore + artistMatchScore + moodMatchScore;

    const ageInDays = (Date.now() - new Date(song.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const recency = 1 / (1 + ageInDays);

    const score = matchScore * (song.plays + 1) * recency;
    return { ...song, recommendationScore: score };
  });

  scoredSongs.sort((a, b) => b.recommendationScore - a.recommendationScore);

  return scoredSongs.slice(0, 30);
};

module.exports = { buildTasteProfile, getForYouSongs };
