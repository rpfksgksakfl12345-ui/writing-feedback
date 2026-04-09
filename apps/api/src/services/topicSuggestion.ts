import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3.1-flash-lite-preview";
const TOPIC_COUNT = 10;
const KOREA_TIME_ZONE = "Asia/Seoul";

type TopicSuggestionResponse = {
  topics: string[];
};

let client: GoogleGenAI | null = null;

function getClient() {
  if (client) {
    return client;
  }

  const { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_GENAI_USE_VERTEXAI } = process.env;

  if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
    throw new Error("Vertex AI environment is not configured");
  }

  if (GOOGLE_GENAI_USE_VERTEXAI !== "true") {
    throw new Error("GOOGLE_GENAI_USE_VERTEXAI must be set to true");
  }

  client = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  return client;
}

function normalizeTopic(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeTopics(values: string[]) {
  const seen = new Set<string>();
  const topics: string[] = [];

  for (const value of values) {
    const topic = normalizeTopic(value);

    if (!topic) {
      continue;
    }

    const key = topic.toLocaleLowerCase("ko-KR");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    topics.push(topic);
  }

  return topics;
}

function getCurrentKoreanMonth() {
  const month = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: KOREA_TIME_ZONE,
      month: "numeric",
    }).format(new Date()),
  );

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return 3;
  }

  return month;
}

function getSeasonAndSchoolContext() {
  const month = getCurrentKoreanMonth();

  if (month >= 3 && month <= 5) {
    return {
      month,
      season: "spring",
      schoolPeriod:
        month === 3
          ? "the beginning of the first semester"
          : "the early to middle part of the first semester",
      eventHints: [
        "new classmates",
        "new classroom routines",
        "spring weather",
        "school garden",
        "picnic or field trip",
      ],
    };
  }

  if (month >= 6 && month <= 7) {
    return {
      month,
      season: "summer",
      schoolPeriod: "the later part of the first semester",
      eventHints: [
        "warmer weather",
        "rainy days",
        "sports day",
        "class projects",
        "looking forward to vacation",
      ],
    };
  }

  if (month === 8) {
    return {
      month,
      season: "late summer",
      schoolPeriod: "summer vacation or the beginning of the second semester",
      eventHints: [
        "vacation memories",
        "family outings",
        "returning to school",
        "summer weather",
        "new semester goals",
      ],
    };
  }

  if (month >= 9 && month <= 11) {
    return {
      month,
      season: "autumn",
      schoolPeriod: "the middle of the second semester",
      eventHints: [
        "autumn leaves",
        "harvest season",
        "school festival",
        "friendship",
        "comfortable outdoor activities",
      ],
    };
  }

  if (month === 12) {
    return {
      month,
      season: "winter",
      schoolPeriod: "the end of the school year",
      eventHints: [
        "year-end reflection",
        "winter weather",
        "class memories",
        "holiday season",
        "what I learned this year",
      ],
    };
  }

  return {
    month,
    season: "winter",
    schoolPeriod: "winter vacation or preparation for the new school year",
    eventHints: [
      "vacation routines",
      "new year hopes",
      "helping at home",
      "winter activities",
      "goals for the next grade",
    ],
  };
}

function getGradeGuidance(grade: number) {
  if (grade <= 2) {
    return [
      "Use very concrete and easy-to-start topics.",
      "Focus on familiar experiences, feelings, favorite things, and simple observations.",
      "Avoid topics that require explanation, debate, or abstract thinking.",
    ];
  }

  if (grade <= 4) {
    return [
      "Use concrete school-life and everyday-life topics with a little room for reasons or simple explanation.",
      "Focus on experiences, comparisons, memories, and practical opinions children can express clearly.",
      "Avoid topics that feel adult, technical, or socially complex.",
    ];
  }

  return [
    "Allow simple opinion, comparison, explanation, or reflection topics, but keep them firmly at elementary school level.",
    "Topics should still be based on familiar school, family, friendship, reading, hobbies, and everyday experiences.",
    "Avoid abstract philosophy, political issues, and adult-level social analysis.",
  ];
}

function parseTopics(rawText: string): string[] {
  const text = rawText.trim();

  if (!text) {
    throw new Error("Empty model response");
  }

  try {
    const parsed = JSON.parse(text) as Partial<TopicSuggestionResponse>;

    if (Array.isArray(parsed.topics)) {
      const topics = dedupeTopics(parsed.topics.filter((value): value is string => typeof value === "string"));

      if (topics.length >= TOPIC_COUNT) {
        return topics.slice(0, TOPIC_COUNT);
      }
    }
  } catch {
    // Fall back to line-based parsing for unexpected model output.
  }

  const normalizedTopics = dedupeTopics(
    text
      .split("\n")
      .map((line) => line.replace(/^[\s\-*\d.]+/, "").trim())
      .filter(Boolean),
  );

  if (normalizedTopics.length >= TOPIC_COUNT) {
    return normalizedTopics.slice(0, TOPIC_COUNT);
  }

  throw new Error("Unable to parse topic suggestions");
}

function buildPrompt(grade: number, retryHint?: string) {
  const seasonContext = getSeasonAndSchoolContext();
  const gradeGuidance = getGradeGuidance(grade);

  return [
    "You are helping an elementary school teacher in Korea prepare classroom writing topics.",
    `Suggest exactly ${TOPIC_COUNT} Korean writing topic titles for grade ${grade} students.`,
    `Current Korea classroom context: month ${seasonContext.month}, ${seasonContext.season}, ${seasonContext.schoolPeriod}.`,
    `Seasonal and school-life hints you may use when natural: ${seasonContext.eventHints.join(", ")}.`,
    "Grade guidance:",
    ...gradeGuidance.map((line) => `- ${line}`),
    "Quality rules:",
    "- Every topic must feel realistic for an elementary classroom writing activity.",
    "- Prefer specific, practical, easy-to-start prompts rather than broad themes.",
    "- Each topic must be meaningfully different from the others.",
    "- Keep topics suitable for short writing around 300 characters or less.",
    "- Favor experiences, observations, feelings, school life, family life, hobbies, seasons, and familiar events.",
    "- Older grades may include simple opinions or explanations, but never adult-level analysis.",
    "- Avoid political, highly sensitive, violent, philosophical, or adult-sounding topics.",
    "- Avoid vague prompts that are too hard to start writing immediately.",
    "- Write each topic as a clear Korean title or prompt a teacher could use right away.",
    '- Return JSON only in this exact format: {"topics":["...","...","...","...","...","...","...","...","...","..."]}',
    retryHint ? `Retry instruction: ${retryHint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateTopicSuggestions(grade: number) {
  const ai = getClient();
  const retryHints = [
    undefined,
    `The previous response was unusable. Return ${TOPIC_COUNT} distinct, concrete topics with no duplicates and no abstract themes.`,
  ];

  for (const retryHint of retryHints) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: buildPrompt(grade, retryHint),
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["topics"],
          properties: {
            topics: {
              type: "array",
              minItems: TOPIC_COUNT,
              maxItems: TOPIC_COUNT,
              items: {
                type: "string",
              },
            },
          },
        },
      },
    });

    try {
      return parseTopics(response.text ?? "");
    } catch {
      // Retry once with a stricter instruction when the model output is not usable.
    }
  }

  throw new Error("Unable to parse topic suggestions");
}
