import multer from "multer";
import { NextFunction, Request, Response, Router } from "express";
import { Role } from "@prisma/client";
import {
  allowedImageMimeTypes,
  createSafeUploadFilename,
  ensureUploadsDirSync,
  uploadMaxFileSizeBytes,
  uploadsDir,
} from "../config/uploads";
import {
  createSubmission,
  getSubmission,
  getSubmissions,
  updateExtractedText,
  updateFeedback,
} from "../controllers/submissionsController";
import { createFeedbackDraft } from "../controllers/feedbackDraftController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";
import { feedbackDraftRateLimiter, uploadRateLimiter } from "../middlewares/rateLimit";

ensureUploadsDirSync();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, createSafeUploadFilename(file.originalname)),
});

const upload = multer({
  storage,
  limits: {
    fileSize: uploadMaxFileSizeBytes,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("UNSUPPORTED_IMAGE_TYPE"));
  },
});
const router = Router();
const uploadSingleImage = upload.single("image");

function handleImageUpload(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  uploadSingleImage(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "이미지 파일은 10MB 이하만 올릴 수 있어요." });
      return;
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") {
      res.status(400).json({ message: "jpg, png, webp 이미지 파일만 올릴 수 있어요." });
      return;
    }

    next(error);
  });
}

router.use(authMiddleware);
router.post("/", requireRoleMiddleware(Role.STUDENT), uploadRateLimiter, handleImageUpload, createSubmission);
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
