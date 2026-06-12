const generateFileName = (title, artist, ext = "mp3") => {
  const clean = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

  return `${clean(title)}_${clean(artist)}.${ext}`;
};

module.exports = { generateFileName };
