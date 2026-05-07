import { Response } from "express";
import { Prisma } from "@prisma/client";
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
    const where: Prisma.TopicWhereInput = {};

    if (grade) {
      if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
        return res.status(400).json({ message: "Invalid grade" });
      }

      where.grade = grade;
    }

    if (req.user?.role === "STUDENT" && req.user.userId) {
      const studentClassroomId = await getStudentClassroomId(req.user.userId);

      if (!studentClassroomId) {
        return res.json([]);
      }

      where.classroomId = studentClassroomId;
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
      where.classroom = { teacherId: req.user.userId };
    }

    const topics = await prisma.topic.findMany({
      where,
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
        classroom: {
          select: { teacherId: true },
        },
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

      if (!studentClassroomId || topic.classroomId !== studentClassroomId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    } else if (req.user?.role === "TEACHER") {
      if (topic.classroom?.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    return res.json(topic);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load topic", error });
  }
}

export async function createTopic(req: AuthRequest, res: Response) {
  try {
    const { title, description, grade } = req.body;
    const requestedClassroomId = req.body?.classroomId ? Number(req.body.classroomId) : null;

    if (!title || !grade || !req.user?.userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const nextGrade = Number(grade);

    if (!Number.isInteger(nextGrade) || nextGrade < 1 || nextGrade > 6) {
      return res.status(400).json({ message: "Invalid grade" });
    }

    let classroomId = requestedClassroomId;

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
    } else {
      const ownedClassrooms = await prisma.classroom.findMany({
        where: { teacherId: req.user.userId },
        select: { id: true },
        take: 2,
      });

      if (ownedClassrooms.length === 0) {
        return res.status(400).json({ message: "먼저 학급을 만들어야 주제를 등록할 수 있습니다." });
      }

      if (ownedClassrooms.length > 1) {
        return res.status(400).json({ message: "classroomId is required" });
      }

      classroomId = ownedClassrooms[0].id;
    }

    const topic = await prisma.topic.create({
      data: {
        title,
        description,
        grade: nextGrade,
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
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        classroom: {
          select: { teacherId: true },
        },
      },
    });

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    if (topic.classroom?.teacherId !== req.user?.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.topic.delete({ where: { id: topicId } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete topic", error });
  }
}
