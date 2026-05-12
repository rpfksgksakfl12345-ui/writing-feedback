import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createSubmission,
  getSubmission,
  getSubmissions,
  updateExtractedText,
  updateFeedback,
} from "../controllers/submissionsController";
import { createFeedbackDraft } from "../controllers/feedbackDraftController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";
import { handleImageUpload, singleImageUpload } from "../middlewares/imageUpload";
import { feedbackDraftRateLimiter, uploadRateLimiter } from "../middlewares/rateLimit";

const router = Router();
const uploadSingleImage = handleImageUpload(singleImageUpload("image"));

router.use(authMiddleware);
router.post("/", requireRoleMiddleware(Role.STUDENT), uploadRateLimiter, uploadSingleImage, createSubmission);
router.get("/", getSubmissions);
router.get("/:id", getSubmission);
router.post(
  "/:id/feedback-draft",
  requireRoleMiddleware(Role.TEACHER),
  feedbackDraftRateLimiter,
  createFeedbackDraft,
);
router.patch("/:id/extracted-text", requireRoleMiddleware(Role.TEACHER), updateExtractedText);
router.patch("/:id/feedback", requireRoleMiddleware(Role.TEACHER), updateFeedback);

export default router;
