import { Response } from "express";
import {
  NeisApiError,
  NeisConfigurationError,
  searchNeisSchools,
} from "../services/neis";
import { AuthRequest } from "../types";

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
      return res.status(503).json({ message: "NEIS_API_KEY is not configured" });
    }

    if (error instanceof NeisApiError) {
      return res.status(502).json({ message: "NEIS 학교 정보를 불러오지 못했습니다." });
    }

    return res.status(500).json({ message: "학교 검색 중 문제가 발생했습니다." });
  }
}
