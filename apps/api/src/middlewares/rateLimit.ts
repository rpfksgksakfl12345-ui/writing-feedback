import { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
let requestCountSinceCleanup = 0;

function normalizeKeyPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]+/g, "_")
    .slice(0, 160);
}

export function getClientIp(req: Request) {
  return normalizeKeyPart(req.ip || req.socket.remoteAddress || "unknown");
}

export function getBodyString(req: Request, fieldName: string) {
  const value = (req.body as Record<string, unknown> | undefined)?.[fieldName];
  return typeof value === "string" ? value.trim() : "";
}

function cleanupExpiredBuckets(now: number) {
  requestCountSinceCleanup += 1;

  if (requestCountSinceCleanup < 100) {
    return;
  }

  requestCountSinceCleanup = 0;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const baseKey = options.keyGenerator?.(req) || getClientIp(req);
    const key = `${options.name}:${normalizeKeyPart(baseKey)}`;
    const currentBucket = buckets.get(key);
    const bucket =
      currentBucket && currentBucket.resetAt > now
        ? currentBucket
        : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);
    cleanupExpiredBuckets(now);

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: options.message });
    }

    return next();
  };
}

export const teacherLoginRateLimiter = createRateLimiter({
  name: "teacher-login",
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: (req) => `${getClientIp(req)}:${getBodyString(req, "email")}`,
});

export const studentLoginRateLimiter = createRateLimiter({
  name: "student-login",
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: "로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const classCode = getBodyString(req, "classCode").toUpperCase();
    const studentNumber = getBodyString(req, "studentNumber");

    return classCode && studentNumber
      ? `${classCode}:${studentNumber}`
      : getClientIp(req);
  },
});

export const teacherRegisterRateLimiter = createRateLimiter({
  name: "teacher-register",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "가입 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: getClientIp,
});

export const teacherPasswordChangeRateLimiter = createRateLimiter({
  name: "teacher-password-change",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "비밀번호 변경 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const authUser = (req as Request & { user?: { userId?: number } }).user;
    return authUser?.userId ? `teacher:${authUser.userId}` : getClientIp(req);
  },
});

export const topicAiRateLimiter = createRateLimiter({
  name: "topic-ai",
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "AI 주제 생성 시도가 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const authUser = (req as Request & { user?: { userId?: number } }).user;
    return authUser?.userId ? `teacher:${authUser.userId}` : getClientIp(req);
  },
});

export const feedbackDraftRateLimiter = createRateLimiter({
  name: "feedback-draft-ai",
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: "AI 피드백 생성 시도가 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const authUser = (req as Request & { user?: { userId?: number } }).user;
    return authUser?.userId ? `teacher:${authUser.userId}` : getClientIp(req);
  },
});

export const bulkFeedbackDraftRateLimiter = createRateLimiter({
  name: "bulk-feedback-draft-ai",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "AI 피드백 일괄 생성 시도가 많아요. 잠시 후 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const authUser = (req as Request & { user?: { userId?: number } }).user;
    return authUser?.userId ? `teacher:${authUser.userId}` : getClientIp(req);
  },
});

export const uploadRateLimiter = createRateLimiter({
  name: "student-upload",
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "업로드 시도가 많아요. 잠시 뒤 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const authUser = (req as Request & { user?: { userId?: number } }).user;
    return authUser?.userId ? `student:${authUser.userId}` : getClientIp(req);
  },
});

export const teacherBulkUploadRateLimiter = createRateLimiter({
  name: "teacher-bulk-upload",
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: "교사 일괄 업로드 시도가 많아요. 잠시 후 다시 시도해 주세요.",
  keyGenerator: (req) => {
    const authUser = (req as Request & { user?: { userId?: number } }).user;
    return authUser?.userId ? `teacher:${authUser.userId}` : getClientIp(req);
  },
});
