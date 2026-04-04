import "dotenv/config";
import path from "path";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth";
import studentsRoutes from "./routes/students";
import submissionsRoutes from "./routes/submissions";
import topicsRoutes from "./routes/topics";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/submissions", submissionsRoutes);
app.use("/api/students", studentsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
