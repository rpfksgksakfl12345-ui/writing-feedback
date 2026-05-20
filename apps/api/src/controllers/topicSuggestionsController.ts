import { Response } from "express";
import { generateTopicSuggestions, type TopicSuggestionInput } from "../services/topicSuggestion";
import {
  fetchNeisSchedules,
  getNeisSchoolFromClassroom,
  NeisApiError,
  NeisConfigurationError,
} from "../services/neis";
import { prisma } from "../services/prisma";
import { AuthRequest } from "../types";

function getNeisSkipLogDetails(error: unknown) {
  if (error instanceof NeisConfigurationError) {
    return "source=NEIS timeout=false code=missing_key";
  }

  if (error instanceof NeisApiError) {
    return [
      `source=${error.serviceName ?? "NEIS"}`,
      `timeout=${Boolean(error.timedOut)}`,
      `code=${error.code ?? "none"}`,
      error.statusCode ? `status=${error.statusCode}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "source=NEIS timeout=false code=unexpected";
}

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
    let schoolContext:
      | {
          schoolName: string;
          officeName?: string;
          scheduleSummaryForAi: string;
        }
      | undefined;
    let publicData:
      | {
          schoolContextUsed: boolean;
          schoolName?: string;
          scheduleCount?: number;
          warning?: string;
          reason?: string;
        }
      | undefined;

    if (requestedClassroomId && req.user?.userId) {
      const classroom = await prisma.classroom.findFirst({
        where: {
          id: requestedClassroomId,
          teacherId: req.user.userId,
        },
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      const school = getNeisSchoolFromClassroom(classroom);

      if (school) {
        try {
          const scheduleContext = await fetchNeisSchedules(school, { grade });
          schoolContext = {
            schoolName: school.schoolName,
            officeName: school.officeName,
            scheduleSummaryForAi: scheduleContext.summaryForAi,
          };
          publicData = {
            schoolContextUsed: true,
            schoolName: school.schoolName,
            scheduleCount: scheduleContext.schedules.length,
          };
        } catch (schoolContextError) {
          const warning =
            schoolContextError instanceof NeisConfigurationError
              ? "NEIS_API_KEY is not configured"
              : "NEIS schedule lookup failed";

          console.warn(
            `[topics.generate] NEIS context skipped teacherId=${req.user.userId} classroomId=${requestedClassroomId} reason=${warning} ${getNeisSkipLogDetails(
              schoolContextError,
            )}`,
          );
          publicData = {
            schoolContextUsed: false,
            schoolName: school.schoolName,
            warning,
          };
        }
      } else {
        publicData = {
          schoolContextUsed: false,
          reason: "NO_CONNECTED_SCHOOL",
        };
      }
    }

    console.info(
      `[topics.generate] teacherId=${req.user?.userId ?? "unknown"} grade=${grade} classroomId=${
        requestedClassroomId ?? "none"
      } publicData=${Boolean(schoolContext)} refinement=${Boolean(
        teacherFeedback,
      )}`,
    );
    const topics = await generateTopicSuggestions(grade, {
      teacherFeedback,
      previousSuggestions,
      schoolContext,
    });
    return res.json({ topics, publicData });
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
