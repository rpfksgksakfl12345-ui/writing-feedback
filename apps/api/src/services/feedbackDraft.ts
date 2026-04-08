import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

type FeedbackDraftResponse = {
  strengths: string[];
  improvements: string[];
  overall: string;
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

function parseDraft(rawText: string): FeedbackDraftResponse {
  const text = rawText.trim();

  if (!text) {
    throw new Error("Empty model response");
  }

  const parsed = JSON.parse(text) as Partial<FeedbackDraftResponse>;

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const improvements = Array.isArray(parsed.improvements)
    ? parsed.improvements
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const overall = typeof parsed.overall === "string" ? parsed.overall.trim() : "";

  if (strengths.length === 0 || improvements.length === 0 || !overall) {
    throw new Error("Unable to parse feedback draft");
  }

  return {
    strengths: strengths.slice(0, 2),
    improvements: improvements.slice(0, 2),
    overall,
  };
}

export async function generateFeedbackDraft(params: {
  grade?: number | null;
  topicTitle: string;
  topicDescription?: string | null;
  studentName: string;
  submissionText?: string | null;
  ocrText?: string | null;
}) {
  const ai = getClient();

  const writingText = params.submissionText?.trim() || params.ocrText?.trim() || "";

  if (!writingText) {
    throw new Error("No submission text available");
  }

  const prompt = [
    "You are helping an elementary school teacher in Korea write short feedback for a student's writing.",
    "Return JSON only.",
    `Student name: ${params.studentName}`,
    `Student grade: ${params.grade ?? "unknown"}`,
    `Topic title: ${params.topicTitle}`,
    `Topic description: ${params.topicDescription ?? ""}`,
    "Student writing:",
    writingText,
    "",
    "Requirements:",
    "- Write feedback in Korean.",
    "- Keep the tone warm, specific, and teacher-friendly.",
    "- strengths: 1 to 2 short bullet-style points",
    "- improvements: 1 to 2 short bullet-style points",
    "- overall: one short final comment in 1 to 2 sentences",
    '- Return JSON only in this exact format: {"strengths":["..."],"improvements":["..."],"overall":"..."}',
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["strengths", "improvements", "overall"],
        properties: {
          strengths: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: { type: "string" },
          },
          improvements: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: { type: "string" },
          },
          overall: {
            type: "string",
          },
        },
      },
    },
  });

  return parseDraft(response.text ?? "");
}
