import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createBulkFeedbackDrafts,
  createBulkTeacherSubmissions,
  teacherBulkUploadMaxFiles,
} from "../controllers/topicBulkController";
import { createTopic, deleteTopic, getTopic, getTopics } from "../controllers/topicsController";
import { generateTopicGuide, generateTopics } from "../controllers/topicSuggestionsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";
import { handleImageUpload, teacherBulkStudentImageUpload } from "../middlewares/imageUpload";
import {
  bulkFeedbackDraftRateLimiter,
  teacherBulkUploadRateLimiter,
  topicAiRateLimiter,
} from "../middlewares/rateLimit";

const router = Router();
const uploadTeacherBulkStudentImages = handleImageUpload(
  teacherBulkStudentImageUpload(teacherBulkUploadMaxFiles),
);

router.use(authMiddleware);
router.get("/", getTopics);
router.post("/", requireRoleMiddleware(Role.TEACHER), createTopic);
router.post("/generate", requireRoleMiddleware(Role.TEACHER), topicAiRateLimiter, generateTopics);
router.post(
  "/generate-guide",
  requireRoleMiddleware(Role.TEACHER),
  topicAiRateLimiter,
  generateTopicGuide,
);
router.post(
  "/:topicId/submissions/bulk-upload",
  requireRoleMiddleware(Role.TEACHER),
  teacherBulkUploadRateLimiter,
  uploadTeacherBulkStudentImages,
  createBulkTeacherSubmissions,
);
router.post(
  "/:topicId/feedback-drafts/bulk",
  requireRoleMiddleware(Role.TEACHER),
  bulkFeedbackDraftRateLimiter,
  createBulkFeedbackDrafts,
);
router.get("/:id", getTopic);
router.delete("/:id", requireRoleMiddleware(Role.TEACHER), deleteTopic);

export default router;
