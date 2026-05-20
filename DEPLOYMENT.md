# Deployment Readiness Guide

This guide is for the first public web deployment of the writing feedback app.
The recommended first launch shape is:

- Web: Vercel
- API: Railway
- Database: Railway PostgreSQL
- Upload files: Railway Volume mounted into the API service

Do not put real secrets in this file or in git.

## 1. Build And Start Commands

Run these locally before deploying:

```bash
npm run build --workspace @writing-feedback/web
npm run build --workspace @writing-feedback/api
```

Vercel web:

```bash
npm run build --workspace @writing-feedback/web
```

Railway API build:

```bash
npm run build --workspace @writing-feedback/api
```

Railway API start:

```bash
npm run start --workspace @writing-feedback/api
```

Production DB migration:

```bash
npm run prisma:deploy --workspace @writing-feedback/api
```

## 2. API Environment Variables

Set these on the Railway API service. Use real values in Railway, not the examples below.

| Name | Required in production | Notes |
| --- | --- | --- |
| `NODE_ENV` | Recommended | Set to `production`. Railway runtime env also triggers production validation. |
| `DATABASE_URL` | Yes | Railway PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Strong random secret, at least 32 characters. Never use `change-me`. |
| `PORT` | Railway sets this | Keep app default as fallback only. |
| `CORS_ORIGIN` | Yes | Exact web origin, for example `https://your-app.vercel.app`. Comma-separated origins are supported. |
| `WEB_ORIGIN` | Alternative | Used only when `CORS_ORIGIN` is not set. |
| `TEACHER_SIGNUP_CODE` | Yes | Required so teacher signup is not publicly open. |
| `TRUST_PROXY_HOPS` | Yes | Use `1` on Railway so rate limiting reads the proxied client IP correctly. |
| `UPLOADS_DIR` | Yes | Use a Railway Volume path, for example `/data/uploads`. |
| `GOOGLE_CLOUD_PROJECT` | Yes | Vertex AI project. |
| `GOOGLE_CLOUD_LOCATION` | Yes | Vertex AI location. |
| `GOOGLE_GENAI_USE_VERTEXAI` | Yes | Must be `true`. |
| `GEMINI_TOPIC_MODEL` | Optional | Topic-suggestion Gemini model. Defaults to the current safe model `gemini-3.1-flash-lite-preview`. To test Gemini 3.5 Flash for topic suggestions only, set `GEMINI_TOPIC_MODEL=gemini-3.5-flash` on the Railway API service and redeploy. |
| `AI_REQUEST_TIMEOUT_MS` | Optional | Gemini topic suggestion and feedback request wait timeout. Defaults to `45000`. SDK calls are not directly aborted, but the API stops waiting and returns the existing failure response. |
| `GOOGLE_CLOUD_DOCUMENTAI_PROJECT` | Yes | Document AI project. |
| `GOOGLE_CLOUD_DOCUMENTAI_LOCATION` | Yes | Document AI location. |
| `GOOGLE_CLOUD_DOCUMENTAI_PROCESSOR_ID` | Yes | Document AI processor ID. |
| `OCR_REQUEST_TIMEOUT_MS` | Optional | Document AI OCR timeout budget. Defaults to `60000`. OCR failures are saved on the submission instead of crashing the API. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternative | Path to a Google credential JSON file available at runtime. Useful locally or on hosts where you can mount a file. |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE64` | Recommended on Railway | Base64-encoded service account JSON. The API restores it to a temp file at startup and sets `GOOGLE_APPLICATION_CREDENTIALS`. Do not commit or log this value. |
| `NEIS_API_KEY` | Required for NEIS public data features | NEIS Open API key used only by the Railway API for school search and academic schedule lookup. Do not set this in Vercel. The API can start without it, but NEIS lookup endpoints return a clear JSON error. |
| `PUBLIC_DATA_TIMEOUT_MS` | Optional | NEIS public-data request timeout. Defaults to `8000`. Topic suggestions continue without NEIS context when this times out. |
| `PUBLIC_DATA_API_KEY` | Optional | Shared fallback key for public-data APIs that use the public data portal service key format. Keep it on Railway API only, never Vercel. Source-specific keys below take precedence. |
| `KASI_SPECIAL_DAY_API_KEY` | Optional | Korea Astronomy and Space Science Institute special-day/solar-term API key. If missing, only this context is skipped. |
| `KMA_FORECAST_API_KEY` | Optional | Korea Meteorological Administration short-term forecast API key. If missing, only weather context is skipped. |
| `AIRKOREA_API_KEY` | Optional | AirKorea air-quality API key. If missing, only air-quality context is skipped. |
| `BULK_FEEDBACK_CHUNK_SIZE` | Optional | Defaults to 5 and is capped at 8. Smaller values reduce per-request blast radius; larger values reduce AI call count. |

The API fails fast in `NODE_ENV=production` or Railway runtime if required
values are missing, if `JWT_SECRET` is weak, or if Vertex mode is not enabled.

Google authentication note:

- The API uses Google Application Default Credentials through Google client
  libraries.
- On Railway, prefer `GOOGLE_APPLICATION_CREDENTIALS_BASE64`. At startup, the
  API base64-decodes the value, validates that it is JSON, writes it to the
  runtime temp directory, and sets `GOOGLE_APPLICATION_CREDENTIALS` to that
  generated path.
- If both `GOOGLE_APPLICATION_CREDENTIALS` and
  `GOOGLE_APPLICATION_CREDENTIALS_BASE64` are set, the explicit file path wins
  and the base64 value is ignored.
- `GOOGLE_APPLICATION_CREDENTIALS` remains supported for local development or
  hosting environments where a credential JSON file can be mounted safely.
- The service account needs access to Vertex AI and the configured Document AI
  processor.
- Never store the credential JSON in the repository or expose it to the web app.
- Never paste the raw JSON into code, GitHub, chat, logs, or browser-visible
  environment variables.

PowerShell command to base64-encode a downloaded service account JSON file:

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content "C:\path\to\service-account.json" -Raw)))
```

Copy only the command output into Railway Variables as
`GOOGLE_APPLICATION_CREDENTIALS_BASE64`.

## 3. Web Environment Variables

Set these on the Vercel project.

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Public Railway API URL, for example `https://your-api.up.railway.app`. |
| `NEXT_PUBLIC_REQUIRE_API_BASE_URL` | Recommended | Set to `true` so production builds fail if the API URL is missing. |

`NEXT_PUBLIC_API_BASE_URL` is baked into the web build. If the API URL changes,
redeploy the web app.

## 4. Railway API Setup

1. Create a Railway project.
2. Add a PostgreSQL service.
3. Add an API service connected to the repository.
4. Keep the service root at the repository root for this shared npm workspace,
   then set:

```text
Build command: npm run build --workspace @writing-feedback/api
Start command: npm run start --workspace @writing-feedback/api
```

If Railway auto-imports the monorepo and creates an API service automatically,
confirm the build/start commands still run from the shared workspace context and
can access `packages/shared-types`.

5. Add a Railway Volume to the API service.
6. Mount the volume at `/data`.
7. Set `UPLOADS_DIR=/data/uploads`.
8. Set the API environment variables from section 2.
9. Deploy the API.
10. Run production migrations:

```bash
npm run prisma:deploy --workspace @writing-feedback/api
```

11. Set Railway healthcheck path to:

```text
/health
```

12. Confirm logs show the API listening without env validation errors.

Railway service filesystems are ephemeral unless a Volume is mounted. Without a
Volume, uploaded student images can disappear after redeploys or restarts.

## 5. Vercel Web Setup

1. Create a Vercel project from the same repository.
2. Set Root Directory to:

```text
apps/web
```

3. Confirm Framework Preset is Next.js.
4. Use the default output directory (`.next`).
5. If the build command is not detected correctly, set:

```bash
npm run build
```

6. Set `NEXT_PUBLIC_API_BASE_URL` to the Railway API URL.
7. Set `NEXT_PUBLIC_REQUIRE_API_BASE_URL=true`.
8. Deploy a preview first.
9. Smoke test the preview against the Railway API.
10. Promote to production after the checklist passes.

`NEXT_PUBLIC_API_BASE_URL` is baked into the web build. If the API URL changes,
redeploy the web app.

When sharing Vercel preview URLs externally, consider Vercel preview protection
or keep the URL private until production env and CORS are correct.

## 6. Deployment Console Checklist

Railway API service values:

| Setting | Value |
| --- | --- |
| Repository | `rpfksgksakfl12345-ui/writing-feedback` |
| Service root | repository root `/` |
| Build command | `npm run build --workspace @writing-feedback/api` |
| Start command | `npm run start --workspace @writing-feedback/api` |
| Healthcheck path | `/health` |
| Volume mount path | `/data` |
| Upload env | `UPLOADS_DIR=/data/uploads` |
| Google credential env | `GOOGLE_APPLICATION_CREDENTIALS_BASE64=<base64 service account JSON>` |
| Topic suggestion model env | `GEMINI_TOPIC_MODEL=gemini-3.5-flash` to test Gemini 3.5 Flash, or omit it to use the default safe model |
| NEIS public data env | `NEIS_API_KEY=<NEIS Open API key>` |
| Optional public data env | `KASI_SPECIAL_DAY_API_KEY`, `KMA_FORECAST_API_KEY`, `AIRKOREA_API_KEY`, or fallback `PUBLIC_DATA_API_KEY` on the Railway API service only |
| Production migration | `npm run prisma:deploy --workspace @writing-feedback/api` |

Vercel web project values:

| Setting | Value |
| --- | --- |
| Repository | `rpfksgksakfl12345-ui/writing-feedback` |
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Build command | `npm run build` |
| Output Directory | `.next` default |
| API env | `NEXT_PUBLIC_API_BASE_URL=<Railway API public URL>` |
| Build guard env | `NEXT_PUBLIC_REQUIRE_API_BASE_URL=true` |

Deploy order:

1. Deploy Railway API with a temporary or final allowed web origin.
2. Confirm Railway `/health`.
3. Deploy Vercel web with `NEXT_PUBLIC_API_BASE_URL` set to the Railway API URL.
4. Update Railway `CORS_ORIGIN` to the actual Vercel URL.
5. Redeploy Railway API after CORS changes.
6. Redeploy Vercel if `NEXT_PUBLIC_API_BASE_URL` changes.

## 7. Uploads

Current first-launch approach:

- API stores uploads on a local filesystem path.
- `UPLOADS_DIR` chooses that path.
- Railway Volume makes that path persistent.
- Protected `/uploads/:filename` still requires authentication and ownership.

Example Railway setup:

```text
Volume mount path: /data
UPLOADS_DIR=/data/uploads
```

The API creates the upload directory if it does not exist.

Upload guardrails:

- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max image size: 10 MB
- Stored filenames are generated with a timestamp, random suffix, and sanitized extension
- Teacher bulk upload uses the same file type, size, safe filename, `UPLOADS_DIR`,
  and protected `/uploads/:filename` access rules as student photo upload.

Longer term, move uploads to object storage such as Railway Storage Buckets or an
S3-compatible bucket. Object storage gives better backups, CDN options, and
safer scaling than local service volumes.

## 8. Rate Limits

The API has in-memory rate limits for:

- Teacher login
- Student classroom login
- Teacher signup
- Teacher password change
- AI topic generation
- AI feedback draft generation
- Bulk AI feedback draft generation
- Student upload
- Teacher bulk upload

The student login limiter is keyed by classroom code and student number when
available, not by IP only, so one school network should not block the whole
classroom. Teacher login combines email and IP. In-memory rate limits are fine
for the first single-instance launch, but they reset on API restart and are not
shared across multiple API instances. Use Redis or another shared store before
running multiple API replicas.

## 9. Security Checklist

Before launch:

- Use a strong `JWT_SECRET`.
- Set exact `CORS_ORIGIN`.
- Set `NEIS_API_KEY` on Railway if public-data school search and
  schedule-based topic suggestions will be used.
- Set `TEACHER_SIGNUP_CODE`.
- Set `TRUST_PROXY_HOPS=1` on Railway.
- Confirm `/uploads/:filename` requires a Bearer token.
- Confirm teacher signup fails without the signup code.
- Confirm rate limited auth requests return HTTP 429 with a Korean message.
- Do not expose API keys or service account credentials to the web app.

Known follow-up security work:

- Add Redis-backed rate limit store before multi-instance API scaling.
- Add login audit logs.
- Revisit 4-character or low-entropy student passwords if usage grows.
- Consider forced password change after admin reset.

## 10. Database And Backups

Production migrations should use:

```bash
npm run prisma:deploy --workspace @writing-feedback/api
```

Do not run `prisma migrate dev` against production.

Before the first real user launch:

- Enable or verify Railway PostgreSQL backups.
- Record the restore procedure.
- Back up before applying future migrations.
- Treat migration rollback as a planned operation, not a casual deploy revert.

## 11. Logs, Health, And Cost Controls

Railway:

- Use Railway logs for API startup failures, env validation errors, OCR errors,
  NEIS lookup errors, and AI request failures.
- Set healthcheck path to `/health`.

Google Cloud:

- Set a budget alert before opening access.
- Check Vertex AI quotas.
- Check Document AI quotas.
- Watch OCR and AI logs during the first classroom test.

AI/OCR cost control already in code:

- AI and OCR calls are server-side only.
- NEIS Open API calls are server-side only. The web app never receives
  `NEIS_API_KEY`.
- Special-day, weather, and air-quality public-data calls are server-side only.
  The web app never receives `KASI_SPECIAL_DAY_API_KEY`,
  `KMA_FORECAST_API_KEY`, `AIRKOREA_API_KEY`, or `PUBLIC_DATA_API_KEY`.
- Public-data topic context is cached in memory per API instance. Current MVP
  TTLs are roughly 3 days for special days, 2 hours for weather, and 45 minutes
  for air quality. This is enough for a single Railway API instance; use Redis
  or another shared cache before scaling to multiple replicas.
- Topic generation and feedback draft endpoints require teacher auth.
- Upload requires student auth and has a file size limit.
- AI endpoints now have lightweight per-teacher rate limits.
- External calls have default timeout safeguards: NEIS public data 8 seconds,
  Gemini AI requests 45 seconds, and Document AI OCR 60 seconds. These can be
  tuned with optional timeout environment variables if classroom testing shows
  the defaults are too short or too long.
- Teacher bulk upload requires teacher auth, is button-triggered, and runs OCR
  once per selected student photo. It can increase Document AI cost in proportion
  to the number of photos.
- Topic bulk feedback requires teacher auth, is button-triggered, skips
  submissions that already have an AI draft or final feedback, and processes
  submissions in small chunks. It can increase Vertex AI cost in proportion to
  the amount of student writing, but avoids the teacher making many separate
  draft-generation clicks.

## 12. First Deploy Order

1. Push the latest committed code to GitHub.
2. Create Railway PostgreSQL.
3. Create Railway API service.
4. Mount Railway Volume at `/data`.
5. Set API env.
6. Deploy API.
7. Run `npm run prisma:deploy --workspace @writing-feedback/api`.
8. Check `/health`.
9. Create Vercel web project.
10. Set web env.
11. Deploy Vercel preview.
12. Update `CORS_ORIGIN` to the final Vercel production domain if needed.
13. Redeploy API after CORS changes.
14. Redeploy web if `NEXT_PUBLIC_API_BASE_URL` changes.

## 13. Smoke Test Checklist

Run this immediately after deploy:

- `/health` returns `{ ok: true }`.
- Teacher signup requires `TEACHER_SIGNUP_CODE`.
- Teacher login works.
- Teacher password change works.
- A classroom can be created.
- A school can be searched and connected from classroom creation or classroom
  detail.
- A student account can be issued.
- The student password is visible only right after issue/reissue.
- Bulk student creation works for a small test batch.
- Student classroom login works.
- Student typed writing submission works.
- Student photo upload works.
- Teacher bulk photo upload works for a selected topic and skips students who
  already submitted.
- Teacher can view protected uploaded image.
- AI topic generation works.
- AI topic generation shows connected school context when the selected
  classroom has NEIS school data.
- AI topic refinement works.
- AI feedback draft works.
- Topic bulk AI feedback draft generation works and does not overwrite existing
  AI drafts or final feedback.
- A joking, careless, or very short writing sample receives firm but warm
  feedback without forced praise.
- Teacher final feedback can be saved.
- Student can see the saved final feedback.
- Railway logs show no repeated errors.
- Google Cloud budget/quota dashboards look normal.
- Railway usage limits look normal.

## 14. Rollback Notes

For web/API code problems, redeploy the previous known-good commit from Vercel
or Railway.

For database changes, do not rely on a quick code rollback. Back up before
migrations and use a deliberate restore or forward-fix plan if migration data
changes are involved.

For upload issues, confirm the Railway Volume is still mounted and that
`UPLOADS_DIR` points to the mounted path.
