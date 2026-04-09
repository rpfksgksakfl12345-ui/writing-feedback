import fs from "fs";
import path from "path";
import multer from "multer";
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

const uploadDir = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
});

const upload = multer({ storage });
const router = Router();

router.use(authMiddleware);
router.post("/", requireRoleMiddleware(Role.STUDENT), upload.single("image"), createSubmission);
router.get("/", getSubmissions);
router.get("/:id", getSubmission);
router.post("/:id/feedback-draft", requireRoleMiddleware(Role.TEACHER), createFeedbackDraft);
router.patch("/:id/extracted-text", requireRoleMiddleware(Role.TEACHER), updateExtractedText);
router.patch("/:id/feedback", requireRoleMiddleware(Role.TEACHER), updateFeedback);

export default router;
