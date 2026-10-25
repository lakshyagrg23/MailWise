# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MailWise is a Gmail client that classifies mail into user-defined categories with Gemini, plus on-demand AI summaries and AI-drafted emails. Monorepo: `client/` (React SPA) and `server/` (Express API + Prisma/PostgreSQL). The root README is outdated; trust the code.

## Commands

Client (`cd client`): `npm run dev` (Vite on :3000), `npm run build`, `npm run lint`. No test runner is configured.

Server (`cd server`): `npm start` (`node server.js`, port 5000), `npx prisma db push` to sync the schema, `npx prisma generate`. No dev/watch script and no tests.

Full local stack: `docker compose -f docker-compose.local.yml up --build` (Postgres, backend on :5000, nginx-served client on :80). It reads `server/.env`.

Required server env: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY`, `FRONTEND_URL`; optional `GOOGLE_PUBSUB_TOPIC` (Gmail push). Client uses `VITE_BACKEND_URL` (defaults to `http://localhost:5000`).

## Architecture

**Auth (no sessions/JWT).** `/auth/callback` upserts the user, stores Google access/refresh tokens in Postgres, seeds 7 default categories for new users, and redirects to the frontend with `access_token`, `user_id`, `name` in the query string. The client saves them in `localStorage` (`mailwise_token`, `mailwise_user_id`) and sends the token as `?access_token=` (or Bearer header) plus `user_id` on every call. Server-side, `services/googleAuthService.getAuthenticatedClient` resolves the user (`userId` > `googleId` > token), refreshes the token if it expires within 5 minutes, persists it, and returns a Gmail client. Note `userId` takes priority over the token, and user-scoped routes do no ownership check.

**Demo mode.** The literal token `"demo"` short-circuits nearly every controller to return seeded data. `/auth/demo` resets the `demo_google_id` user. New controllers must handle `"demo"` or they will break the demo flow.

**Ingestion pipeline** (triggered by `GET /fetch-emails/:category`, in `controllers/emails/getEmailsByCategory.js`):
1. List latest 30 Gmail IDs, then `gmailFetchService.filterUnprocessedEmailIds` diffs against `email_metadata`.
2. `fetchRawEmailsConcurrently` (concurrency 10) fetches and cleans bodies via `utils/emailCleaner` (cap 1200 chars).
3. `batchClassificationService.processAndClassifyEmails`: Gmail labels SPAM / CATEGORY_PROMOTIONS / CATEGORY_SOCIAL bypass Gemini; the rest are token-batched (~8000 est. tokens) and classified 2 batches at a time, requesting only `{email_id, category}` JSON. Unknown or missing results fall back to a Miscellaneous-like default category, and that fallback is persisted (never retried).
4. `createMany` with `skipDuplicates`, then the category filter is applied from the DB.

Only metadata is stored. Bodies/attachments are fetched live from Gmail (`/fetch-email/:id`). `emailsummary` holds either a short snippet or a Gemini summary. Code on both client and server distinguishes them by checking for `•` or `Action Item:`; keep that convention consistent. `/email/summarize/:id` caches into that column.

**Shared helpers:** `utils/retryHelper.executeWithRetry` (backoff on 429/5xx/network only) and `utils/asyncPool` (sliding-window concurrency) wrap all Gmail/Gemini calls.

**Gmail push (WIP on branch `webhook`).** `services/gmailWatchService.setupGmailWatch` (called from the OAuth callback) registers `users.watch` and stores `last_history_id` / `watch_expiration`. `controllers/webhook/gmailWebhook.js` currently only decodes and acks the Pub/Sub message; it does not yet verify the Pub/Sub token, call `history.list`, or process mail. Watches expire in ~7 days and nothing renews them.

**Routing quirks (`server/server.js`).** `emailActionRoutes` is mounted at both `/email` and `/emails`; it contains `POST /send-emails`, `GET /summarize/:emailId`, and `DELETE /:userId`. In `emailDetailRoutes`, `/email` (AI draft generation) must stay before `/:emailId`. `BigInt.prototype.toJSON` is patched globally because `update` columns are BigInt.

**Categories.** Per-user rows in `category_preferences`; the description is what the classifier prompt sees. Renaming/deleting a category does not update `email_metadata.category`, so existing emails keep the stale name.

**Client.** `App.jsx` owns auth bootstrap and a single large `emailContext` (about 17 state values); components read it via `useContext`. Routes: `Main` (header + sidebar + `Outlet`) with `emails/:type` (`Email.jsx` list, rows rendered by `DisplayEmail`) and `/view` (`ViewEmails.jsx`). UI mixes MUI and Tailwind. `api/api.url.js`, `routes/route.js`, and several `package.json` deps (three/@react-three, react-scripts, syncfusion, websocket) are unused leftovers.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`: builds `./server` into `ghcr.io/<owner>/mailwise-backend`, SSHes to EC2, writes `.env` from GitHub secrets, and runs `docker compose pull && up -d`. Only the backend is deployed this way (the frontend is on Amplify, allowed via a hardcoded CORS origin in `server.js`). The server container runs `prisma db push --accept-data-loss` on every start, so destructive schema changes will drop data in production. Adding a new env var requires updating both `docker-compose.yml` and the `.env` generation step in `deploy.yml`.
