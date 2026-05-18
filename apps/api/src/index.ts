import "dotenv/config";
import "./config/googleCredentials";
import fs from "fs/promises";
import path from "path";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth";
import classroomsRoutes from "./routes/classrooms";
import studentsRoutes from "./routes/students";
import submissionsRoutes from "./routes/submissions";
import topicsRoutes from "./routes/topics";
import { configureTrustProxy, getAllowedOrigins, validateProductionEnv } from "./config/env";
import { ensureUploadsDirSync, resolveUploadFilePath } from "./config/uploads";
import { authMiddleware } from "./middlewares/auth";
import { prisma } from "./services/prisma";
import { AuthRequest } from "./types";

validateProductionEnv();
ensureUploadsDirSync();

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = getAllowedOrigins();

configureTrustProxy(app);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json());

app.get("/uploads/:filename", authMiddleware, async (req: AuthRequest, res) => {
  const rawFilename = req.params.filename;

  if (Array.isArray(rawFilename)) {
    return res.status(400).json({ message: "Invalid file path" });
  }

  const filename = path.basename(rawFilename);
  if (!filename || filename !== rawFilename || filename.includes("..")) {
    return res.status(400).json({ message: "Invalid file path" });
  }

  const uploadPath = `/uploads/${filename}`;
  const filePath = resolveUploadFilePath(filename);

  try {
    const submission = await prisma.submission.findFirst({
      where: { imageUrl: uploadPath },
      include: {
        classroom: {
          select: { teacherId: true },
        },
        topic: {
          select: {
            classroom: {
              select: { teacherId: true },
            },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "File not found" });
    }

    const user = req.user;
    const canAccess =
      user?.role === "STUDENT"
        ? submission.studentId === user.userId
        : user?.role === "TEACHER" &&
          (submission.classroom?.teacherId === user.userId ||
            submission.topic?.classroom?.teacherId === user.userId);

    if (!canAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await fs.access(filePath);

    return res.sendFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return res.status(404).json({ message: "File not found" });
    }

    return res.status(500).json({ message: "Failed to load file" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/classrooms", classroomsRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/submissions", submissionsRoutes);
app.use("/api/students", studentsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
