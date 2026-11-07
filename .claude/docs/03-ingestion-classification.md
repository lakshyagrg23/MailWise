# 03 - Ingestion and Classification Pipeline

Scope: `GET /fetch-emails/:category` and everything it calls. Paths are relative to `server/` unless noted. Line numbers are from the code as read; the root `CLAUDE.md` is partly stale (section 1).

Related: [01-architecture](01-architecture.md), [02-auth-security](02-auth-security.md), [04-ai-and-gmail-actions](04-ai-and-gmail-actions.md), [05-data-layer](05-data-layer.md), [06-gmail-push-webhook](06-gmail-push-webhook.md), [07-frontend](07-frontend.md), [08-devops-deployment](08-devops-deployment.md), [09-scalability-reliability](09-scalability-reliability.md).

Labels: **[Verified]** = confirmed directly in code. **[Risk]** = plausible failure not reproduced, or depends on library/Gmail behaviour. **[Opportunity]** = improvement.

## 1. Corrections to CLAUDE.md

| CLAUDE.md says | Code says |
|---|---|
| "List latest 30 Gmail IDs" | `maxResults: 20` (`controllers/emails/getEmailsByCategory.js:61`) |
| Token sent as `?access_token=` plus `user_id` | Identity is only the signed session cookie via `requireAuth` (`middleware/requireAuth.js:35-50`); `req.user = {id, isDemo}` |
| `executeWithRetry` wraps all Gmail/Gemini calls | Not true. Gmail `messages.list` (`getEmailsByCategory.js:59`), the userinfo call (`:50`) and Gmail calls in summarize/getEmailById are not wrapped (6.3). |
| Classified "2 batches at a time" | Configured so (`:84`), but with a 20-email cap there is almost always one batch (5.2) |

## 2. Step-by-step flow

Route: `routes/emailListRoutes.js:8` -> `syncLimiter` (30 req/min per user, `middleware/rateLimit.js:15`) -> `getEmailsByCategory`; mounted behind `requireAuth` (`server.js:49`).

1. **Demo short-circuit** (`getEmailsByCategory.js:14-39`). If `req.user.isDemo`, no Gmail or Gemini; returns seeded `email_metadata` rows, filtered by category with the same case-insensitive filter as the live path.
2. **Auth client** (`:45`). `getAuthenticatedClient({userId})` loads the user, refreshes the Google token if needed, returns a Gmail client (see [02](02-auth-security.md)).
3. **Userinfo call** (`:49-56`). An extra `axios.get(.../oauth2/v2/userinfo)` on **every** sync, only to return name/pic/email that are already in the DB (`authUser` is the fallback, `:120-122`). Failure is swallowed; no axios timeout.
4. **List IDs** (`:59-64`). `users.messages.list({userId:'me', maxResults:20, q:'-in:trash -in:draft'})`. No `labelIds`, `pageToken` or `includeSpamTrash`.
5. **Dedupe** (`:67`; `services/gmailFetchService.js:40-64`). One `findMany` on `(user_id, email_id IN [...])`; returns IDs not present. On a DB error it returns **all** IDs (`:62`), re-fetching and re-classifying everything (inserts are still de-duplicated, but Gemini cost is paid again).
6. **Categories** (`:74-77`). One `findMany` of `category_name, category_description`; no `orderBy`.
7. **Fetch bodies** (`:80`; `gmailFetchService.js:74-130`). `asyncPoolValues(10, ids, ...)` -> `messages.get(format:'full')` inside `executeWithRetry` (2 retries, 500 ms base, `:83-92`). Per message: subject/from (case-insensitive header lookup, `:101-102`), `extractBody` (plain first, then html), `cleanEmailForAI(raw, 1200)` (`:105`), first attachment filename (`:107`), `labelIds`, `internalDate` -> ISO. Failed/empty messages return `null` and are dropped (`:96`, `:122`); they are not inserted, so they are retried next sync (good).
8. **Classify** (`:84`; `services/batchClassificationService.js:334-350`): label bypass (`:48-94`), `createTokenBatches` (`:103-130`), `classifyAllBatchesConcurrently` with `asyncPool(2)` (`:300-323`), each batch via `classifySingleBatch` (`:218-290`).
9. **Insert** (`:87-98`). `createMany({data, skipDuplicates:true})` against `@@unique([user_id,email_id])` (`prisma/schema.prisma`, EmailMetadata).
10. **Respond** (`:102-123`). Reads **all** stored rows for the user (category filter is case-insensitive `equals`), `orderBy received_date desc`, no `take`/`skip`. BigInt `update` is stringified.
11. **Error path** (`:125-128`). Any throw gives 500 `"Failed to fetch/classify emails"`. Sync and read share one try block, so a failed ingestion also hides already-stored mail.

When is this triggered? `client/src/App.jsx:97-101` calls it only when `emails.length === 0 && authenticated`. So ingestion effectively runs once per page load; there is no polling, and Gmail push is not wired to ingestion ([06](06-gmail-push-webhook.md)).

## 3. The 20-email window and "pagination"

- **[Verified] The window is 20, not 30** (`getEmailsByCategory.js:61`), with no pagination at the Gmail layer or the API layer.
- **[Verified] No `pageToken`, no history cursor.** Each sync looks at the newest 20 messages of the mailbox minus trash/drafts. If more than 20 arrive between syncs (or on first login to an old mailbox), the overflow is never ingested; there is no backfill.
- **[Verified] The query is mailbox-wide, not inbox-only.** `-in:trash -in:draft` includes Sent, archived mail and chats, so the user's own sent mail is classified by Gemini and shown in categories. Probably unintended for an inbox classifier.
- **[Risk] The SPAM bypass is probably dead code.** `messages.list` omits SPAM and TRASH unless `includeSpamTrash=true` (Gmail API default is false; this is API behaviour, not in the repo). The code never sets it, so the `labels.includes('SPAM')` branch (`batchClassificationService.js:54-64`) would rarely fire.
- **[Verified] The response is unbounded.** Step 10 returns every stored row in one JSON. Rows are small (snippet <= ~143 chars or a 60-80 word summary), fine for hundreds of rows, but the client has no pagination either ([07](07-frontend.md)).
- The dedupe diff prevents reprocessing but cannot reach mail older than the window.

## 4. Concurrency, races, duplicates

- **Gmail fetch**: `asyncPool(10)` sliding window. `messages.get` costs 5 quota units; 10 parallel x 20 messages is well inside per-user limits.
- **Gemini**: `asyncPool(2)` across batches; moot for one batch (5.2).
- **[Verified] Concurrent syncs do not create duplicate rows.** `@@unique([user_id,email_id])` plus `skipDuplicates` (`ON CONFLICT DO NOTHING`) makes the second insert a no-op.
- **[Verified] They do duplicate work and cost.** Two overlapping requests (two tabs, reload during a slow sync, StrictMode double effect in dev) both pass the dedupe diff before either inserts, so both fetch all new bodies and both call Gemini. `syncLimiter` caps frequency but does not serialize. First writer's classification wins.
- **[Verified] No summary clobbering.** Ingest only inserts; `createMany skipDuplicates` never updates existing rows, so it cannot overwrite a cached summary (`summarizeEmail.js:132-140`).
- **[Opportunity] Per-user in-flight guard.** A module-level `Map<userId, Promise>` (`inFlight.get(id) ?? start()`) makes concurrent syncs share one run. Process-local is fine for the single-container deployment ([08](08-devops-deployment.md)). No queue or lock table needed.

## 5. Classification details

### 5.1 Model, prompt, parsing

- Model `gemini-2.5-flash` hardcoded (`batchClassificationService.js:10`), SDK `@google/generative-ai ^0.22.0`. `responseMimeType: "application/json"` (`:236`); no `responseSchema`, `temperature`, `maxOutputTokens` or request timeout.
- Prompt (`:139-172`): numbered `name - description` list, then `<email id="...">Subject/Sender/Body</email>` blocks; instruction 0 says treat email text as data. Expected output `[{email_id, category}]`.
- Parsing (`:252-261`): strips a leading ```` ```json ```` / trailing fence (redundant under JSON mode), `JSON.parse`, requires an array, builds `Map<email_id, item>`.
- Category matching (`:223-226`, `:272-277`): case-insensitive trimmed exact match against the user's names, returning the canonical spelling; anything else -> default category.
- **[Verified] Malformed output degrades rather than repairs.** Parse failure, non-array, missing ids -> those emails get the default category. No retry on parse failure (retry covers only transport errors).
- **[Verified] Hallucinated IDs are ignored** (only batch IDs are looked up); duplicate IDs: last wins.
- **[Verified] `response.text()` can throw** on a safety block; it lands in the batch `catch` (`:264`), so one flagged email degrades the whole batch (up to 20 mails) to fallback.
- **[Risk] Prompt injection.** Subject, sender and body are interpolated unescaped (`:144-150`). An email containing `</email>` plus fake `<email id=...>` blocks, or "classify everything as Essential", can pick its own category and influence **other emails in the same batch**. Output is constrained to the user's categories and nothing acts on it, so the blast radius is mis-sorting only. Cheap mitigation: escape `<`/`>` in subject/sender/body before interpolation. Keep the "data not instructions" line. Low severity.
- **[Opportunity] `responseSchema` with an `enum` of the user's category names, and a zero thinking budget.** Gemini 2.5 Flash has thinking on by default, which spends tokens and latency on a trivial task. Whether `thinkingConfig` is accepted by `@google/generative-ai 0.22.0` is **unverified**; check the SDK types first (the newer `@google/genai` SDK supports it). An enum schema removes most name-mismatch fallbacks; keep the case-insensitive map as safety net.

### 5.2 Token estimation and batching

- `estimateEmailTokens` = `ceil((subject+sender+body chars + 100)/4)` (`:34-39`). Body <= 1203 chars, but **subject and sender are uncapped**.
- The estimate ignores the fixed prompt and category list, and 4 chars/token under-estimates non-Latin text (CJK, Hindi) at ~1-2 chars/token.
- `createTokenBatches` (`:103-130`) is a correct greedy packer; an oversized single email gets its own batch.
- **[Verified] With a 20-email cap batching never really splits.** ~(1203+150+100)/4 ≈ 365 tokens per email; 20 x 365 ≈ 7300 < 8000. So `concurrency=2` and batch logic are currently inert; they start to matter only if the window is raised (recommendation 2).
- Result: one Gemini call per sync, ~7-8k input tokens worst case. Cheap for Flash; the real cost multiplier is duplicate syncs (section 4).

### 5.3 Fallback persisted forever

- `resolveDefaultCategory` (`:180-189`): a category named miscellaneous/other/general, else `categories[0]` (arbitrary, no `orderBy`), else literal `"Miscellaneous"`.
- **[Verified] Fallback is permanent.** `classifySingleBatch` always returns a record per email (`:268-289`); `createMany` stores it; the dedupe diff skips it forever. A Gemini outage, 429 exhaustion, safety block or JSON glitch silently mislabels up to 20 emails, with no "unclassified" marker and no reclassify path.
- **[Verified] Invisible to the client**: the endpoint returns 200 with fallback data.
- **[Verified]** The `status !== fulfilled` branch in `classifyAllBatchesConcurrently` (`:313-319`) is effectively unreachable because `classifySingleBatch` catches its own errors.
- **[Opportunity] Minimal fix.** On whole-batch AI failure (the `catch` at `:264`), return nothing for that batch so the emails are not inserted and are retried next sync via the dedupe diff. Retry cost during a long outage is bounded by `syncLimiter` and the 20-mail window. For per-email omissions (valid JSON, missing id/unknown category) keeping the default is acceptable. No schema change needed.
- **[Verified] Direct-bucket names are hardcoded** (`"Spam"`, `"Promotions"`, `"Social"`, `:59,:67,:79`) regardless of the user's categories. Defaults seeded at login include Promotions and Social but **not** Spam (`controllers/auth/callback.js:6-12`). A user who renames/deletes them, or any Spam-labelled mail, ends up with a category that has no sidebar entry (visible only under "All").
- **[Verified] Duplication**: the same record literal appears in the three bucket branches (`:55-86`), `createFallbackEmailRecord` (`:198-209`) and `classifySingleBatch` (`:279-288`). A single `toRecord(email, category)` helper removes ~50 lines.

### 5.4 Stale category names (rename/delete)

- `controllers/categories/updateCategory.js:20-30` updates only `category_preferences`; `deleteCategory.js:5-14` deletes only the preference row. Neither touches `email_metadata.category`.
- **[Verified]** After rename `A -> B`, old rows stay `A`, and `GET /fetch-emails/B` returns only mail classified after the rename. After delete, rows keep the dead name and are reachable only via "All".
- **[Verified]** Adding a category does not reclassify old mail either.
- **[Opportunity]** In `updateCategory`, use `prisma.$transaction([update preference, emailMetadata.updateMany({where:{user_id, category: old}, data:{category: new}})])`. In `deleteCategory`, reassign to the default category the same way. A few lines, no new infra. See also [05](05-data-layer.md) (category is a free string, no FK).

## 6. Shared helpers

### 6.1 `utils/emailCleaner.js`

Pipeline `cleanEmailForAI` (`:125-160`): HTML detect -> `stripHtml` -> `stripQuotedReplies` -> `stripSignaturesAndFooters` -> whitespace normalise -> fallback -> cap.

- **[Verified] The 1200 cap is a UTF-16 slice** (`:155-156`) and can split a surrogate pair. More important is `generateBodySnippet` (`batchClassificationService.js:20-26`), which slices to 140 and **stores** the result. **[Risk]** A lone surrogate going through Prisma's JSON protocol may be rejected by the Rust query engine; if so the whole `createMany` throws, the request returns 500, nothing is inserted, and the same email (still in the 20-ID window) breaks every following sync until it ages out. Not reproduced. Fix is trivial: truncate by code point (`Array.from(s).slice(0,n).join('')`).
- **[Verified] Entity decode order bug** (`:21` before `:22`): `&amp;` decoded before `&lt;`, so `&amp;lt;` becomes `<`. `String.fromCharCode` (`:28`) mishandles code points above 0xFFFF (`&#128512;`), and hex entities other than `&#x2F;` are not decoded. Low impact (AI input).
- **[Verified] Loose HTML detection** (`:132`): any plain text containing `<x ... >` (for example `Name <a@b.com> ... >`) triggers tag stripping and drops that text.
- **[Verified] Tags become spaces** (`:55`), so `<b>H</b>ello` becomes `H ello`; ugly in the stored, user-visible snippet.
- **[Verified] Over-aggressive truncation patterns**: `On <line> wrote:` (`:77`) deletes everything after it, including a legitimate sentence like "On Friday he wrote: ..."; the Outlook `From:/Sent:` block (`:80`) deletes the remainder; bare `--` line (`:98`) discards the rest. If the result is empty, the fallback (`:150-152`) restores the un-stripped body, which is the right behaviour for forwarded/receipt mail.
- **[Verified] Only the first text part is used** (`extractBody`): a stub `text/plain` hides the real `text/html`; charset is assumed UTF-8. See [04](04-ai-and-gmail-actions.md) section 7.
- Regex DoS: patterns are linear (lazy `[\s\S]*?` with simple anchors; `<[^>]+>`), **[Risk]** low. Cleaning runs on the full body before truncation (`:132-157`), so per-message cost scales with body size (x10 concurrent). Acceptable at 20 messages. **[Opportunity]** cap raw input (~50 KB) before regexing, and do not clean twice (`generateBodySnippet` re-cleans, `:24`).

### 6.2 `utils/asyncPool.js`

- **[Verified] Correct.** Sliding window: a tracker removes itself on settle and `Promise.race(executing)` waits when `size >= limit` (`:31-40`). `results` keeps input order and `Promise.allSettled` closes it out (`:45`). Rejections are handled by the tracker's `.catch`, so no unhandled rejections. Sync throws are captured by `Promise.resolve().then(...)` (`:26`). Limit is clamped to >= 1.
- `asyncPoolValues` (`:58-75`) silently drops `null`/`undefined` (intended for failed fetches); `onError` gets the index into the original array (correct).

### 6.3 `utils/retryHelper.js`

- **Retried** (`isTransientError`, `:13-50`): status 429 or 5xx (`error.status|statusCode|response.status`); message contains `429`, `resource_exhausted`, `quota`, `rate limit`, `too many requests`, `service unavailable`, `bad gateway`, `gateway timeout`, `overloaded`, `econnreset`, `etimedout`, `econnrefused`, `socket hang up`, `network`; or `code` ECONNRESET/ETIMEDOUT/ECONNREFUSED. Everything else (400/401/403/404, safety blocks, JSON errors) is not retried.
- **Backoff** `base * factor^(attempt-1)`, capped at `maxDelayMs=8000`, with 0.8x-1.2x jitter (`:94-97`). `maxRetries` counts retries, so attempts = retries + 1 (`:82`).
- **[Verified] `Retry-After` is ignored.** The fixed 1/2/4 s schedule can burn all retries in ~7 s on a real rate limit.
- **[Verified] `quota`/`resource_exhausted` are retried**, including Gemini daily-quota exhaustion, which is not transient: ~7 s of futile retries before fallback.
- **[Risk]** `(error.code || '').toLowerCase()` (`:18`) throws if a library sets a numeric `code`, masking the real error. With `gaxios 6.7.1` the HTTP status is in `.status` (`node_modules/gaxios/build/src/common.js:79`) so it works today. Use `String(error.code || '')`.
- **[Verified] Coverage gaps** (section 1): `messages.list` has no retry, so a transient 503 fails the whole sync.
- **[Verified] No timeouts anywhere**: Gemini, Gmail and the axios userinfo call have no deadline, so a hung upstream holds the request. **[Opportunity]** Gemini SDK supports `requestOptions.timeout` in `getGenerativeModel`; axios supports `timeout`.

## 7. Cost and quota

- Per sync with N new emails: N x `messages.get` (5 units each), one `list` (5 units), one userinfo call, and at most one Gemini call (<= ~8k in, small out). Cheap.
- Multipliers: duplicate concurrent syncs (section 4); DB-blip re-classification (`gmailFetchService.js:62`).
- **Shared Gemini key**: per-user limiters are 30/min sync, 60/min summarize, 20/min draft (`rateLimit.js:13-15`); one user can issue up to ~110 Gemini-backed requests a minute, and there is no daily or global budget. One abusive or compromised account can exhaust the key for everyone. **[Opportunity]** in-memory per-user daily counter for AI endpoints plus a circuit breaker that returns 503 after repeated quota errors. See [09](09-scalability-reliability.md).

## 8. Error paths and partial failure

| Failure | Behaviour |
|---|---|
| Userinfo fails | Warn and continue; DB profile used (`:54-56`, `:120-122`) |
| Gmail list fails | 500 for the whole request; no retry |
| One `messages.get` fails | Retried twice, dropped this run, retried next sync (`gmailFetchService.js:122`) |
| Whole Gemini batch fails | Fallback category, **persisted** (5.3) |
| `createMany` fails | 500, and stored mail is not returned either |
| Dedupe query fails | Re-process all 20 (`gmailFetchService.js:62`) |
| Token refresh fails | `getAuthenticatedClient` throws -> generic 500, not 401, so the client cannot prompt reconnect ([02](02-auth-security.md)) |

**[Opportunity]** Put ingestion (`:58-100`) in its own try/catch and always return stored rows (optionally with a `syncError` flag).

## 9. Demo mode

Handled early and correctly (`:14-39`): no Gmail, no Gemini; seeded rows (`controllers/auth/demoLogin.js:52-60`) with plain snippets (no `•`). No issues found.

## 10. Prioritized recommendations

1. **Stop persisting AI-failure fallbacks** (5.3): skip inserting a batch whose Gemini call failed so the next sync retries. ~10 lines; highest value for cost.
2. **Fix the ingestion window** (3): a `pageToken` loop (bounded, e.g. 50-100 IDs) and likely `labelIds:['INBOX']` or `in:inbox`. Confirm product intent on Sent/Archive first. Keep the dedupe diff.
3. **Migrate emails on category rename/delete** (5.4) via a transaction.
4. **Per-user in-flight guard** (4); do not add a queue/Redis for a single-container app.
5. **Timeouts** on Gemini/Gmail/axios, and wrap `messages.list` in `executeWithRetry` (6.3).
6. **Truncate stored snippets by code point**, and `String(error.code || '')` (6.1, 6.3).
7. **Decouple read from sync failure**, and drop the redundant userinfo call (8, 2).
8. `responseSchema` enum + low thinking budget, and escape `</email>` in prompt content (5.1) - verify SDK support first.
9. Make direct buckets map to the user's own category of that name when present (5.3).
10. Cleaner polish (entity order, code-point entities, bare `--` rule); low priority.
