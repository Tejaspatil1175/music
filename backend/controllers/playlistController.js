const Playlist = require("../models/Playlist");
const Song = require("../models/Song");

// Create playlist
const createPlaylist = async (req, res) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Playlist name is required", data: null });
    }

    const playlist = await Playlist.create({
      name,
      description: description || "",
      isPublic: isPublic !== undefined ? isPublic : true,
      coverImage: coverImage || "",
      userId: req.user.id,
      songs: [],
      totalDuration: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Playlist created successfully",
      data: playlist,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Get my playlists
const getMyPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.user.id });
    return res.status(200).json({
      success: true,
      message: "Playlists fetched successfully",
      data: playlists,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Get public playlists
const getPublicPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.aggregate([
      { $match: { isPublic: true } },
      { $addFields: { songCount: { $size: "$songs" } } },
      { $sort: { songCount: -1 } },
    ]);

    // Populate userId (username, avatar) for public playlists
    const populatedPlaylists = await Playlist.populate(playlists, {
      path: "userId",
      select: "username avatar",
    });

    return res.status(200).json({
      success: true,
      message: "Public playlists fetched successfully",
      data: populatedPlaylists,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Get playlist by ID
const getPlaylistById = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate("userId", "username avatar")
      .populate({
        path: "songs.songId",
        match: { isActive: true },
      });

    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found", data: null });
    }

    // Filter out deleted/inactive songs that failed to populate
    playlist.songs = playlist.songs.filter((s) => s.songId != null);

    return res.status(200).json({
      success: true,
      message: "Playlist fetched successfully",
      data: playlist,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Update playlist
const updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found", data: null });
    }

    if (playlist.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized", data: null });
    }

    const { name, description, coverImage, isPublic } = req.body;
    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (coverImage !== undefined) playlist.coverImage = coverImage;
    if (isPublic !== undefined) playlist.isPublic = isPublic;

    await playlist.save();

    return res.status(200).json({
      success: true,
      message: "Playlist updated successfully",
      data: playlist,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Delete playlist
const deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found", data: null });
    }

    if (playlist.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized", data: null });
    }

    await Playlist.deleteOne({ _id: req.params.id });

    return res.status(200).json({
      success: true,
      message: "Playlist deleted successfully",
      data: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Add song to playlist
const addSongToPlaylist = async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) {
      return res.status(400).json({ success: false, message: "Song ID is required", data: null });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found", data: null });
    }

    if (playlist.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized", data: null });
    }

    if (playlist.songs.length >= 500) {
      return res.status(400).json({ success: false, message: "Playlist limits reached (max 500 songs)", data: null });
    }

    const songExists = playlist.songs.some((s) => s.songId.toString() === songId);
    if (songExists) {
      return res.status(400).json({ success: false, message: "Song already in playlist", data: null });
    }

    const song = await Song.findOne({ _id: songId, isActive: true });
    if (!song) {
      return res.status(404).json({ success: false, message: "Song not found or inactive", data: null });
    }

    playlist.songs.push({ songId, addedAt: new Date() });
    playlist.totalDuration += song.duration || 0;

    await playlist.save();

    return res.status(200).json({
      success: true,
      message: "Song added to playlist",
      data: playlist,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Remove song from playlist
const removeSongFromPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found", data: null });
    }

    if (playlist.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized", data: null });
    }

    const songId = req.params.songId;
    const songIndex = playlist.songs.findIndex((s) => s.songId.toString() === songId);
    if (songIndex === -1) {
      return res.status(404).json({ success: false, message: "Song not found in playlist", data: null });
    }

    const song = await Song.findById(songId);
    playlist.songs.splice(songIndex, 1);
    playlist.totalDuration = Math.max(0, playlist.totalDuration - (song?.duration || 0));

    await playlist.save();

    return res.status(200).json({
      success: true,
      message: "Song removed from playlist",
      data: playlist,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Reorder playlist songs
const reorderPlaylist = async (req, res) => {
  try {
    const { songs } = req.body; // ordered array of songIds
    if (!Array.isArray(songs)) {
      return res.status(400).json({ success: false, message: "Ordered list of songIds is required", data: null });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found", data: null });
    }

    if (playlist.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized", data: null });
    }

    // Preserve addedAt for original songs while mapping to the new order
    const originalSongsMap = new Map(playlist.songs.map((s) => [s.songId.toString(), s.addedAt]));

    playlist.songs = songs.map((id) => ({
      songId: id,
      addedAt: originalSongsMap.get(id.toString()) || new Date(),
    }));

    // Recalculate duration just in case
    const dbSongs = await Song.find({ _id: { $in: songs }, isActive: true });
    const durationMap = new Map(dbSongs.map((s) => [s._id.toString(), s.duration]));
    playlist.totalDuration = songs.reduce((total, id) => total + (durationMap.get(id.toString()) || 0), 0);

    await playlist.save();

    return res.status(200).json({
      success: true,
      message: "Playlist reordered successfully",
      data: playlist,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = {
  createPlaylist,
  getMyPlaylists,
  getPublicPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylist,
};
