const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const getYoutubeInfo = (url) => {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      ["--dump-json", "--no-playlist", url],
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        try {
          const info = JSON.parse(stdout);
          resolve({
            title: info.title || "",
            artist: info.uploader || info.channel || "",
            duration: info.duration || 0,
            thumbnail: info.thumbnail || "",
            views: info.view_count || 0,
            youtubeUrl: url,
          });
        } catch (e) {
          reject(new Error("Failed to parse YouTube info"));
        }
      }
    );
  });
};

const downloadYoutubeAudio = (url, outputPath, onProgress) => {
  return new Promise((resolve, reject) => {
    const args = [
      "--no-playlist",
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--output", outputPath,
      "--newline",
      url,
    ];

    const proc = execFile("yt-dlp", args, { timeout: 300000 });

    proc.stdout.on("data", (data) => {
      const line = data.toString().trim();
      const match = line.match(/(\d+\.\d+)%/);
      if (match && onProgress) {
        onProgress(parseFloat(match[1]));
      }
    });

    proc.stderr.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Private video") || msg.includes("This video is private")) {
        proc.kill();
        reject(new Error("PRIVATE_VIDEO"));
      } else if (msg.includes("age") && msg.includes("restricted")) {
        proc.kill();
        reject(new Error("AGE_RESTRICTED"));
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // yt-dlp appends .mp3 extension automatically
        const finalPath = outputPath.endsWith(".mp3") ? outputPath : outputPath + ".mp3";
        resolve(finalPath);
      } else {
        reject(new Error("DOWNLOAD_FAILED"));
      }
    });
  });
};

module.exports = { getYoutubeInfo, downloadYoutubeAudio };
