# CLAUDE.md

Guidance for Claude Code in this repository. The root `README.md` is outdated; trust the code. Detailed, evidence-based analysis lives in [`.claude/docs/`](.claude/docs/README.md) (index) - read the relevant document before changing an area.

## What this is

MailWise: a Gmail client that classifies mail into user-defined categories with Gemini, plus on-demand AI summaries and AI-drafted emails. Monorepo:
- `client/` - React 19 + Vite SPA (MUI + Tailwind, react-router 7, axios). Hosted on AWS Amplify.
- `server/` - Express 4 (ESM) + Prisma 5.21 + PostgreSQL, Google APIs (`googleapis`), Gemini (`@google/generative-ai`). Deployed as one Docker container on EC2.

## Commands

- Client (`cd client`): `npm run dev` (Vite :3000), `npm run build`, `npm run lint` (currently reports errors). No tests.
- Server (`cd server`): `npm start` (`node server.js`, :5000; `app.js` builds the Express app via `createApp()`, `server.js` validates env and listens). `npx prisma generate`. `npm test` runs the `node:test` suite in `server/tests/` (no database or network needed; it uses `createApp()` plus fake-user routers, so DB-backed behaviour is not covered). No dev/watch script.
- Local stack: `docker compose -f docker-compose.local.yml up --build` (Postgres, backend :5000, nginx client :80). It needs `DB_PASSWORD` from the shell or a root `.env`; use `--env-file server/.env` if needed.
- Server env (all read only in `server/config/env.js`): the server refuses to boot without **`SESSION_SECRET`** (>=16 chars), `DATABASE_URL`, `FRONTEND_URL` (it lists everything missing at once); `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY` only log a warning at boot (demo mode works without them) but are required for real use. Optional: `SESSION_SAMESITE` (default `lax`), `COOKIE_DOMAIN`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`. Client: `VITE_BACKEND_URL` (default `http://localhost:5000`).

## Architecture (verified against code)

**Auth = signed HttpOnly cookie session** (`server/utils/session.js`, `middleware/requireAuth.js`). `/auth` flow uses an OAuth `state` cookie; `/auth/callback` upserts the user, stores Google tokens in Postgres (**plaintext**), seeds default categories, sets the `mailwise_session` cookie (HMAC-signed `{uid, exp}`, 7 days, no revocation) and redirects to the frontend. The client calls `GET /auth/me` on boot with `withCredentials`. Identity comes **only** from `req.user.id`; never read `user_id`/tokens from query, body or params. `services/googleAuthService` refreshes the Google token and returns a Gmail client. The resource API lives under `/api/v1` (`routes/v1/`: `/emails`, `/sent`, `/drafts`, `/categories`, `/ai`) with `requireAuth` applied once at its root (one route file per resource, each mirrored by a `controllers/<resource>/` folder); `/auth` (per-IP limiter on `/url`, `/callback`, `/demo`) and `/webhook` (public, verifies a Pub/Sub OIDC token) stay unversioned because Google registers those URLs. CORS allowlist = `FRONTEND_URL` (+ localhost origins outside production).

**Demo mode.** `POST /auth/demo` (transactional reset + seed) resets and logs in as the shared real DB user `demo_google_id`; `req.user.isDemo` makes controllers return seeded data without touching Gmail/Gemini. New controllers must branch on `req.user.isDemo`. All visitors share this one user.

**Ingestion** (`POST /api/v1/emails/sync`, `controllers/emails/syncEmails.js` -> `services/syncService.js`; the client then reads `GET /api/v1/emails`, which is DB-only and side-effect free): list the newest **20** Gmail IDs -> `gmailFetchService.filterUnprocessedEmailIds` diffs against `email_metadata` -> `fetchRawEmailsConcurrently` (concurrency 10, bodies cleaned by `utils/emailCleaner`, 1200-char cap) -> `batchClassificationService.processAndClassifyEmails` (SPAM / CATEGORY_PROMOTIONS / CATEGORY_SOCIAL labels bypass Gemini; the rest go to Gemini as `{email_id, category}` JSON; in practice always one batch) -> `createMany` with `skipDuplicates`. Unknown or failed results fall back to a default category **and are persisted, never retried**. No pagination/backfill.

**Storage.** Only metadata (`users`, `email_metadata`, `category_preferences`; no indexes beyond uniques). Bodies are fetched live (`GET /api/v1/emails/:id`, which lists attachments as metadata only: `{partId, filename, mimeType, size}`); attachment bytes come from `GET /api/v1/emails/:id/attachments/:partId` (forced download, keyed by stable `partId`, 25 MB cap). `emailsummary` holds either a short snippet or a Gemini summary, distinguished everywhere by checking for `•` or `Action Item:` (server `summarizeEmail.js`, client `DisplayEmail.jsx`, `ViewEmails.jsx`). Keep that convention consistent until it is replaced by a dedicated column. Renaming a category (`PATCH /categories/:id`) re-labels `email_metadata.category` in the same transaction; **deleting** one still does not (emails keep the stale name).

**Helpers.** `utils/retryHelper.executeWithRetry` (429/5xx/network backoff, ignores `Retry-After`, not applied to every Gmail call) and `utils/asyncPool`. `BigInt.prototype.toJSON` is patched globally in `app.js`. `config/env.js` loads dotenv itself and is the ONLY module that may read `process.env`; import `{ env }` from it everywhere else (so import order no longer matters). The Prisma client is `lib/prisma.js`.

**Routing conventions.** Resource-style under `/api/v1`: GET is read-only (list reads the DB; Gmail pulls are `POST /emails/sync`), flags are `PATCH /emails/:id`, summaries `POST /emails/:id/summary`, drafts `POST` create / `PUT /:id` update, categories keyed by **id**. Every async handler is wrapped in `utils/http/asyncHandler`; throw `HttpError` (`utils/http/httpErrors.js`) for expected failures and let `toErrorResponse` in the central handler map them (Prisma `P2002` -> 409, Gmail insufficient-scope 403 -> `reauth_required`, everything else -> generic 500). Validate path params with `router.param` + `utils/http/params.js`; request-body validators live in `validators/`. Per-route limiters exist only for sync (30/min), summarize (60/min), AI compose (20/min); `emails/send` and `emails/:id` are not limited. Gmail-push auth middleware lives in `middleware/verifyPubSubToken.js`. Built-in view names (`all, inbox, starred, sent, drafts`) are reserved and rejected as category names (`config/categories.js`).

**Gmail push is not functional.** `controllers/webhook/gmailWebhook.js` verifies the Pub/Sub token and acks, but there is no `gmailWatchService`, no watch registration, no `last_history_id`/`watch_expiration` columns, no `history.list`, and no client channel. `GOOGLE_PUBSUB_TOPIC` is read by no code.

**Client.** `App.jsx` owns auth bootstrap and a ~17-value `emailContext` (5 values unused, new object every render). Layout: `pages/` (routed screens: `Main` shell, `Email` list, `ViewEmails` detail), `components/{layout,mail,compose,categories,common}/`, `context/emailContext.js`, `api/`, `utils/`. Routes: `Main` (header, sidebar, `Outlet`) with `emails/:type` (`pages/Email.jsx` -> `mail/DisplayEmail`) and `/view` (`pages/ViewEmails.jsx`). Import paths must match file-name case exactly (Amplify builds on Linux). `GmailOAuthApp.jsx` is the live login/demo page. Email HTML is sanitized with DOMPurify in `utils/formatEmailBody.js` (strict config, remote images blocked by default) - do not weaken it. Tailwind currently loads via a runtime CDN script in `index.html`. **All HTTP calls go through `client/src/api/` modules** (`auth.js`, `emails.js`, `drafts.js`, `categories.js`, `ai.js`; shared axios instance and `API` prefix in `http.js`); they return unwrapped data and throw on failure. Components must not import `http` or hard-code `/api/v1` paths. About 14 deps are unused (three/@react-three, syncfusion, websocket, react-scripts, react-hot, react-calendar, ...).

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml` (no lint/build/test gate): builds `./server` into `ghcr.io/<owner>/mailwise-backend:latest`, SSHes to EC2, writes `.env` from GitHub secrets, `docker compose pull && up -d`. The frontend is on Amplify. **`server/Dockerfile:27` runs `prisma db push --accept-data-loss` on every start**, so destructive schema changes drop production data (`prisma/migrations/` holds a baseline but nothing applies it; its README is wrong about this). Adding an env var requires updating `docker-compose.yml` **and** the `.env` step in `deploy.yml`; currently `SESSION_SAMESITE`, `COOKIE_DOMAIN` and `PUBSUB_*` are missing there.

## Known issues to keep in mind

Top items (full list with evidence in [`.claude/docs/README.md`](.claude/docs/README.md)): `db push --accept-data-loss` in prod; plaintext Google tokens; failed Gemini batches persisted with the default category; stale category names after category delete; outbound mail always `text/html`; category list on the client ignores the URL param; trash button in `ViewEmails.jsx` is local-only.

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
