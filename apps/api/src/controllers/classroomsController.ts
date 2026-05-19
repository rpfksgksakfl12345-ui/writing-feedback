import { randomBytes } from "crypto";
import { Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../services/prisma";
import { hashPassword } from "../services/auth";
import {
  fetchNeisSchedules,
  getNeisSchoolFromClassroom,
  NeisApiError,
  NeisConfigurationError,
  type NeisSchool,
} from "../services/neis";
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
    hasLoginPassword: Boolean(studentProfile.classroomLoginPassword),
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

class ClassroomSchoolInputError extends Error {}

function readInputString(record: Record<string, unknown>, key: keyof NeisSchool) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function getClearedSchoolData() {
  return {
    neisOfficeCode: null,
    neisOfficeName: null,
    neisSchoolCode: null,
    neisSchoolName: null,
    neisSchoolLevel: null,
    neisSchoolAddress: null,
    neisSchoolHomepage: null,
  };
}

function getSchoolDataFromRequest(
  value: unknown,
  options: { allowClear: boolean },
) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return options.allowClear ? getClearedSchoolData() : null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ClassroomSchoolInputError("Invalid school payload");
  }

  const record = value as Record<string, unknown>;
  const officeCode = readInputString(record, "officeCode");
  const officeName = readInputString(record, "officeName");
  const schoolCode = readInputString(record, "schoolCode");
  const schoolName = readInputString(record, "schoolName");

  if (!officeCode || !schoolCode || !schoolName) {
    throw new ClassroomSchoolInputError("officeCode, schoolCode, and schoolName are required");
  }

  return {
    neisOfficeCode: officeCode,
    neisOfficeName: officeName || null,
    neisSchoolCode: schoolCode,
    neisSchoolName: schoolName,
    neisSchoolLevel: readInputString(record, "schoolLevel") || null,
    neisSchoolAddress: readInputString(record, "address") || null,
    neisSchoolHomepage: readInputString(record, "homepage") || null,
  };
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
    const issuedLoginPassword =
      typeof req.body?.classroomLoginPassword === "string" &&
      req.body.classroomLoginPassword.trim()
        ? req.body.classroomLoginPassword.trim()
        : createClassroomLoginPassword();
    const classroomLoginPasswordHash = await hashPassword(issuedLoginPassword);

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
          classroomLoginPassword: classroomLoginPasswordHash,
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

    return res.status(201).json({
      ...toStudentRosterItem(studentProfile),
      issuedLoginPassword,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create student", error });
  }
}

export async function reissueClassroomStudentPassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const classroomId = Number(req.params.classroomId);
    const studentProfileId = Number(req.params.studentProfileId);

    if (!Number.isInteger(classroomId) || classroomId < 1) {
      return res.status(400).json({ message: "Invalid classroom ID" });
    }

    if (!Number.isInteger(studentProfileId) || studentProfileId < 1) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        id: studentProfileId,
        classroomId,
        classroom: {
          teacherId: req.user.userId,
        },
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

    if (!studentProfile) {
      return res.status(404).json({ message: "Student not found" });
    }

    const issuedLoginPassword = createClassroomLoginPassword();
    const classroomLoginPasswordHash = await hashPassword(issuedLoginPassword);

    const updatedStudentProfile = await prisma.studentProfile.update({
      where: { id: studentProfile.id },
      data: {
        classroomLoginPassword: classroomLoginPasswordHash,
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

    return res.json({
      ...toStudentRosterItem(updatedStudentProfile),
      issuedLoginPassword,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reissue login password", error });
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

    let schoolData: ReturnType<typeof getSchoolDataFromRequest> = null;

    try {
      schoolData = getSchoolDataFromRequest(req.body?.neisSchool, { allowClear: false });
    } catch {
      return res.status(400).json({ message: "선택한 학교 정보를 다시 확인해 주세요." });
    }

    const classroom = await prisma.classroom.create({
      data: {
        name,
        grade,
        classCode: await createUniqueClassCode(),
        teacherId: req.user.userId,
        ...(schoolData ?? {}),
      },
    });

    return res.status(201).json(classroom);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create classroom", error });
  }
}

export async function updateClassroomNeisSchool(req: AuthRequest, res: Response) {
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

    let schoolData: ReturnType<typeof getSchoolDataFromRequest>;

    try {
      schoolData = getSchoolDataFromRequest(req.body?.neisSchool, { allowClear: true });
    } catch {
      return res.status(400).json({ message: "선택한 학교 정보를 다시 확인해 주세요." });
    }

    if (!schoolData) {
      return res.status(400).json({ message: "neisSchool is required" });
    }

    const updatedClassroom = await prisma.classroom.update({
      where: { id: classroom.id },
      data: schoolData,
    });

    return res.json(updatedClassroom);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update classroom school", error });
  }
}

export async function getClassroomNeisSchedules(req: AuthRequest, res: Response) {
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

    const school = getNeisSchoolFromClassroom(classroom);

    if (!school) {
      return res.status(400).json({ message: "이 학급에 연결된 학교가 없습니다." });
    }

    const scheduleContext = await fetchNeisSchedules(school, { grade: classroom.grade });
    return res.json(scheduleContext);
  } catch (error) {
    if (error instanceof NeisConfigurationError) {
      return res.status(503).json({ message: "NEIS_API_KEY is not configured" });
    }

    if (error instanceof NeisApiError) {
      return res.status(502).json({ message: "NEIS 학사일정을 불러오지 못했습니다." });
    }

    return res.status(500).json({ message: "Failed to load NEIS schedules", error });
  }
}
