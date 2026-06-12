require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const socketSetup = require("./config/socket");

// Import Routes
const authRoutes = require("./routes/auth");
const musicRoutes = require("./routes/music");
const playlistRoutes = require("./routes/playlist");
const youtubeRoutes = require("./routes/youtube");
const recommendRoutes = require("./routes/recommend");
const activityRoutes = require("./routes/activity");
const adminRoutes = require("./routes/admin");

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);
socketSetup(io);

// Global Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/playlist", playlistRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/admin", adminRoutes);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
    data: null,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
});
