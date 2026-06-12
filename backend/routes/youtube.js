const express = require("express");
const router = express.Router();
const { getInfo, downloadAudio } = require("../controllers/youtubeController");
const verifyToken = require("../middleware/verifyToken");
const { youtubeLimiter } = require("../middleware/rateLimiter");

router.get("/info", verifyToken, getInfo);
router.post("/download", verifyToken, youtubeLimiter, downloadAudio);

module.exports = router;
