const express = require("express");
const router = Router = express.Router();
const { logActivity, getHistory, getStats } = require("../controllers/activityController");
const verifyToken = require("../middleware/verifyToken");

router.post("/log", verifyToken, logActivity);
router.get("/history", verifyToken, getHistory);
router.get("/stats", verifyToken, getStats);

module.exports = router;
