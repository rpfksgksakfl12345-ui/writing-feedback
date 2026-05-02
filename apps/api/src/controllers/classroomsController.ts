import { randomBytes } from "crypto";
import { Response } from "express";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

function createClassCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

async function createUniqueClassCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const classCode = createClassCode();
    const existingClassroom = await prisma.classroom.findUnique({ where: { classCode } });

    if (!existingClassroom) {
      return classCode;
    }
  }

  throw new Error("Failed to generate unique class code");
}

export async function getClassrooms(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });

    return res.json(classrooms);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load classrooms", error });
  }
}

export async function createClassroom(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const grade = Number(req.body?.grade);

    if (!name || !Number.isInteger(grade) || grade < 1 || grade > 6) {
      return res.status(400).json({ message: "name and grade are required" });
    }

    const classroom = await prisma.classroom.create({
      data: {
        name,
        grade,
        classCode: await createUniqueClassCode(),
        teacherId: req.user.userId,
      },
    });

    return res.status(201).json(classroom);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create classroom", error });
  }
}
