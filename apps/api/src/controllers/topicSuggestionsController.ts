import { Response } from "express";
import { buildTopicPublicDataContext } from "../services/publicDataContext";
import { prisma } from "../services/prisma";
import {
  generateTopicGuide as generateSelectedTopicGuide,
  generateTopicSuggestions,
  type TopicSuggestionInput,
} from "../services/topicSuggestion";
import { AuthRequest } from "../types";

export async function generateTopics(req: AuthRequest, res: Response) {
  const grade = Number(req.body?.grade);
  const requestedClassroomId = req.body?.classroomId ? Number(req.body.classroomId) : null;
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

  if (
    requestedClassroomId !== null &&
    (!Number.isInteger(requestedClassroomId) || requestedClassroomId < 1)
  ) {
    return res.status(400).json({ message: "Invalid classroom ID" });
  }

  try {
    let classroom: Awaited<ReturnType<typeof prisma.classroom.findFirst>> | null | undefined;

    if (requestedClassroomId && req.user?.userId) {
      classroom = await prisma.classroom.findFirst({
        where: {
          id: requestedClassroomId,
          teacherId: req.user.userId,
        },
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }
    }

    const publicDataContext = await buildTopicPublicDataContext({
      classroom,
      grade,
      teacherId: req.user?.userId,
      includeOptionalSources: false,
      maxSummaryLength: 1600,
    });

    console.info(
      `[topics.generate] teacherId=${req.user?.userId ?? "unknown"} grade=${grade} classroomId=${
        requestedClassroomId ?? "none"
      } publicData=${publicDataContext.response.contextUsed} refinement=${Boolean(
        teacherFeedback,
      )}`,
    );

    const topics = await generateTopicSuggestions(grade, {
      teacherFeedback,
      previousSuggestions,
      schoolContext: publicDataContext.schoolContext,
    });

    return res.json({ topics, publicData: publicDataContext.response });
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

export async function generateTopicGuide(req: AuthRequest, res: Response) {
  const grade = Number(req.body?.grade);
  const requestedClassroomId = req.body?.classroomId ? Number(req.body.classroomId) : null;
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const shortGuide =
    typeof req.body?.shortGuide === "string" ? req.body.shortGuide.trim() : "";

  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    return res.status(400).json({ message: "1학년부터 6학년까지 학년을 선택해 주세요." });
  }

  if (!title) {
    return res.status(400).json({ message: "상세 안내를 만들 주제 제목이 필요합니다." });
  }

  if (
    requestedClassroomId !== null &&
    (!Number.isInteger(requestedClassroomId) || requestedClassroomId < 1)
  ) {
    return res.status(400).json({ message: "Invalid classroom ID" });
  }

  try {
    if (requestedClassroomId && req.user?.userId) {
      const classroom = await prisma.classroom.findFirst({
        where: {
          id: requestedClassroomId,
          teacherId: req.user.userId,
        },
        select: {
          id: true,
        },
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }
    }

    console.info(
      `[topics.generateGuide] teacherId=${req.user?.userId ?? "unknown"} grade=${grade} classroomId=${
        requestedClassroomId ?? "none"
      }`,
    );

    const studentGuide = await generateSelectedTopicGuide(grade, { title, shortGuide });

    return res.json({ studentGuide });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[topics.generateGuide] failed teacherId=${
        req.user?.userId ?? "unknown"
      } grade=${grade} message=${message}`,
    );
    return res.status(500).json({
      message: "AI 학생 안내문 생성에 실패했습니다. 짧은 안내문을 그대로 사용하거나 직접 수정해 주세요.",
    });
  }
}
