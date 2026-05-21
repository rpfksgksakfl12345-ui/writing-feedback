import { getAirQualityContext } from "./airQuality";
import {
  getPublicDataErrorLogDetails,
  PublicDataApiError,
  PublicDataConfigurationError,
} from "./publicDataCommon";
import { inferRegionalContext } from "./regionContext";
import { getSpecialDaysContext } from "./specialDays";
import { getWeatherContext } from "./weather";
import {
  fetchNeisSchedules,
  getNeisSchoolFromClassroom,
  NeisApiError,
  NeisConfigurationError,
} from "./neis";

type ClassroomForPublicData = {
  id: number;
  neisOfficeCode: string | null;
  neisOfficeName: string | null;
  neisSchoolCode: string | null;
  neisSchoolName: string | null;
  neisSchoolLevel: string | null;
  neisSchoolAddress: string | null;
  neisSchoolHomepage: string | null;
};

export type PublicDataSourceStatus = {
  source: "neis" | "special-days" | "weather" | "air-quality";
  used: boolean;
  cacheHit?: boolean;
  warning?: string;
  reason?: string;
  timedOut?: boolean;
  code?: string;
  statusCode?: number;
  summaryLength?: number;
  itemCount?: number;
};

export type TopicPublicDataContext = {
  summaryForAi: string;
  schoolContext?: {
    schoolName: string;
    officeName?: string;
    scheduleSummaryForAi: string;
  };
  response: {
    schoolContextUsed: boolean;
    schoolName?: string;
    scheduleCount?: number;
    warning?: string;
    reason?: string;
    contextUsed: boolean;
    sources: PublicDataSourceStatus[];
    regionName?: string;
  };
};

type PublicDataTaskResult = {
  statuses: PublicDataSourceStatus[];
  summaries?: string[];
  schoolContextUsed?: boolean;
  scheduleCount?: number;
  warning?: string;
  reason?: string;
};

function getNeisLogDetails(error: unknown) {
  if (error instanceof NeisConfigurationError) {
    return {
      detail: "source=neis timeout=false code=missing_key",
      status: {
        source: "neis" as const,
        used: false,
        warning: "NEIS_API_KEY is not configured",
        reason: "MISSING_KEY",
        timedOut: false,
        code: "missing_key",
      },
    };
  }

  if (error instanceof NeisApiError) {
    const detail = [
      `source=${error.serviceName ?? "neis"}`,
      `timeout=${Boolean(error.timedOut)}`,
      `code=${error.code ?? "none"}`,
      error.statusCode ? `status=${error.statusCode}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      detail,
      status: {
        source: "neis" as const,
        used: false,
        warning: "NEIS schedule lookup failed",
        timedOut: Boolean(error.timedOut),
        code: error.code,
        statusCode: error.statusCode,
      },
    };
  }

  return {
    detail: "source=neis timeout=false code=unexpected",
    status: {
      source: "neis" as const,
      used: false,
      warning: "NEIS schedule lookup failed",
      reason: "UNEXPECTED",
    },
  };
}

function getPublicDataStatus(
  source: PublicDataSourceStatus["source"],
  error: unknown,
): PublicDataSourceStatus {
  if (error instanceof PublicDataConfigurationError) {
    return {
      source,
      used: false,
      reason: "MISSING_KEY",
      code: "missing_key",
      timedOut: false,
    };
  }

  if (error instanceof PublicDataApiError) {
    return {
      source,
      used: false,
      warning: `${source} lookup failed`,
      timedOut: Boolean(error.timedOut),
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  return {
    source,
    used: false,
    warning: `${source} lookup failed`,
    reason: "UNEXPECTED",
  };
}

function logSourceStatus(params: {
  teacherId?: number;
  classroomId?: number | null;
  status: PublicDataSourceStatus;
}) {
  const level = params.status.used || params.status.reason === "MISSING_KEY" ? "info" : "warn";
  const message = [
    `[topics.publicData] teacherId=${params.teacherId ?? "unknown"}`,
    `classroomId=${params.classroomId ?? "none"}`,
    `source=${params.status.source}`,
    `used=${params.status.used}`,
    `cacheHit=${Boolean(params.status.cacheHit)}`,
    `timeout=${Boolean(params.status.timedOut)}`,
    `code=${params.status.code ?? "none"}`,
    params.status.statusCode ? `status=${params.status.statusCode}` : "",
    params.status.reason ? `reason=${params.status.reason}` : "",
    params.status.summaryLength !== undefined ? `summaryLength=${params.status.summaryLength}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}

function combineSummaries(values: string[]) {
  const summaries = values.map((value) => value.trim()).filter(Boolean);

  if (summaries.length === 0) {
    return "";
  }

  return summaries.join("\n\n").slice(0, 2400);
}

export async function buildTopicPublicDataContext(params: {
  classroom?: ClassroomForPublicData | null;
  grade: number;
  teacherId?: number;
}): Promise<TopicPublicDataContext> {
  const taskResults: PublicDataTaskResult[] = [];
  const tasks: Promise<PublicDataTaskResult>[] = [];
  let schoolName: string | undefined;
  let scheduleCount: number | undefined;
  let schoolContextUsed = false;
  let warning: string | undefined;
  let reason: string | undefined;

  const classroomId = params.classroom?.id ?? null;
  const school = params.classroom ? getNeisSchoolFromClassroom(params.classroom) : null;
  const region = params.classroom ? inferRegionalContext(params.classroom) : null;

  if (school) {
    schoolName = school.schoolName;

    tasks.push(
      (async () => {
        try {
          const scheduleContext = await fetchNeisSchedules(school, { grade: params.grade });
          const status: PublicDataSourceStatus = {
            source: "neis",
            used: true,
            cacheHit: false,
            itemCount: scheduleContext.schedules.length,
            summaryLength: scheduleContext.summaryForAi.length,
          };
          logSourceStatus({ teacherId: params.teacherId, classroomId, status });
          return {
            statuses: [status],
            summaries: [scheduleContext.summaryForAi],
            schoolContextUsed: true,
            scheduleCount: scheduleContext.schedules.length,
          };
        } catch (error) {
          const { detail, status } = getNeisLogDetails(error);
          console.warn(
            `[topics.publicData] teacherId=${params.teacherId ?? "unknown"} classroomId=${
              classroomId ?? "none"
            } ${detail}`,
          );
          return { statuses: [status], warning: status.warning };
        }
      })(),
    );
  } else if (params.classroom) {
    reason = "NO_CONNECTED_SCHOOL";
    const status: PublicDataSourceStatus = {
      source: "neis",
      used: false,
      reason,
    };
    logSourceStatus({ teacherId: params.teacherId, classroomId, status });
    taskResults.push({ statuses: [status], reason });
  }

  tasks.push(
    (async () => {
      try {
        const { value, cacheHit } = await getSpecialDaysContext();
        const status: PublicDataSourceStatus = {
          source: "special-days",
          used: Boolean(value.summaryForAi),
          cacheHit,
          itemCount: value.itemCount,
          summaryLength: value.summaryForAi.length,
          reason: value.summaryForAi ? undefined : "NO_RELEVANT_DATA",
        };
        logSourceStatus({ teacherId: params.teacherId, classroomId, status });
        return { statuses: [status], summaries: [value.summaryForAi] };
      } catch (error) {
        const status = getPublicDataStatus("special-days", error);
        logSourceStatus({ teacherId: params.teacherId, classroomId, status });
        console.info(`[topics.publicData] ${getPublicDataErrorLogDetails(error)}`);
        return { statuses: [status] };
      }
    })(),
  );

  if (region) {
    for (const [source, fetcher] of [
      ["weather", getWeatherContext],
      ["air-quality", getAirQualityContext],
    ] as const) {
      tasks.push(
        (async () => {
          try {
            const { value, cacheHit } = await fetcher(region);
            const status: PublicDataSourceStatus = {
              source,
              used: Boolean(value.summaryForAi),
              cacheHit,
              itemCount: value.itemCount,
              summaryLength: value.summaryForAi.length,
              reason: value.summaryForAi ? undefined : "NO_RELEVANT_DATA",
            };
            logSourceStatus({ teacherId: params.teacherId, classroomId, status });
            return { statuses: [status], summaries: [value.summaryForAi] };
          } catch (error) {
            const status = getPublicDataStatus(source, error);
            logSourceStatus({ teacherId: params.teacherId, classroomId, status });
            console.info(`[topics.publicData] ${getPublicDataErrorLogDetails(error)}`);
            return { statuses: [status] };
          }
        })(),
      );
    }
  } else if (params.classroom) {
    for (const source of ["weather", "air-quality"] as const) {
      const status: PublicDataSourceStatus = {
        source,
        used: false,
        reason: "NO_REGION",
      };
      logSourceStatus({ teacherId: params.teacherId, classroomId, status });
      taskResults.push({ statuses: [status] });
    }
  }

  taskResults.push(...(await Promise.all(tasks)));

  const statuses = taskResults.flatMap((result) => result.statuses);
  const summaries = taskResults.flatMap((result) => result.summaries ?? []);

  for (const result of taskResults) {
    if (result.schoolContextUsed) {
      schoolContextUsed = true;
    }

    if (result.scheduleCount !== undefined) {
      scheduleCount = result.scheduleCount;
    }

    warning = warning ?? result.warning;
    reason = reason ?? result.reason;
  }

  const summaryForAi = combineSummaries(summaries);
  const firstFailedStatus = statuses.find((status) => status.warning);

  return {
    summaryForAi,
    schoolContext: summaryForAi
      ? {
          schoolName: schoolName ?? "",
          officeName: school?.officeName,
          scheduleSummaryForAi: summaryForAi,
        }
      : undefined,
    response: {
      schoolContextUsed,
      schoolName,
      scheduleCount,
      warning: warning ?? firstFailedStatus?.warning,
      reason,
      contextUsed: Boolean(summaryForAi),
      sources: statuses,
      regionName: region?.sidoName,
    },
  };
}
