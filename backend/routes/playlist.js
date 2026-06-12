const express = require("express");
const router = express.Router();
const {
  createPlaylist,
  getMyPlaylists,
  getPublicPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylist,
} = require("../controllers/playlistController");
const verifyToken = require("../middleware/verifyToken");

// Public playlist endpoints
router.get("/public", getPublicPlaylists); // Before /:id
router.get("/:id", getPlaylistById);

// Protected playlist endpoints
router.post("/", verifyToken, createPlaylist);
router.get("/my", verifyToken, getMyPlaylists);
router.put("/:id", verifyToken, updatePlaylist);
router.delete("/:id", verifyToken, deletePlaylist);
router.post("/:id/add", verifyToken, addSongToPlaylist);
router.delete("/:id/remove/:songId", verifyToken, removeSongFromPlaylist);
router.put("/:id/reorder", verifyToken, reorderPlaylist);

module.exports = router;
