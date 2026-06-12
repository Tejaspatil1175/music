const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  });

const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: "All fields required", data: null });

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password))
      return res.status(400).json({
        success: false,
        message: "Password must be min 8 chars, include 1 uppercase and 1 number",
        data: null,
      });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(400).json({ success: false, message: "Email or username already taken", data: null });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      data: { accessToken, user: { id: user._id, username: user.username, email: user.email, role: user.role } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required", data: null });

    const user = await User.findOne({ email });
    if (!user || !user.isActive)
      return res.status(400).json({ success: false, message: "Invalid credentials or account banned", data: null });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ success: false, message: "Invalid credentials", data: null });

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          favoriteGenres: user.favoriteGenres,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) await RefreshToken.deleteOne({ token });
    res.clearCookie("refreshToken");
    return res.status(200).json({ success: true, message: "Logged out", data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token)
      return res.status(401).json({ success: false, message: "No refresh token", data: null });

    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < new Date())
      return res.status(401).json({ success: false, message: "Refresh token expired or invalid", data: null });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: "User not found or banned", data: null });

    const accessToken = generateAccessToken(user);
    return res.status(200).json({ success: true, message: "Token refreshed", data: { accessToken } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found", data: null });
    return res.status(200).json({ success: true, message: "User profile", data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const updateMe = async (req, res) => {
  try {
    const { username, bio, avatar, favoriteGenres } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { username, bio, avatar, favoriteGenres },
      { new: true, runValidators: true }
    ).select("-password");
    return res.status(200).json({ success: true, message: "Profile updated", data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match)
      return res.status(400).json({ success: false, message: "Old password incorrect", data: null });

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword))
      return res.status(400).json({
        success: false,
        message: "New password must be min 8 chars, include 1 uppercase and 1 number",
        data: null,
      });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated", data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = { register, login, logout, refresh, getMe, updateMe, updatePassword };
