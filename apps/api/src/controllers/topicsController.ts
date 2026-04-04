import { Response } from "express";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

export async function getTopics(req: AuthRequest, res: Response) {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const topics = await prisma.topic.findMany({
      where: grade ? { grade } : undefined,
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(topics);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load topics", error });
  }
}

export async function getTopic(req: AuthRequest, res: Response) {
  try {
    const topic = await prisma.topic.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    return res.json(topic);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load topic", error });
  }
}

export async function createTopic(req: AuthRequest, res: Response) {
  try {
    const { title, description, grade } = req.body;

    if (!title || !grade || !req.user?.userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const topic = await prisma.topic.create({
      data: {
        title,
        description,
        grade: Number(grade),
        teacherId: req.user.userId,
      },
    });

    return res.status(201).json(topic);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create topic", error });
  }
}

export async function deleteTopic(req: AuthRequest, res: Response) {
  try {
    const topicId = Number(req.params.id);
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    if (topic.teacherId !== req.user?.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.topic.delete({ where: { id: topicId } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete topic", error });
  }
}
