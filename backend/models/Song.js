const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    album: { type: String, default: "" },
    genre: { type: String, default: "" },
    mood: {
      type: String,
      enum: ["happy", "sad", "energetic", "calm", "romantic", "angry", "focus", ""],
      default: "",
    },
    language: { type: String, default: "" },
    lyrics: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    filePath: { type: String, required: true },
    coverImage: { type: String, default: "" },
    fileFormat: { type: String, default: "mp3" },
    fileSize: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    tags: [{ type: String }],
    bpm: { type: Number, default: 0 },
    uploadedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String, enum: ["user", "admin"] },
    },
    source: { type: String, enum: ["admin", "user", "youtube"], default: "user" },
    youtubeUrl: { type: String, default: "" },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

songSchema.index({ title: "text", artist: "text", album: "text", genre: "text", tags: "text" });

module.exports = mongoose.model("Song", songSchema);
