import { Router } from "express";
import { Role } from "@prisma/client";
import { searchSchools } from "../controllers/publicDataController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";
import { neisLookupRateLimiter } from "../middlewares/rateLimit";

const router = Router();

router.use(authMiddleware, requireRoleMiddleware(Role.TEACHER));
router.get("/neis/schools", neisLookupRateLimiter, searchSchools);

export default router;
