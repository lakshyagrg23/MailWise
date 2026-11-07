# 09 - Scalability, Reliability & Performance

Cross-cutting synthesis. Built from docs [01](01-architecture.md), [03](03-ingestion-classification.md), [04](04-ai-and-gmail-actions.md), [05](05-data-layer.md), [06](06-gmail-push-webhook.md), [08](08-devops-deployment.md) plus direct checks of `server/middleware/rateLimit.js`, `server/prisma.js`, `server/server.js`. Labels: **[Verified]** seen in code, **[Risk]** plausible, **[Opportunity]** improvement.

## 1. Deployment shape today

One backend container on one EC2 host (`docker-compose.yml`), Postgres external to the container, frontend static on Amplify. One Node process, no cluster, no worker, no queue, no cache layer. Rate-limit state, and any future in-flight de-dup state, lives in process memory.

**Judgement:** for a personal/portfolio-scale Gmail client this shape is appropriate. Almost none of the findings below need new infrastructure. They need small code changes. The right question is "what breaks first?", not "how do we scale to N users?".

## 2. What breaks first (ordered by likelihood)

| # | Issue | Label | Evidence | Why it matters |
|---|---|---|---|---|
| 1 | Process crash from unhandled rejection in the demo branch of the sync controller (DB call outside try/catch, Express 4) | **[Verified]** code path; crash behaviour on Node 22 is **[Risk]** | `getEmailsByCategory.js:14-39` (docs 01, 02) | One transient DB error can take the single process down; no orchestrator health check restarts based on liveness (no `/healthz`, doc 08). |
| 2 | Gemini / Gmail failures are swallowed or persisted permanently | **[Verified]** | Failed batch saved with default category, never retried (doc 03); client shows failure as empty inbox (doc 07) | Quota blips become permanent data-quality loss, invisibly. |
| 3 | No timeouts on Gmail/Gemini calls; retry ignores `Retry-After`, retries daily-quota errors | **[Verified]** | `utils/retryHelper.js` (doc 03) | A hung upstream call holds the request (and a pool slot) indefinitely; client has no axios timeout either (doc 07). |
| 4 | Demo user shared by all visitors, reset non-atomically on each `GET /auth/demo` | **[Verified]** | `demoLogin.js` (docs 02, 05) | Concurrent demo visitors corrupt each other's state; also a public state-changing GET. Matters most if the demo is linked from a portfolio. |
| 5 | Unbounded list response, no pagination, no index on `(user_id, received_date)` | **[Verified]** | Main list query has no `take` (doc 05) | Fine at 20-ish mails/user; grows linearly because rows are never expired and there is no backfill ceiling. |
| 6 | Sync runs inline in the request; concurrent syncs duplicate Gmail+Gemini work | **[Verified]** | Unique key + `skipDuplicates` prevents duplicate rows but not duplicate work (doc 03) | Double-clicks / two tabs double the Gemini spend. |
| 7 | `send-emails` and `fetch-email/:id` have no rate limiter; `fetch-email/:id` inlines all attachments with no size cap | **[Verified]** | `rateLimit.js` exports only `aiDraftLimiter(20/min)`, `summarizeLimiter(60/min)`, `syncLimiter(30/min)` (docs 02, 04) | Memory spike per request; abuse surface for Gmail send quota. |
| 8 | All error paths incl. 413 collapse to 500; `express.json()` has the 100 KB default so the code's 1 MB send cap is unreachable | **[Verified]** | `server.js:42,56` (doc 04) | Debuggability and correctness, not scale. |
| 9 | Prisma default connection pool, one `PrismaClient` | **[Verified]** config; **[Risk]** only matters if DB is small/shared | `server/prisma.js` | Default pool (`num_cpus*2+1`) is fine for one process. Set `connection_limit` explicitly only if the DB host is constrained. |
| 10 | Rate limiter uses default in-memory store; `trust proxy` = 1 | **[Verified]** | `rateLimit.js`, `server.js:26` | Correct for a single instance. Counters reset on restart and would not be shared across replicas; `trust proxy 1` is wrong if there is more than one proxy hop (e.g. CloudFront/ALB + nginx) - all users then share one IP key for unauthenticated routes. |

## 3. Request-path analysis

### Ingestion (`GET /fetch-emails/:category`)
Steps, from doc 03: list **20** newest IDs (not 30, `getEmailsByCategory.js:61`) -> diff against `email_metadata` -> fetch bodies (concurrency 10) -> classify -> `createMany` -> read from DB.

- Latency is dominated by one Gemini call. Batching is effectively inert: 20 emails ~ 7.3k estimated tokens, below the ~8000 threshold, so there is one batch and `asyncPool(2)` never parallelises anything **[Verified, doc 03]**. Don't spend effort tuning the batch/pool constants.
- Each sync also makes a Google userinfo call **[Verified, doc 01]** (extra round trip on every sync).
- Quota exposure: free-tier Gemini limits are per-project, not per-user. One chatty user can exhaust classification for everyone. Per-user limiter (30/min) does not protect the shared project quota. **[Risk]**

### Summaries / drafts
Cached into `emailsummary`, so repeat opens are free *only* when the heuristic (`•` / `Action Item:`) recognises the cached value. Summaries using `*`/`-` bullets are re-generated and re-billed on every open **[Verified, doc 04]**. A dedicated nullable `ai_summary` column removes the heuristic and the cost leak at once.

### Send
Always `text/html`; no double-submit guard; no limiter **[Verified, doc 04]**. Reliability impact is user-visible (collapsed line breaks, duplicate sends on double-click) rather than scale-related.

## 4. Do you need a queue / cache / more instances?

| Option | Verdict for this app |
|---|---|
| Job queue (BullMQ/SQS) for ingestion | **Not now.** A 20-message sync finishes in seconds. A per-user in-flight `Map<userId, Promise>` in the process solves duplicate work (finding 6) with ~10 lines. Revisit only if you add backfill of thousands of mails or Gmail push ingestion with retries. |
| Redis (cache, rate-limit store) | **Not now.** Single instance. Only needed if you run 2+ replicas. |
| Horizontal scaling | **Not needed.** State is in Postgres; sessions are stateless HMAC cookies, so replicas would work except for the in-memory limiter. |
| Gmail push (Pub/Sub) | **Likely not worth finishing** (doc 06): inert today, schema lacks `last_history_id`/`watch_expiration`, no client channel (no SSE/websocket) to show pushed mail. Refetch-on-focus or a modest poll gets most of the value. Either delete the dead webhook surface or finish it deliberately. |
| Read replicas / partitioning | **No.** |

## 5. Reliability gaps (operational)

- **[Verified] No health endpoint, no SIGTERM handler, no `unhandledRejection` handler** (doc 08). Rolling the container during a sync can cut requests mid-flight.
- **[Verified] Deploy is not gated by any CI** and has no rollback tag (only `:latest`) (doc 08). A bad push to `main` ships to prod.
- **[Verified] Startup runs `prisma db push --accept-data-loss`** (`server/Dockerfile:27`). A destructive schema edit drops production data on the next deploy. This contradicts `server/prisma/migrations/README.md`, which claims `migrate deploy` is in use (docs 05, 08).
- **[Verified] Production env gap:** `deploy.yml` writes `SESSION_SECRET` but not `SESSION_SAMESITE`, `COOKIE_DOMAIN`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PUBSUB_TOPIC` (checked in `deploy.yml` and `docker-compose.yml`). Cross-site cookie behaviour between Amplify and EC2 is therefore uncontrolled, and the webhook returns 401 in production.
- **[Risk] No backups / observability** documented; console-only logging with no rotation (doc 08).
- **[Risk, unconfirmed] Prisma `createMany` could throw on a snippet truncated through a surrogate pair** (140 UTF-16 units), blocking later syncs until the mail leaves the 20-mail window (doc 03 #7). Cheap to defuse by truncating by code point.

## 6. Data growth

`email_metadata` rows are never expired and only metadata is stored (small rows). Growth is bounded in practice by the 20-mail window, but there is no backfill, so older mail never appears **[Verified, doc 03]**. If you add pagination/backfill, add `@@index([user_id, received_date])` first (doc 05) and cap response size.

## 7. Recommended order of work (small, high-value first)

1. Wrap the demo branch in try/catch; add a final `unhandledRejection` log and a `/healthz` route (finding 1, ops gap).
2. Resolve the migration story: pick `migrate deploy` (follow `migrations/README.md` one-time `resolve`) and change `Dockerfile:27`; or consciously remove the README claim. Never leave `--accept-data-loss` on a production start path.
3. Pass `SESSION_SAMESITE`/`COOKIE_DOMAIN` (and `PUBSUB_*` if keeping push) through compose + `deploy.yml`; align Amplify and API under one registrable domain.
4. Don't persist whole-batch Gemini failures; add a per-user in-flight guard; add timeouts and `Retry-After` handling to `retryHelper`.
5. Add the `(user_id, received_date)` index and a `take` on the list query; add rate limiters to `send-emails` and `fetch-email/:id`; cap attachment inlining.
6. Add a minimal CI job (client lint+build, server `prisma validate`) gating deploy; tag images by SHA for rollback.
7. Make the demo user per-session or at least serialise the reset in a transaction.

Defer: queues, Redis, replicas, push ingestion.
