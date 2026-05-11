import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const configuredUploadsDir = process.env.UPLOADS_DIR?.trim();

export const uploadsDir = path.resolve(configuredUploadsDir || DEFAULT_UPLOADS_DIR);
export const uploadMaxFileSizeBytes = 10 * 1024 * 1024;

export const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function ensureUploadsDirSync() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function resolveUploadFilePath(filename: string) {
  const filePath = path.resolve(uploadsDir, filename);

  if (!filePath.startsWith(`${uploadsDir}${path.sep}`)) {
    throw new Error("Invalid upload file path");
  }

  return filePath;
}

export function createSafeUploadFilename(originalName: string) {
  const parsedName = path.parse(path.basename(originalName));
  const safeBaseName =
    parsedName.name
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "upload";
  const safeExtension = [".jpg", ".jpeg", ".png", ".webp"].includes(
    parsedName.ext.toLowerCase(),
  )
    ? parsedName.ext.toLowerCase()
    : ".jpg";

  return `${Date.now()}-${randomBytes(6).toString("hex")}-${safeBaseName}${safeExtension}`;
}
