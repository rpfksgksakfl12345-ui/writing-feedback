function getApiBaseUrl() {
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const requireConfiguredApiBaseUrl =
    process.env.NODE_ENV === "production" &&
    (process.env.VERCEL === "1" ||
      process.env.CI === "true" ||
      process.env.NEXT_PUBLIC_REQUIRE_API_BASE_URL === "true");

  if (!configuredApiBaseUrl && requireConfiguredApiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required for production web builds.");
  }

  return configuredApiBaseUrl || "http://localhost:4000";
}

export const API_BASE_URL = getApiBaseUrl();

type RequestOptions = RequestInit & {
  token?: string | null;
};

function createApiHeaders(options: RequestOptions) {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  return headers;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = createApiHeaders(options);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFetchBlob(path: string, options: RequestOptions = {}) {
  const headers = createApiHeaders(options);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return response.blob();
}
