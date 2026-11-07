# 05 - Data Layer (Prisma / PostgreSQL)

Scope: `server/prisma/schema.prisma`, `server/prisma/migrations/*`, `server/prisma.js`, and every Prisma call in `server/`.
Cross-refs: [01-architecture](01-architecture.md), [02-auth-security](02-auth-security.md), [03-ingestion-classification](03-ingestion-classification.md), [06-gmail-push-webhook](06-gmail-push-webhook.md), [07-frontend](07-frontend.md), [08-devops-deployment](08-devops-deployment.md), [09-scalability-reliability](09-scalability-reliability.md).
Labels: **[Verified]** read in code, **[Risk]** plausible failure or harm, **[Opportunity]** improvement.
Paths are relative to the repo root.

## 1. Schema (3 models)

Source: `server/prisma/schema.prisma:10-55`. Prisma 5.21.1 (`server/package.json`), provider postgresql.

| Model (table) | Columns of note | Constraints |
|---|---|---|
| `User` (`users`) | `google_id`, `email` (both `@unique`), `access_token`, `refresh_token`, `token_expiry`, `update BigInt? @default(1)`, `created_at DateTime?` | PK `id` serial |
| `EmailMetadata` (`email_metadata`) | `user_id Int?`, `email_id`, `subject`, `sender`, `category String`, `attachname?`, `emailsummary?`, `received_date DateTime?`, `update BigInt?` | `@@unique([user_id, email_id])`; FK to users `onDelete: Cascade` |
| `CategoryPreference` (`category_preferences`) | `user_id Int?`, `category_name`, `category_description` | `@@unique([user_id, category_name])`; FK `onDelete: Cascade` |

- **[Verified]** There are no `@@index` declarations anywhere. The only indexes are PKs and the three unique indexes.
- **[Verified]** There is NO `last_history_id` or `watch_expiration` column (schema lines 10-25), contrary to root CLAUDE.md. See [06](06-gmail-push-webhook.md).
- **[Verified]** `category` is a free-text String, not a FK to `category_preferences`. `update` on users and emails is a vestigial BigInt (section 5.7).

## 2. Migrations vs schema

- **[Verified] Baseline matches schema.** `server/prisma/migrations/20261025000000_baseline/migration.sql:1-59` was compared column by column with the schema: same tables, types (`SERIAL`, `TEXT`, `TIMESTAMP(3)`, `BIGINT DEFAULT 1`), nullability, the 4 unique indexes (lines 44-53) and both `ON DELETE CASCADE ON UPDATE CASCADE` FKs (lines 56, 59). I did not run `prisma migrate diff` (needs the CLI; outside the no-side-effects rule), so this is a read-based comparison. `migration_lock.toml` = postgresql.
- **[Verified] Doc drift: the container still uses `db push`.** `server/Dockerfile:27` is `CMD ["sh","-c","npx prisma db push --accept-data-loss && npm start"]`, with a comment (lines 24-26) saying to switch to `migrate deploy` after baselining. But `server/prisma/migrations/README.md:9` says "The container now starts with `npx prisma migrate deploy && npm start`". That README sentence is wrong about current code; root CLAUDE.md ("runs `prisma db push --accept-data-loss`") is correct. Net: migrations exist but nothing applies them yet.
- **[Risk] Two schema-sync mechanisms.** While `db push` is the CMD, any schema.prisma edit goes live on next start with no migration file, and `--accept-data-loss` silently drops data on rename/removal (renaming `emailsummary` = drop that data).
- **[Risk] Prod cut-over procedure (`server/prisma/migrations/README.md:7-22`) pitfalls.**
  1. The prod DB is on a docker network (`postgres:5432`, `docker-compose.yml:16`), not reachable from a laptop. README hints at a one-off container; spell out e.g. `docker compose run --rm backend npx prisma migrate resolve --applied 20261025000000_baseline` (image has the CLI: devDeps kept, `Dockerfile:9-11`).
  2. The README puts the DB password in a shell command line (history/process list). Use the container's existing `DATABASE_URL`.
  3. Ordering: if the CMD is flipped to `migrate deploy` BEFORE `resolve`, the container crash-loops on `CREATE TABLE "users"` already existing (`restart: unless-stopped`, `docker-compose.yml:7`) and the API is down. Resolve first, then ship the image.
  4. The `migrate diff` verification (README:27-29) is the key safety step; make it mandatory. Prod was built by `db push` from possibly older schema revisions, so the live DB could differ (e.g. a missing unique index) and the baseline would then lie.
  5. pg_dump first (README says so); there is no rollback section.
- **[Opportunity]** Run `resolve` once, flip CMD to `npx prisma migrate deploy && npm start`, drop `--accept-data-loss`, fix README tense. Then ship one migration for indexes (section 6) and one for the push columns ([06](06-gmail-push-webhook.md)).

## 3. Client instantiation and pooling

- **[Verified]** `server/prisma.js:1-5`: one module-singleton `new PrismaClient()`, no options. Fine for a long-running Express process.
- **[Verified]** Default pool = `num_cpus*2+1`; no `connection_limit`/`pool_timeout` in `DATABASE_URL` (`docker-compose.yml:16`). Postgres is a sidecar, fine at this scale.
- **[Opportunity]** No SIGTERM -> `prisma.$disconnect()` and no `log: ['warn','error']`. Cheap to add; low value.

## 4. Every Prisma query, by model

### User (`users`)
| File:line | Op | Notes |
|---|---|---|
| `server/middleware/requireAuth.js:17` | `findUnique({id})`, select id, google_id | every authenticated request |
| `server/services/googleAuthService.js:35` | `findUnique({id})`, full row incl. tokens | per Gmail-touching request (second user read after requireAuth) |
| `server/services/googleAuthService.js:60` | `update` tokens after refresh | only on refresh |
| `server/controllers/auth/me.js:5` | `findUnique({id})` | 4 safe fields |
| `server/controllers/auth/callback.js:49,57,88` | `findUnique({email})`, `create`, `update` | find-then-write, not `upsert` |
| `server/controllers/auth/demoLogin.js:6,9,21` | find by `google_id`, create, update | |
| `server/controllers/categories/createCategory.js:21` | `update({data:{update:1}})` | effectively a no-op (5.7) |
| `server/controllers/emails/getEmailsByCategory.js:15` | demo-path `findUnique` | |
| `server/controllers/webhook/gmailWebhook.js:32` | `findUnique({email})` | then reads `user.last_history_id`, a column that does not exist |

### EmailMetadata (`email_metadata`)
| File:line | Op | Index used |
|---|---|---|
| `server/services/gmailFetchService.js:46` | `findMany({user_id, email_id in [...]})`, select email_id | unique(user_id,email_id) - good |
| `server/controllers/emails/getEmailsByCategory.js:23` (demo), `:108` (real) | `findMany where user_id [+ category insensitive] orderBy received_date desc`, no `take` | only user_id prefix of the unique index (section 6) |
| `server/controllers/emails/getEmailsByCategory.js:93` | `createMany skipDuplicates` | unique(user_id,email_id) |
| `server/controllers/emails/summarizeEmail.js:40,87` | `findUnique(user_id_email_id)` | unique - good |
| `server/controllers/emails/summarizeEmail.js:132` | `updateMany` (cache summary) | unique - good |
| `server/controllers/emails/clearUserEmails.js:10` | `deleteMany({user_id})` | |
| `server/controllers/auth/demoLogin.js:26,64` | `deleteMany`, then 9 `create` in a loop | |

### CategoryPreference (`category_preferences`)
| File:line | Op |
|---|---|
| `server/controllers/categories/getCategories.js:5` | `findMany({user_id})` |
| `server/controllers/categories/createCategory.js:13` | `create` |
| `server/controllers/categories/updateCategory.js:20,27` | `findUnique` then `update` (compound key `user_id_category_name`) |
| `server/controllers/categories/deleteCategory.js:7` | `delete` (compound key), `.catch(()=>null)` |
| `server/controllers/auth/callback.js:116` | `createMany skipDuplicates` (default seeding) |
| `server/controllers/emails/getEmailsByCategory.js:74` | `findMany` once per ingest |
| `server/controllers/auth/demoLogin.js:25,41` | `deleteMany`, then 7 `create` in a loop |

- **[Verified]** No `$transaction`, `$queryRaw` or `$executeRaw` anywhere in `server/` (grep, node_modules excluded). All multi-step writes are non-atomic.

## 5. Semantics and correctness findings

### 5.1 Stale category names (CLAUDE.md claim confirmed)
- **[Verified]** `updateCategory.js:27-33` changes only `category_preferences.category_name`; it never touches `email_metadata`. `deleteCategory.js:7` deletes only the preference. Existing mail keeps the old string in `email_metadata.category`.
- Consequence: after a rename or delete, the old category's mail is invisible under any current category (list filters by name, `getEmailsByCategory.js` whereClause), reachable only via `All`. Re-creating the old name "resurrects" it.
- **[Verified]** Hard-coded names break the same way: the fast path writes literal `"Spam"`, `"Promotions"`, `"Social"` (`server/services/batchClassificationService.js:59,70,81`) regardless of the user's list. "Spam" is not in the default seed (`callback.js:5-13`); if a user deletes/renames Promotions or Social, label-routed mail still lands under the old name.
- **[Verified]** The fallback category is persisted forever (`batchClassificationService.js:196-208`); no reclassification path.
- **[Opportunity]** In the update/delete controllers add, in one `prisma.$transaction([...])`, `emailMetadata.updateMany({where:{user_id, category: old}, data:{category: new}})` (rename) or move to a fallback such as Miscellaneous (delete). Roughly 10 lines per controller.
- **[Verified]** Case handling is inconsistent: the list filter uses `mode: 'insensitive'` but the unique constraint is case-sensitive, so "finance" and "Finance" can coexist as categories and their mail merges in the filter.
- **[Verified]** A duplicate name on create/rename throws Prisma `P2002`, returned as a generic 500 (`createCategory.js:31-34`, `updateCategory.js:36-38`) instead of 409. Delete turns every error into 404 (`deleteCategory.js:14`).

### 5.2 Default category seeding
- **[Verified]** 7 defaults (`callback.js:5-13`), inserted only for brand-new users via `createMany skipDuplicates` (`callback.js:116-119`) AFTER the user row is created, in a separate step; failure is caught and only logged (`callback.js:121-123`). A failure leaves a user with zero categories forever (seeding never retried), so the classifier prompt has no categories and fallback becomes "Miscellaneous" (`batchClassificationService.js:188`).
- **[Risk]** Concurrent first-login callbacks (double click): both find no user, the second `create` hits `email` unique -> 500. Use `upsert` on `email`.
- **[Opportunity]** Seed atomically with a nested create (`categories: { create: [...] }`) or seed idempotently on every login.
- The seed list is duplicated in `demoLogin.js:30-38`; extract one constant.

### 5.3 Nullable `user_id` FKs
- **[Verified]** `user_id Int?` on both child tables (schema lines 29, 49; SQL lines 20, 37). Postgres treats NULLs as distinct in unique indexes, so `(NULL, email_id)` duplicates are allowed, and NULL-owner rows are reached by neither `onDelete: Cascade` nor any per-user query. No code path here inserts NULL (all inserts pass `user_id`), so this is latent.
- **[Opportunity]** After confirming no NULL rows in prod, make it `Int` NOT NULL via a real migration (not `db push --accept-data-loss`).

### 5.4 Cascade deletes
- **[Verified]** Deleting a `users` row cascades both child tables (SQL lines 56, 59). But the app never deletes users (no `user.delete` anywhere), and `server/controllers/auth/logout.js` only clears the cookie. Tokens stay in the DB indefinitely after "logout". See [02](02-auth-security.md).
- **[Opportunity]** Small "delete my account" endpoint: revoke the Google token, then `user.delete` (cascade does the rest).

### 5.5 Unique constraints and `createMany skipDuplicates`
- **[Verified]** Ingestion is check-then-insert: `filterUnprocessedEmailIds` (`gmailFetchService.js:40-64`), then `createMany skipDuplicates` (`getEmailsByCategory.js:93`). Two concurrent `/fetch-emails` for one user see the same "new" ids, both fetch bodies and call Gemini; the second insert is silently dropped (`ON CONFLICT DO NOTHING`). Data stays correct, but Gmail and Gemini cost is doubled, and the first writer's classification wins.
- **[Opportunity]** A per-user in-flight Map<userId, Promise> in the controller dedupes this on a single instance; no DB change. See [03](03-ingestion-classification.md).
- **[Verified]** The id list is capped by Gmail `maxResults: 20` (`getEmailsByCategory.js:61`); CLAUDE.md says 30 (drift).

### 5.6 OAuth tokens in plaintext
- **[Verified]** `access_token` and `refresh_token` are plain `TEXT` (schema lines 17-18), read in full by `googleAuthService.js:35` (no `select`). The refresh token is long-lived and grants Gmail access; a DB dump or backup leak = mailbox compromise. The demo user stores literal `'demo'`/`'demo_refresh'` (`demoLogin.js:15-16,23`).
- **[Opportunity]** AES-256-GCM encrypt `refresh_token` (optionally `access_token`) in `googleAuthService` and `callback.js` with a `TOKEN_ENC_KEY` env var (must be added to BOTH `docker-compose.yml` and the `.env` step in `deploy.yml`, see [08](08-devops-deployment.md)). Existing rows: lazy "decrypt-or-passthrough" plus re-encrypt on next refresh. Medium priority: the DB is on a private docker network, so the realistic exposure is backups and host compromise.

### 5.7 BigInt `update` and the global toJSON patch
- **[Verified]** Both models have `update BigInt? @default(1)`. Patch: `server/server.js:21` `BigInt.prototype.toJSON = function(){ return this.toString(); }`.
- **[Verified]** The patch is mostly redundant: list endpoints already stringify (`getEmailsByCategory.js:28-31,65-68`). `CategoryPreference` has no BigInt, so `updateCategory.js:35` does not need it.
- **[Verified]** `update` is not used for logic: `callback.js:51,71,95` selects it into a local that is unused; `createCategory.js:21-24` writes `1` over the default `1` (a wasted query per category creation). Writers: `batchClassificationService.js:63,74,85,207,287` (`1n`), `callback.js:66`.
- **[Risk]** A global prototype patch is a hidden side effect; low severity.
- **[Opportunity]** Drop the dead column (migration), the patch, the stringify mapping, `1n` literals and the wasted update. First grep the client for `.update` usage ([07](07-frontend.md)). Cheapest partial: delete the `createCategory` update call.

## 6. Indexes for the real query patterns

Dominant query: `WHERE user_id = ? [AND category ILIKE ?] ORDER BY received_date DESC`, no LIMIT (`getEmailsByCategory.js:23,108`). `unique(user_id, email_id)` serves only the `user_id` prefix; the sort needs a sort step over all of the user's rows. `category_preferences` and `users` lookups are all covered by existing PK/unique indexes.

- **[Opportunity]** Add `@@index([user_id, received_date(sort: Desc)])` on `EmailMetadata`. `mode: 'insensitive'` generates case-insensitive matching that a plain btree on `category` cannot serve; at per-user row counts (hundreds to low thousands) the `user_id` index plus filter is fine. Better: compare category exactly (`equals` without insensitive) and use `[user_id, category, received_date]` if lists grow.
- **[Verified]** Not needed: standalone `email_id`, `sender`, `users.google_id/email` (latter two already unique).
- Ship via a real migration (section 2).

## 7. Efficiency, N+1, transactions

- **[Verified]** Every Gmail request does two user reads (`requireAuth.js:17` and `googleAuthService.js:35`). Not an N+1, just a duplicate; skip unless profiling demands.
- **[Verified]** No N+1 in ingestion: categories fetched once (`getEmailsByCategory.js:74`), bulk `createMany`.
- **[Verified]** `demoLogin.js:25-70`: two `deleteMany` then 7 + 9 sequential `create` calls (16 round trips), no transaction. Two simultaneous demo logins race (both delete, both insert; unique violation -> 500). Also every demo click wipes and reseeds the SAME shared user, so another visitor's live demo session is reset mid-use.
- **[Opportunity]** Use `createMany` inside `$transaction`, or serve demo data from an in-memory fixture with no DB writes.
- **[Verified]** Unbounded list: no `take` or cursor, so each call returns every stored row (with `emailsummary` text) for the category.

## 8. Growth and retention

- **[Verified]** Only metadata plus one snippet/summary per mail (roughly under 2 KB/row). Rows are added by every ingest (up to 20 latest ids per call) and never expire. The only deletion is the manual `clearUserEmails` (`clearUserEmails.js:10`; skipped for demo, line 5). No TTL, cleanup job or per-user cap.
- **[Opportunity]** Pagination (`take: 200` + cursor) is the priority since it bounds payload regardless of growth; a retention job (delete older than N days) is optional.
- **[Opportunity]** No DB backup mechanism appears in the repo; see [08](08-devops-deployment.md).

## 9. Demo user
- **[Verified]** Identity: `google_id = 'demo_google_id'`, email `demo@mailwise.app` (`demoLogin.js:6,13`); `requireAuth.js:4,25` derives `isDemo`. Only `clearUserEmails.js:5` has an explicit demo guard; category CRUD and summary caching are not demo-guarded, so visitors can mutate shared demo rows until the next demo login resets them.

## Prioritized recommendations

1. (High, small) Settle migrations: run baseline `resolve` on prod (after `migrate diff` and a pg_dump), flip Dockerfile CMD to `migrate deploy`, correct `migrations/README.md:9` meanwhile. Removes the standing `--accept-data-loss` risk.
2. (High, small) Fix stale categories: update/delete controllers also `updateMany` `email_metadata.category` in a `$transaction`; map P2002 to 409; stop hard-coding `Spam/Promotions/Social` or ensure they exist.
3. (High, small) Paginate the list query and add `@@index([user_id, received_date])`.
4. (Medium) `upsert` the user in `callback.js`; seed categories atomically.
5. (Medium) Make the demo reset atomic or fixture-based; guard demo mutations.
6. (Medium) Encrypt refresh tokens at rest; add account delete/revoke.
7. (Low) `user_id` NOT NULL after checking prod; remove dead `update` column, BigInt patch and wasted update call.
8. (Low) Per-user ingest lock to avoid duplicate Gemini spend; `$disconnect` on SIGTERM; unify the duplicated default-category list.
