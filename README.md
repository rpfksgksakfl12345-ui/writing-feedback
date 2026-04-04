# Writing Feedback MVP

## Local Development

1. Install dependencies:
   `npm install`
2. Start PostgreSQL with Docker:
   `npm run db:up`
3. Run Prisma migration:
   `npm run db:migrate`
4. Seed test data:
   `npm run db:seed`
5. Start API and web together:
   `npm run dev`

The web app runs on `http://localhost:3000` and the API runs on `http://localhost:4000`.

## Docker PostgreSQL

The root [docker-compose.yml](./docker-compose.yml) starts one local PostgreSQL container with:

- Database: `writing_feedback`
- User: `writing_feedback_user`
- Password: `writing_feedback_password`
- Port: `5432`

Useful commands:

- Start DB: `docker compose up -d postgres`
- Stop DB: `docker compose down`
- View DB logs: `docker compose logs -f postgres`

## Prisma Commands

- Generate client: `npm run prisma:generate --workspace @writing-feedback/api`
- Run migration: `npm run db:migrate`
- Seed data: `npm run db:seed`

Prisma now uses [apps/api/prisma.config.ts](C:/Users/01028091334/writing-feedback/apps/api/prisma.config.ts) for the seed command instead of the deprecated `package.json#prisma` field.

## Environment Variables

The API reads variables from [apps/api/.env](C:/Users/01028091334/writing-feedback/apps/api/.env):

- `DATABASE_URL`: local Docker PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret for local auth
- `PORT`: API port, default `4000`

If you need to reset the local API config, copy [apps/api/.env.example](C:/Users/01028091334/writing-feedback/apps/api/.env.example) to `apps/api/.env`.

## Seed Accounts

- Teacher: `teacher@test.com` / `password123`
- Student: `student1@test.com` / `password123`
- Student: `student2@test.com` / `password123`

## Troubleshooting

- `P1001: Can't reach database server`: confirm Docker Desktop is running, then run `npm run db:up`.
- Port `5432` already in use: stop another local PostgreSQL instance or change the published port in `docker-compose.yml` and `DATABASE_URL` together.
- Prisma client or migration issues after schema changes: run `npm run prisma:generate --workspace @writing-feedback/api` again.
- Uploaded images not loading: confirm the API server is running on `http://localhost:4000` and that files exist under `apps/api/uploads`.

## Security Notes

- `next` was bumped from `14.2.25` to `14.2.35` to pick up the patched 14.x security release line.
- `multer` remains on `1.x` for now. Upgrading to `2.x` is recommended, but it is deferred because upload middleware behavior changed across the major release and should be regression-tested with the current submission flow.
- TODO: upgrade `multer` to `>=2.1.0` after validating `upload.single("image")`, file error handling, and local disk storage behavior.
