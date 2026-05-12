import fs from "fs/promises";
import path from "path";
import { Response } from "express";
import { InputType, OcrStatus } from "@prisma/client";
import { prisma } from "../services/prisma";
import { runSubmissionOcr } from "../services/photoOcr";
import {
  flattenFeedbackDraft,
  generateBulkFeedbackDrafts,
  getBulkFeedbackChunkSize,
} from "../services/feedbackDraft";
import { AuthRequest } from "../types";

export const teacherBulkUploadMaxFiles = 30;

type BulkUploadEntry = {
  studentId: number;
  file: Express.Multer.File;
};

type StudentProfileForBulk = {
  userId: number;
  studentNumber: number;
  user: {
    name: string;
    grade: number | null;
  };
};

function getPreferredSubmissionText(submission: {
  inputType: InputType;
  content: string | null;
  editedExtractedText: string | null;
  ocrExtractedText: string | null;
  extractedText: string | null;
}) {
  if (submission.inputType === InputType.TYPED) {
    return submission.content?.trim() || "";
  }

  return (
    submission.editedExtractedText?.trim() ||
    submission.ocrExtractedText?.trim() ||
    submission.extractedText?.trim() ||
    ""
  );
}

function hasSavedFeedback(submission: {
  aiFeedback: string | null;
  finalFeedback: string | null;
}) {
  return Boolean(submission.finalFeedback?.trim() || submission.aiFeedback?.trim());
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getStudentIdFromFieldName(fieldName: string) {
  const match = /^studentFile-(\d+)$/.exec(fieldName);

  if (!match) {
    return null;
  }

  const studentId = Number(match[1]);
  return Number.isInteger(studentId) && studentId > 0 ? studentId : null;
}

async function removeUnusedUpload(file: Express.Multer.File) {
  try {
    await fs.unlink(file.path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown unlink error";
    console.warn(`[bulk-upload] failed to remove unused upload path=${file.path} message=${message}`);
  }
}

function getStudentLabel(student?: StudentProfileForBulk) {
  if (!student) {
    return undefined;
  }

  return `${student.studentNumber}번 ${student.user.name}`;
}

async function findOwnedTopic(topicId: number, teacherId: number) {
  return prisma.topic.findFirst({
    where: {
      id: topicId,
      classroom: {
        teacherId,
      },
    },
    include: {
      classroom: {
        select: {
          id: true,
          teacherId: true,
        },
      },
    },
  });
}

export async function createBulkTeacherSubmissions(req: AuthRequest, res: Response) {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const topicId = Number(req.params.topicId);

  if (!Number.isInteger(topicId) || topicId < 1) {
    return res.status(400).json({ message: "올바른 주제 ID가 아닙니다." });
  }

  const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

  if (files.length === 0) {
    return res.status(400).json({ message: "업로드할 학생 글 사진을 선택해 주세요." });
  }

  try {
    const topic = await findOwnedTopic(topicId, req.user.userId);

    if (!topic) {
      await Promise.all(files.map(removeUnusedUpload));
      return res.status(404).json({ message: "주제를 찾을 수 없습니다." });
    }

    if (!topic.classroomId) {
      await Promise.all(files.map(removeUnusedUpload));
      return res.status(400).json({ message: "학급에 연결된 주제만 일괄 업로드할 수 있습니다." });
    }

    const created: Array<{
      studentId: number;
      studentName?: string;
      submissionId: number;
      ocrText: string;
    }> = [];
    const skipped: Array<{
      studentId: number;
      studentName?: string;
      submissionId?: number;
      reason: string;
    }> = [];
    const failed: Array<{
      studentId: number;
      studentName?: string;
      submissionId?: number;
      reason: string;
    }> = [];
    const uniqueEntries: BulkUploadEntry[] = [];
    const seenStudentIds = new Set<number>();

    for (const file of files) {
      const studentId = getStudentIdFromFieldName(file.fieldname);

      if (!studentId) {
        failed.push({ studentId: 0, reason: "학생 정보를 확인하지 못했어요." });
        await removeUnusedUpload(file);
        continue;
      }

      if (seenStudentIds.has(studentId)) {
        failed.push({ studentId, reason: "학생 한 명당 사진은 한 장만 선택해 주세요." });
        await removeUnusedUpload(file);
        continue;
      }

      seenStudentIds.add(studentId);
      uniqueEntries.push({ studentId, file });
    }

    const studentIds = uniqueEntries.map((entry) => entry.studentId);
    const studentProfiles = await prisma.studentProfile.findMany({
      where: {
        classroomId: topic.classroomId,
        userId: { in: studentIds },
      },
      include: {
        user: {
          select: {
            name: true,
            grade: true,
          },
        },
      },
    });
    const studentByUserId = new Map(
      studentProfiles.map((studentProfile) => [studentProfile.userId, studentProfile]),
    );
    const existingSubmissions = await prisma.submission.findMany({
      where: {
        topicId,
        studentId: { in: studentIds },
      },
      select: {
        id: true,
        studentId: true,
      },
    });
    const existingSubmissionByStudentId = new Map(
      existingSubmissions.map((submission) => [submission.studentId, submission.id]),
    );

    for (const entry of uniqueEntries) {
      const student = studentByUserId.get(entry.studentId);
      const studentName = getStudentLabel(student);

      if (!student) {
        failed.push({
          studentId: entry.studentId,
          reason: "이 학급 학생이 아니어서 제출물을 만들 수 없어요.",
        });
        await removeUnusedUpload(entry.file);
        continue;
      }

      const existingSubmissionId = existingSubmissionByStudentId.get(entry.studentId);

      if (existingSubmissionId) {
        skipped.push({
          studentId: entry.studentId,
          studentName,
          submissionId: existingSubmissionId,
          reason: "이미 이 주제 제출물이 있어요.",
        });
        await removeUnusedUpload(entry.file);
        continue;
      }

      try {
        const submission = await prisma.submission.create({
          data: {
            inputType: InputType.PHOTO,
            imageUrl: `/uploads/${path.basename(entry.file.path)}`,
            content: null,
            ocrStatus: OcrStatus.PROCESSING,
            ocrError: null,
            extractedText: null,
            aiFeedback: null,
            finalFeedback: null,
            topicId,
            studentId: entry.studentId,
            classroomId: topic.classroomId,
          },
        });
        const ocrResult = await runSubmissionOcr({
          submissionId: submission.id,
          imagePath: entry.file.path,
          mimeType: entry.file.mimetype || "image/jpeg",
        });

        if (ocrResult.ok) {
          created.push({
            studentId: entry.studentId,
            studentName,
            submissionId: submission.id,
            ocrText: ocrResult.extractedText,
          });
        } else {
          failed.push({
            studentId: entry.studentId,
            studentName,
            submissionId: submission.id,
            reason: "사진은 저장했지만 OCR이 글자를 읽지 못했어요. 제출물에서 사진과 오류를 확인해 주세요.",
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error(
          `[bulk-upload] failed teacherId=${req.user.userId} topicId=${topicId} studentId=${entry.studentId} message=${message}`,
        );
        failed.push({
          studentId: entry.studentId,
          studentName,
          reason: "제출물을 저장하지 못했어요.",
        });
        await removeUnusedUpload(entry.file);
      }
    }

    return res.status(201).json({ created, skipped, failed });
  } catch (error) {
    await Promise.all(files.map(removeUnusedUpload));
    return res.status(500).json({ message: "일괄 업로드에 실패했습니다.", error });
  }
}

export async function createBulkFeedbackDrafts(req: AuthRequest, res: Response) {
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const topicId = Number(req.params.topicId);

  if (!Number.isInteger(topicId) || topicId < 1) {
    return res.status(400).json({ message: "올바른 주제 ID가 아닙니다." });
  }

  try {
    const topic = await findOwnedTopic(topicId, req.user.userId);

    if (!topic) {
      return res.status(404).json({ message: "주제를 찾을 수 없습니다." });
    }

    const submissions = await prisma.submission.findMany({
      where: {
        topicId,
        topic: {
          classroom: {
            teacherId: req.user.userId,
          },
        },
      },
      include: {
        student: {
          select: {
            name: true,
            grade: true,
          },
        },
        topic: {
          select: {
            title: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const skipped: Array<{ submissionId: number; reason: string }> = [];
    const failed: Array<{ submissionId: number; reason: string }> = [];
    const generated: Array<{ submissionId: number; feedback: string }> = [];
    const targets = submissions.flatMap((submission) => {
      if (hasSavedFeedback(submission)) {
        skipped.push({
          submissionId: submission.id,
          reason: "이미 피드백 초안 또는 최종 피드백이 있어요.",
        });
        return [];
      }

      if (submission.inputType === InputType.PHOTO && submission.ocrStatus !== OcrStatus.DONE) {
        skipped.push({
          submissionId: submission.id,
          reason: "OCR이 완료된 사진 제출물만 처리할 수 있어요.",
        });
        return [];
      }

      const submissionText = getPreferredSubmissionText(submission);

      if (!submissionText) {
        skipped.push({
          submissionId: submission.id,
          reason: "피드백에 사용할 글 텍스트가 없어요.",
        });
        return [];
      }

      return [
        {
          id: submission.id,
          grade: submission.student.grade,
          studentName: submission.student.name,
          submissionText,
        },
      ];
    });
    let aiCalls = 0;

    for (const chunk of chunkArray(targets, getBulkFeedbackChunkSize())) {
      aiCalls += 1;

      try {
        const drafts = await generateBulkFeedbackDrafts({
          topicTitle: topic.title,
          topicDescription: topic.description,
          submissions: chunk.map((submission) => ({
            submissionId: submission.id,
            grade: submission.grade,
            studentName: submission.studentName,
            submissionText: submission.submissionText,
          })),
        });
        const draftBySubmissionId = new Map(
          drafts.map((draft) => [draft.submissionId, flattenFeedbackDraft(draft)]),
        );

        for (const submission of chunk) {
          const feedback = draftBySubmissionId.get(submission.id)?.trim();

          if (!feedback) {
            failed.push({
              submissionId: submission.id,
              reason: "AI 응답에서 이 제출물의 피드백을 확인하지 못했어요.",
            });
            continue;
          }

          await prisma.submission.update({
            where: { id: submission.id },
            data: {
              aiFeedback: feedback,
            },
          });
          generated.push({ submissionId: submission.id, feedback });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error(
          `[bulk-feedback] failed teacherId=${req.user.userId} topicId=${topicId} message=${message}`,
        );

        for (const submission of chunk) {
          failed.push({
            submissionId: submission.id,
            reason: "AI 응답을 확인하지 못했어요.",
          });
        }
      }
    }

    return res.json({
      summary: {
        requested: submissions.length,
        generated: generated.length,
        skipped: skipped.length,
        failed: failed.length,
        aiCalls,
      },
      generated,
      skipped,
      failed,
    });
  } catch (error) {
    return res.status(500).json({
      message: "주제별 AI 피드백 일괄 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      error,
    });
  }
}
