import { Request, Response, Router } from "express";
import { upload } from "../config/multer";
import { authenticate } from "../middleware/auth";
import { uploadLimiter } from "../middleware/rateLimiter";
import {
  editMessageRules,
  paginationRules,
  sendMessageRules,
} from "../middleware/validate";
import * as messageService from "../services/messageService";
import AppError from "../utils/AppError";
import asyncHandler from "../utils/asyncHandler";
import { created, success } from "../utils/response";

const router = Router({ mergeParams: true });

// GET /api/groups/:groupId/messages — paginated message history
router.get(
  "/",
  authenticate,
  paginationRules,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 30, before } = req.query;
    const result = await messageService.getMessages(
      //@ts-ignore
      req.params.groupId,
      req.user!._id.toString(),
      {
        page: typeof page === "string" ? parseInt(page) : 1,
        limit: typeof limit === "string" ? parseInt(limit) : 30,
        before: typeof before === "string" ? before : undefined,
      },
    );
    success(res, result);
  }),
);

// POST /api/groups/:groupId/messages — send a message (text or with files)
router.post(
  "/",
  authenticate,
  uploadLimiter,
  upload.array("files", 5),
  sendMessageRules,
  asyncHandler(async (req: Request, res: Response) => {
    const { content, type, replyTo } = req.body;
    const message = await messageService.sendMessage({
      //@ts-ignore
      groupId: req.params.groupId,
      senderId: req.user!._id.toString(),
      content,
      type,
      replyTo,
      files: (req.files as Express.Multer.File[]) || [],
      req,
    });
    created(res, { message }, "Message sent");
  }),
);

// PATCH /api/groups/:groupId/messages/:messageId — edit message
router.patch(
  "/:messageId",
  authenticate,
  editMessageRules,
  asyncHandler(async (req: Request, res: Response) => {
    const message = await messageService.editMessage(
      //@ts-ignore
      req.params.messageId,
      req.user!._id.toString(),
      req.body.content,
    );
    success(res, { message }, "Message updated");
  }),
);

// DELETE /api/groups/:groupId/messages/:messageId — soft delete
router.delete(
  "/:messageId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const message = await messageService.deleteMessage(
      //@ts-ignore
      req.params.messageId,
      req.user!._id.toString(),
      req.params.groupId,
    );
    success(res, { message }, "Message deleted");
  }),
);

// POST /api/groups/:groupId/messages/:messageId/react — toggle reaction
router.post(
  "/:messageId/react",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== "string" || emoji.length > 10) {
      throw new AppError("Valid emoji is required", 400);
    }
    const message = await messageService.toggleReaction(
      //@ts-ignore
      req.params.messageId,
      req.user!._id.toString(),
      emoji,
    );
    success(res, { reactions: message.reactions }, "Reaction toggled");
  }),
);

// POST /api/groups/:groupId/messages/mark-read — mark all as read
router.post(
  "/mark-read",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await messageService.markAsRead(
      //@ts-ignore
      req.params.groupId,
      req.user!._id.toString(),
    );
    success(res, {}, "Messages marked as read");
  }),
);

export default router;
