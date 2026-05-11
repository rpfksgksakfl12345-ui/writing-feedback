import { Router } from "express";
import { changePassword, login, me, register, studentLogin } from "../controllers/authController";
import { authMiddleware } from "../middlewares/auth";
import {
  studentLoginRateLimiter,
  teacherLoginRateLimiter,
  teacherPasswordChangeRateLimiter,
  teacherRegisterRateLimiter,
} from "../middlewares/rateLimit";

const router = Router();

router.post("/register", teacherRegisterRateLimiter, register);
router.post("/login", teacherLoginRateLimiter, login);
router.post("/student-login", studentLoginRateLimiter, studentLogin);
router.get("/me", authMiddleware, me);
router.patch("/password", authMiddleware, teacherPasswordChangeRateLimiter, changePassword);

export default router;
