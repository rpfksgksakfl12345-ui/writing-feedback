import { Router } from "express";
import { Role } from "@prisma/client";
import { createTopic, deleteTopic, getTopic, getTopics } from "../controllers/topicsController";
import { generateTopics } from "../controllers/topicSuggestionsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";
import { topicAiRateLimiter } from "../middlewares/rateLimit";

const router = Router();

router.use(authMiddleware);
router.get("/", getTopics);
router.post("/", requireRoleMiddleware(Role.TEACHER), createTopic);
router.post("/generate", requireRoleMiddleware(Role.TEACHER), topicAiRateLimiter, generateTopics);
router.get("/:id", getTopic);
router.delete("/:id", requireRoleMiddleware(Role.TEACHER), deleteTopic);

export default router;
