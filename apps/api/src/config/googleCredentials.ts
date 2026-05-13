import fs from "fs";
import os from "os";
import path from "path";

const credentialsPathEnvName = "GOOGLE_APPLICATION_CREDENTIALS";
const credentialsBase64EnvName = "GOOGLE_APPLICATION_CREDENTIALS_BASE64";

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function getCredentialsFilePath() {
  const credentialsDir = path.join(os.tmpdir(), "writing-feedback-google");
  fs.mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });

  return path.join(credentialsDir, "google-application-credentials.json");
}

function parseCredentialsJson(encodedCredentials: string) {
  try {
    const decodedCredentials = Buffer.from(
      encodedCredentials.replace(/\s+/g, ""),
      "base64",
    ).toString("utf8");
    const parsedCredentials = JSON.parse(decodedCredentials) as unknown;

    if (
      !parsedCredentials ||
      typeof parsedCredentials !== "object" ||
      Array.isArray(parsedCredentials)
    ) {
      throw new Error("Credential JSON must be an object");
    }

    return JSON.stringify(parsedCredentials);
  } catch {
    throw new Error("Google credential env를 확인해 주세요.");
  }
}

export function configureGoogleApplicationCredentials() {
  const existingCredentialsPath = readEnv(credentialsPathEnvName);
  const encodedCredentials = readEnv(credentialsBase64EnvName);

  if (existingCredentialsPath || !encodedCredentials) {
    return;
  }

  const credentialsFilePath = getCredentialsFilePath();
  const credentialsJson = parseCredentialsJson(encodedCredentials);

  fs.writeFileSync(credentialsFilePath, credentialsJson, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    fs.chmodSync(credentialsFilePath, 0o600);
  } catch {
    // Some hosts or filesystems do not support chmod. The file still lives in
    // the runtime temp directory and is never written to git-tracked paths.
  }

  process.env[credentialsPathEnvName] = credentialsFilePath;
}

configureGoogleApplicationCredentials();
