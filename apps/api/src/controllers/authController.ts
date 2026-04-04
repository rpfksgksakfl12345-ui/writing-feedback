import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../services/prisma";
import { comparePassword, hashPassword, signToken } from "../services/auth";
import { AuthRequest } from "../types";

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, role, grade } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: "Missing required fields" });
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
        role: role as Role,
        grade: role === "STUDENT" ? Number(grade) || null : null,
      },
    });

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        grade: user.grade,
      },
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

    const token = signToken({ userId: user.id, role: user.role, email: user.email });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        grade: user.grade,
      },
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        grade: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load profile", error });
  }
}
