import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createClassroom,
  createClassroomStudent,
  deleteClassroom,
  deleteClassroomStudent,
  getClassroomNeisSchedules,
  getClassrooms,
  getClassroomStudents,
  reissueClassroomStudentPassword,
  updateClassroomNeisSchool,
} from "../controllers/classroomsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware, requireRoleMiddleware(Role.TEACHER));
router.get("/", getClassrooms);
router.post("/", createClassroom);
router.patch("/:classroomId", updateClassroomNeisSchool);
router.delete("/:classroomId", deleteClassroom);
router.get("/:classroomId/neis-schedules", getClassroomNeisSchedules);
router.get("/:classroomId/students", getClassroomStudents);
router.post("/:classroomId/students", createClassroomStudent);
router.delete("/:classroomId/students/:studentProfileId", deleteClassroomStudent);
router.post("/:classroomId/students/:studentProfileId/login-password", reissueClassroomStudentPassword);

export default router;
