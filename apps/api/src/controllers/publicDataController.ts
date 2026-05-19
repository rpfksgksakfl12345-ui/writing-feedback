import { Response } from "express";
import {
  NeisApiError,
  NeisConfigurationError,
  searchNeisSchools,
} from "../services/neis";
import { AuthRequest } from "../types";

function getNeisErrorLogDetails(error: NeisApiError) {
  return [
    `service=${error.serviceName ?? "unknown"}`,
    error.code ? `code=${error.code}` : "",
    error.statusCode ? `status=${error.statusCode}` : "",
    `message=${error.message}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function searchSchools(req: AuthRequest, res: Response) {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";

  if (keyword.length < 2) {
    return res.status(400).json({ message: "학교명을 두 글자 이상 입력해 주세요." });
  }

  try {
    const schools = await searchNeisSchools(keyword);
    return res.json({ schools });
  } catch (error) {
    if (error instanceof NeisConfigurationError) {
      console.error(
        `[public-data.neis.schools] missing_key teacherId=${req.user?.userId ?? "unknown"} keywordLength=${keyword.length}`,
      );
      return res.status(503).json({ message: "NEIS_API_KEY is not configured" });
    }

    if (error instanceof NeisApiError) {
      console.error(
        `[public-data.neis.schools] neis_error teacherId=${req.user?.userId ?? "unknown"} keywordLength=${keyword.length} ${getNeisErrorLogDetails(error)}`,
      );
      return res.status(502).json({ message: "NEIS 학교 정보를 불러오지 못했습니다." });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[public-data.neis.schools] unexpected_error teacherId=${req.user?.userId ?? "unknown"} keywordLength=${keyword.length} message=${message}`,
    );
    return res.status(500).json({ message: "학교 검색 중 문제가 발생했습니다." });
  }
}
