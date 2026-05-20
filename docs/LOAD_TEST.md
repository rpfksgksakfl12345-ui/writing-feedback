# Load Test Guide

This guide is for cautious classroom-readiness checks. Do not start with the
production Railway API at high concurrency. Begin against local or staging, then
run small production checks only when you can watch Railway and Google Cloud
dashboards at the same time.

## Safety Rules

- Default load test mode calls only `/health`.
- AI topic generation, AI feedback, OCR, and photo upload are disabled unless
  explicit flags are provided.
- AI and OCR tests can create Google Cloud cost and quota pressure.
- Use only disposable teacher/student accounts and disposable topics.
- Do not use real student writing, real student identities, or real classroom
  passwords in test data.
- Keep credentials in environment variables. Do not hardcode them in scripts.

## Environment Variables

Set only what the scenario needs:

```powershell
$env:LOAD_TEST_BASE_URL="http://localhost:4000"
$env:LOAD_TEST_TEACHER_EMAIL="teacher@example.com"
$env:LOAD_TEST_TEACHER_PASSWORD="teacher-password"
$env:LOAD_TEST_CLASSROOM_ID="1"
$env:LOAD_TEST_STUDENT_CLASS_CODE="ABC123"
$env:LOAD_TEST_STUDENT_NUMBER="1"
$env:LOAD_TEST_STUDENT_PASSWORD="student-password"
```

Optional variables:

```powershell
$env:LOAD_TEST_TEACHER_TOKEN="<already-issued-token>"
$env:LOAD_TEST_STUDENT_TOKEN="<already-issued-token>"
$env:LOAD_TEST_TOPIC_ID="1"
$env:LOAD_TEST_SUBMISSION_ID="1"
$env:LOAD_TEST_IMAGE_PATH="C:\path\to\small-test-image.jpg"
$env:LOAD_TEST_GRADE="3"
```

## Commands

Safe default:

```powershell
npm run load:test
```

Dry run without sending requests:

```powershell
npm run load:test -- --dry-run --include-login --include-topics
```

Health plus login:

```powershell
npm run load:test -- --include-login --requests 25 --concurrency 5
```

Teacher topic list:

```powershell
npm run load:test -- --include-login --include-topics --requests 25 --concurrency 5
```

Typed submission with a disposable student/topic:

```powershell
npm run load:test -- --include-submit --requests 5 --concurrency 1
```

Limited AI topic-generation check:

```powershell
npm run load:test -- --include-ai --ai-requests 2 --concurrency 1
```

AI feedback draft check for one disposable submission:

```powershell
npm run load:test -- --include-feedback --ai-requests 2 --concurrency 1
```

Photo upload/OCR check:

```powershell
npm run load:test -- --include-upload --include-ocr --requests 2 --concurrency 1
```

Photo upload starts OCR, so `--include-upload` and `--include-ocr` must be used
together. Keep this test very small.

## Reading Results

The script prints one JSON summary per scenario:

- total requests
- success and failed counts
- status-code counts, including `429`
- average latency
- p50, p95, p99 latency
- max latency
- requests per second
- short failure examples
- bottleneck summary

For one classroom, start with 25 students. For two classrooms, test around 50
students. For multiple teachers, run teacher login/topic-list checks separately
from student submission checks so the bottleneck is clear.

## What To Watch

Watch these dashboards while running non-trivial tests:

- Railway API CPU and memory
- Railway PostgreSQL connection count and CPU
- HTTP 5xx and 429 responses
- Vertex AI quota and spend
- Document AI quota and spend
- Railway logs for timeout and public-data fallback messages

## Interpretation

- `/health` p95 above 500ms suggests platform or network pressure.
- Login p95 above 1500ms may be bcrypt CPU pressure or database latency.
- Topic-list p95 above 1500ms usually points to database latency.
- AI topic generation and feedback are expected to be slower; watch timeout
  rates and quota/cost rather than raw latency alone.
- OCR is intentionally expensive and should be tested in very small batches.

In production, do not jump directly from 25 to hundreds of users. Increase
concurrency gradually and keep AI/OCR tests separate from regular classroom
traffic.
