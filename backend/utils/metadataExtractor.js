const mm = require("music-metadata");

const extractMetadata = async (filePath) => {
  try {
    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;
    const format = metadata.format;

    return {
      title: common.title || "",
      artist: common.artist || common.albumartist || "",
      album: common.album || "",
      genre: Array.isArray(common.genre) ? common.genre[0] : common.genre || "",
      duration: Math.round(format.duration) || 0,
      bpm: common.bpm || 0,
      fileFormat: format.container ? format.container.toLowerCase() : "mp3",
    };
  } catch (err) {
    console.error("Metadata extraction error:", err.message);
    return {};
  }
};

module.exports = { extractMetadata };
