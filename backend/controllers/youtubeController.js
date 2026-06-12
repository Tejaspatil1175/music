const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const https = require("https");
const Song = require("../models/Song");
const { uploadToGCS } = require("../config/storage");
const { generateFileName } = require("../utils/fileNamer");
const { extractMetadata } = require("../utils/metadataExtractor");
const { getYoutubeInfo, downloadYoutubeAudio } = require("../utils/ytdlpHelper");

// Helper to download image using standard https
const downloadThumbnail = (url, destPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch thumbnail: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(destPath);
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
};

// GET /info?url=
const getInfo = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: "YouTube URL is required", data: null });
    }

    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!ytRegex.test(url)) {
      return res.status(400).json({ success: false, message: "Invalid YouTube URL format", data: null });
    }

    const info = await getYoutubeInfo(url);
    return res.status(200).json({
      success: true,
      message: "YouTube video info fetched",
      data: info,
    });
  } catch (err) {
    const msg = err.message;
    if (msg.includes("Private video") || msg.includes("private")) {
      return res.status(400).json({ success: false, message: "Private video or unavailable video", data: null });
    }
    if (msg.includes("age") && msg.includes("restricted")) {
      return res.status(400).json({ success: false, message: "Age restricted video", data: null });
    }
    return res.status(400).json({ success: false, message: `Could not fetch video info: ${err.message}`, data: null });
  }
};

// POST /download
const downloadAudio = async (req, res) => {
  const { url, genre, mood, language } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: "YouTube URL is required", data: null });
  }

  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  if (!ytRegex.test(url)) {
    return res.status(400).json({ success: false, message: "Invalid YouTube URL format", data: null });
  }

  try {
    // Duplicate check
    const existingSong = await Song.findOne({ youtubeUrl: url, isActive: true });
    if (existingSong) {
      return res.status(200).json({
        success: true,
        message: "Song already exists in database",
        data: existingSong,
      });
    }

    // Pre-allocate ObjectId and generate temp path
    const songId = new mongoose.Types.ObjectId();
    const io = req.app.get("io");
    const tempDir = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Fetch video info
    let info;
    try {
      info = await getYoutubeInfo(url);
    } catch (infoErr) {
      return res.status(400).json({
        success: false,
        message: `Could not access video: ${infoErr.message}`,
        data: null,
      });
    }

    const title = info.title;
    const artist = info.artist;
    const cleanFileName = generateFileName(title, artist);
    const localAudioPath = path.join(tempDir, `${songId}_temp`);
    const localThumbnailPath = path.join(tempDir, `${songId}_thumb.jpg`);

    // Download audio in background
    let downloadPath;
    try {
      downloadPath = await downloadYoutubeAudio(url, localAudioPath, (percent) => {
        if (io) {
          io.emit("download:progress", {
            songId: songId.toString(),
            percent,
            status: "downloading",
          });
        }
      });
    } catch (dlErr) {
      if (io) {
        io.emit("download:progress", {
          songId: songId.toString(),
          percent: 0,
          status: "failed",
        });
      }

      if (dlErr.message === "PRIVATE_VIDEO") {
        return res.status(400).json({ success: false, message: "Private / unavailable video", data: null });
      }
      if (dlErr.message === "AGE_RESTRICTED") {
        return res.status(400).json({ success: false, message: "Age restricted video", data: null });
      }

      return res.status(500).json({
        success: false,
        message: `Download failed: ${dlErr.message}`,
        data: null,
        retry: true,
      });
    }

    // Download thumbnail if present
    let coverUrl = "";
    if (info.thumbnail) {
      try {
        await downloadThumbnail(info.thumbnail, localThumbnailPath);
        coverUrl = await uploadToGCS(localThumbnailPath, `covers/${songId}_thumb.jpg`, "image/jpeg");
        fs.unlinkSync(localThumbnailPath);
      } catch (thumbErr) {
        console.error("Thumbnail download/upload error:", thumbErr.message);
        // Fallback to youtube url or leave empty
        coverUrl = info.thumbnail;
      }
    }

    // Upload Audio to GCS
    let audioUrl = "";
    try {
      audioUrl = await uploadToGCS(downloadPath, `songs/${cleanFileName}`, "audio/mpeg");
      fs.unlinkSync(downloadPath);
    } catch (uploadErr) {
      if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
      return res.status(500).json({ success: false, message: `Upload to storage failed: ${uploadErr.message}`, data: null });
    }

    // Extract metadata from MP3 (for accurate duration/bpm)
    const localTempForMeta = path.join(tempDir, `${songId}_meta.mp3`);
    let duration = info.duration || 0;
    let bpm = 0;
    let fileFormat = "mp3";

    // Create the Song in database
    const song = await Song.create({
      _id: songId,
      title,
      artist,
      album: "YouTube Upload",
      genre: genre || "Unknown",
      mood: mood || "",
      language: language || "",
      duration,
      filePath: audioUrl,
      coverImage: coverUrl,
      fileFormat,
      fileSize: 0, // In backend downloads we may not need strictly correct file size, or we can check stat
      plays: 0,
      likes: [],
      tags: [genre, mood, "youtube"].filter(Boolean),
      bpm,
      uploadedBy: { userId: req.user.id, role: req.user.role },
      source: "youtube",
      youtubeUrl: url,
      isPublic: true,
      isActive: true,
    });

    if (io) {
      io.emit("download:progress", {
        songId: songId.toString(),
        percent: 100,
        status: "completed",
      });

      // Emit new song notification
      io.emit("song:uploaded", { song });
    }

    return res.status(201).json({
      success: true,
      message: "YouTube audio downloaded and uploaded successfully",
      data: song,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
};

module.exports = {
  getInfo,
  downloadAudio,
};
