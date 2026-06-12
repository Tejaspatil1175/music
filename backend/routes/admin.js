const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/adminController");
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");

// Protect all admin routes using verifyToken and isAdmin middlewares
router.use(verifyToken, isAdmin);

router.get("/stats", getStats);

router.get("/songs", getAllSongs);
router.put("/songs/:id", updateSong);
router.delete("/songs/:id", deleteSong);

router.get("/users", getAllUsers);
router.put("/users/:id/ban", banUser);
router.put("/users/:id/unban", unbanUser);
router.put("/users/:id/role", changeRole);

router.get("/activity", getAllActivities);
router.get("/analytics/plays", getPlaysAnalytics);
router.get("/analytics/signups", getSignupsAnalytics);

module.exports = router;
