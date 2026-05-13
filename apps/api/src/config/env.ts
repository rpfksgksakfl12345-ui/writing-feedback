import { Express } from "express";

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function requireEnv(name: string, missing: string[]) {
  if (!readEnv(name)) {
    missing.push(name);
  }
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID)
  );
}

function getTrustProxyValue() {
  const rawValue = readEnv("TRUST_PROXY") || readEnv("TRUST_PROXY_HOPS");

  if (!rawValue) {
    return false;
  }

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  const hopCount = Number(rawValue);
  if (Number.isInteger(hopCount) && hopCount >= 0) {
    return hopCount;
  }

  return rawValue;
}

export function validateProductionEnv() {
  if (!isProductionRuntime()) {
    return;
  }

  const missing: string[] = [];

  requireEnv("DATABASE_URL", missing);
  requireEnv("JWT_SECRET", missing);
  requireEnv("TEACHER_SIGNUP_CODE", missing);
  requireEnv("GOOGLE_CLOUD_PROJECT", missing);
  requireEnv("GOOGLE_CLOUD_LOCATION", missing);
  requireEnv("GOOGLE_GENAI_USE_VERTEXAI", missing);
  requireEnv("GOOGLE_CLOUD_DOCUMENTAI_PROJECT", missing);
  requireEnv("GOOGLE_CLOUD_DOCUMENTAI_LOCATION", missing);
  requireEnv("GOOGLE_CLOUD_DOCUMENTAI_PROCESSOR_ID", missing);
  requireEnv("UPLOADS_DIR", missing);

  if (!readEnv("GOOGLE_APPLICATION_CREDENTIALS") && !readEnv("GOOGLE_APPLICATION_CREDENTIALS_BASE64")) {
    missing.push("GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_BASE64");
  }

  if (!readEnv("CORS_ORIGIN") && !readEnv("WEB_ORIGIN")) {
    missing.push("CORS_ORIGIN or WEB_ORIGIN");
  }

  if (!readEnv("TRUST_PROXY_HOPS") && !readEnv("TRUST_PROXY")) {
    missing.push("TRUST_PROXY_HOPS or TRUST_PROXY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (readEnv("JWT_SECRET") === "change-me" || readEnv("JWT_SECRET").length < 32) {
    throw new Error("JWT_SECRET must be a strong production secret.");
  }

  if (readEnv("GOOGLE_GENAI_USE_VERTEXAI") !== "true") {
    throw new Error("GOOGLE_GENAI_USE_VERTEXAI must be set to true in production.");
  }
}

export function getAllowedOrigins() {
  const rawOrigins =
    readEnv("CORS_ORIGIN") || readEnv("WEB_ORIGIN") || "http://localhost:3000";

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureTrustProxy(app: Express) {
  const trustProxyValue = getTrustProxyValue();

  if (trustProxyValue !== false) {
    app.set("trust proxy", trustProxyValue);
  }
}
