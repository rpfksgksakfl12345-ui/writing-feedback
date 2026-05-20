import { getCachedPublicData } from "./publicDataCache";
import {
  appendPublicDataParams,
  fetchPublicDataJson,
  PublicDataApiError,
  PublicDataConfigurationError,
  readPublicDataApiKey,
} from "./publicDataCommon";
import { RegionalContext } from "./regionContext";

const SOURCE = "weather";
const KMA_BASE_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
const KOREA_TIME_ZONE = "Asia/Seoul";
const WEATHER_TTL_MS = 2 * 60 * 60 * 1000;
const WEATHER_NEGATIVE_TTL_MS = 20 * 60 * 1000;
const BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"];

type KmaForecastItem = {
  baseDate?: string;
  baseTime?: string;
  category?: string;
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
};

type KmaResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: KmaForecastItem[] | KmaForecastItem;
      };
    };
  };
};

type WeatherContext = {
  summaryForAi: string;
  itemCount: number;
};

function getKoreaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
  };
}

function formatYmd(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function getForecastBase() {
  const { year, month, day, hour } = getKoreaParts();
  const todayUtc = Date.UTC(year, month - 1, day);
  const availableHour = hour - 2;
  const baseTime = [...BASE_TIMES]
    .reverse()
    .find((time) => Number(time.slice(0, 2)) <= availableHour);

  if (baseTime) {
    return { baseDate: formatYmd(new Date(todayUtc)), baseTime };
  }

  return { baseDate: formatYmd(new Date(todayUtc - 24 * 60 * 60 * 1000)), baseTime: "2300" };
}

function normalizeItems(payload: KmaResponse) {
  const header = payload.response?.header;

  if (header?.resultCode && header.resultCode !== "00") {
    throw new PublicDataApiError(SOURCE, header.resultMsg || "KMA forecast request failed", {
      code: header.resultCode,
    });
  }

  const item = payload.response?.body?.items?.item;

  if (!item) {
    return [];
  }

  return Array.isArray(item) ? item : [item];
}

function weatherLabel(category: string, value: string) {
  if (category === "PTY") {
    switch (value) {
      case "1":
        return "비";
      case "2":
        return "비 또는 눈";
      case "3":
        return "눈";
      case "4":
        return "소나기";
      default:
        return "";
    }
  }

  if (category === "SKY") {
    switch (value) {
      case "1":
        return "맑음";
      case "3":
        return "구름 많음";
      case "4":
        return "흐림";
      default:
        return "";
    }
  }

  return value;
}

function pickForecast(items: KmaForecastItem[], dayOffset: 0 | 1) {
  const { year, month, day } = getKoreaParts();
  const targetDate = formatYmd(new Date(Date.UTC(year, month - 1, day + dayOffset)));
  const targetItems = items.filter((item) => item.fcstDate === targetDate);

  if (targetItems.length === 0) {
    return null;
  }

  const byCategory = new Map<string, KmaForecastItem>();

  for (const item of targetItems) {
    if (item.category && !byCategory.has(item.category)) {
      byCategory.set(item.category, item);
    }
  }

  return {
    sky: byCategory.get("SKY")?.fcstValue
      ? weatherLabel("SKY", String(byCategory.get("SKY")?.fcstValue))
      : "",
    precipitation: byCategory.get("PTY")?.fcstValue
      ? weatherLabel("PTY", String(byCategory.get("PTY")?.fcstValue))
      : "",
    rainChance: byCategory.get("POP")?.fcstValue ?? "",
    temperature: byCategory.get("TMP")?.fcstValue ?? byCategory.get("TMX")?.fcstValue ?? "",
  };
}

function describeForecast(
  label: string,
  forecast: ReturnType<typeof pickForecast>,
  region: RegionalContext,
) {
  if (!forecast) {
    return "";
  }

  const fragments = [
    forecast.precipitation ? `${forecast.precipitation} 가능성` : "",
    forecast.sky,
    forecast.rainChance ? `강수확률 ${forecast.rainChance}%` : "",
    forecast.temperature ? `기온 약 ${forecast.temperature}도` : "",
  ].filter(Boolean);

  if (fragments.length === 0) {
    return "";
  }

  return `- ${label} ${region.sidoName} 지역 기준 날씨는 ${fragments.join(
    ", ",
  )}. 정확한 학교 지점 날씨로 단정하지 말고 등굣길, 창밖 관찰, 쉬는 시간, 날씨가 기분과 활동에 준 영향 정도로 약하게 활용 가능.`;
}

function buildSummary(items: KmaForecastItem[], region: RegionalContext): WeatherContext {
  const lines = [
    describeForecast("오늘", pickForecast(items, 0), region),
    describeForecast("내일", pickForecast(items, 1), region),
  ].filter(Boolean);

  if (lines.length === 0) {
    return { summaryForAi: "", itemCount: 0 };
  }

  return {
    itemCount: lines.length,
    summaryForAi: ["날씨 맥락:", ...lines].join("\n"),
  };
}

export async function getWeatherContext(region: RegionalContext) {
  const apiKey = readPublicDataApiKey("KMA_FORECAST_API_KEY");

  if (!apiKey) {
    throw new PublicDataConfigurationError(SOURCE);
  }

  const { baseDate, baseTime } = getForecastBase();
  const cacheKey = `${SOURCE}:${region.sidoName}:${baseDate}:${baseTime}:${region.nx}:${region.ny}`;

  return getCachedPublicData(cacheKey, WEATHER_TTL_MS, async () => {
    try {
      const url = new URL(`${KMA_BASE_URL}/getVilageFcst`);
      appendPublicDataParams(url, {
        ServiceKey: apiKey,
        pageNo: 1,
        numOfRows: 250,
        dataType: "JSON",
        base_date: baseDate,
        base_time: baseTime,
        nx: region.nx,
        ny: region.ny,
      });

      const payload = await fetchPublicDataJson<KmaResponse>(SOURCE, url);
      return buildSummary(normalizeItems(payload), region);
    } catch (error) {
      if (error instanceof PublicDataApiError) {
        throw error;
      }

      throw new PublicDataApiError(SOURCE, "Weather context failed");
    }
  }).catch(async (error) => {
    if (error instanceof PublicDataApiError) {
      await getCachedPublicData(`${SOURCE}:negative:${region.sidoName}`, WEATHER_NEGATIVE_TTL_MS, async () => null);
    }

    throw error;
  });
}
