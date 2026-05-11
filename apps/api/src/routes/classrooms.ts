import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createClassroom,
  createClassroomStudent,
  getClassrooms,
  getClassroomStudents,
  reissueClassroomStudentPassword,
} from "../controllers/classroomsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware, requireRoleMiddleware(Role.TEACHER));
router.get("/", getClassrooms);
router.post("/", createClassroom);
router.get("/:classroomId/students", getClassroomStudents);
router.post("/:classroomId/students", createClassroomStudent);
router.post("/:classroomId/students/:studentProfileId/login-password", reissueClassroomStudentPassword);

export default router;
