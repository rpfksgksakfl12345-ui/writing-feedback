# AGENTS.md

## Local Dev Server

This repo is `writing-feedback`. It is a Windows PowerShell based local dev setup with:

- `apps/web`: Next.js on `http://localhost:3000`
- `apps/api`: Express/TypeScript on `http://localhost:4000`
- PostgreSQL via Docker Compose

Keep server automation changes small. Prefer the existing npm scripts (`dev`, `db:up`, `db:down`) and do not create, overwrite, print, or modify env values unless the user explicitly asks.

## When The User Says "서버 켜줘"

Run the project automation instead of starting ad hoc terminals:

1. Work from the repo root and confirm the root `package.json` name is `writing-feedback`.
2. Check the existing `.dev/dev-server.pid` and logs before starting another server.
3. Do not edit env files. Confirm `apps/api/.env` exists; if it is missing, tell the user to create it from `apps/api/.env.example`.
4. Run `npm run dev:boot`.
5. If Codex sandboxing blocks Docker or port inspection, rerun `npm run dev:boot` with the needed approval instead of bypassing the script.
6. After success, report `http://localhost:3000`, `http://localhost:4000`, and `http://localhost:4000/health`.

`npm run dev:boot` is responsible for the practical checks:

- validates the repo root and `apps/api/.env`
- removes a stale PID file when the saved process is gone
- detects an already running dev process by PID/log state before starting a duplicate
- checks ports `3000` and `4000` and prints readable owner information on conflicts
- checks Docker CLI, tries to start Docker Desktop when it is not running, and waits briefly for Docker readiness
- reuses `npm run db:up`
- waits for the Postgres container health check
- starts the existing `npm run dev` command in the background
- waits for both `http://localhost:3000` and `http://localhost:4000/health`
- writes logs to `.dev/dev-server.out.log` and `.dev/dev-server.err.log`

If boot fails, report the stage shown by the script:

- `env`: the user must provide `apps/api/.env`; do not generate or print values
- `docker`: start or restart Docker Desktop, then retry `npm run dev:boot`
- `port-check`: stop the listed process or free the listed port before retrying
- `existing-dev`: run `npm run dev:stop`, then retry
- `db`: inspect `npm run db:logs`
- `dev-server`: check `.dev` logs; run `npm run dev:stop` before retrying if the process is still running

## When The User Says "서버 꺼줘"

1. Run `npm run dev:stop` from the repo root.
2. It stops the background dev process that `dev:boot` started when a PID is available.
3. It reuses `npm run db:down` when Docker is ready.
4. If no PID file exists, explain that a manually started `npm run dev` terminal should be stopped with `Ctrl+C`.
