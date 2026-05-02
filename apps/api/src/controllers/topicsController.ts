import { Response } from "express";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

async function getStudentClassroomId(userId: number) {
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { classroomId: true },
  });

  return studentProfile?.classroomId ?? null;
}

export async function getTopics(req: AuthRequest, res: Response) {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const classroomId = req.query.classroomId ? Number(req.query.classroomId) : undefined;
    const where: {
      grade?: number;
      classroomId?: number;
      OR?: Array<{ classroomId: number | null } | { teacherId: number }>;
    } = {};

    if (grade) {
      where.grade = grade;
    }

    if (req.user?.role === "STUDENT" && req.user.userId) {
      const studentClassroomId = await getStudentClassroomId(req.user.userId);
      where.OR = studentClassroomId
        ? [{ classroomId: studentClassroomId }, { classroomId: null }]
        : [{ classroomId: null }];
    } else if (req.user?.role === "TEACHER" && classroomId) {
      if (!Number.isInteger(classroomId) || classroomId < 1 || !req.user?.userId) {
        return res.status(400).json({ message: "Invalid classroom ID" });
      }

      const classroom = await prisma.classroom.findFirst({
        where: {
          id: classroomId,
          teacherId: req.user.userId,
        },
        select: { id: true },
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      where.classroomId = classroomId;
    } else if (req.user?.role === "TEACHER" && req.user.userId) {
      where.OR = [{ classroomId: null }, { teacherId: req.user.userId }];
    }

    const topics = await prisma.topic.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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

    if (req.user?.role === "STUDENT" && req.user.userId) {
      const studentClassroomId = await getStudentClassroomId(req.user.userId);

      if (topic.classroomId && topic.classroomId !== studentClassroomId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    } else if (
      req.user?.role === "TEACHER" &&
      topic.classroomId &&
      topic.teacherId !== req.user.userId
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(topic);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load topic", error });
  }
}

export async function createTopic(req: AuthRequest, res: Response) {
  try {
    const { title, description, grade } = req.body;
    const classroomId = req.body?.classroomId ? Number(req.body.classroomId) : null;

    if (!title || !grade || !req.user?.userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (classroomId) {
      if (!Number.isInteger(classroomId) || classroomId < 1) {
        return res.status(400).json({ message: "Invalid classroom ID" });
      }

      const classroom = await prisma.classroom.findFirst({
        where: {
          id: classroomId,
          teacherId: req.user.userId,
        },
        select: { id: true },
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }
    }

    const topic = await prisma.topic.create({
      data: {
        title,
        description,
        grade: Number(grade),
        teacherId: req.user.userId,
        classroomId,
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
