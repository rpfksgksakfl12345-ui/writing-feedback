import multer from "multer";
import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  allowedImageMimeTypes,
  createSafeUploadFilename,
  ensureUploadsDirSync,
  uploadMaxFileSizeBytes,
  uploadsDir,
} from "../config/uploads";

type ImageUploadOptions = {
  maxFiles?: number;
  fieldNamePattern?: RegExp;
};

ensureUploadsDirSync();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, createSafeUploadFilename(file.originalname)),
});

function createImageUpload(options: ImageUploadOptions = {}) {
  return multer({
    storage,
    limits: {
      fileSize: uploadMaxFileSizeBytes,
      files: options.maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (options.fieldNamePattern && !options.fieldNamePattern.test(file.fieldname)) {
        cb(new Error("UNSUPPORTED_IMAGE_FIELD"));
        return;
      }

      if (allowedImageMimeTypes.has(file.mimetype)) {
        cb(null, true);
        return;
      }

      cb(new Error("UNSUPPORTED_IMAGE_TYPE"));
    },
  });
}

export function singleImageUpload(fieldName: string) {
  return createImageUpload().single(fieldName);
}

export function teacherBulkStudentImageUpload(maxFiles: number) {
  return createImageUpload({
    maxFiles,
    fieldNamePattern: /^studentFile-\d+$/,
  }).any();
}

export function handleImageUpload(uploadMiddleware: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "이미지 파일은 10MB 이하만 올릴 수 있어요." });
        return;
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
        res.status(400).json({ message: "한 번에 올릴 수 있는 사진 수를 초과했어요." });
        return;
      }

      if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") {
        res.status(400).json({ message: "jpg, png, webp 이미지 파일만 올릴 수 있어요." });
        return;
      }

      if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_FIELD") {
        res.status(400).json({ message: "학생별 사진 입력만 업로드할 수 있어요." });
        return;
      }

      next(error);
    });
  };
}
