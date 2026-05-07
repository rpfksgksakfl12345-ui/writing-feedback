import path from "path";
import { Response } from "express";
import { InputType, OcrStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "../services/prisma";
import { runSubmissionOcr } from "../services/photoOcr";
import { AuthRequest } from "../types";

function getMimeTypeFromImagePath(imagePath: string) {
  switch (path.extname(imagePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function normalizeSubmissionText(rawText: string | null | undefined) {
  if (!rawText) {
    return "";
  }

  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

async function resumePendingPhotoOcr(submission: {
  id: number;
  inputType: InputType;
  ocrStatus: OcrStatus;
  imageUrl: string | null;
}) {
  if (
    submission.inputType !== InputType.PHOTO ||
    submission.ocrStatus !== OcrStatus.NONE ||
    !submission.imageUrl
  ) {
    return false;
  }

  const imagePath = path.resolve(process.cwd(), "uploads", path.basename(submission.imageUrl));
  const claimedSubmission = await prisma.submission.updateMany({
    where: {
      id: submission.id,
      inputType: InputType.PHOTO,
      ocrStatus: OcrStatus.NONE,
    },
    data: {
      ocrStatus: OcrStatus.PROCESSING,
      ocrError: null,
    },
  });

  if (claimedSubmission.count === 0) {
    return false;
  }

  void runSubmissionOcr({
    submissionId: submission.id,
    imagePath,
    mimeType: getMimeTypeFromImagePath(imagePath),
  });

  return true;
}

async function getStudentClassroomId(userId: number) {
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { classroomId: true },
  });

  return studentProfile?.classroomId ?? null;
}

function isSubmissionOwnedByTeacher(
  submission: {
    classroom?: { teacherId: number } | null;
    topic?: { classroom?: { teacherId: number } | null } | null;
  },
  teacherId: number,
) {
  return (
    submission.classroom?.teacherId === teacherId ||
    submission.topic?.classroom?.teacherId === teacherId
  );
}

export async function createSubmission(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const topicId = Number(req.body.topicId);
    const inputType =
      req.body.inputType === InputType.TYPED ? InputType.TYPED : InputType.PHOTO;

    if (!topicId) {
      return res.status(400).json({ message: "topicId is required" });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const studentClassroomId = await getStudentClassroomId(req.user.userId);

    if (!studentClassroomId || topic.classroomId !== studentClassroomId) {
      return res.status(403).json({ message: "Topic is not available for this classroom" });
    }

    const existingSubmission = await prisma.submission.findFirst({
      where: {
        studentId: req.user.userId,
        topicId,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (existingSubmission) {
      return res.status(409).json({
        message: "이미 제출한 주제입니다. 책장에서 저장된 공책을 확인해 주세요.",
      });
    }

    if (inputType === InputType.TYPED) {
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";

      if (!content) {
        return res.status(400).json({ message: "content is required for typed submissions" });
      }

      const submission = await prisma.submission.create({
        data: {
          inputType,
          imageUrl: null,
          content,
          ocrStatus: OcrStatus.NONE,
          ocrError: null,
          extractedText: null,
          aiFeedback: null,
          topicId,
          studentId: req.user.userId,
          classroomId: studentClassroomId,
        },
      });

      return res.status(201).json(submission);
    }

    if (!req.file) {
      return res.status(400).json({ message: "image file is required for photo submissions" });
    }

    const submission = await prisma.submission.create({
      data: {
        inputType,
        imageUrl: `/uploads/${path.basename(req.file.path)}`,
        content: null,
        ocrStatus: OcrStatus.PROCESSING,
        ocrError: null,
        extractedText: null,
        aiFeedback: null,
        topicId,
        studentId: req.user.userId,
        classroomId: studentClassroomId,
      },
    });

    void runSubmissionOcr({
      submissionId: submission.id,
      imagePath: req.file.path,
      mimeType: req.file.mimetype || "image/jpeg",
    });

    return res.status(201).json(submission);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create submission", error });
  }
}

export async function getSubmissions(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const teacherClassroomIds =
      req.user.role === "TEACHER"
        ? (
            await prisma.classroom.findMany({
              where: { teacherId: req.user.userId },
              select: { id: true },
            })
          ).map((classroom) => classroom.id)
        : [];

    const submissions = await prisma.submission.findMany({
      where:
        req.user?.role === "TEACHER" && req.user.userId
          ? {
              OR: [
                { classroomId: { in: teacherClassroomIds } },
                {
                  topic: {
                    classroom: {
                      teacherId: req.user.userId,
                    },
                  },
                },
              ],
            }
          : { studentId: req.user?.userId },
      include: {
        student: {
          select: { id: true, name: true, email: true, grade: true },
        },
        topic: {
          select: { id: true, title: true, grade: true, classroomId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(submissions);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load submissions", error });
  }
}

export async function getSubmission(req: AuthRequest, res: Response) {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        student: {
          select: { id: true, name: true, email: true, grade: true },
        },
        topic: {
          select: {
            id: true,
            title: true,
            description: true,
            grade: true,
            teacherId: true,
            classroom: {
              select: { teacherId: true },
            },
          },
        },
        classroom: {
          select: { teacherId: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (req.user?.role === "TEACHER") {
      if (!req.user.userId || !isSubmissionOwnedByTeacher(submission, req.user.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
    } else if (submission.studentId !== req.user?.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const resumedOcr = await resumePendingPhotoOcr(submission);

    if (resumedOcr) {
      submission.ocrStatus = OcrStatus.PROCESSING;
      submission.ocrError = null;
    }

    return res.json(submission);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load submission", error });
  }
}

export async function updateExtractedText(req: AuthRequest, res: Response) {
  try {
    const submissionId = Number(req.params.id);
    const rawExtractedText = req.body?.extractedText;

    if (!Number.isInteger(submissionId) || submissionId < 1) {
      return res.status(400).json({ message: "Invalid submission ID" });
    }

    if (typeof rawExtractedText !== "string") {
      return res.status(400).json({ message: "extractedText is required" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        classroom: {
          select: { teacherId: true },
        },
        topic: {
          select: {
            classroom: {
              select: { teacherId: true },
            },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!req.user?.userId || !isSubmissionOwnedByTeacher(submission, req.user.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (submission.inputType !== InputType.PHOTO) {
      return res.status(400).json({ message: "Only photo submissions can update extracted text" });
    }

    if (submission.ocrStatus !== OcrStatus.DONE) {
      return res.status(400).json({ message: "Extracted text can be edited only after OCR completes" });
    }

    const normalizedOriginalText =
      normalizeSubmissionText(submission.ocrExtractedText) ||
      normalizeSubmissionText(submission.extractedText);
    const normalizedEditedText = normalizeSubmissionText(rawExtractedText);
    const nextEditedExtractedText =
      normalizedEditedText && normalizedEditedText !== normalizedOriginalText
        ? normalizedEditedText
        : null;
    const nextExtractedText = nextEditedExtractedText || normalizedOriginalText || null;

    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        editedExtractedText: nextEditedExtractedText,
        extractedText: nextExtractedText,
      },
    });

    return res.json(updatedSubmission);
  } catch (error) {
    return res.status(500).json({ message: "Failed to save extracted text", error });
  }
}

export async function updateFeedback(req: AuthRequest, res: Response) {
  try {
    const submissionId = Number(req.params.id);
    const { finalFeedback } = req.body;

    if (!finalFeedback) {
      return res.status(400).json({ message: "finalFeedback is required" });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        classroom: {
          select: { teacherId: true },
        },
        topic: {
          select: {
            classroom: {
              select: { teacherId: true },
            },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!req.user?.userId || !isSubmissionOwnedByTeacher(submission, req.user.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        finalFeedback,
        status: SubmissionStatus.REVIEWED,
      },
    });

    return res.json(updatedSubmission);
  } catch (error) {
    return res.status(500).json({ message: "Failed to save feedback", error });
  }
}
