import { randomBytes } from "crypto";
import { Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../services/prisma";
import { hashPassword } from "../services/auth";
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

function createClassroomLoginPassword() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function createInternalStudentEmail(classroomId: number, studentNumber: number) {
  const suffix = randomBytes(4).toString("hex");
  return `student-${classroomId}-${studentNumber}-${suffix}@classroom.local`;
}

function toStudentRosterItem(studentProfile: {
  id: number;
  userId: number;
  studentNumber: number;
  classroomLoginPassword: string;
  createdAt: Date;
  user: {
    name: string;
    grade: number | null;
  };
}) {
  return {
    id: studentProfile.id,
    userId: studentProfile.userId,
    name: studentProfile.user.name,
    grade: studentProfile.user.grade,
    studentNumber: studentProfile.studentNumber,
    classroomLoginPassword: studentProfile.classroomLoginPassword,
    createdAt: studentProfile.createdAt,
  };
}

async function findOwnedClassroom(classroomId: number, teacherId: number) {
  return prisma.classroom.findFirst({
    where: {
      id: classroomId,
      teacherId,
    },
  });
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

export async function getClassroomStudents(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const classroomId = Number(req.params.classroomId);

    if (!Number.isInteger(classroomId) || classroomId < 1) {
      return res.status(400).json({ message: "Invalid classroom ID" });
    }

    const classroom = await findOwnedClassroom(classroomId, req.user.userId);

    if (!classroom) {
      return res.status(404).json({ message: "Classroom not found" });
    }

    const students = await prisma.studentProfile.findMany({
      where: { classroomId },
      include: {
        user: {
          select: {
            name: true,
            grade: true,
          },
        },
      },
      orderBy: { studentNumber: "asc" },
    });

    return res.json(students.map(toStudentRosterItem));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load students", error });
  }
}

export async function createClassroomStudent(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const classroomId = Number(req.params.classroomId);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const studentNumber = Number(req.body?.studentNumber);
    const classroomLoginPassword =
      typeof req.body?.classroomLoginPassword === "string" &&
      req.body.classroomLoginPassword.trim()
        ? req.body.classroomLoginPassword.trim()
        : createClassroomLoginPassword();

    if (!Number.isInteger(classroomId) || classroomId < 1) {
      return res.status(400).json({ message: "Invalid classroom ID" });
    }

    if (!name || !Number.isInteger(studentNumber) || studentNumber < 1) {
      return res.status(400).json({ message: "name and studentNumber are required" });
    }

    const classroom = await findOwnedClassroom(classroomId, req.user.userId);

    if (!classroom) {
      return res.status(404).json({ message: "Classroom not found" });
    }

    const existingStudentNumber = await prisma.studentProfile.findUnique({
      where: {
        classroomId_studentNumber: {
          classroomId,
          studentNumber,
        },
      },
    });

    if (existingStudentNumber) {
      return res.status(400).json({ message: "Student number already exists in this classroom" });
    }

    const studentProfile = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: createInternalStudentEmail(classroomId, studentNumber),
          password: await hashPassword(createClassroomLoginPassword()),
          name,
          role: Role.STUDENT,
          grade: classroom.grade,
        },
      });

      return tx.studentProfile.create({
        data: {
          userId: user.id,
          classroomId,
          studentNumber,
          classroomLoginPassword,
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
    });

    return res.status(201).json(toStudentRosterItem(studentProfile));
  } catch (error) {
    return res.status(500).json({ message: "Failed to create student", error });
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
