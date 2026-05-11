import { Response } from "express";
import { generateTopicSuggestions, type TopicSuggestionInput } from "../services/topicSuggestion";
import { AuthRequest } from "../types";

export async function generateTopics(req: AuthRequest, res: Response) {
  const grade = Number(req.body?.grade);
  const teacherFeedback =
    typeof req.body?.teacherFeedback === "string" ? req.body.teacherFeedback.trim() : "";
  const previousSuggestions = Array.isArray(req.body?.previousSuggestions)
    ? (req.body.previousSuggestions.filter(
        (value: unknown) =>
          typeof value === "string" ||
          (typeof value === "object" && value !== null && !Array.isArray(value)),
      ) as TopicSuggestionInput[])
    : undefined;

  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    return res.status(400).json({ message: "1학년부터 6학년까지의 학년을 선택해 주세요." });
  }

  try {
    console.info(
      `[topics.generate] teacherId=${req.user?.userId ?? "unknown"} grade=${grade} refinement=${Boolean(
        teacherFeedback,
      )}`,
    );
    const topics = await generateTopicSuggestions(grade, {
      teacherFeedback,
      previousSuggestions,
    });
    return res.json({ topics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[topics.generate] failed teacherId=${req.user?.userId ?? "unknown"} grade=${grade} message=${message}`,
    );
    return res.status(500).json({
      message: "AI 주제 추천에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}
