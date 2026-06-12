const socketSetup = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join", (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Emit updated trending list every 10 minutes
  setInterval(async () => {
    try {
      const Song = require("../models/Song");
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const trending = await Song.find({
        isActive: true,
        isPublic: true,
        plays: { $gte: 10 },
        createdAt: { $gte: since },
      })
        .sort({ plays: -1 })
        .limit(20)
        .select("title artist coverImage plays genre mood");

      io.emit("now:trending", { songs: trending });
    } catch (err) {
      console.error("Trending emit error:", err.message);
    }
  }, 10 * 60 * 1000);
};

module.exports = socketSetup;
