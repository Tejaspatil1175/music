const path = require("path");
const fs = require("fs");
const Song = require("../models/Song");
const UserActivity = require("../models/UserActivity");
const ListeningSession = require("../models/ListeningSession");
const { uploadToGCS, deleteFromGCS } = require("../config/storage");
const { generateFileName } = require("../utils/fileNamer");
const { extractMetadata } = require("../utils/metadataExtractor");

const uploadSong = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "MP3 file required", data: null });

    const { title, artist, album, genre, mood, language, lyrics, tags, bpm, isPublic } = req.body;

    if (!title || !artist)
      return res.status(400).json({ success: false, message: "Title and artist are required", data: null });

    const autoMeta = await extractMetadata(req.file.path);
    const fileName = generateFileName(title, artist);
    const gcsPath = `songs/${fileName}`;

    const fileUrl = await uploadToGCS(req.file.path, gcsPath, "audio/mpeg");
    fs.unlinkSync(req.file.path);

    let coverUrl = "";
    if (req.body.coverImageUrl) coverUrl = req.body.coverImageUrl;

    const song = await Song.create({
      title: title || autoMeta.title,
      artist: artist || autoMeta.artist,
      album: album || autoMeta.album || "",
      genre: genre || autoMeta.genre || "",
      mood: mood || "",
      language: language || "",
      lyrics: lyrics || "",
      duration: autoMeta.duration || 0,
      filePath: fileUrl,
      coverImage: coverUrl,
      fileFormat: autoMeta.fileFormat || "mp3",
      fileSize: req.file.size,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      bpm: bpm || autoMeta.bpm || 0,
      uploadedBy: { userId: req.user.id, role: req.user.role },
      source: req.user.role === "admin" ? "admin" : "user",
      isPublic: isPublic !== undefined ? isPublic === "true" : true,
    });

    // Notify all via socket if admin upload
    if (req.user.role === "admin" && req.app.get("io")) {
      req.app.get("io").emit("song:uploaded", { song });
    }

    return res.status(201).json({ success: true, message: "Song uploaded", data: song });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const getAllSongs = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "createdAt", genre, mood, language, artist } = req.query;
    const filter = { isActive: true, isPublic: true };

    if (genre) filter.genre = new RegExp(genre, "i");
    if (mood) filter.mood = mood;
    if (language) filter.language = new RegExp(language, "i");
    if (artist) filter.artist = new RegExp(artist, "i");

    const sortMap = { plays: { plays: -1 }, likes: { likes: -1 }, createdAt: { createdAt: -1 } };
    const sortOpt = sortMap[sort] || { createdAt: -1 };

    const total = await Song.countDocuments(filter);
    const songs = await Song.find(filter)
      .sort(sortOpt)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      message: "Songs fetched",
      data: songs,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const getSongById = async (req, res) => {
  try {
    const song = await Song.findOne({ _id: req.params.id, isActive: true });
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });
    return res.status(200).json({ success: true, message: "Song fetched", data: song });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const updateSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });

    const isOwner = song.uploadedBy.userId.toString() === req.user.id;
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized", data: null });

    const fields = ["title", "artist", "album", "genre", "mood", "language", "lyrics", "tags", "bpm", "isPublic", "coverImage"];
    fields.forEach((f) => { if (req.body[f] !== undefined) song[f] = req.body[f]; });

    await song.save();
    return res.status(200).json({ success: true, message: "Song updated", data: song });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });

    const isOwner = song.uploadedBy.userId.toString() === req.user.id;
    if (!isOwner && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Not authorized", data: null });

    song.isActive = false;
    await song.save();

    return res.status(200).json({ success: true, message: "Song deleted", data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const playSong = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const song = await Song.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }, { new: true });
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });

    await UserActivity.create({
      userId: req.user.id,
      songId: song._id,
      action: "play",
      genre: song.genre,
      artist: song.artist,
      mood: song.mood,
      sessionId: sessionId || "",
    });

    if (sessionId) {
      await ListeningSession.findOneAndUpdate(
        { userId: req.user.id, sessionId },
        {
          $push: { songs: { songId: song._id, playedAt: new Date() } },
          $setOnInsert: { startedAt: new Date() },
        },
        { upsert: true }
      );
    }

    return res.status(200).json({ success: true, message: "Play logged", data: { plays: song.plays } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const completeSong = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });

    await UserActivity.create({
      userId: req.user.id,
      songId: song._id,
      action: "complete",
      genre: song.genre,
      artist: song.artist,
      mood: song.mood,
      sessionId: sessionId || "",
    });

    if (sessionId) {
      await ListeningSession.findOneAndUpdate(
        { userId: req.user.id, sessionId, "songs.songId": song._id },
        { $set: { "songs.$.completed": true } }
      );
    }

    return res.status(200).json({ success: true, message: "Complete logged", data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const likeSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });

    const userId = req.user.id;
    const alreadyLiked = song.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      song.likes = song.likes.filter((id) => id.toString() !== userId);
    } else {
      song.likes.push(userId);
      await UserActivity.create({
        userId,
        songId: song._id,
        action: "like",
        genre: song.genre,
        artist: song.artist,
        mood: song.mood,
      });
    }

    await song.save();
    return res.status(200).json({
      success: true,
      message: alreadyLiked ? "Unliked" : "Liked",
      data: { likes: song.likes.length, liked: !alreadyLiked },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const skipSong = async (req, res) => {
  try {
    const { sessionId, skipAfterSeconds = 0 } = req.body;
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: "Song not found", data: null });

    await UserActivity.create({
      userId: req.user.id,
      songId: song._id,
      action: "skip",
      genre: song.genre,
      artist: song.artist,
      mood: song.mood,
      skipAfterSeconds,
      sessionId: sessionId || "",
    });

    return res.status(200).json({ success: true, message: "Skip logged", data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const searchSongs = async (req, res) => {
  try {
    const { q, genre, mood, language, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true, isPublic: true };

    if (q) {
      filter.$or = [
        { title: new RegExp(q, "i") },
        { artist: new RegExp(q, "i") },
        { album: new RegExp(q, "i") },
        { genre: new RegExp(q, "i") },
        { tags: new RegExp(q, "i") },
        { mood: new RegExp(q, "i") },
      ];
    }

    if (genre) filter.genre = new RegExp(genre, "i");
    if (mood) filter.mood = mood;
    if (language) filter.language = new RegExp(language, "i");

    const total = await Song.countDocuments(filter);
    const songs = await Song.find(filter)
      .sort({ plays: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      message: "Search results",
      data: songs,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = { uploadSong, getAllSongs, getSongById, updateSong, deleteSong, playSong, completeSong, likeSong, skipSong, searchSongs };
