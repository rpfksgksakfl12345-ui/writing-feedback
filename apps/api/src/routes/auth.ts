import { Router } from "express";
import { changePassword, login, me, register, studentLogin } from "../controllers/authController";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/student-login", studentLogin);
router.get("/me", authMiddleware, me);
router.patch("/password", authMiddleware, changePassword);

export default router;
