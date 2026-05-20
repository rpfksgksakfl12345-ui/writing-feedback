export class ExternalRequestTimeoutError extends Error {
  readonly source: string;
  readonly timeoutMs: number;

  constructor(source: string, timeoutMs: number) {
    super(`${source} timed out after ${timeoutMs}ms`);
    this.name = "ExternalRequestTimeoutError";
    this.source = source;
    this.timeoutMs = timeoutMs;
  }
}

export function isExternalRequestTimeoutError(
  error: unknown,
): error is ExternalRequestTimeoutError {
  return error instanceof ExternalRequestTimeoutError;
}

export function readTimeoutMs(envName: string, defaultValue: number) {
  const rawValue = process.env[envName]?.trim();
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  if (!Number.isInteger(parsedValue) || parsedValue < 1000) {
    return defaultValue;
  }

  return Math.min(parsedValue, 5 * 60 * 1000);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function withTimeout<T>(
  promise: Promise<T>,
  source: string,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new ExternalRequestTimeoutError(source, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function withAbortTimeout<T>(
  source: string,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw new ExternalRequestTimeoutError(source, timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
