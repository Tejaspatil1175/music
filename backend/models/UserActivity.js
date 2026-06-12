const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
  action: {
    type: String,
    enum: ["play", "like", "skip", "add_to_playlist", "search", "complete"],
    required: true,
  },
  genre: { type: String, default: "" },
  artist: { type: String, default: "" },
  mood: { type: String, default: "" },
  skipAfterSeconds: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  sessionId: { type: String, default: "" },
});

userActivitySchema.index({ userId: 1, timestamp: -1 });
userActivitySchema.index({ userId: 1, songId: 1, action: 1 });

module.exports = mongoose.model("UserActivity", userActivitySchema);
