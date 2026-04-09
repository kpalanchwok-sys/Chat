import { Request, Response, Router } from "express";
import { body, validationResult } from "express-validator";
import xss from "xss";
import { getFileUrl, uploadAvatar } from "../config/multer";
import { authenticate } from "../middleware/auth";
import { User } from "../models/User";
import AppError from "../utils/AppError";
import asyncHandler from "../utils/asyncHandler";
import { success } from "../utils/response";

const router = Router();

// GET /api/users/search?q=username
router.get(
  "/search",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q || (typeof q === "string" && q.trim().length < 2))
      throw new AppError("Search query must be at least 2 characters", 400);

    const users = await User.find({
      username: { $regex: String(q).trim(), $options: "i" },
      _id: { $ne: req.user!._id },
      isBanned: false,
    })
      .select("username avatar bio isOnline lastSeen")
      .limit(20);

    success(res, { users });
  }),
);

// GET /api/users/:id — get public profile
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id).select(
      "username avatar bio isOnline lastSeen createdAt",
    );
    if (!user) throw new AppError("User not found", 404);
    success(res, { user });
  }),
);

// PATCH /api/users/me — update own profile
router.patch(
  "/me",
  authenticate,
  [
    body("bio")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Bio max 200 characters"),
    body("username")
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username 3–30 chars")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Letters, numbers, underscores only"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError("Validation failed", 422);

    const { bio, username } = req.body;
    const updates: any = {};

    if (username && username !== req.user!.username) {
      const taken = await User.findOne({ username });
      if (taken) throw new AppError("Username is already taken", 409);
      updates.username = username;
    }

    if (bio !== undefined)
      updates.bio = xss(bio, { whiteList: {}, stripIgnoreTag: true });

    const user = await User.findByIdAndUpdate(req.user!._id, updates, {
      new: true,
      runValidators: true,
    });
    success(res, { user }, "Profile updated");
  }),
);

// POST /api/users/me/avatar — upload avatar
router.post(
  "/me/avatar",
  authenticate,
  uploadAvatar.single("avatar"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError("Avatar image is required", 400);
    const avatarUrl = getFileUrl(req, req.file.path);
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { avatar: avatarUrl },
      { new: true },
    );
    success(res, { avatar: user?.avatar }, "Avatar updated");
  }),
);

export default router;
