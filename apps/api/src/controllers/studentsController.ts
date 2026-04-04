import { Response } from "express";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

export async function getStudentSubmissions(req: AuthRequest, res: Response) {
  try {
    const studentId = Number(req.params.studentId);
    const submissions = await prisma.submission.findMany({
      where: { studentId },
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
