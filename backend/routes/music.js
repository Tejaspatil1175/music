const express = require("express");
const router = express.Router();
const {
  uploadSong,
  getAllSongs,
  getSongById,
  updateSong,
  deleteSong,
  playSong,
  completeSong,
  likeSong,
  skipSong,
  searchSongs,
} = require("../controllers/musicController");
const verifyToken = require("../middleware/verifyToken");
const { uploadMiddleware } = require("../middleware/uploadMiddleware");

// Public routes
router.get("/", getAllSongs);
router.get("/search", searchSongs); // Must be before /:id to prevent parameter collision
router.get("/:id", getSongById);

// Protected upload
router.post("/upload", verifyToken, uploadMiddleware, uploadSong);

// Protected streaming and playback tracking
router.put("/:id", verifyToken, updateSong);
router.delete("/:id", verifyToken, deleteSong);
router.post("/:id/play", verifyToken, playSong);
router.post("/:id/complete", verifyToken, completeSong);
router.post("/:id/like", verifyToken, likeSong);
router.post("/:id/skip", verifyToken, skipSong);

module.exports = router;
