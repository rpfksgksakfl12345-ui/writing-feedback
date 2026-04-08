import { Response } from "express";
import { prisma } from "../services/prisma";
import { generateFeedbackDraft } from "../services/feedbackDraft";
import { AuthRequest } from "../types";

export async function createFeedbackDraft(req: AuthRequest, res: Response) {
  const submissionId = Number(req.params.id);

  if (!Number.isInteger(submissionId) || submissionId < 1) {
    return res.status(400).json({ message: "올바른 제출물 ID가 아닙니다." });
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: true,
        topic: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "제출물을 찾을 수 없습니다." });
    }

    const draft = await generateFeedbackDraft({
      grade: submission.student.grade,
      topicTitle: submission.topic.title,
      topicDescription: submission.topic.description,
      studentName: submission.student.name,
      submissionText: submission.content,
      ocrText: submission.ocrText,
    });

    return res.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[feedback.draft] failed teacherId=${req.user?.userId ?? "unknown"} submissionId=${submissionId} message=${message}`,
    );

    return res.status(500).json({
      message: "AI 피드백 초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}
