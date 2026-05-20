#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const DEFAULT_TOTAL = 20;
const DEFAULT_CONCURRENCY = 5;

const args = new Set(process.argv.slice(2));
const argValues = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg.startsWith("--") && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    argValues.set(arg, process.argv[index + 1]);
    index += 1;
  }
}

function readNumberArg(name, fallback) {
  const value = Number(argValues.get(name) ?? process.env[name.replace(/^--/, "LOAD_TEST_").toUpperCase()]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const config = {
  baseUrl: (argValues.get("--base-url") || process.env.LOAD_TEST_BASE_URL || "http://localhost:4000").replace(/\/$/, ""),
  total: readNumberArg("--requests", DEFAULT_TOTAL),
  concurrency: readNumberArg("--concurrency", DEFAULT_CONCURRENCY),
  includeLogin: args.has("--include-login"),
  includeTopics: args.has("--include-topics"),
  includeSubmit: args.has("--include-submit"),
  includeAi: args.has("--include-ai"),
  includeFeedback: args.has("--include-feedback"),
  includeUpload: args.has("--include-upload"),
  includeOcr: args.has("--include-ocr"),
  dryRun: args.has("--dry-run"),
  aiRequests: readNumberArg("--ai-requests", 3),
};

function env(name) {
  return process.env[name]?.trim() || "";
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function request(path, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${config.baseUrl}${path}`, options);
  const elapsedMs = performance.now() - startedAt;
  let body = "";

  try {
    body = await response.text();
  } catch {
    body = "";
  }

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs,
    body: body.slice(0, 300),
  };
}

async function runScenario(name, total, makeRequest) {
  const results = [];
  let nextIndex = 0;
  const startedAt = performance.now();
  const workerCount = Math.min(config.concurrency, total);

  async function worker() {
    while (nextIndex < total) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        results.push(await makeRequest(currentIndex));
      } catch (error) {
        results.push({
          ok: false,
          status: 0,
          elapsedMs: 0,
          body: error instanceof Error ? error.message : "request failed",
        });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));

  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const durations = results.map((result) => result.elapsedMs).filter((value) => value > 0);
  const statusCounts = new Map();

  for (const result of results) {
    statusCounts.set(result.status, (statusCounts.get(result.status) ?? 0) + 1);
  }

  const failures = results.filter((result) => !result.ok);
  const summary = {
    name,
    total: results.length,
    success: results.length - failures.length,
    failed: failures.length,
    statusCounts: Object.fromEntries([...statusCounts.entries()].sort()),
    avgMs: durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0,
    p50Ms: Math.round(percentile(durations, 50)),
    p95Ms: Math.round(percentile(durations, 95)),
    p99Ms: Math.round(percentile(durations, 99)),
    maxMs: Math.round(Math.max(0, ...durations)),
    requestsPerSecond: Number((results.length / Math.max(elapsedSeconds, 0.001)).toFixed(2)),
    failureExamples: failures.slice(0, 3).map((failure) => ({
      status: failure.status,
      body: failure.body,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function teacherLogin() {
  const email = env("LOAD_TEST_TEACHER_EMAIL");
  const password = env("LOAD_TEST_TEACHER_PASSWORD");

  if (!email || !password) {
    throw new Error("LOAD_TEST_TEACHER_EMAIL and LOAD_TEST_TEACHER_PASSWORD are required");
  }

  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!result.ok) {
    throw new Error(`teacher login failed with status ${result.status}`);
  }

  return JSON.parse(result.body).token;
}

async function studentLogin() {
  const classCode = env("LOAD_TEST_STUDENT_CLASS_CODE");
  const studentNumber = Number(env("LOAD_TEST_STUDENT_NUMBER"));
  const classroomLoginPassword = env("LOAD_TEST_STUDENT_PASSWORD");

  if (!classCode || !Number.isInteger(studentNumber) || !classroomLoginPassword) {
    throw new Error(
      "LOAD_TEST_STUDENT_CLASS_CODE, LOAD_TEST_STUDENT_NUMBER, and LOAD_TEST_STUDENT_PASSWORD are required",
    );
  }

  const result = await request("/api/auth/student-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classCode, studentNumber, classroomLoginPassword }),
  });

  if (!result.ok) {
    throw new Error(`student login failed with status ${result.status}`);
  }

  return JSON.parse(result.body).token;
}

async function getFirstStudentTopicId(studentToken) {
  const result = await request("/api/topics", {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  if (!result.ok) {
    throw new Error(`topic list failed with status ${result.status}`);
  }

  const topics = JSON.parse(result.body);
  const topicId = Array.isArray(topics) ? topics[0]?.id : null;

  if (!topicId) {
    throw new Error("student has no available topics for typed submission test");
  }

  return topicId;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function main() {
  console.log(
    JSON.stringify(
      {
        baseUrl: config.baseUrl,
        total: config.total,
        concurrency: config.concurrency,
        safeMode:
          !config.includeAi && !config.includeOcr && !config.includeUpload && !config.includeFeedback,
        dryRun: config.dryRun,
      },
      null,
      2,
    ),
  );

  if (config.dryRun) {
    console.log(
      JSON.stringify(
        {
          scenarios: [
            "health",
            config.includeLogin ? "teacher-login" : "",
            config.includeLogin ? "student-login" : "",
            config.includeTopics ? "topic-list" : "",
            config.includeSubmit ? "typed-submission" : "",
            config.includeAi ? "ai-topic-generation" : "",
            config.includeFeedback ? "ai-feedback-draft" : "",
            config.includeUpload || config.includeOcr ? "photo-upload-ocr" : "",
          ].filter(Boolean),
        },
        null,
        2,
      ),
    );
    return;
  }

  const summaries = [];
  summaries.push(await runScenario("health", config.total, () => request("/health")));

  let teacherToken = env("LOAD_TEST_TEACHER_TOKEN");
  let studentToken = env("LOAD_TEST_STUDENT_TOKEN");

  if (config.includeLogin) {
    summaries.push(
      await runScenario("teacher-login", config.total, () =>
        request("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: env("LOAD_TEST_TEACHER_EMAIL"),
            password: env("LOAD_TEST_TEACHER_PASSWORD"),
          }),
        }),
      ),
    );
    teacherToken ||= await teacherLogin();

    summaries.push(
      await runScenario("student-login", config.total, () =>
        request("/api/auth/student-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classCode: env("LOAD_TEST_STUDENT_CLASS_CODE"),
            studentNumber: Number(env("LOAD_TEST_STUDENT_NUMBER")),
            classroomLoginPassword: env("LOAD_TEST_STUDENT_PASSWORD"),
          }),
        }),
      ),
    );
    studentToken ||= await studentLogin();
  }

  if (config.includeTopics) {
    teacherToken ||= await teacherLogin();
    const classroomId = env("LOAD_TEST_CLASSROOM_ID");
    const query = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
    summaries.push(
      await runScenario("topic-list", config.total, () =>
        request(`/api/topics${query}`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
        }),
      ),
    );
  }

  if (config.includeSubmit) {
    studentToken ||= await studentLogin();
    const topicId = env("LOAD_TEST_TOPIC_ID") || (await getFirstStudentTopicId(studentToken));
    summaries.push(
      await runScenario("typed-submission", Math.min(config.total, 5), (index) =>
        request("/api/submissions", {
          method: "POST",
          headers: authHeaders(studentToken),
          body: JSON.stringify({
            topicId,
            inputType: "TYPED",
            content: `부하 테스트용 글입니다. 실제 학생 글이 아닙니다. 요청 번호 ${index}`,
          }),
        }),
      ),
    );
  }

  if (config.includeAi) {
    teacherToken ||= await teacherLogin();
    summaries.push(
      await runScenario("ai-topic-generation", config.aiRequests, () =>
        request("/api/topics/generate", {
          method: "POST",
          headers: authHeaders(teacherToken),
          body: JSON.stringify({
            grade: Number(env("LOAD_TEST_GRADE") || "3"),
            classroomId: env("LOAD_TEST_CLASSROOM_ID") || undefined,
          }),
        }),
      ),
    );
  }

  if (config.includeFeedback) {
    teacherToken ||= await teacherLogin();
    const submissionId = env("LOAD_TEST_SUBMISSION_ID");

    if (!submissionId) {
      throw new Error("LOAD_TEST_SUBMISSION_ID is required for --include-feedback");
    }

    summaries.push(
      await runScenario("ai-feedback-draft", config.aiRequests, () =>
        request(`/api/submissions/${submissionId}/feedback-draft`, {
          method: "POST",
          headers: authHeaders(teacherToken),
          body: JSON.stringify({}),
        }),
      ),
    );
  }

  if (config.includeUpload || config.includeOcr) {
    if (!config.includeUpload || !config.includeOcr) {
      throw new Error("photo upload starts OCR, so use --include-upload and --include-ocr together");
    }

    studentToken ||= await studentLogin();
    const imagePath = env("LOAD_TEST_IMAGE_PATH");
    const topicId = env("LOAD_TEST_TOPIC_ID") || (await getFirstStudentTopicId(studentToken));

    if (!imagePath) {
      throw new Error("LOAD_TEST_IMAGE_PATH is required for upload/OCR test");
    }

    const image = await readFile(imagePath);
    summaries.push(
      await runScenario("photo-upload-ocr", Math.min(config.total, 3), () => {
        const form = new FormData();
        form.set("topicId", String(topicId));
        form.set("inputType", "PHOTO");
        form.set("image", new Blob([image], { type: "image/jpeg" }), "load-test.jpg");

        return request("/api/submissions", {
          method: "POST",
          headers: { Authorization: `Bearer ${studentToken}` },
          body: form,
        });
      }),
    );
  }

  const bottlenecks = summaries
    .filter((summary) => summary.failed > 0 || summary.p95Ms > 2000 || summary.statusCounts["429"])
    .map((summary) => ({
      scenario: summary.name,
      failed: summary.failed,
      p95Ms: summary.p95Ms,
      rateLimited: summary.statusCounts["429"] ?? 0,
    }));

  console.log(JSON.stringify({ bottlenecks }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
