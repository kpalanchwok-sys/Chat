import { Request, Response, Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createGroupRules,
  mongoId,
  paginationRules,
  updateGroupRules,
} from "../middleware/validate";
import * as groupService from "../services/groupService";
import AppError from "../utils/AppError";
import asyncHandler from "../utils/asyncHandler";
import { created, paginated, success } from "../utils/response";

const router = Router();

// GET /api/groups — browse public groups
router.get(
  "/",
  authenticate,
  paginationRules,
  asyncHandler(async (req: Request, res: Response) => {
    const { search, page = 1, limit = 20 } = req.query;
    const result = await groupService.browseGroups({
      search: typeof search === "string" ? search : undefined,
      page: typeof page === "string" ? parseInt(page) : 1,
      limit: typeof limit === "string" ? parseInt(limit) : 20,
    });
    paginated(
      res,
      result.groups,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
      "Success",
    );
  }),
);

// GET /api/groups/my — groups the user has joined
router.get(
  "/my",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const groups = await groupService.getUserGroups(req.user!._id.toString());
    success(res, { groups });
  }),
);

// POST /api/groups — create group
router.post(
  "/",
  authenticate,
  createGroupRules,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, type, maxMembers, tags } = req.body;
    const group = await groupService.createGroup(
      { name, description, type, maxMembers, tags },
      req.user!._id.toString(),
    );
    created(res, { group }, "Group created successfully");
  }),
);

// POST /api/groups/join-invite — join via invite code
router.post(
  "/join-invite",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { inviteCode } = req.body;
    if (!inviteCode) throw new AppError("Invite code is required", 400);
    const group = await groupService.joinByInvite(inviteCode, req.user!);
    success(res, { group }, "Joined group successfully");
  }),
);

// GET /api/groups/:id — get group details
router.get(
  "/:id",
  authenticate,
  mongoId("id"),
  asyncHandler(async (req: Request, res: Response) => {
    const group = await groupService.getGroupById(
      req.params.id,
      req.user!._id.toString(),
    );
    success(res, { group });
  }),
);

// POST /api/groups/:id/join — join a public group
router.post(
  "/:id/join",
  authenticate,
  mongoId("id"),
  asyncHandler(async (req: Request, res: Response) => {
    const group = await groupService.joinGroup(req.params.id, req.user!);
    success(res, { group }, "Joined group successfully");
  }),
);

// POST /api/groups/:id/leave — leave a group
router.post(
  "/:id/leave",
  authenticate,
  mongoId("id"),
  asyncHandler(async (req: Request, res: Response) => {
    await groupService.leaveGroup(req.params.id, req.user!);
    success(res, {}, "Left group successfully");
  }),
);

// PATCH /api/groups/:id — update group info (admin only)
router.patch(
  "/:id",
  authenticate,
  mongoId("id"),
  updateGroupRules,
  asyncHandler(async (req: Request, res: Response) => {
    const group = await groupService.updateGroup(
      req.params.id,
      req.body,
      req.user!._id.toString(),
    );
    success(res, { group }, "Group updated");
  }),
);

// DELETE /api/groups/:id — delete group (owner only)
router.delete(
  "/:id",
  authenticate,
  mongoId("id"),
  asyncHandler(async (req: Request, res: Response) => {
    await groupService.deleteGroup(req.params.id, req.user!._id.toString());
    success(res, {}, "Group deleted");
  }),
);

// GET /api/groups/:id/members — list members
router.get(
  "/:id/members",
  authenticate,
  mongoId("id"),
  asyncHandler(async (req: Request, res: Response) => {
    const group = await groupService.getGroupById(
      req.params.id,
      req.user!._id.toString(),
    );
    success(res, { members: group.members, memberCount: group.memberCount });
  }),
);

// PATCH /api/groups/:id/members/:userId/role — update member role (admin only)
router.patch(
  "/:id/members/:userId/role",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.body;
    const validRoles = ["member", "moderator", "admin"];
    if (!validRoles.includes(role))
      throw new AppError(`Role must be one of: ${validRoles.join(", ")}`, 400);
    const group = await groupService.updateMemberRole(
      req.params.id,
      req.params.userId,
      role,
      req.user!._id.toString(),
    );
    success(res, { group }, "Member role updated");
  }),
);

// DELETE /api/groups/:id/members/:userId — kick member (moderator+)
router.delete(
  "/:id/members/:userId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await groupService.kickMember(
      req.params.id,
      req.params.userId,
      req.user!._id.toString(),
    );
    success(res, {}, "Member removed from group");
  }),
);

export default router;
