const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

// Ensure upload sub-directories exist
['images', 'files', 'avatars'].forEach((dir) => {
  const p = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  files: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'audio/mpeg',
    'video/mp4',
  ],
};

const ALL_ALLOWED = [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.files];

// ─── Storage engine ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isImage = ALLOWED_TYPES.images.includes(file.mimetype);
    const subDir = isImage ? 'images' : 'files';
    cb(null, path.join(UPLOAD_DIR, subDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ─── File filter ──────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALL_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type "${file.mimetype}" is not allowed`, 400, 'INVALID_FILE_TYPE'), false);
  }
};

// ─── Multer instances ─────────────────────────────────────────────────────────
const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

// Single avatar upload
const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'avatars')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.images.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Only image files are allowed for avatars', 400, 'INVALID_FILE_TYPE'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for avatars
});

// Helper: build public URL from saved file path
const getFileUrl = (req, filePath) => {
  const relative = path.relative(UPLOAD_DIR, filePath).replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/uploads/${relative}`;
};

module.exports = { upload, uploadAvatar, getFileUrl, UPLOAD_DIR, ALLOWED_TYPES };
