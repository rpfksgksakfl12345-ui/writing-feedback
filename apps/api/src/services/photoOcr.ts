import fs from "fs/promises";
import { GoogleAuth } from "google-auth-library";
import { OcrStatus } from "@prisma/client";
import { prisma } from "./prisma";

const DOCUMENT_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DOCUMENT_AI_BASE_URL = "https://documentai.googleapis.com/v1";

type DocumentAiConfig = {
  project: string;
  location: string;
  processorId: string;
};

const auth = new GoogleAuth({
  scopes: [DOCUMENT_AI_SCOPE],
});

function normalizeExtractedText(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function getSafeOcrError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "OCR failed";

  if (!message) {
    return "OCR failed";
  }

  return message.slice(0, 500);
}

function getDocumentAiConfig(): DocumentAiConfig {
  const project =
    process.env.GOOGLE_CLOUD_DOCUMENTAI_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    "";
  const location =
    process.env.GOOGLE_CLOUD_DOCUMENTAI_LOCATION?.trim() ||
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
    "";
  const processorId = process.env.GOOGLE_CLOUD_DOCUMENTAI_PROCESSOR_ID?.trim() || "";

  if (!project || !location || !processorId) {
    throw new Error(
      "Document AI OCR is not configured. Set GOOGLE_CLOUD_DOCUMENTAI_PROCESSOR_ID and project/location env vars.",
    );
  }

  return {
    project,
    location,
    processorId,
  };
}

async function getAccessToken() {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse.token;

  if (!accessToken) {
    throw new Error("Failed to acquire Google Cloud access token for Document AI");
  }

  return accessToken;
}

async function parseProcessResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | {
        document?: {
          text?: string | null;
        };
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    const message = payload?.error?.message?.trim();
    throw new Error(message || `Document AI request failed with status ${response.status}`);
  }

  return normalizeExtractedText(payload?.document?.text ?? "");
}

async function extractTextFromImage(params: { imagePath: string; mimeType: string }) {
  const config = getDocumentAiConfig();
  const imageBuffer = await fs.readFile(params.imagePath);
  const accessToken = await getAccessToken();
  const processorName = [
    "projects",
    config.project,
    "locations",
    config.location,
    "processors",
    config.processorId,
  ].join("/");

  const response = await fetch(`${DOCUMENT_AI_BASE_URL}/${processorName}:process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawDocument: {
        content: imageBuffer.toString("base64"),
        mimeType: params.mimeType,
      },
      skipHumanReview: true,
    }),
  });

  return parseProcessResponse(response);
}

export async function runSubmissionOcr(params: {
  submissionId: number;
  imagePath: string;
  mimeType: string;
}) {
  try {
    console.log(`[ocr] started submissionId=${params.submissionId}`);

    await prisma.submission.update({
      where: { id: params.submissionId },
      data: {
        ocrStatus: OcrStatus.PROCESSING,
        ocrError: null,
      },
    });

    const extractedText = await extractTextFromImage({
      imagePath: params.imagePath,
      mimeType: params.mimeType,
    });

    if (!extractedText) {
      throw new Error("No readable text found in the uploaded image");
    }

    await prisma.submission.update({
      where: { id: params.submissionId },
      data: {
        ocrStatus: OcrStatus.DONE,
        ocrExtractedText: extractedText,
        editedExtractedText: null,
        extractedText,
        ocrError: null,
      },
    });

    console.log(`[ocr] completed submissionId=${params.submissionId}`);
  } catch (error) {
    const ocrError = getSafeOcrError(error);

    try {
      await prisma.submission.update({
        where: { id: params.submissionId },
        data: {
          ocrStatus: OcrStatus.FAILED,
          ocrExtractedText: null,
          editedExtractedText: null,
          extractedText: null,
          ocrError,
        },
      });
    } catch (updateError) {
      const updateMessage =
        updateError instanceof Error ? updateError.message : "unknown update error";
      console.error(
        `[ocr] failed to persist failure submissionId=${params.submissionId} message=${updateMessage}`,
      );
    }

    console.error(`[ocr] failed submissionId=${params.submissionId} message=${ocrError}`);
  }
}
