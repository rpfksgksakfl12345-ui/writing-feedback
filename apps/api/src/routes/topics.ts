import { Router } from "express";
import { Role } from "@prisma/client";
import { createTopic, deleteTopic, getTopic, getTopics } from "../controllers/topicsController";
import { generateTopics } from "../controllers/topicSuggestionsController";
import { authMiddleware, requireRoleMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);
router.get("/", getTopics);
router.post("/", requireRoleMiddleware(Role.TEACHER), createTopic);
router.post("/generate", requireRoleMiddleware(Role.TEACHER), generateTopics);
router.get("/:id", getTopic);
router.delete("/:id", requireRoleMiddleware(Role.TEACHER), deleteTopic);

export default router;
