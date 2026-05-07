import { Response } from "express";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

export async function getStudentSubmissions(req: AuthRequest, res: Response) {
  try {
    const studentId = Number(req.params.studentId);
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: {
        classroom: {
          select: { teacherId: true },
        },
      },
    });

    if (!studentProfile) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (studentProfile.classroom.teacherId !== req.user?.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const submissions = await prisma.submission.findMany({
      where: {
        studentId,
        OR: [
          { classroomId: studentProfile.classroomId },
          { topic: { classroomId: studentProfile.classroomId } },
        ],
      },
      include: {
        topic: {
          select: { id: true, title: true, grade: true },
        },
        student: {
          select: { id: true, name: true, email: true, grade: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(submissions);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load student submissions", error });
  }
}
