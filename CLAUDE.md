# CLAUDE.md

Guidance for Claude Code in this repository. The root `README.md` is outdated; trust the code. Detailed, evidence-based analysis lives in [`.claude/docs/`](.claude/docs/README.md) (index) - read the relevant document before changing an area.

## What this is

MailWise: a Gmail client that classifies mail into user-defined categories with Gemini, plus on-demand AI summaries and AI-drafted emails. Monorepo:
- `client/` - React 19 + Vite SPA (MUI + Tailwind, react-router 7, axios). Hosted on AWS Amplify.
- `server/` - Express 4 (ESM) + Prisma 5.21 + PostgreSQL, Google APIs (`googleapis`), Gemini (`@google/generative-ai`). Deployed as one Docker container on EC2.

## Commands

- Client (`cd client`): `npm run dev` (Vite :3000), `npm run build`, `npm run lint` (currently reports errors). No tests.
- Server (`cd server`): `npm start` (`node server.js`, :5000). `npx prisma generate`. No dev/watch script, no tests.
- Local stack: `docker compose -f docker-compose.local.yml up --build` (Postgres, backend :5000, nginx client :80). It needs `DB_PASSWORD` from the shell or a root `.env`; use `--env-file server/.env` if needed.
- Required server env: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY`, `FRONTEND_URL`, **`SESSION_SECRET`** (>=16 chars, the server refuses to boot without it). Optional: `SESSION_SAMESITE` (default `lax`), `COOKIE_DOMAIN`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`. Client: `VITE_BACKEND_URL` (default `http://localhost:5000`).

## Architecture (verified against code)

**Auth = signed HttpOnly cookie session** (`server/utils/session.js`, `middleware/requireAuth.js`). `/auth` flow uses an OAuth `state` cookie; `/auth/callback` upserts the user, stores Google tokens in Postgres (**plaintext**), seeds default categories, sets the `mailwise_session` cookie (HMAC-signed `{uid, exp}`, 7 days, no revocation) and redirects to the frontend. The client calls `GET /auth/me` on boot with `withCredentials`. Identity comes **only** from `req.user.id`; never read `user_id`/tokens from query, body or params. `services/googleAuthService` refreshes the Google token and returns a Gmail client. Routes under `/fetch-emails`, `/fetch-email`, `/categories`, `/email`, `/emails` are behind `requireAuth`; `/auth` has a per-IP limiter; `/webhook` is public (verifies a Pub/Sub OIDC token). CORS allowlist = `FRONTEND_URL` (+ localhost origins outside production).

**Demo mode.** `GET /auth/demo` resets and logs in as the shared real DB user `demo_google_id`; `req.user.isDemo` makes controllers return seeded data without touching Gmail/Gemini. New controllers must branch on `req.user.isDemo`. All visitors share this one user.

**Ingestion** (`GET /fetch-emails/:category`, `controllers/emails/getEmailsByCategory.js`): list the newest **20** Gmail IDs -> `gmailFetchService.filterUnprocessedEmailIds` diffs against `email_metadata` -> `fetchRawEmailsConcurrently` (concurrency 10, bodies cleaned by `utils/emailCleaner`, 1200-char cap) -> `batchClassificationService.processAndClassifyEmails` (SPAM / CATEGORY_PROMOTIONS / CATEGORY_SOCIAL labels bypass Gemini; the rest go to Gemini as `{email_id, category}` JSON; in practice always one batch) -> `createMany` with `skipDuplicates` -> category filter from DB. Unknown or failed results fall back to a default category **and are persisted, never retried**. No pagination/backfill.

**Storage.** Only metadata (`users`, `email_metadata`, `category_preferences`; no indexes beyond uniques). Bodies/attachments are fetched live (`/fetch-email/:id`). `emailsummary` holds either a short snippet or a Gemini summary, distinguished everywhere by checking for `•` or `Action Item:` (server `summarizeEmail.js`, client `DisplayEmail.jsx`, `ViewEmails.jsx`). Keep that convention consistent until it is replaced by a dedicated column. Renaming/deleting a category does **not** update `email_metadata.category`.

**Helpers.** `utils/retryHelper.executeWithRetry` (429/5xx/network backoff, ignores `Retry-After`, not applied to every Gmail call) and `utils/asyncPool`. `BigInt.prototype.toJSON` is patched globally in `server.js`. `server.js` relies on module-level `dotenv.config()` ordering; do not reorder imports carelessly.

**Routing quirks.** `emailActionRoutes` is mounted at both `/email` and `/emails`. Per-route limiters exist only for sync (30/min), summarize (60/min), AI draft (20/min); `send-emails` and `fetch-email/:id` are not limited. Every unhandled error becomes a generic 500.

**Gmail push is not functional.** `controllers/webhook/gmailWebhook.js` verifies the Pub/Sub token and acks, but there is no `gmailWatchService`, no watch registration, no `last_history_id`/`watch_expiration` columns, no `history.list`, and no client channel. `GOOGLE_PUBSUB_TOPIC` is read by no code.

**Client.** `App.jsx` owns auth bootstrap and a ~17-value `emailContext` (5 values unused, new object every render). Routes: `Main` (header, sidebar, `Outlet`) with `emails/:type` (`Email.jsx` -> `DisplayEmail`) and `/view` (`ViewEmails.jsx`). `GmailOAuthApp.jsx` is the live login/demo page. Email HTML is sanitized with DOMPurify in `utils/formatEmailBody.js` (strict config, remote images blocked by default) - do not weaken it. Tailwind currently loads via a runtime CDN script in `index.html`. About 14 deps are unused (three/@react-three, syncfusion, websocket, react-scripts, react-hot, react-calendar, ...).

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml` (no lint/build/test gate): builds `./server` into `ghcr.io/<owner>/mailwise-backend:latest`, SSHes to EC2, writes `.env` from GitHub secrets, `docker compose pull && up -d`. The frontend is on Amplify. **`server/Dockerfile:27` runs `prisma db push --accept-data-loss` on every start**, so destructive schema changes drop production data (`prisma/migrations/` holds a baseline but nothing applies it; its README is wrong about this). Adding an env var requires updating `docker-compose.yml` **and** the `.env` step in `deploy.yml`; currently `SESSION_SAMESITE`, `COOKIE_DOMAIN` and `PUBSUB_*` are missing there.

## Known issues to keep in mind

Top items (full list with evidence in [`.claude/docs/README.md`](.claude/docs/README.md)): `db push --accept-data-loss` in prod; plaintext Google tokens; failed Gemini batches persisted with the default category; stale category names after rename/delete; outbound mail always `text/html`; category list on the client ignores the URL param; trash button in `ViewEmails.jsx` is local-only; demo branch of the sync controller is outside try/catch.

## Analysis documents

| Doc | Topic |
|---|---|
| [01-architecture](.claude/docs/01-architecture.md) | Components, flows, endpoint contract, doc drift |
| [02-auth-security](.claude/docs/02-auth-security.md) | Session, OAuth, demo, ownership matrix, risks |
| [03-ingestion-classification](.claude/docs/03-ingestion-classification.md) | Gmail fetch, Gemini batching, retry/pool |
| [04-ai-and-gmail-actions](.claude/docs/04-ai-and-gmail-actions.md) | Summaries, drafts, send/MIME |
| [05-data-layer](.claude/docs/05-data-layer.md) | Schema, migrations, queries, transactions |
| [06-gmail-push-webhook](.claude/docs/06-gmail-push-webhook.md) | Push status and completion design |
| [07-frontend](.claude/docs/07-frontend.md) | Client architecture, deps, UX bugs |
| [08-devops-deployment](.claude/docs/08-devops-deployment.md) | CI/CD, Docker, env inventory, ops |
| [09-scalability-reliability](.claude/docs/09-scalability-reliability.md) | What breaks first, what not to build |
