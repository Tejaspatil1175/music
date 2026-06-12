const mongoose = require("mongoose");

const listeningSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sessionId: { type: String, required: true },
  songs: [
    {
      songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
      playedAt: { type: Date, default: Date.now },
      completed: { type: Boolean, default: false },
      skipAfterSeconds: { type: Number, default: 0 },
    },
  ],
  totalDuration: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
});

module.exports = mongoose.model("ListeningSession", listeningSessionSchema);
