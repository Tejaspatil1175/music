const express = require("express");
const router = express.Router();
const {
  getForYou,
  getTrending,
  getNew,
  getSimilar,
  getMixes,
} = require("../controllers/recommendController");
const verifyToken = require("../middleware/verifyToken");

// Public endpoints
router.get("/trending", getTrending);
router.get("/new", getNew);
router.get("/similar/:id", getSimilar);

// Protected endpoints
router.get("/foryou", verifyToken, getForYou);
router.get("/mixes", verifyToken, getMixes);

module.exports = router;
