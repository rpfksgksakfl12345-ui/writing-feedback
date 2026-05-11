import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../services/prisma";
import { comparePassword, hashPassword, signToken } from "../services/auth";
import { AuthRequest } from "../types";

function toAuthUser(user: {
  id: number;
  email: string;
  name: string;
  role: Role;
  grade: number | null;
  studentProfile?: {
    classroomId: number;
    studentNumber: number;
    classroom: {
      name: string;
      classCode: string;
    };
  } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    grade: user.grade,
    studentProfile: user.studentProfile
      ? {
          classroomId: user.studentProfile.classroomId,
          classroomName: user.studentProfile.classroom.name,
          classCode: user.studentProfile.classroom.classCode,
          studentNumber: user.studentProfile.studentNumber,
        }
      : null,
  };
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, role } = req.body;
    const nextRole = role ?? Role.TEACHER;
    const configuredSignupCode = process.env.TEACHER_SIGNUP_CODE?.trim() || "";
    const providedSignupCode =
      typeof req.body?.teacherSignupCode === "string"
        ? req.body.teacherSignupCode.trim()
        : req.get("x-teacher-signup-code")?.trim() || "";

    if (!email || !password || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (nextRole !== Role.TEACHER) {
      return res.status(400).json({ message: "Only teacher registration is supported" });
    }

    if (configuredSignupCode && providedSignupCode !== configuredSignupCode) {
      return res.status(403).json({ message: "교사 가입 코드가 올바르지 않습니다." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: await hashPassword(password),
        name,
        role: Role.TEACHER,
        grade: null,
      },
    });

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    return res.status(201).json({
      token,
      user: toAuthUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register", error });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.role !== Role.TEACHER) {
      return res.status(401).json({ message: "Students must use classroom login" });
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    return res.json({
      token,
      user: toAuthUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login", error });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== Role.TEACHER) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const currentPassword =
      typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해 주세요." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "새 비밀번호는 8자 이상이어야 합니다." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user || user.role !== Role.TEACHER) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!(await comparePassword(currentPassword, user.password))) {
      return res.status(400).json({ message: "현재 비밀번호가 맞지 않습니다." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(newPassword),
      },
    });

    return res.json({ message: "비밀번호를 바꿨어요." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password", error });
  }
}

export async function studentLogin(req: Request, res: Response) {
  try {
    const classCode =
      typeof req.body?.classCode === "string" ? req.body.classCode.trim().toUpperCase() : "";
    const rawStudentNumber = Number(req.body?.studentNumber);
    const classroomLoginPassword =
      typeof req.body?.classroomLoginPassword === "string"
        ? req.body.classroomLoginPassword.trim()
        : typeof req.body?.loginPassword === "string"
          ? req.body.loginPassword.trim()
          : "";

    if (
      !classCode ||
      !Number.isInteger(rawStudentNumber) ||
      rawStudentNumber < 1 ||
      !classroomLoginPassword
    ) {
      return res.status(400).json({
        message: "classCode, studentNumber, and classroomLoginPassword are required",
      });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        studentNumber: rawStudentNumber,
        classroom: {
          classCode,
        },
      },
      include: {
        user: true,
        classroom: {
          select: {
            name: true,
            classCode: true,
          },
        },
      },
    });

    let isPasswordValid = false;
    if (studentProfile) {
      try {
        isPasswordValid = await comparePassword(
          classroomLoginPassword,
          studentProfile.classroomLoginPassword,
        );
      } catch {
        isPasswordValid = false;
      }
    }

    if (!studentProfile || studentProfile.user.role !== Role.STUDENT || !isPasswordValid) {
      return res.status(401).json({ message: "Invalid classroom login credentials" });
    }

    const token = signToken({
      userId: studentProfile.user.id,
      role: studentProfile.user.role,
      email: studentProfile.user.email,
    });

    return res.json({
      token,
      user: toAuthUser({
        ...studentProfile.user,
        studentProfile,
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login", error });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        studentProfile: {
          select: {
            classroomId: true,
            studentNumber: true,
            classroom: {
              select: {
                name: true,
                classCode: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      ...toAuthUser(user),
      createdAt: user.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load profile", error });
  }
}
