import path from "path";
import { Response } from "express";
import { InputType, OcrStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

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

    if (inputType === InputType.TYPED) {
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";

      if (!content) {
        return res.status(400).json({ message: "content is required for typed submissions" });
      }

      const topic = await prisma.topic.findUnique({ where: { id: topicId } });

      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
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
        },
      });

      return res.status(201).json(submission);
    }

    if (!req.file) {
      return res.status(400).json({ message: "image file is required for photo submissions" });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const submission = await prisma.submission.create({
      data: {
        inputType,
        imageUrl: `/uploads/${path.basename(req.file.path)}`,
        content: null,
        ocrStatus: OcrStatus.NONE,
        ocrError: null,
        extractedText: null,
        aiFeedback: null,
        topicId,
        studentId: req.user.userId,
      },
    });

    return res.status(201).json(submission);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create submission", error });
  }
}

export async function getSubmissions(req: AuthRequest, res: Response) {
  try {
    const submissions = await prisma.submission.findMany({
      where: req.user?.role === "TEACHER" ? undefined : { studentId: req.user?.userId },
      include: {
        student: {
          select: { id: true, name: true, email: true, grade: true },
        },
        topic: {
          select: { id: true, title: true, grade: true },
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
          select: { id: true, title: true, description: true, grade: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (req.user?.role !== "TEACHER" && submission.studentId !== req.user?.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(submission);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load submission", error });
  }
}

export async function updateFeedback(req: AuthRequest, res: Response) {
  try {
    const submissionId = Number(req.params.id);
    const { finalFeedback } = req.body;

    if (!finalFeedback) {
      return res.status(400).json({ message: "finalFeedback is required" });
    }

    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
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
