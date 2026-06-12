const multer = require("multer");
const path = require("path");
const fs = require("fs");

const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tmpDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "audio/mpeg" ||
    file.mimetype === "audio/mp3" ||
    path.extname(file.originalname).toLowerCase() === ".mp3"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only MP3 files are allowed"), false);
  }
};

const uploadMiddleware = (req, res, next) => {
  const maxSize = req.user && req.user.role === "admin" ? 50 * 1024 * 1024 : 20 * 1024 * 1024;

  const upload = multer({ storage, fileFilter, limits: { fileSize: maxSize } }).single("file");

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message, data: null });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message, data: null });
    }
    next();
  });
};

const coverUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG/PNG/WEBP images allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("coverImage");

module.exports = { uploadMiddleware, coverUpload };
