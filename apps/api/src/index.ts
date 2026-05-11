import "dotenv/config";
import path from "path";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth";
import classroomsRoutes from "./routes/classrooms";
import studentsRoutes from "./routes/students";
import submissionsRoutes from "./routes/submissions";
import topicsRoutes from "./routes/topics";

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

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
