import { getCachedPublicData } from "./publicDataCache";
import {
  appendPublicDataParams,
  fetchPublicDataText,
  PublicDataConfigurationError,
  PublicDataApiError,
  readPublicDataApiKey,
} from "./publicDataCommon";

const SOURCE = "special-days";
const SPECIAL_DAY_BASE_URL =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService";
const KOREA_TIME_ZONE = "Asia/Seoul";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SPECIAL_DAY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const SPECIAL_DAY_NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;
const LOOK_AROUND_DAYS = 30;
const MAX_SPECIAL_DAY_LINES = 4;

type SpecialDayApiItem = {
  name: string;
  date: string;
  kind: "holiday" | "anniversary" | "solar-term";
  isHoliday?: boolean;
};

type SpecialDayContext = {
  summaryForAi: string;
  itemCount: number;
};

const operations: Array<{
  operation: string;
  kind: SpecialDayApiItem["kind"];
}> = [
  { operation: "getRestDeInfo", kind: "holiday" },
  { operation: "getAnniversaryInfo", kind: "anniversary" },
  { operation: "get24DivisionsInfo", kind: "solar-term" },
];

const excludedNamePatterns = [
  /선거/u,
  /국회의원/u,
  /대통령/u,
  /지방선거/u,
  /기독탄신/u,
  /성탄/u,
  /석가/u,
  /부처님/u,
];

const usefulAnniversaryPatterns = [
  /과학/u,
  /환경/u,
  /독서/u,
  /책/u,
  /한글/u,
  /어린이/u,
  /식목/u,
  /바다/u,
  /정보/u,
  /발명/u,
];

function getKoreaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function getKoreaTodayUtcTime() {
  const { year, month, day } = getKoreaDateParts();
  return Date.UTC(year, month - 1, day);
}

function getMonthKeysAroundToday() {
  const today = getKoreaTodayUtcTime();
  const keys = new Set<string>();

  for (const offsetDays of [-LOOK_AROUND_DAYS, 0, LOOK_AROUND_DAYS]) {
    const date = new Date(today + offsetDays * ONE_DAY_MS);
    keys.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return Array.from(keys);
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function readXmlTag(block: string, tagName: string) {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "u").exec(block);
  return match ? decodeXml(match[1]) : "";
}

function parseSpecialDayXml(xml: string, kind: SpecialDayApiItem["kind"]) {
  const resultCode = readXmlTag(xml, "resultCode");
  const resultMessage = readXmlTag(xml, "resultMsg") || readXmlTag(xml, "resultMessage");

  if (resultCode && resultCode !== "00") {
    throw new PublicDataApiError(SOURCE, resultMessage || "Special day request failed", {
      code: resultCode,
    });
  }

  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gu));

  return items.flatMap((match): SpecialDayApiItem[] => {
    const block = match[1];
    const name = readXmlTag(block, "dateName");
    const date = readXmlTag(block, "locdate");

    if (!name || !/^\d{8}$/.test(date)) {
      return [];
    }

    return [
      {
        name,
        date,
        kind,
        isHoliday: readXmlTag(block, "isHoliday") === "Y",
      },
    ];
  });
}

async function fetchSpecialDayMonth(
  apiKey: string,
  yearMonth: string,
  operation: string,
  kind: SpecialDayApiItem["kind"],
) {
  const [year, month] = yearMonth.split("-");
  const url = new URL(`${SPECIAL_DAY_BASE_URL}/${operation}`);
  appendPublicDataParams(url, {
    ServiceKey: apiKey,
    pageNo: 1,
    numOfRows: 100,
    solYear: year,
    solMonth: month,
  });

  const xml = await fetchPublicDataText(SOURCE, url);
  return parseSpecialDayXml(xml, kind);
}

function shouldUseSpecialDay(item: SpecialDayApiItem) {
  if (excludedNamePatterns.some((pattern) => pattern.test(item.name))) {
    return false;
  }

  if (item.kind === "solar-term" || item.isHoliday) {
    return true;
  }

  return usefulAnniversaryPatterns.some((pattern) => pattern.test(item.name));
}

function getRelativeDateLabel(date: string) {
  const today = getKoreaTodayUtcTime();
  const eventTime = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)));
  const diffDays = Math.round((eventTime - today) / ONE_DAY_MS);

  if (diffDays === 0) {
    return "오늘";
  }

  return diffDays > 0 ? `${diffDays}일 뒤` : `${Math.abs(diffDays)}일 전`;
}

function getWritingUse(item: SpecialDayApiItem) {
  if (item.kind === "solar-term") {
    return "계절 변화, 학교 주변 자연 관찰, 생활 속 달라진 점을 약하게 활용 가능";
  }

  if (/현충/u.test(item.name)) {
    return "훈화식 주제가 아니라 기억, 감사, 평화, 공동체 마음을 조심스럽게 다루는 정도로 활용 가능";
  }

  if (/환경/u.test(item.name)) {
    return "환경을 아끼는 행동, 우리 반이 실천할 수 있는 작은 약속으로 활용 가능";
  }

  if (/과학|발명/u.test(item.name)) {
    return "궁금한 점, 관찰, 새롭게 알게 된 사실, 상상한 발명품 주제로 활용 가능";
  }

  if (/한글|독서|책/u.test(item.name)) {
    return "좋아하는 말, 책에서 만난 장면, 글자의 소중함 같은 쓰기 주제로 활용 가능";
  }

  if (/어린이/u.test(item.name)) {
    return "가족 전제 없이 소중한 순간, 하고 싶은 일, 나를 응원하는 말로 활용 가능";
  }

  return "초등학생의 경험, 관찰, 감사, 약속과 연결될 때만 약하게 활용 가능";
}

function buildSummary(items: SpecialDayApiItem[]): SpecialDayContext {
  const today = getKoreaTodayUtcTime();
  const seen = new Set<string>();
  const selectedItems = items
    .filter((item) => {
      const eventTime = Date.UTC(Number(item.date.slice(0, 4)), Number(item.date.slice(4, 6)) - 1, Number(item.date.slice(6, 8)));
      return Math.abs(Math.round((eventTime - today) / ONE_DAY_MS)) <= LOOK_AROUND_DAYS;
    })
    .filter(shouldUseSpecialDay)
    .sort((left, right) => {
      const leftTime = Date.UTC(Number(left.date.slice(0, 4)), Number(left.date.slice(4, 6)) - 1, Number(left.date.slice(6, 8)));
      const rightTime = Date.UTC(Number(right.date.slice(0, 4)), Number(right.date.slice(4, 6)) - 1, Number(right.date.slice(6, 8)));
      return Math.abs(leftTime - today) - Math.abs(rightTime - today);
    })
    .filter((item) => {
      if (seen.has(item.name)) {
        return false;
      }

      seen.add(item.name);
      return true;
    })
    .slice(0, MAX_SPECIAL_DAY_LINES);

  if (selectedItems.length === 0) {
    return { summaryForAi: "", itemCount: 0 };
  }

  return {
    itemCount: selectedItems.length,
    summaryForAi: [
      "특일/절기 맥락:",
      ...selectedItems.map(
        (item) =>
          `- ${getRelativeDateLabel(item.date)} ${item.name}: ${getWritingUse(item)}.`,
      ),
    ].join("\n"),
  };
}

export async function getSpecialDaysContext() {
  const apiKey = readPublicDataApiKey("KASI_SPECIAL_DAY_API_KEY");

  if (!apiKey) {
    throw new PublicDataConfigurationError(SOURCE);
  }

  return getCachedPublicData(
    `${SOURCE}:${getMonthKeysAroundToday().join(",")}`,
    SPECIAL_DAY_TTL_MS,
    async () => {
      try {
        const items = (
          await Promise.all(
            getMonthKeysAroundToday().flatMap((yearMonth) =>
              operations.map(({ operation, kind }) =>
                fetchSpecialDayMonth(apiKey, yearMonth, operation, kind),
              ),
            ),
          )
        ).flat();

        return buildSummary(items);
      } catch (error) {
        if (error instanceof PublicDataApiError) {
          throw error;
        }

        throw new PublicDataApiError(SOURCE, "Special day context failed");
      }
    },
  ).catch(async (error) => {
    if (error instanceof PublicDataApiError) {
      await getCachedPublicData(`${SOURCE}:negative`, SPECIAL_DAY_NEGATIVE_TTL_MS, async () => null);
    }

    throw error;
  });
}
