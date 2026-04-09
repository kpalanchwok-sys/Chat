import { Request } from "express";
import fs from "fs";
import multer, { FileFilterCallback, Multer, StorageEngine } from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import AppError from "../utils/AppError";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
const MAX_FILE_SIZE =
  //   (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
  process.env.MAX_FILE_SIZE_MB;

// Ensure upload sub-directories exist
["images", "files", "avatars"].forEach((dir) => {
  const p = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_TYPES = {
  images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  files: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/zip",
    "audio/mpeg",
    "video/mp4",
  ],
};

const ALL_ALLOWED = [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.files];

// // ─── Storage engine ───────────────────────────────────────────────────────────
const storage: StorageEngine = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    const isImage = ALLOWED_TYPES.images.includes(file.mimetype);
    const subDir = isImage ? "images" : "files";
    cb(null, path.join(UPLOAD_DIR, subDir));
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ─── File filter ──────────────────────────────────────────────────────────────
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALL_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `File type "${file.mimetype}" is not allowed`,
        400,
        "INVALID_FILE_TYPE",
      ),
    );
  }
};

// ─── Multer instances ─────────────────────────────────────────────────────────
const upload: Multer = multer({
  storage,
  fileFilter,
  //   limits: { fileSize: MAX_FILE_SIZE },
});

// Single avatar upload
const uploadAvatar: Multer = multer({
  storage: multer.diskStorage({
    destination: (
      req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void,
    ) => cb(null, path.join(UPLOAD_DIR, "avatars")),
    filename: (
      req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (ALLOWED_TYPES.images.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new AppError(
          "Only image files are allowed for avatars",
          400,
          "INVALID_FILE_TYPE",
        ),
      );
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for avatars
});

// Helper: build public URL from saved file path
const getFileUrl = (req: Request, filePath: string): string => {
  const relative = path.relative(UPLOAD_DIR, filePath).replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/uploads/${relative}`;
};

export { ALLOWED_TYPES, getFileUrl, upload, UPLOAD_DIR, uploadAvatar };
