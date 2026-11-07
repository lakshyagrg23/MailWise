# 01 - System Architecture

Scope: component map, tech stack, request lifecycle, trust boundaries, end-to-end flows, server layering, client-server contract, conventions, documentation drift. Deep dives live in sibling docs: [02-auth-security](02-auth-security.md), [03-ingestion-classification](03-ingestion-classification.md), [04-ai-and-gmail-actions](04-ai-and-gmail-actions.md), [05-data-layer](05-data-layer.md), [06-gmail-push-webhook](06-gmail-push-webhook.md), [07-frontend](07-frontend.md), [08-devops-deployment](08-devops-deployment.md), [09-scalability-reliability](09-scalability-reliability.md).

Labels: **[Verified]** seen in code, **[Risk]** plausible but not proven, **[Opportunity]** improvement. Paths are relative to the repo root; line numbers refer to the working tree as read.

---

## 1. Component map

```
                      +------------------------------+
 Browser (React SPA)  |  client/  (Vite, :3000 dev)  |   prod: AWS Amplify (per README/CLAUDE.md; not in repo)
 HttpOnly cookie jar  |  axios withCredentials       |   local docker: nginx :80 (client/Dockerfile, nginx.conf)
                      +--------------+---------------+
                                     | HTTPS/JSON + cookie mailwise_session
                                     v
                      +------------------------------+
                      | server/  Express 4 (:5000)   |  Docker image on EC2 (ghcr.io), behind a proxy (trust proxy=1)
                      |  routes -> controllers       |
                      |         -> services -> utils |
                      +---+-----------+----------+---+
                          |           |          |
            Prisma 5.21   |           |          | OIDC JWT (Pub/Sub push)
                          v           v          v
                  PostgreSQL     Google APIs    Google Pub/Sub --> POST /webhook/gmail
                  (users,        - OAuth2 token endpoint, userinfo
                  email_metadata - Gmail API (list/get/send/attachments)
                  category_      Gemini API (gemini-2.5-flash)
                  preferences)
```

There is no queue, cache, worker, or scheduler: everything runs inline in the request handler of a single Node process.

## 2. Tech stack (from package.json / Dockerfiles)

| Layer | Tech | Version / evidence |
|---|---|---|
| Runtime | Node | `node:22-alpine` (`server/Dockerfile:1`, `client/Dockerfile:2`) |
| API | Express | `^4.21.2`; ESM (`"type": "module"`) (`server/package.json:12-20`) |
| Middleware libs | cors `^2.8.5`, cookie-parser `^1.4.7`, express-rate-limit `8.7.1` (pinned) | `server/package.json:17-21` |
| ORM / DB | Prisma `5.21.1` (client + CLI pinned), `pg ^8.14.1`; PostgreSQL 15 locally (`docker-compose.local.yml:5`) | `server/package.json:15,24,27` |
| Google | `googleapis ^146`, `google-auth-library ^9.15`, `@google/generative-ai ^0.22` (model `gemini-2.5-flash`) | `server/package.json`, `summarizeEmail.js:12` |
| Server HTTP client | axios `^1.8.4` (only for Google userinfo) | `callback.js:40`, `getEmailsByCategory.js:50` |
| Frontend | React `^19.1`, react-router-dom `^7.6`, Vite `^6.3.5` (+ SWC plugin), MUI `^7.1`, Tailwind `^4.1`, axios `^1.9`, dompurify `3.4.17`, framer-motion, react-hot-toast | `client/package.json` |
| Dead client deps | three, @react-three/*, react-scripts, @syncfusion/*, websocket, react-hot, @testing-library/* (no tests exist) | `client/package.json:116-118,121-123,133-136` |
| Testing / lint | Client ESLint only; no tests anywhere | `client/package.json:104-109` |
| Delivery | Docker, GitHub Actions -> GHCR -> SSH to EC2 (backend only) | `.github/workflows/deploy.yml` |

**[Verified]** Server `package.json` has only a `start` script: no dev/watch, lint, test, or `engines` (`server/package.json:5-7`).

## 3. Request lifecycle (server/server.js)

1. Startup: `dotenv.config()` (L6) -> `assertSessionConfig()` (L19) throws if `SESSION_SECRET` is missing or < 16 chars, so the process fails fast. Then `BigInt.prototype.toJSON` patch (L21).
2. `app.set('trust proxy', 1)` (L26): one proxy hop trusted for `req.ip` and Secure cookies.
3. `cors({origin: allowedOrigins, credentials: true})` (L36-39). Allowlist = `FRONTEND_URL` + localhost origins only when `NODE_ENV !== 'production'` (L29-34).
4. `cookieParser()` (L41), `express.json()` (L42; default 100 kb limit).
5. Router mounting (L45-53):

| Mount | Middleware chain | Router |
|---|---|---|
| `/auth` | `authLimiter` (60/min per IP) -> router (`/me` adds `requireAuth`) | `routes/authRoutes.js` |
| `/webhook` | none at mount; route adds `verifyPubSubToken` | `routes/webhookRoutes.js:8` |
| `/fetch-emails` | `requireAuth` -> `syncLimiter` 30/min/user | `routes/emailListRoutes.js:8` |
| `/fetch-email` | `requireAuth` -> `aiDraftLimiter` 20/min on POST `/email` only | `routes/emailDetailRoutes.js:9` |
| `/categories` | `requireAuth` | `routes/categoryRoutes.js` |
| `/email` and `/emails` (same router mounted twice) | `requireAuth` -> `summarizeLimiter` 60/min on summarize only | `routes/emailActionRoutes.js` |

6. Error handler (L56-59) logs and returns `{error:"Internal Server Error"}`. **[Verified]** Express 4 does not route rejected promises from `async` handlers to it, so it fires only for sync throws or `next(err)`.
7. `app.listen(PORT||5000)` and `export default app` (L62-64).

`requireAuth` (`middleware/requireAuth.js:10-31`) verifies the HMAC-signed cookie (`utils/session.js:65-80`), loads the user row (one DB query per request), and sets `req.user = {id, isDemo}` where `isDemo = google_id === 'demo_google_id'`. Limiters key by `u:<userId>` when `req.user` exists, else by IP (`rateLimit.js:9`).

**[Verified]** No 404 handler, request logging, `helmet`, health endpoint, or graceful shutdown. **[Verified]** Rate-limit store is the default in-memory one (`rateLimit.js:3-11`): counters reset on restart and are per-process (acceptable for one container; see doc 09).

## 4. Trust boundaries

| # | Boundary | Trusted party | Enforcement |
|---|---|---|---|
| T1 | Browser -> API | Holder of a valid signed cookie `mailwise_session` (HttpOnly, 7-day TTL) | `requireAuth`; identity never read from query/body (`requireAuth.js:6-9`) |
| T2 | Cross-origin browser | Only `FRONTEND_URL` (+ localhost in non-prod) | CORS allowlist with credentials; SameSite default `lax` (`session.js:32`) |
| T3 | Pub/Sub -> `/webhook/gmail` | Caller with OIDC JWT matching audience and service-account email | `verifyPubSubToken`, fails closed if env missing (`verifyPubSubToken.js:14-17`) |
| T4 | API -> Google (Gmail, userinfo, token) | Per-user OAuth tokens stored in Postgres | `getAuthenticatedClient` (`googleAuthService.js:27`) |
| T5 | API -> Gemini | One shared server key; email text is untrusted data in prompts | `<email>` / `<description>` delimiters (`summarizeEmail.js:104`, `generateAiEmail.js:45`) |
| T6 | API -> Postgres | Full trust, no row-level security; tenant isolation is `user_id` in each query | controllers pass `req.user.id` |
| T7 | Demo user | A real DB user with a real session cookie, protected by controller short-circuits, not by auth | `req.user.isDemo` checks |

**[Verified]** OAuth access/refresh tokens are stored unencrypted (`callback.js:63-64`, `schema.prisma:238-240`). **[Risk]** a DB leak equals Gmail read+send for every user. See [02-auth-security](02-auth-security.md), [05-data-layer](05-data-layer.md).

**[Verified]** HTML bodies from `/fetch-email/:id` are returned unsanitized (`getEmailById.js:37,84`); sanitization is client-side (DOMPurify in `client/src/utils/formatEmailBody.js:1`). The server is not a sanitization boundary; see [07-frontend](07-frontend.md).

## 5. End-to-end flows

### 5.1 Login (Google OAuth)

```
SPA (GmailOAuthApp.jsx:12)      API                                      Google
  GET /auth/url  ------------->  issueOAuthState(): random 32B,
                                 Set-Cookie mailwise_oauth_state (10 min)  (url.js:3-16, session.js:82-86)
                 <-- {authUrl}   scopes: userinfo.email/profile, gmail.readonly, gmail.send;
                                 access_type=offline, prompt=consent
  window.location = authUrl ------------------------------------------> consent
                                                        <--- 302 GET /auth/callback?code&state
  GET /auth/callback --------->  consumeOAuthState(): ?state vs cookie, cookie always cleared (callback.js:17)
                                 getToken(code) -> userinfo (axios) -> find user by EMAIL
                                 new: create user + 7 default categories; existing: update tokens
                                 createSession(): Set-Cookie mailwise_session (callback.js:100)
                 <-- 302 FRONTEND_URL/emails/inbox
  App mount: GET /auth/me ---->  requireAuth -> {id,name,email,pic,isDemo} (App.jsx:78, me.js)
```

**[Risk]** `authRoutes.js:14-18` creates one module-level `OAuth2` client shared by all callbacks, and `callback.js:33` calls `setCredentials` on it per login. Harmless today because later code uses the local `tokens`, but it is shared mutable state. Users are matched on email, not Google id (`callback.js:49-52`); see doc 02.

### 5.2 Demo mode

```
SPA button (GmailOAuthApp.jsx:112): window.location = ${baseURL}/auth/demo  (GET navigation)
demoLogin (demoLogin.js:4-78):
  find user google_id='demo_google_id' (create if absent, access_token='demo')
  else DELETE that user's categories + emails                     <- shared, destructive reset
  re-seed 7 categories + 9 emails with relative timestamps (16 sequential inserts)
  createSession(res, demoUser.id); 302 FRONTEND_URL/emails/inbox
```

After this the demo user is an ordinary authenticated user with `req.user.isDemo === true`. Short-circuits: `getEmailsByCategory.js:14` (reads seeded rows), `getEmailById.js:11` (canned body), `summarizeEmail.js:27` (canned), `generateAiEmail.js:30` (canned), `sendEmail.js:7` (no-op success), `clearUserEmails.js:5` (no-op). Category CRUD has **no** demo branch and mutates real rows.

- **[Verified]** All demo visitors share one DB user; each `/auth/demo` visit wipes categories/emails under anyone currently using the demo (`demoLogin.js:25-26`).
- **[Verified]** The reset is not transactional, and `/auth/demo` is unauthenticated, GET, IP-limited at 60/min: 2 deletes + 16 inserts per call. **[Opportunity]** `prisma.$transaction` + `createMany`.
- **[Verified]** Demo is keyed on `req.user.isDemo`, not the literal token `"demo"`. `access_token='demo'` is still stored (`demoLogin.js:15,23`) but is vestigial. **[Risk]** any new controller touching Gmail/Gemini without an `isDemo` branch will 500 for demo (`getAuthenticatedClient` would use the fake token).

### 5.3 Fetch + classify (core flow)

Triggered by `GET /fetch-emails/:category` from `client/src/api/api.js:5`, called from `App.jsx:99-110` (login, and whenever `emails` is empty) plus other paths in doc 07. Handler: `controllers/emails/getEmailsByCategory.js`.

```
requireAuth -> syncLimiter -> getEmailsByCategory
 1 getAuthenticatedClient({userId})  user row + token refresh if <5 min to expiry
 2 GET Google userinfo (axios)       EVERY sync, only to return name/pic/email (L50)
 3 gmail messages.list maxResults 20, q "-in:trash -in:draft"                (L59-63)
 4 filterUnprocessedEmailIds         1 query: IDs already in email_metadata
 5 if new IDs: categoryPreference.findMany; fetchRawEmailsConcurrently(ids, gmail, 10);
               processAndClassifyEmails(raw, categories, 2); emailMetadata.createMany(skipDuplicates)
 6 emailMetadata.findMany ALL user rows (+ case-insensitive category filter), by received_date desc
 7 JSON {emails, name, pic, email}; BigInt `update` stringified manually (L113-116) and by global patch
```

- **[Verified]** Step 6 has no `take`/pagination (`getEmailsByCategory.js:108-111`); the response grows unbounded. Only the newest 20 Gmail messages are examined per call, so older mail is never ingested. See [03-ingestion-classification](03-ingestion-classification.md), [09-scalability-reliability](09-scalability-reliability.md).
- **[Verified]** The full pipeline (Gmail + Gemini) runs synchronously in the request, and the single catch at L125 wraps step 6 too: any failure in steps 1-5 returns 500 even though stored emails exist. **[Opportunity]** serve stored rows and treat sync errors as non-fatal.
- **[Verified]** No per-user lock: concurrent syncs are deduped by `skipDuplicates` but can double-spend Gemini calls.
- **[Verified]** Step 2 is a wasted external round trip per sync; the user row (`authUser`) already has the same fields (fallbacks at L120-122).

### 5.4 View email

`ViewEmails.jsx:49` -> `GET /fetch-email/:emailId` -> `getEmailById.js`: live Gmail `messages.get`, body via `helpFunctions/extractBody.js` (text/plain, then text/html, then top-level body), then **sequential** `attachments.get` per top-level attachment part with base64 data inlined in the JSON (`getEmailById.js:42-75`).

- **[Verified]** Attachments are downloaded for every view, no size cap; only top-level `payload.parts` are scanned (the ingestion helper `findAttachmentName` recurses, this does not). **[Opportunity]** return attachment metadata and add a download endpoint.
- **[Verified]** Cross-user access is impossible by construction (the id goes to the current user's Gmail client). Response keeps legacy fields `_id`/`userId` = email id (`getEmailById.js:79-81`).

### 5.5 Summarize

`DisplayEmail.jsx:135`, `ViewEmails.jsx:70` -> `GET /email/summarize/:emailId` (60/min) -> `summarizeEmail.js`:
1. Demo -> canned. 2. `getAuthenticatedClient` (L36, **before** the cache check, so cache hits still pay a user lookup/possible token refresh). 3. Cache hit if `emailsummary` contains `•` or `Action Item:` (L50-60). 4. Else fetch from Gmail (fallback to the stored snippet). 5. Gemini with 3 retries. 6. `updateMany` overwrites `emailsummary` (L131-141); cache write errors are swallowed.

**[Risk]** The discriminator is heuristic: a Gemini reply lacking both markers is cached but treated as a snippet, so it is re-generated every view; a newsletter snippet containing `•` is mistaken for an AI summary. See 7.2.

### 5.6 Compose / AI draft / send

- Draft: `Auto_email.jsx:29` -> `POST /fetch-email/email {type, details}` (20/min) -> `generateAiEmail.js` (type in {formal, informal}, details <= 1000 chars, output clamped, 502 on malformed JSON).
- Send: `Compose.jsx:82` -> `POST /email/send-emails`. **[Verified]** The client posts `{headers, body: JSON.stringify(hook.data)}` (`Compose.jsx:82-85`) and the server has explicit "legacy frontend" unwrapping (`sendEmail.js:15-33`). Validation and MIME building in `utils/mimeBuilder.js` (header-injection checks, 50 recipients, 1 MB body; `isValidation` -> 400). **[Opportunity]** send flat `{to, subject, body}` and delete the dual parser.
- **[Verified]** `POST /send-emails` has no limiter (`emailActionRoutes.js:10`; limiters exist only in `rateLimit.js:13-15`). **[Risk]** a hijacked session could mass-send from the user's Gmail (bounded by Gmail quotas). Add e.g. 20/min.

### 5.7 Gmail push webhook (incomplete)

```
Gmail -> Pub/Sub -> push subscription -> POST /webhook/gmail  (Authorization: Bearer <OIDC JWT>)
  verifyPubSubToken (audience + email_verified + exact SA email) else 401
  gmailWebhook: validate message.data (base64 JSON {emailAddress, historyId})
     unknown user -> 200; historyId <= stored -> 200; else log + 200.  NO history.list, NO persistence.
```

- **[Verified]** Nothing registers a Gmail watch: no `setupGmailWatch`/`gmailWatchService` in any `.js` (grep), and `server/services/` contains only `batchClassificationService.js`, `gmailFetchService.js`, `googleAuthService.js`. `services/gmailWatchService.js` is **absent** from disk and `git ls-files`; `callback.js` calls no watch function.
- **[Verified]** `gmailWebhook.js:40` reads `user.last_history_id`, but `schema.prisma` `User` (L11-25) and the baseline migration have no `last_history_id`/`watch_expiration`. It is always `undefined`, so the stale-id branch is dead code and every authenticated push just logs and returns 200.
- **[Verified]** `docker-compose.yml:25-27` references `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PUBSUB_TOPIC`, but `deploy.yml:76-85` never writes them to `.env`, so on prod the webhook would always 401 (fail-closed). `GOOGLE_PUBSUB_TOPIC` is read by no code. Detail in [06-gmail-push-webhook](06-gmail-push-webhook.md).

## 6. Server module/layer structure and consistency

```
server/
  server.js                  composition root (app creation and listen are fused)
  prisma.js                  PrismaClient singleton
  routes/*.js (6)            URL -> controller wiring, per-route limiters
  middleware/                requireAuth.js, rateLimit.js
  controllers/
    auth/ (url, callback, demoLogin, me, logout)
    categories/ (get, create, update, delete)
    emails/ (getEmailsByCategory, getEmailById, summarizeEmail, generateAiEmail, sendEmail, clearUserEmails)
    webhook/gmailWebhook.js
    helpFunctions/ (extractBody.js [used by controllers AND a service], fetchUserData.js [unused])
  services/                  googleAuthService, gmailFetchService, batchClassificationService
  utils/                     session, verifyPubSubToken (is middleware), retryHelper, asyncPool, emailCleaner, mimeBuilder
  prisma/                    schema.prisma + migrations/ (baseline only)
```

- **[Verified]** Layering is only partly honoured. Categories and `auth/me` call Prisma directly; `getEmailsByCategory` orchestrates services and Prisma; `summarizeEmail.js` and `generateAiEmail.js` embed prompts, Gemini client creation, and DB caching in the controller while classification has a real service. Three separate `new GoogleGenerativeAI(...)` (`summarizeEmail.js:11`, `generateAiEmail.js:6`, `batchClassificationService.js:9`) and the model name hard-coded three times. **[Opportunity]** one `services/geminiService.js` (client, model const, retry wrapper).
- **[Verified]** A service imports from the controllers folder: `gmailFetchService.js:2` -> `controllers/helpFunctions/extractBody.js`. Move to `utils/`.
- **[Verified]** `verifyPubSubToken.js` is middleware living in `utils/`.
- **[Verified]** Dead/legacy: `controllers/helpFunctions/fetchUserData.js` (no importers); alias exports with old names (`fetch1`, `fetch3`, `aiEmail`, `sendEmails`, `InsertnewCat`, `DisplayingCategoriesName`, `UpdateCategory`, `fetchMail`) imported nowhere; tracked `server/attachments/WhatsApp Image 2025-04-03 at 12.52.52.jpeg` referenced by no code.
- **[Verified]** `dotenv.config()` is repeated in about eight modules. ESM imports are hoisted, so the call at `server.js:6` runs *after* imported modules evaluate; the per-module calls are what make module-level reads like `authRoutes.js:14` and `generateAiEmail.js:6` work. **[Risk]** deleting them naively breaks those reads; replace with `import 'dotenv/config'` as the first import instead.
- **[Verified]** `listen()` runs at import time (`server.js:62-64`), so the app cannot be imported by tests without binding a port.
- **[Verified]** Error shapes are mostly `{error}` but `/auth/callback` returns plain text (`callback.js:18,22,104`), and `sendEmail` returns `{message, response}` while `Compose.jsx:86` also checks a nonexistent `response.data.status` (harmless: HTTP 200 is checked first).
- **[Verified]** Async handlers depend on per-controller try/catch. `getEmailsByCategory.js:14-39` (demo branch Prisma calls) sits outside the try, so a DB error there is an unhandled rejection (Node 22 default: crash). **[Risk]** one transient DB error on the demo path can kill the API. **[Opportunity]** a 6-line `asyncHandler` wrapper (or Express 5).

## 7. Conventions

### 7.1 Demo mode
See 5.2. Rule for new code: any handler that calls Gmail or Gemini must check `req.user.isDemo` first and return canned data. CLAUDE.md's "`token === 'demo'`" is obsolete.

### 7.2 `emailsummary` snippet-vs-summary
`email_metadata.emailsummary` (`schema.prisma:256`) holds either a <=140-char snippet (`generateBodySnippet`, `batchClassificationService.js:20-26`; used at L60/71/82 for label fast-path and L204/284 for AI rows) or a Gemini summary. Discriminator: contains `•` or `Action Item:`. Implemented server-side at `summarizeEmail.js:51-52` and mirrored on the client (`DisplayEmail.jsx:105,129`, `ViewEmails.jsx:38,107`). Demo seed rows contain no marker, so they count as snippets. **[Opportunity]** a nullable `ai_summary` column replaces the magic string (needs a real migration; note deploy still uses `db push`, see 9).

### 7.3 BigInt patch
`BigInt.prototype.toJSON` returns a string (`server.js:21`) because `users.update` and `email_metadata.update` are `BigInt?` (`schema.prisma:241,258`). `getEmailsByCategory` also stringifies manually (L28-31, L113-116), making the patch redundant there. **[Verified]** The `update` column is vestigial: the server only writes `user.update = 1` (`createCategory.js:21-24`), while the client increments an `update` counter and sends it in DELETE bodies (`NewCategory.jsx:93-95`) that the server ignores (`deleteCategory.js` reads only params). **[Opportunity]** confirm with docs 05/07 and remove.

### 7.4 Route ordering and aliasing
- `emailDetailRoutes.js:9-12`: `POST /email` precedes `GET /:emailId`. Since the methods differ, order is not load-bearing today; it only matters if someone adds `GET /email`. Currently `GET /fetch-email/email` falls into `getEmailById` with id `"email"` (Gmail error -> 500). The README wrongly documents the draft endpoint as GET.
- `emailActionRoutes` is mounted at `/email` and `/emails` (`server.js:52-53`). **[Verified]** the client uses only `/email/...`; `/emails` is an unused alias. **[Opportunity]** drop one.
- `/fetch-emails` (list) vs `/fetch-email` (detail/draft) differ by one letter; the draft POST under `/fetch-email/email` is a naming wart.
- Category names travel in the URL path; the client uses `encodeURIComponent` (`NewCategory.jsx:67,93`). Renaming a category does not update `email_metadata.category` (doc 05).

### 7.5 Identity
Identity is exclusively `req.user.id` from the cookie. A grep of `client/src` finds no use of `user_id` or `access_token`. `getAuthenticatedClient` asserts an integer id (`googleAuthService.js:28-30`).

## 8. Client-server contract

All endpoints except `/auth/*` and `/webhook/*` need the session cookie (401 otherwise). The client uses axios `withCredentials: true` (`client/src/api/http.js:6`); a response interceptor turns any non-`/auth/` 401 into `resetSession()` (`http.js:33-42`, `App.jsx:70-73`).

| Method | Path | Auth | Limiter | Handler | Client caller |
|---|---|---|---|---|---|
| GET | `/auth/url` | public | authLimiter (IP) | `controllers/auth/url.js` | `GmailOAuthApp.jsx:12` |
| GET | `/auth/callback` | public (state cookie) | authLimiter | `auth/callback.js` | browser redirect from Google |
| GET | `/auth/demo` | public | authLimiter | `auth/demoLogin.js` | `GmailOAuthApp.jsx:112` (navigation) |
| GET | `/auth/me` | cookie | authLimiter (IP) | `auth/me.js` | `App.jsx:78` |
| POST | `/auth/logout` | none (clears cookie) | authLimiter | `auth/logout.js` | `Optionsmenu.jsx:22` |
| GET | `/fetch-emails/:category` | cookie | syncLimiter 30/min/user | `emails/getEmailsByCategory.js` | `api/api.js:5` (via `App.jsx:106`) |
| GET | `/fetch-email/:emailId` | cookie | none | `emails/getEmailById.js` | `ViewEmails.jsx:49` |
| POST | `/fetch-email/email` | cookie | aiDraftLimiter 20/min | `emails/generateAiEmail.js` | `Auto_email.jsx:29` |
| GET | `/email/summarize/:emailId` (also `/emails/...`) | cookie | summarizeLimiter 60/min | `emails/summarizeEmail.js` | `DisplayEmail.jsx:135`, `ViewEmails.jsx:70` |
| POST | `/email/send-emails` (also `/emails/...`) | cookie | none | `emails/sendEmail.js` | `Compose.jsx:82` |
| DELETE | `/email` or `/emails` (router root) | cookie | none | `emails/clearUserEmails.js` | none |
| GET | `/categories` | cookie | none | `categories/getCategories.js` | `SideBarContent.jsx:52` |
| POST | `/categories` | cookie | none | `categories/createCategory.js` | `NewCategory.jsx:43` |
| PUT | `/categories/:categoryName` | cookie | none | `categories/updateCategory.js` | `NewCategory.jsx:67` |
| DELETE | `/categories/:categoryName` | cookie | none | `categories/deleteCategory.js` | `NewCategory.jsx:93` |
| POST | `/webhook/gmail` | Pub/Sub OIDC JWT | none | `webhook/gmailWebhook.js` | Google Pub/Sub, not the client |

Observations:
- **[Verified]** Response shapes are ad hoc: categories return `{name, title}` where title is the description (`getCategories.js:10`); the email list returns raw DB column names (`attachname`, `emailsummary`, `received_date`, `update`) plus `{name, pic, email}`.
- **[Verified]** `api.js:14-16` swallows errors and returns `{emails: []}`, so a failed sync looks like an empty mailbox (no error state in UI).
- **[Verified]** Category endpoints validate only non-emptiness (`createCategory.js:6`); duplicates surface as a 500 (Prisma unique violation) instead of 409; no length or count cap, and `category_description` is injected into the Gemini prompt (cost and prompt-injection surface; docs 03/04).
- **[Verified]** No CSRF token; protection is SameSite=Lax + CORS allowlist. If `SESSION_SAMESITE=none` is used (needed for a cross-site SPA), JSON content-type preflight is the only barrier. See doc 02.
- **[Risk]** Cross-site hosting: README/CLAUDE.md place the SPA on Amplify and the API on EC2. With default `SameSite=lax` the XHR cookie is not sent cross-site, so the deployment works only if both share a registrable domain (`COOKIE_DOMAIN`) or `SESSION_SAMESITE=none` is set. Neither `docker-compose.yml:12-27` nor `deploy.yml:76-85` passes those variables, so they cannot be set via the current pipeline. Confirm the real topology; see doc 08.

## 9. Config surface (architecture-relevant)

Server env read in code: `DATABASE_URL`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `GEMINI_API_KEY`, `FRONTEND_URL`, `SESSION_SECRET` (required), `SESSION_SAMESITE`, `COOKIE_DOMAIN`, `NODE_ENV`, `PORT`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`. Client: `VITE_BACKEND_URL`, baked at build (`http.js:3`); `client/Dockerfile` has no `ARG VITE_BACKEND_URL`, so the nginx image always targets `http://localhost:5000` unless a `.env` is copied in. `client/nginx.conf` CSP `connect-src` allows `http://localhost:5000` and any `https:`.

**[Verified]** Prisma migrations exist (`server/prisma/migrations/20261025000000_baseline`), but `server/Dockerfile:25` still runs `prisma db push --accept-data-loss` and `deploy.yml` never runs `migrate deploy`. `prisma/migrations/README.md:7-9` describes a CMD (`migrate deploy && npm start`) that the Dockerfile does not contain. See docs 05/08.

## 10. Documentation drift (CLAUDE.md and README.md vs code)

| # | Doc statement | Code reality | Evidence |
|---|---|---|---|
| 1 | CLAUDE.md: "no sessions/JWT"; redirect carries `access_token`, `user_id`, `name`; client keeps `mailwise_token` in localStorage | Signed HttpOnly cookie `mailwise_session`; redirect is `FRONTEND_URL/emails/inbox` with no params; no localStorage tokens | `callback.js:99-101`, `session.js:3-56`, `App.jsx:76-95` |
| 2 | CLAUDE.md / README L86: requests carry `?access_token=` / Bearer and `user_id` | Neither is read; identity only from cookie | `requireAuth.js:6-12`, `http.js:6` |
| 3 | CLAUDE.md: `getAuthenticatedClient` resolves `userId` > `googleId` > token; no ownership check | Takes only an integer `userId` from `req.user.id`, throws otherwise | `googleAuthService.js:27-30` |
| 4 | CLAUDE.md: literal token `"demo"` short-circuits controllers | `req.user.isDemo` (google_id match) | `requireAuth.js:25`, controllers (5.2) |
| 5 | CLAUDE.md: `setupGmailWatch` in `services/gmailWatchService.js`, called from OAuth callback, stores `last_history_id`/`watch_expiration`; README lists watch registration as existing | File does not exist; no watch call; no such columns | `server/services/`, `callback.js`, `schema.prisma:11-25`, `gmailWebhook.js:40` |
| 6 | CLAUDE.md: webhook only decodes and acks, no token verification | OIDC JWT verified; payload validated; user lookup; inert historyId compare | `webhookRoutes.js:8`, `verifyPubSubToken.js`, `gmailWebhook.js` |
| 7 | CLAUDE.md and README step 1: latest 30 Gmail IDs | `maxResults: 20` | `getEmailsByCategory.js:61` |
| 8 | CLAUDE.md: `DELETE /:userId`; README: `DELETE /email/:userId` | `DELETE /` without param | `emailActionRoutes.js:16` |
| 9 | README: `/categories/:userId` and `/categories/:userId/:categoryName` | `/categories`, `/categories/:categoryName` | `categoryRoutes.js:10-13` |
| 10 | README: `GET /fetch-email/email` drafts AI email | `POST /fetch-email/email` | `emailDetailRoutes.js:9` |
| 11 | CLAUDE.md: `/email` must precede `/:emailId` | Different methods; not load-bearing now | `emailDetailRoutes.js:9,12` |
| 12 | CLAUDE.md: frontend allowed via hardcoded CORS origin | Env-driven allowlist (`FRONTEND_URL`); localhost only outside production | `server.js:29-34` |
| 13 | CLAUDE.md / README required env lists | Also `SESSION_SECRET` (boot fails without it); optional `SESSION_SAMESITE`, `COOKIE_DOMAIN`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`; `GOOGLE_PUBSUB_TOPIC` unused. README `.env` sample omits `SESSION_SECRET`, so following it fails at startup | `session.js:8-17`, `server.js:19` |
| 14 | CLAUDE.md / README: `npx prisma db push` | Baseline migration exists; Dockerfile still uses `db push --accept-data-loss`; migrations README claims `migrate deploy` CMD | `server/Dockerfile:25`, `prisma/migrations/README.md:7-9` |
| 15 | CLAUDE.md: new env vars need both compose and deploy.yml | Rule is right and currently violated for `PUBSUB_*`/`GOOGLE_PUBSUB_TOPIC` | `docker-compose.yml:22-27` vs `deploy.yml:76-85` |
| 16 | CLAUDE.md: `routes/route.js` unused | `api.url.js` is unused, but `routes/route.js` is imported by `DisplayEmail.jsx:8`, `SearchResults.jsx:4`, `SideBarContent.jsx:17` (path constants only; not used for routing) | grep |
| 17 | CLAUDE.md: `App.jsx` owns "auth bootstrap" with token handling | Bootstrap is `GET /auth/me`; ~17 context values still true; catch-all `*` redirects to `/emails/inbox` | `App.jsx:35-54,76-95,22-33` |
| 18 | README project structure: services include "watch registration" | No such service | `server/services/` |
| 19 | README "Gmail push (in progress): watch registration and webhook exist" | Only the webhook endpoint exists | 5.7 |

Referenced-but-missing: `server/services/gmailWatchService.js` (confirmed absent from disk and `git ls-files`; zero references in code). The `webhook` branch named in CLAUDE.md was not checked. `git status` shows root `CLAUDE.md` as deleted (` D`) and `.claude/` untracked, so the tracked root copy differs from the working tree; I treated the content quoted in the task as the stale text. Tracked but unused: `server/attachments/*.jpeg`.

## 11. Prioritized recommendations

Sized for a small single-instance app; none adds new infrastructure.

**P0 - correctness / outage risk**
1. Guard code outside try/catch (`getEmailsByCategory.js:14-39`) with a small `asyncHandler` wrapper; unhandled rejections can crash Node 22. [Verified]
2. Reconcile prod config: confirm SPA/API topology, then make `SESSION_SAMESITE`/`COOKIE_DOMAIN` and `PUBSUB_*` flow through `docker-compose.yml` and `deploy.yml`. [Risk]
3. Decide the webhook's fate (doc 06): finish it (migration adding `last_history_id`/`watch_expiration`, watch service, `history.list`) or remove the dead path, `GOOGLE_PUBSUB_TOPIC`, and doc claims. Today it is a secured no-op. [Verified]
4. Resolve the schema-deploy contradiction (doc 05/08): `db push --accept-data-loss` in the Dockerfile vs migrations README. [Verified]

**P1 - robustness / cost**
5. Make sync failure non-fatal, paginate the list query (`take`/cursor), and surface sync errors in the client (`api.js:14-16`). [Verified]
6. Drop the per-sync Google userinfo call (`getEmailsByCategory.js:50`); move `getAuthenticatedClient` after the cache check in `summarizeEmail.js`. [Opportunity]
7. Add limiters to `POST /send-emails` and `GET /fetch-email/:id`; stop inlining attachments on view. [Verified/Opportunity]
8. Wrap `/auth/demo` seeding in a transaction with `createMany`. [Verified]

**P2 - maintainability**
9. One `services/geminiService.js`; move `extractBody` to `utils/`, `verifyPubSubToken` to `middleware/`. [Opportunity]
10. Delete dead code: `fetchUserData.js`, legacy alias exports, `/emails` mount, `api.url.js`, `server/attachments/*.jpeg`, unused client deps. [Verified]
11. Flatten the send-email payload and drop the legacy parser. [Opportunity]
12. Replace the `•`/`Action Item:` heuristic with an explicit column at the next migration. [Opportunity]
13. Split `app` from `listen`; add `/healthz`, a 404 handler, `engines`, a `dev` script. [Opportunity]
14. Rewrite CLAUDE.md and README from the section 10 table (auth, demo, push, endpoints, env, ingestion count).
