import { getCachedPublicData } from "./publicDataCache";
import {
  appendPublicDataParams,
  fetchPublicDataJson,
  PublicDataApiError,
  PublicDataConfigurationError,
  readPublicDataApiKey,
} from "./publicDataCommon";
import { RegionalContext } from "./regionContext";

const SOURCE = "air-quality";
const AIRKOREA_BASE_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc";
const AIR_QUALITY_TTL_MS = 45 * 60 * 1000;
const AIR_QUALITY_NEGATIVE_TTL_MS = 15 * 60 * 1000;

type AirKoreaItem = {
  dataTime?: string;
  stationName?: string;
  pm10Grade?: string;
  pm10Grade1h?: string;
  pm25Grade?: string;
  pm25Grade1h?: string;
  pm10Value?: string;
  pm25Value?: string;
};

type AirKoreaResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: AirKoreaItem[] | AirKoreaItem;
    };
  };
};

type AirQualityContext = {
  summaryForAi: string;
  itemCount: number;
};

function normalizeItems(payload: AirKoreaResponse) {
  const header = payload.response?.header;

  if (header?.resultCode && header.resultCode !== "00") {
    throw new PublicDataApiError(
      SOURCE,
      header.resultMsg || "AirKorea request failed",
      { code: header.resultCode },
    );
  }

  const items = payload.response?.body?.items;

  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : [items];
}

function gradeLabel(value: string | undefined) {
  switch (value) {
    case "1":
      return "좋음";
    case "2":
      return "보통";
    case "3":
      return "나쁨";
    case "4":
      return "매우 나쁨";
    default:
      return "";
  }
}

function averageGrade(items: AirKoreaItem[], field: "pm10Grade" | "pm25Grade") {
  const values = items
    .map((item) => Number(item[field] || item[`${field}1h` as keyof AirKoreaItem]))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 4);

  if (values.length === 0) {
    return "";
  }

  return String(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
}

function buildSummary(items: AirKoreaItem[], region: RegionalContext): AirQualityContext {
  if (items.length === 0) {
    return { summaryForAi: "", itemCount: 0 };
  }

  const pm10 = gradeLabel(averageGrade(items, "pm10Grade"));
  const pm25 = gradeLabel(averageGrade(items, "pm25Grade"));
  const fragments = [
    pm10 ? `미세먼지 ${pm10}` : "",
    pm25 ? `초미세먼지 ${pm25}` : "",
  ].filter(Boolean);

  if (fragments.length === 0) {
    return { summaryForAi: "", itemCount: 0 };
  }

  return {
    itemCount: items.length,
    summaryForAi: [
      "대기질 맥락:",
      `- ${region.sidoName} 지역 기준 대기질은 ${fragments.join(
        ", ",
      )} 수준일 수 있음. 정확한 학교 측정소 값으로 단정하지 말고 건강 개인정보를 묻지 않으며, 하늘 관찰, 실내외 활동 선택, 공기를 깨끗하게 하기 위한 작은 실천 정도로 1개 안팎만 약하게 활용 가능.`,
    ].join("\n"),
  };
}

export async function getAirQualityContext(region: RegionalContext) {
  const apiKey = readPublicDataApiKey("AIRKOREA_API_KEY");

  if (!apiKey) {
    throw new PublicDataConfigurationError(SOURCE);
  }

  return getCachedPublicData(
    `${SOURCE}:${region.airKoreaSidoName}`,
    AIR_QUALITY_TTL_MS,
    async () => {
      try {
        const url = new URL(`${AIRKOREA_BASE_URL}/getCtprvnRltmMesureDnsty`);
        appendPublicDataParams(url, {
          serviceKey: apiKey,
          returnType: "json",
          numOfRows: 100,
          pageNo: 1,
          sidoName: region.airKoreaSidoName,
          ver: "1.0",
        });

        const payload = await fetchPublicDataJson<AirKoreaResponse>(SOURCE, url);
        return buildSummary(normalizeItems(payload), region);
      } catch (error) {
        if (error instanceof PublicDataApiError) {
          throw error;
        }

        throw new PublicDataApiError(SOURCE, "Air quality context failed");
      }
    },
  ).catch(async (error) => {
    if (error instanceof PublicDataApiError) {
      await getCachedPublicData(
        `${SOURCE}:negative:${region.airKoreaSidoName}`,
        AIR_QUALITY_NEGATIVE_TTL_MS,
        async () => null,
      );
    }

    throw error;
  });
}
