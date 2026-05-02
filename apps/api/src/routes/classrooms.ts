import { Router } from "express";
import { Role } from "@prisma/client";
import { createClassroom, getClassrooms } from "../controllers/classroomsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware, requireRoleMiddleware(Role.TEACHER));
router.get("/", getClassrooms);
router.post("/", createClassroom);

export default router;
