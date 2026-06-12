const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  refresh,
  getMe,
  updateMe,
  updatePassword,
} = require("../controllers/authController");
const verifyToken = require("../middleware/verifyToken");
const { loginLimiter } = require("../middleware/rateLimiter");

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.post("/refresh", refresh);

// Protected routes
router.get("/me", verifyToken, getMe);
router.put("/me", verifyToken, updateMe);
router.put("/me/password", verifyToken, updatePassword);

module.exports = router;
