# 06 - Gmail Push (Pub/Sub) Webhook

Cross-refs: [01-architecture](01-architecture.md), [02-auth-security](02-auth-security.md), [03-ingestion-classification](03-ingestion-classification.md), [05-data-layer](05-data-layer.md), [07-frontend](07-frontend.md), [08-devops-deployment](08-devops-deployment.md), [09-scalability-reliability](09-scalability-reliability.md).
Labels: **[Verified]** read in code/git, **[Risk]**, **[Opportunity]**. Paths relative to repo root.

## 1. Current state in one paragraph

**[Verified]** Only the receiving half exists, and even that is inert. There is an authenticated route (`POST /webhook/gmail`), a payload decoder and a stale-`historyId` check, but: no code registers a Gmail watch, no schema columns exist to store `historyId`/expiry, nothing processes history, and production env/deploy plumbing for the auth variables is incomplete, so the endpoint rejects every request with 401. Root CLAUDE.md, README and the `webhook` branch description are all out of date or wrong about this (details below).

## 2. What exists

| Piece | File:line | State |
|---|---|---|
| Route mount | `server/server.js:46` `app.use("/webhook", webhookRoutes)` (public, before `requireAuth`, no rate limiter) | present |
| Route | `server/routes/webhookRoutes.js:8` `POST /gmail` -> `verifyPubSubToken`, `gmailWebhook` | present |
| OIDC verification | `server/utils/verifyPubSubToken.js:10-39` | present, reasonable (3) |
| Controller | `server/controllers/webhook/gmailWebhook.js:11-53` | decodes + acks only |
| Watch registration | `setupGmailWatch` | **does not exist** |
| Schema columns | `last_history_id`, `watch_expiration` | **do not exist** |
| Renewal | none | missing |
| Client notification | none | missing |

### Things claimed elsewhere that are false in this checkout
- **[Verified]** `services/gmailWatchService.js` does not exist. `git ls-files server` has no such file; `git ls-tree -r webhook` (the `webhook` branch) also has no `*watch*` file, and `git log --all -- server/services/gmailWatchService.js` is empty. A repo-wide grep for `setupGmailWatch|watch_expiration|last_history_id` (node_modules excluded) hits only `gmailWebhook.js:40` (reads `user.last_history_id`), CLAUDE.md and the README.
- **[Verified]** `server/controllers/auth/callback.js` (lines 1-124) never calls any watch function; it only upserts the user, seeds categories and calls `createSession`. So the CLAUDE.md sentence "called from the OAuth callback" is wrong.
- **[Verified]** `schema.prisma:10-25` (and the `webhook` branch schema, grep empty) has no `last_history_id` / `watch_expiration`. See [05](05-data-layer.md).
- **[Verified]** `GOOGLE_PUBSUB_TOPIC` is never read by any `.js` file in `server/` (only referenced in `docker-compose.yml:28` and README:15,109). README.md:15 ("watch registration ... exist") is therefore wrong.
- **[Verified]** CLAUDE.md says the webhook "does not yet verify the Pub/Sub token": stale. Verification was added on `main` (`verifyPubSubToken.js`, wired at `webhookRoutes.js:8`). Note the `webhook` branch lacks it (`git diff --stat main webhook` shows `verifyPubSubToken.js` 41 lines absent there); `main` is ahead of that branch.

## 3. Webhook authentication review

`server/utils/verifyPubSubToken.js`:
- Requires `Authorization: Bearer <jwt>` (line 21); verifies with `new OAuth2Client().verifyIdToken({idToken, audience})` (line 26). google-auth-library fetches Google's public certs, checks RS256 signature, `exp`/`iat`, issuer (`accounts.google.com` / `https://accounts.google.com`) and `aud` equals `PUBSUB_AUDIENCE` - **[Verified]** that is what `verifyIdToken` does by default in v9 (`google-auth-library ^9.15.1`), so signature/issuer/audience are all enforced by the library, not hand-rolled.
- Then requires `email_verified === true` and `email === PUBSUB_SERVICE_ACCOUNT_EMAIL` (line 29). This is the correct Pub/Sub push pattern (the push subscription's service account identity).
- Fails closed with 401 if either env var is missing (lines 14-17) or on any exception (35-38). Does not leak detail to the caller.
- **[Verified]** Correctness of the design: good. Minor points:
  - **[Risk, low]** It does not check `payload.sub`/`azp` against the SA's unique id; email match is the standard approach and sufficient.
  - **[Risk, low]** Public route, no rate limit: an attacker can force repeated JWT parse attempts; cheap and cert fetch is cached. Optional: reuse `authLimiter` style limiter for `/webhook`.
  - **[Risk, low]** Pub/Sub push also sends a `subscription` and `messageId`; neither is validated or used (see idempotency).

### Production wiring is incomplete
- **[Verified]** `docker-compose.yml:26-28` passes `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PUBSUB_TOPIC` from `${...}` substitution.
- **[Verified]** `.github/workflows/deploy.yml:76-85` writes only DB_*, DATABASE_URL, GOOGLE_*, GEMINI_API_KEY, FRONTEND_URL, SESSION_SECRET into `.env`. None of the three PUBSUB variables are written. Compose substitutes empty strings, so in production `verifyPubSubToken` hits the missing-config branch and returns 401 for everything. Fail-closed, safe, but the feature cannot work until deploy.yml (and GitHub secrets) are updated, per the "add env var in both places" rule in CLAUDE.md. Also `docker-compose.local.yml` has no PUBSUB vars (it loads `server/.env`; README documents only GOOGLE_PUBSUB_TOPIC). See [08](08-devops-deployment.md).
- **[Risk]** `PUBSUB_AUDIENCE` must exactly equal the audience configured on the Pub/Sub push subscription (typically the public webhook URL). An HTTPS public URL is also required for push delivery; the EC2 backend behind nginx/ALB must expose `/webhook/gmail`. Not verified from repo.

## 4. Controller behaviour (`gmailWebhook.js`)

- Validates `message.data` string (15), base64-decodes and `JSON.parse`s (22) -> 400 on error (a 400 makes Pub/Sub retry up to the subscription's policy then dead-letter; for a permanently malformed message prefer ack 200/204).
- Validates `emailAddress` (string, <=320) and `historyId` (digits or safe int) at 27-30.
- Looks up `prisma.user.findUnique({where:{email}})` (32). Unknown user -> 200 ack (36). Good (prevents retry storms).
- Stale check (39-44): `stored = user.last_history_id` is `undefined` always (column missing), so the check is always skipped and falls through to the log + 200 (47-48). **[Verified]** Dead code today.
- TODO at line 46: no `history.list`, no persist of `last_history_id`, no ingestion. So today a valid push causes nothing except a log line.
- **[Verified]** The user lookup uses the email from the payload, which is trustworthy only because the JWT was verified; fine. It does not exclude the demo user (`demo@mailwise.app`) - harmless as it has no real Gmail.
- **[Verified]** `export const fetchMail = gmailWebhook` (line 55) is a leftover alias.
- Idempotency: **[Verified]** the intended mechanism (monotonic `historyId` compare) is half-written and needs the column. Pub/Sub is at-least-once and unordered, so the final design must be idempotent; the existing insert (`createMany skipDuplicates` on unique(user_id,email_id), `getEmailsByCategory.js:93`) already makes message processing idempotent, which helps a lot.

## 5. Gmail push facts that shape the design (external, from Gmail API docs; not in repo)
- `users.watch` (topic, labelIds) returns `{historyId, expiration}`; the watch **expires after at most 7 days** and must be re-called (Google recommends daily). The topic must grant `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role.
- The notification body carries only `{emailAddress, historyId}` - no message ids. You must call `users.history.list(startHistoryId = last stored historyId, historyTypes=['messageAdded'])` and then fetch the messages.
- `history.list` can return 404 if `startHistoryId` is too old (history retained roughly a week or less); you then must do a full/recent resync (the current "list latest 20" path).
- Notifications are rate-limited per user (about 1/sec) and may be delayed or dropped; Google advises a fallback periodic sync.

## 6. Right-sized design to complete it

Principle: reuse the existing pipeline pieces; add the minimum new state; keep the existing "list latest 20 + diff" as the correctness fallback.

### 6.1 Schema (one migration; see [05](05-data-layer.md) section 2)
Add to `User`: `last_history_id BigInt?` (or `String?`; ids exceed 2^53 rarely but BigInt matches existing `update` handling) and `watch_expiration DateTime?`. Do via a migration, not an ad-hoc `db push`.

### 6.2 Extract the ingest core
Refactor `getEmailsByCategory.js` lines ~58-100 into `services/ingestService.ingestMessageIds(userId, gmail, ids)` that does: `filterUnprocessedEmailIds` -> category lookup -> `fetchRawEmailsConcurrently` -> `processAndClassifyEmails` -> `createMany skipDuplicates`. Both the HTTP list route and the webhook call it. This is the only real refactor and also removes duplicated logic ([03](03-ingestion-classification.md)).

### 6.3 `services/gmailWatchService.js`
- `setupGmailWatch(userId)`: `getAuthenticatedClient({userId})` -> `gmail.users.watch({userId:'me', requestBody:{topicName: process.env.GOOGLE_PUBSUB_TOPIC, labelIds:['INBOX']}})` wrapped in `executeWithRetry` (existing helper). Persist `watch_expiration = new Date(Number(expiration))`; set `last_history_id` ONLY if currently null (so an existing cursor is not moved forward and mail skipped).
- No-op (log once) if `GOOGLE_PUBSUB_TOPIC` is unset, so local dev and the demo keep working; skip demo user.

### 6.4 Webhook handler flow
1. Verify JWT (exists). Parse and validate (exists). Look up user.
2. If `stored` and `incoming <= stored` -> ack (exists; works once the column exists).
3. Ack fast: respond 204 immediately, then process in the background (`setImmediate`) because the Pub/Sub ack deadline is short (default 10 s) and classification may take longer. Alternative for simplicity: process inline with a hard timeout; at this app's volume background-after-ack is fine but errors then need to be logged since Pub/Sub will not retry.
4. Process: per-user in-flight guard (a `Map<userId, Promise>` chaining runs) so concurrent pushes serialize; then `history.list({startHistoryId: stored, historyTypes:['messageAdded'], labelId:'INBOX'})` following `nextPageToken`; collect unique `messagesAdded[].message.id`; call `ingestMessageIds`; then persist `last_history_id = response.historyId` (the latest from history.list), and only after ingestion succeeded.
5. On 404 from history.list: fall back to listing the latest 20 ids (existing behaviour), ingest, and set `last_history_id` to the incoming id.
6. Idempotency: out-of-order/duplicate pushes are handled by the monotonic check plus `skipDuplicates`. Use a conditional update (`updateMany where last_history_id < new`) to avoid moving the cursor backwards.
7. Return 2xx for any non-retriable situation (unknown user, malformed message); return 5xx only for transient failures worth retrying (DB down).

### 6.5 Renewal (pick lazy, not cron)
- **Lazy on login + on use (recommended):** call `setupGmailWatch` from the OAuth callback AND from `/auth/me` or `getEmailsByCategory` when `watch_expiration` is null or within 24h. It piggybacks on existing traffic, needs no scheduler, no second process, and fits the single-container deploy. Weakness: a user who does not open the app for >7 days loses push until they return - which is acceptable since mail is ingested on their next visit anyway.
- **Optional cron:** a `setInterval` (daily) in `server.js` that renews watches where `watch_expiration < now+2d`. Easy for single instance; becomes duplicated work if you ever run 2 replicas (see [09](09-scalability-reliability.md)). Skip unless you want mail processed while users are away.
- Also handle refresh-token revocation (`invalid_grant`): stop retrying; clear `watch_expiration` (a "disconnected" state).

### 6.6 Ops/config
- Add `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PUBSUB_TOPIC` to GitHub secrets and the `.env` step in `deploy.yml:76-85`; compose already forwards them.
- GCP: create topic; grant `gmail-api-push@system.gserviceaccount.com` Publisher; create a push subscription to `https://<api-host>/webhook/gmail` with OIDC auth (service account email + audience); the OAuth consent/scope must include Gmail read (already used).
- Optional: add a small rate limiter on `/webhook`.

## 7. How the client learns about new mail

**[Verified]** There is no realtime channel today: no websocket/SSE server code in `server/` (the websocket dependency in the client is an unused leftover per CLAUDE.md), and the client only gets new mail when it calls `GET /fetch-emails/:category`, which itself ingests. So even a perfect webhook only fills the DB; the UI would not show it until the next fetch. Options, smallest first:
1. **Do nothing realtime**: push makes the next page load instant (mail already classified) but the user still must refresh/navigate. Cheap, genuinely useful.
2. **Client polling a cheap endpoint**: e.g. `GET /fetch-emails/count?since=<ts>` or a `lastIngestedAt` field; client polls every 60 s when the tab is visible and refetches on change. No new infrastructure and works with cookies auth ([02](02-auth-security.md)). Needs a small client change in the `emailContext` provider ([07](07-frontend.md)).
3. **SSE** (`GET /events`, one `res` kept per user in a Map; webhook calls `notify(userId)`). Works only on a single backend instance (in-memory registry), needs nginx buffering disabled, and keep-alive pings. About 40 lines, worth it only if instant updates matter.

## 8. Is push worth it vs polling?

Honest assessment for this app:
- **Pro push:** fresher data, classification cost moved off the user's critical path (first page view after a long absence is currently slow because it fetches and runs Gemini inline), fewer wasted `messages.list` calls.
- **Con:** needs GCP Pub/Sub project, IAM, a stable public HTTPS endpoint with audience matching, watch renewal, history-gap fallback, new columns, three more secrets in the deploy pipeline, and background processing/error handling in a single-container app with no job queue. It also means classifying (Gemini cost) mail for users who never return, and ingest concurrency per user. Each user's Gmail watch requires their refresh token to stay valid; revoked tokens create silent failures. For a portfolio-scale app with few users, the operational surface is large relative to benefit.
- **Current polling-on-view cost is small:** one `messages.list` (20 ids) per category click.
- **Recommendation:** Do not complete push until there is real demand for background ingestion/notifications. If fresher UI is the goal, option 2 above (client polling the existing list endpoint on a timer / on tab focus) delivers 90% of the value for a tiny fraction of the work. If push is wanted as a learning/portfolio feature, implement 6.1-6.5 as above in that order and keep the list-based sync as the fallback.
- Either way, remove or fix the misleading claims (README:15, CLAUDE.md "Gmail push" paragraph, `GOOGLE_PUBSUB_TOPIC` as "optional" when no code reads it) so the repo's docs match the code.

## Prioritized recommendations

1. (High, trivial) Correct the docs: no `gmailWatchService.js` exists, callback does not register a watch, webhook auth is done, columns are absent. Update README:15 and the CLAUDE.md Gmail-push paragraph.
2. (High, decision) Decide push vs "polling on view/timer". If skipping push, delete or clearly mark `routes/webhookRoutes.js`, `controllers/webhook/gmailWebhook.js`, `verifyPubSubToken.js`, and the three compose env lines to cut attack surface (public unauthenticated-route code that does nothing).
3. (Medium, if keeping) Make the stub honest: webhook currently reads a nonexistent column; add the migration (`last_history_id`, `watch_expiration`) or remove that check.
4. (Medium, if finishing) Extract `ingestMessageIds` from `getEmailsByCategory.js`; add `gmailWatchService`; implement `history.list` flow with 404 fallback and per-user serialization; ack-fast + background process.
5. (Medium, if finishing) Wire PUBSUB_* secrets into `deploy.yml` `.env` generation and GCP IAM/subscription; lazy renewal on login/use.
6. (Low) Return 2xx (not 400) for permanently malformed messages; add a rate limiter to `/webhook`.
7. (Low) Add a lightweight client poll or SSE only after backend ingestion works.
