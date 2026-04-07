import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

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

function parseTopics(rawText: string): string[] {
  const text = rawText.trim();

  if (!text) {
    throw new Error("Empty model response");
  }

  try {
    const parsed = JSON.parse(text) as Partial<TopicSuggestionResponse>;

    if (Array.isArray(parsed.topics)) {
      const topics = parsed.topics
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);

      if (topics.length >= 5) {
        return topics.slice(0, 5);
      }
    }
  } catch {
    // Fall back to line-based parsing for unexpected model output.
  }

  const topics = text
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.]+/, "").trim())
    .filter(Boolean);

  if (topics.length >= 5) {
    return topics.slice(0, 5);
  }

  throw new Error("Unable to parse topic suggestions");
}

export async function generateTopicSuggestions(grade: number) {
  const ai = getClient();

  const prompt = [
    "You are helping an elementary school teacher in Korea.",
    `Suggest exactly 5 Korean writing topic titles for grade ${grade} students.`,
    "Requirements:",
    "- Suitable for elementary school students.",
    "- Good for short writing around 300 characters or less.",
    "- Concrete, familiar, everyday-life topics.",
    "- Encourage feelings, experiences, or simple opinions.",
    '- Return JSON only in this exact format: {"topics":["...","...","...","...","..."]}',
    "- Each topic must be a short Korean title.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["topics"],
        properties: {
          topics: {
            type: "array",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "string",
            },
          },
        },
      },
    },
  });

  return parseTopics(response.text ?? "");
}
