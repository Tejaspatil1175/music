const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    songs: [
      {
        songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    coverImage: { type: String, default: "" },
    isPublic: { type: Boolean, default: true },
    totalDuration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Playlist", playlistSchema);
