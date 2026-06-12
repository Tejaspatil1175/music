const User = require("../models/User");
const Song = require("../models/Song");
const UserActivity = require("../models/UserActivity");
const { deleteFromGCS } = require("../config/storage");

// GET /stats
const getStats = async (req, res) => {
  try {
    const totalSongs = await Song.countDocuments();
    const totalUsers = await User.countDocuments();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const playsToday = await UserActivity.countDocuments({
      action: "play",
      timestamp: { $gte: todayStart },
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: weekAgo },
    });

    // Sum of fileSize in MB
    const storageAgg = await Song.aggregate([
      { $group: { _id: null, total: { $sum: "$fileSize" } } },
    ]);
    const storageBytes = storageAgg[0]?.total || 0;
    const storageMB = parseFloat((storageBytes / (1024 * 1024)).toFixed(2));

    const topSongs = await Song.find({ isActive: true })
      .sort({ plays: -1 })
      .limit(10)
      .select("title artist plays coverImage");

    const topGenres = await Song.aggregate([
      { $match: { isActive: true, genre: { $ne: "" } } },
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return res.status(200).json({
      success: true,
      message: "Admin statistics fetched",
      data: {
        totalSongs,
        totalUsers,
        playsToday,
        newUsersThisWeek,
        storageUsedMB: storageMB,
        topSongs,
        topGenres: topGenres.map((g) => ({ genre: g._id, count: g.count })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /songs (paginated list of all songs including inactive)
const getAllSongs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const total = await Song.countDocuments();
    const songs = await Song.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "All songs fetched",
      data: songs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// PUT /songs/:id
const updateSong = async (req, res) => {
  try {
    const song = await Song.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!song) {
      return res.status(404).json({ success: false, message: "Song not found", data: null });
    }
    return res.status(200).json({ success: true, message: "Song updated successfully", data: song });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// DELETE /songs/:id (hard delete and remove from Firebase/GCS storage)
const deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: "Song not found", data: null });
    }

    // Attempt GCS deletion of audio file
    if (song.filePath) {
      await deleteFromGCS(song.filePath);
    }
    // Attempt GCS deletion of cover image if it was uploaded
    if (song.coverImage && song.coverImage.includes(process.env.GCS_BUCKET_NAME || "")) {
      await deleteFromGCS(song.coverImage);
    }

    await Song.deleteOne({ _id: req.params.id });

    return res.status(200).json({
      success: true,
      message: "Song deleted permanently from database and GCS storage",
      data: null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /users (paginated users list)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const total = await User.countDocuments();
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Users list fetched",
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// PUT /users/:id/ban
const banUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", data: null });
    }
    return res.status(200).json({ success: true, message: "User banned successfully", data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// PUT /users/:id/unban
const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", data: null });
    }
    return res.status(200).json({ success: true, message: "User unbanned successfully", data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// PUT /users/:id/role
const changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role. Must be 'user' or 'admin'", data: null });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found", data: null });
    }
    return res.status(200).json({ success: true, message: "User role updated successfully", data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /activity (all logs with filters)
const getAllActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { userId, action, songId } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (songId) filter.songId = songId;

    const total = await UserActivity.countDocuments(filter);
    const logs = await UserActivity.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "username email")
      .populate("songId", "title artist");

    return res.status(200).json({
      success: true,
      message: "Platform activity logs fetched",
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /analytics/plays
const getPlaysAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const playsData = await UserActivity.aggregate([
      { $match: { action: "play", timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      message: "Plays analytics (last 30 days) fetched",
      data: playsData.map((d) => ({ date: d._id, plays: d.count })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// GET /analytics/signups
const getSignupsAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const signupsData = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      message: "User signups analytics (last 30 days) fetched",
      data: signupsData.map((d) => ({ date: d._id, signups: d.count })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = {
  getStats,
  getAllSongs,
  updateSong,
  deleteSong,
  getAllUsers,
  banUser,
  unbanUser,
  changeRole,
  getAllActivities,
  getPlaysAnalytics,
  getSignupsAnalytics,
};
