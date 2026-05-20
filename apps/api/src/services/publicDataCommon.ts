import {
  isExternalRequestTimeoutError,
  readTimeoutMs,
  withAbortTimeout,
} from "../utils/timeout";

const DEFAULT_PUBLIC_DATA_TIMEOUT_MS = 8000;

export class PublicDataConfigurationError extends Error {
  readonly source: string;

  constructor(source: string) {
    super(`${source} API key is not configured`);
    this.name = "PublicDataConfigurationError";
    this.source = source;
  }
}

export class PublicDataApiError extends Error {
  readonly source: string;
  readonly code?: string;
  readonly statusCode?: number;
  readonly timedOut?: boolean;

  constructor(
    source: string,
    message: string,
    options: { code?: string; statusCode?: number; timedOut?: boolean } = {},
  ) {
    super(message);
    this.name = "PublicDataApiError";
    this.source = source;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.timedOut = options.timedOut;
  }
}

export function readPublicDataApiKey(primaryName: string) {
  return process.env[primaryName]?.trim() || process.env.PUBLIC_DATA_API_KEY?.trim() || "";
}

export function getPublicDataTimeoutMs() {
  return readTimeoutMs("PUBLIC_DATA_TIMEOUT_MS", DEFAULT_PUBLIC_DATA_TIMEOUT_MS);
}

export function appendPublicDataParams(
  url: URL,
  params: Record<string, string | number | undefined | null>,
) {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  }
}

export async function fetchPublicDataJson<T>(
  source: string,
  url: URL,
): Promise<T> {
  try {
    return await withAbortTimeout(source, getPublicDataTimeoutMs(), async (signal) => {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new PublicDataApiError(source, `${source} request failed`, {
          statusCode: response.status,
        });
      }

      return (await response.json()) as T;
    });
  } catch (error) {
    if (isExternalRequestTimeoutError(error)) {
      throw new PublicDataApiError(source, `${source} request timed out`, {
        timedOut: true,
      });
    }

    if (error instanceof PublicDataApiError) {
      throw error;
    }

    throw new PublicDataApiError(source, `${source} request failed`);
  }
}

export async function fetchPublicDataText(source: string, url: URL) {
  try {
    return await withAbortTimeout(source, getPublicDataTimeoutMs(), async (signal) => {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new PublicDataApiError(source, `${source} request failed`, {
          statusCode: response.status,
        });
      }

      return response.text();
    });
  } catch (error) {
    if (isExternalRequestTimeoutError(error)) {
      throw new PublicDataApiError(source, `${source} request timed out`, {
        timedOut: true,
      });
    }

    if (error instanceof PublicDataApiError) {
      throw error;
    }

    throw new PublicDataApiError(source, `${source} request failed`);
  }
}

export function getPublicDataErrorLogDetails(error: unknown) {
  if (error instanceof PublicDataConfigurationError) {
    return `source=${error.source} timeout=false code=missing_key`;
  }

  if (error instanceof PublicDataApiError) {
    return [
      `source=${error.source}`,
      `timeout=${Boolean(error.timedOut)}`,
      `code=${error.code ?? "none"}`,
      error.statusCode ? `status=${error.statusCode}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "source=public-data timeout=false code=unexpected";
}
