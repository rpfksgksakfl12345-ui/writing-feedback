import { Router } from "express";
import { Role } from "@prisma/client";
import { getStudentSubmissions } from "../controllers/studentsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware, requireRoleMiddleware(Role.TEACHER));
router.get("/:studentId/submissions", getStudentSubmissions);

export default router;
