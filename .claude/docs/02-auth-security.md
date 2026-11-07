# 02 - Authentication and Security Review

Scope: OAuth, sessions, demo mode, ownership checks, CSRF/CORS, rate limiting, injection/XSS, webhook auth, secrets, client auth bootstrap. Paths are relative to the repo root. Labels: **[Verified]** = confirmed in code, **[Risk]** = plausible exposure that depends on deployment or inputs, **[Opportunity]** = hardening or simplification.

Related docs: `01-architecture.md`, `03-ingestion-classification.md`, `04-ai-and-gmail-actions.md`, `05-data-layer.md`, `06-gmail-push-webhook.md`, `07-frontend.md`, `08-devops-deployment.md`, `09-scalability-reliability.md`.

## 0. Discrepancies with the root CLAUDE.md (stale)

| CLAUDE.md says | Code actually does |
|---|---|
| `/auth/callback` redirects with `access_token`, `user_id`, `name` in the query string; client keeps them in `localStorage` | Callback sets a signed HttpOnly cookie and redirects to `${FRONTEND_URL}/emails/inbox` with no identifiers (`server/controllers/auth/callback.js:99-101`). Client has no `localStorage` use (grep of `client/src` finds none) and relies on `withCredentials` (`client/src/api/http.js:5`). |
| `getAuthenticatedClient` resolves user by `userId` > `googleId` > token | Takes only an integer `userId`, throws otherwise (`server/services/googleAuthService.js:27-30`). |
| "user-scoped routes do no ownership check", `DELETE /:userId`, `userId` in paths | No route carries a userId. Identity is `req.user.id` from `requireAuth` everywhere (`server/routes/*.js`). `DELETE /email(s)/` clears only the caller's emails (`server/routes/emailActionRoutes.js:16`). |
| Demo = literal token `"demo"` | Demo = a real DB user with `google_id='demo_google_id'`; `requireAuth` sets `req.user.isDemo` (`server/middleware/requireAuth.js:4,25`). |
| Webhook "does not yet verify the Pub/Sub token" | `verifyPubSubToken` (OIDC JWT, audience + service-account email) is mounted on `POST /webhook/gmail` (`server/routes/webhookRoutes.js:8`). |
| CORS via hardcoded Amplify origin | Allowlist is `FRONTEND_URL` plus localhost origins only when `NODE_ENV !== 'production'` (`server/server.js:29-39`). |

## 1. OAuth flow

- `GET /auth/url` (`server/controllers/auth/url.js`) issues a 32-byte random `state`, stores it in cookie `mailwise_oauth_state` (10 min TTL), and returns the Google URL. **[Verified]** `access_type: 'offline'`, `prompt: 'consent'` so a refresh token is always returned.
- Scopes (`url.js:9-14`): `userinfo.email`, `userinfo.profile`, `gmail.readonly`, `gmail.send`. **[Verified]** These are Gmail *restricted* scopes; public production use needs Google verification and a security assessment. Nothing broader than needed (no `gmail.modify`).
- Callback (`callback.js:17-19`): `consumeOAuthState` compares cookie vs `?state=` with `timingSafeEqual` and clears the cookie (`session.js:89-95`). **[Verified]** Login-CSRF protected. The cookie is Lax, which still travels on the top-level GET redirect back from Google.
- Redirect: only `process.env.FRONTEND_URL` is used (`callback.js:101`). **[Verified]** No attacker-controlled redirect, no open redirect.
- **[Opportunity]** No PKCE. For a confidential server-side client with state this is acceptable; skip.
- **[Risk]** The granted-scope set is never checked. Google granular consent lets a user untick `gmail.send`; the app would then fail with a 500 on send (`sendEmail.js:51-53`) rather than a clear message. Check `tokens.scope` in the callback or handle 403 from Gmail.
- **[Risk]** Users are matched by `email` (`callback.js:49-52`), and `google_id` is not re-verified on later logins. Generally fine for Google accounts, but keying on `google_id` (stable) is more correct if a Workspace address is ever renamed (would create a duplicate user).
- **[Verified]** Errors on callback return generic text (`callback.js:104`); the full error is logged server-side. Token logging is limited to booleans (`callback.js:27-31`).

## 2. Session design (`server/utils/session.js`)

- Format: `base64url(JSON{uid, exp}).base64url(HMAC-SHA256(payload))` (`session.js:49-55`). Verification is constant-time and checks integer `uid` and numeric `exp` (`session.js:65-80`). **[Verified]** Sound for this scale. Algorithm is fixed, so no alg-confusion.
- Expiry: 7 days, absolute, no sliding refresh (`session.js:5`). **[Verified]**
- Secret: `SESSION_SECRET`, minimum 16 chars, checked at boot (`session.js:8-17`, `server/server.js:19`). **[Verified]** Fails fast. **[Opportunity]** 16 chars is a weak floor; require >= 32.
- **[Risk] No revocation.** `POST /auth/logout` only clears the cookie (`logout.js:3-5`). A stolen cookie remains valid until `exp`. `requireAuth` re-reads the user from the DB (`requireAuth.js:17-23`), so deleting the user row kills sessions, but there is no per-user session version. Cheap fix: `session_version Int @default(0)` on `User`, include `v` in the payload, bump on logout; or shorten the TTL. Rotating `SESSION_SECRET` invalidates everyone (single key, no key id).
- Cookie flags (`session.js:31-42`): `httpOnly: true`; `secure` if `NODE_ENV==='production'` or SameSite=none; `sameSite` from `SESSION_SAMESITE` (default `lax`); optional `COOKIE_DOMAIN`; `path=/`. **[Verified]** Good defaults.
- **[Risk, deployment] Cross-site Amplify -> EC2.** The frontend is on Amplify (e.g. `*.amplifyapp.com`) and the API on EC2 (different registrable domain). With the default `SameSite=Lax`, the browser will not attach the session cookie to cross-site `fetch/XHR`, so API calls would 401 right after login. Options: (a) one site (`app.example.com` + `api.example.com`) with `COOKIE_DOMAIN=.example.com` and Lax (best; immune to third-party-cookie blocking); (b) `SESSION_SAMESITE=none` (Secure), which Safari/Chrome third-party-cookie policies may still block. Note `SESSION_SAMESITE` and `COOKIE_DOMAIN` are in neither `docker-compose.yml:10-31` nor the `.env` generation in `.github/workflows/deploy.yml:74-85`, so production **cannot** currently use them (see section 14 and `08-devops-deployment.md`).
- **[Verified]** `clearOptions()` reuses the same domain/sameSite/secure so logout actually clears the cookie (`session.js:44-47`).

## 3. `requireAuth` (`server/middleware/requireAuth.js`)

- Reads only `req.cookies.mailwise_session`; no query/body/header identity. **[Verified]**
- One DB read per request (`select id, google_id`). Sets `req.user = {id, isDemo}`. Any failure returns a bare 401. **[Verified]**
- Mounted at app level for `/fetch-emails`, `/fetch-email`, `/categories`, `/email`, `/emails` (`server/server.js:49-53`); `/auth/me` adds it per-route (`authRoutes.js:23`). **[Verified]**

## 4. Route-by-route ownership matrix

All routes below are behind `requireAuth` unless noted; "user from" is the only source of identity.

| Route | Handler | User from | Ownership notes |
|---|---|---|---|
| `GET /auth/url`, `/auth/callback`, `/auth/demo` | public | n/a | state-protected / demo (sec. 5) |
| `GET /auth/me` | `me.js` | `req.user.id` | own profile only |
| `POST /auth/logout` | `logout.js` | none | no auth needed; harmless |
| `GET /fetch-emails/:category` | `getEmailsByCategory.js:42,45,103` | `req.user.id` | Gmail client and DB filter both by session user; `category` only used in a Prisma `equals` filter |
| `GET /fetch-email/:emailId` | `getEmailById.js:27` | `req.user.id` | Gmail message fetched with that user's token, so Gmail enforces ownership; no DB lookup by emailId |
| `POST /fetch-email/email` | `generateAiEmail.js` | n/a | no user data accessed |
| `GET/POST /categories`, `PUT/DELETE /categories/:categoryName` | `categories/*.js` | `req.user.id` | composite key `user_id_category_name` on every query (`updateCategory.js:12-17`, `deleteCategory.js:7-13`) |
| `POST /email(s)/send-emails` | `sendEmail.js:12` | `req.user.id` | sends from the session user's Gmail only; `from` forced to `user.email` |
| `GET /email(s)/summarize/:emailId` | `summarizeEmail.js:20,40-46,132-140` | `req.user.id` | cache read/write keyed by `(user_id, email_id)` |
| `DELETE /email(s)/` | `clearUserEmails.js:10-12` | `req.user.id` | scoped `deleteMany`; demo skipped |
| `POST /webhook/gmail` | `gmailWebhook.js` | Pub/Sub payload email | authenticated by OIDC, not a user session |

**[Verified] No IDOR found**: no controller reads `user_id`, `userId`, or tokens from `req.query/body/params`. The old "userId has priority over the token" weakness is gone. `controllers/helpFunctions/fetchUserData.js` takes an access token argument and `console.log`s a Google ID; it appears unused (**[Opportunity]** delete it).

## 5. Demo mode

- `GET /auth/demo` (`demoLogin.js`) is public. It finds or creates the single user `demo_google_id` (`access_token:'demo'`, `refresh_token:'demo_refresh'`), deletes all its categories and emails, reseeds 7 categories + 9 emails, then sets a session for that user. **[Verified]**
- `isDemo` handling per controller: `getEmailsByCategory.js:14` (DB-only), `getEmailById.js:11` (static HTML), `summarizeEmail.js:27` (static), `generateAiEmail.js:30` (static, validated first), `sendEmail.js:7` (fake success), `clearUserEmails.js:5` (no-op). `me.js:15` reports `isDemo`. **[Verified]** None of these reach Gmail/Gemini or touch another user's rows when `isDemo` is true; all DB access is by `req.user.id`, the demo user id.
- **[Verified] No cross-user leak or real-data mutation**: a demo session's `req.user.id` is the demo user, and the placeholder token `'demo'` is never sent to Google because every Gmail-using controller returns before `getAuthenticatedClient`.
- **[Risk] Demo is a single shared user.** Every visitor gets the same user row. A new `/auth/demo` visit wipes categories/emails for all concurrent demo sessions (`demoLogin.js:25-26`), and visitors can create/rename/delete categories on the shared row (`createCategory.js`, `updateCategory.js`, `deleteCategory.js` have no `isDemo` guard). Only demo data is affected, but visitors see each other's custom categories and sudden resets. Rate-limit buckets are shared too (`u:<demoId>`).
- **[Risk] State-changing GET.** `/auth/demo` mutates the DB and swaps the visitor's cookie; any page can link/redirect to it and replace a real logged-in session with the demo one (forced logout; low impact). Unauthenticated, it does ~16 sequential writes per call, limited only by `authLimiter` (60/min/IP). **[Opportunity]** Make it `POST`, skip the wipe when data is already pristine, and seed in a transaction with `createMany`.
- **[Verified]** The demo identity cannot be claimed by a real login: callback matches by email and `demo@mailwise.app` is not a Google-issued address for real users.
- **[Risk]** `getEmailsByCategory.js:14-38` runs DB calls outside the `try` block. In Express 4 an async rejection is unhandled, and on Node 22 an unhandled rejection terminates the process. A DB hiccup on a demo request could crash the server. Wrap in `try/catch`. See `09-scalability-reliability.md`.

## 6. Logout

`POST /auth/logout` clears the cookie only (sec. 2, no revocation). The client then resets state (`App.jsx` `resetSession`, lines 56-67). **[Verified]** It is a POST, so not meaningfully CSRF-able.

## 7. Google token storage and refresh

- **[Verified] Plaintext in Postgres.** `users.access_token` and `users.refresh_token` are plain `String?` columns (`server/prisma/schema.prisma:16-17`). A DB or backup leak yields long-lived Gmail read/send access for every user. **[Opportunity]** Encrypt the refresh token at rest with AES-256-GCM using an env key (a ~20-line helper on Node `crypto`, no new dependency). The access token is short-lived and lower priority.
- Refresh (`googleAuthService.js:41-72`): refresh when expiring within 5 min or missing; persists new token/expiry. **[Verified]**
- **[Risk]** If refresh fails (e.g. user revoked access, `invalid_grant`), the error is only logged (`googleAuthService.js:69-71`) and the stale token is used, producing generic 500s. No "needs re-login" path. **[Opportunity]** On `invalid_grant`, clear tokens and return 401 so the client returns to login.
- **[Risk]** Concurrent requests for the same user may refresh in parallel (no lock). Functionally harmless.
- **[Risk]** Google client errors are logged whole via `console.error("...", error)` in several controllers (e.g. `getEmailById.js:90`, `sendEmail.js:52`, `getEmailsByCategory.js:126`). Depending on library version, such error objects can embed request config including the `Authorization` header. Not confirmed here; log `error.message`/`error.code` instead to be safe.
- No token revocation with Google on logout, and no "delete my account/data" endpoint. **[Opportunity]** Low priority at this scale.

## 8. CSRF

- Cookie auth + CORS credentials. Default `SameSite=Lax` blocks cross-site POST/PUT/DELETE with cookies. **[Verified]**
- JSON endpoints need `Content-Type: application/json` (`express.json()` at `server.js:42`), which forces a CORS preflight; the allowlist rejects foreign origins. So even with `SESSION_SAMESITE=none`, cross-site writes are blocked by CORS. **[Verified]** No CSRF token is needed at this scale as long as the API stays JSON-only.
- **[Risk] State-changing GETs** are reachable by top-level navigation under Lax: `GET /auth/demo` (sec. 5), `GET /fetch-emails/:category` (writes `email_metadata`, calls Gemini; a cross-site link could burn the victim's quota, bounded by `syncLimiter` 30/min), `GET /summarize/:emailId` (caches). Responses are not readable cross-site, so impact is cost/noise only.
- **[Opportunity]** If `SESSION_SAMESITE=none` is chosen for deployment, add an `Origin`/`Sec-Fetch-Site` check for non-GET requests (a few lines) as defense in depth.

## 9. CORS (`server/server.js:29-39`)

- `origin` = `[FRONTEND_URL, + localhost origins when not production]`, `credentials: true`. **[Verified]** No wildcard. `FRONTEND_URL` must be an exact origin (`https://host`, no trailing slash); a trailing slash silently breaks CORS. If `FRONTEND_URL` is unset in production the list is empty and browser calls fail (fail-closed).
- No `helmet`; the API sets no security headers itself and leaves `X-Powered-By` on. **[Opportunity]** `app.disable('x-powered-by')` is a one-liner; helmet optional.

## 10. Rate limiting (`server/middleware/rateLimit.js`)

- `express-rate-limit` 8.7.1, default in-memory store, key `u:<userId>` or IPv6-safe IP via `ipKeyGenerator` (`rateLimit.js:9`). **[Verified]**
- Applied: `authLimiter` 60/min/IP on all `/auth/*` (`server.js:45`); `syncLimiter` 30/min on `GET /fetch-emails/:category`; `summarizeLimiter` 60/min; `aiDraftLimiter` 20/min on `POST /fetch-email/email`. **[Verified]** The Gemini routes and ingestion route are limited per user (limiters run after `requireAuth`, so the user key is populated).
- Not limited: `POST /send-emails` (sends real mail from the user's Gmail; a hijacked session could spam), `GET /fetch-email/:emailId` (Gmail quota, attachments), `/categories/*` writes, `DELETE /emails`. **[Risk]** Add a modest limiter (e.g. 10/min) on send and a general per-user limiter. `/webhook/gmail` is OIDC-authenticated so unlimited is acceptable.
- **[Risk] `trust proxy = 1`** (`server.js:26`) is correct only if exactly one proxy (nginx or ALB) sits in front. If container port 5000 is also directly reachable, clients can spoof `X-Forwarded-For` and evade the per-IP `authLimiter`. Behind two hops, all clients would appear as the proxy IP. Verify against `08-devops-deployment.md`.
- **[Risk]** In-memory store resets on restart and is per-process; fine for one container, wrong if scaled out (`09-scalability-reliability.md`).
- **[Opportunity]** Prevent overlapping syncs per user (a simple in-process Set); a user at the cap can otherwise start 30 concurrent Gmail+Gemini sync runs per minute.

## 11. Input validation and injection

- **SQL injection:** only Prisma Client queries; no `$queryRaw/$executeRaw` anywhere in `server/` (grep). **[Verified]**
- **Email send (`server/utils/mimeBuilder.js`)**: rejects CR/LF/NUL in headers (`CTRL_RE`, lines 16-26), regex-validates addresses, caps recipients (50), subject (998), body (1 MB), RFC 2047 encodes display names. **[Verified]** Header/Bcc injection is handled well. Note `express.json()` default 100 kb limit (`server.js:42`) is below the 1 MB body cap, so the effective cap is ~100 kb.
- **AI drafts (`generateAiEmail.js:8-27`)**: type whitelisted, details type/length (1000) checked, delimited with `<description>` plus an instruction to treat it as data, JSON output validated and truncated. **[Verified]** Prompt injection can only change draft text, which the user reviews before sending; no tool access.
- **Summaries (`summarizeEmail.js:100-117`)**: untrusted email wrapped in `<email>` tags with a "treat as data" instruction. **[Verified]** Output is stored in `emailsummary`; an injected summary could mislead but not execute (rendering covered in `07-frontend.md`).
- **Categories:** only a presence check, no type or length limits (`createCategory.js:4-8`, `updateCategory.js:5-9`); names also travel as path params. **[Risk]** Non-string/huge values cause a Prisma error -> 500; descriptions flow into the classifier prompt (`03-ingestion-classification.md`), so unbounded length is a cost vector and a self-prompt-injection surface (own user only). **[Opportunity]** Validate `typeof === 'string'`, trim, max ~50/300 chars; return 409 on duplicate instead of 500.
- `:category` and `:emailId` are passed to Prisma / the Google SDK as data; no path concatenation. **[Verified]**
- Webhook payload validated (`gmailWebhook.js:6-30`). **[Verified]**

## 12. XSS and client rendering

- The only `dangerouslySetInnerHTML` use: `client/src/components/Emailbody.jsx:144`, fed by `formatEmailBody` (`client/src/utils/formatEmailBody.js`). **[Verified]**
- DOMPurify 3.4.17 pinned (`client/package.json`). Config (`formatEmailBody.js:96-102`): `USE_PROFILES: {html:true}`; forbids style/form/iframe/object/embed/script/link/meta/base/video/audio/svg/math/inputs; forbids `style`, `srcset`, some event attrs; `ALLOWED_URI_REGEXP` only http(s)/mailto/safe `data:image`; no `data-*`. **[Verified]** Strong.
- Hook (`:70-94`): links forced `target=_blank rel="noopener noreferrer"` and non-http(s)/mailto hrefs stripped; remote images removed until the user clicks "Load images", then `referrerpolicy=no-referrer`. **[Verified]** Blocks tracking pixels by default.
- Plain-text emails are HTML-escaped first, then URLs linkified (`:116-121`). **[Verified]**
- **[Risk]** `FORBID_ATTR` is a partial deny-list, but the `html` profile allowlist already excludes event handlers, so practical risk is low. Keep DOMPurify current (Dependabot is weekly, `.github/dependabot.yml`).
- Attachments: `ViewEmails.jsx:311-312` builds `data:${att.mimeType};base64,...` with `download=`; mimeType is sender-controlled but only becomes an escaped attribute value on a download link. **[Verified]** Low risk. Attachments come back inline as base64 JSON, bloating responses (`04-ai-and-gmail-actions.md`).
- Other sinks: `window.location.href = authUrl` comes from the app's own API (`GmailOAuthApp.jsx:146`); demo button targets `${baseURL}/auth/demo` (`:244`). **[Verified]** No user-controlled navigation.
- **[Risk, deployment]** The CSP exists only in `client/nginx.conf:6,15` (the local nginx container). The production frontend is on Amplify (per CLAUDE.md), which does not use that file, so production likely has no CSP unless set in Amplify headers. The nginx CSP is also broad: `connect-src https:`, `script-src cdn.jsdelivr.net`, and a `http://localhost:5000` dev leftover. **[Opportunity]** Define CSP in Amplify custom headers, narrowed to the API origin. See `07-frontend.md`, `08-devops-deployment.md`.

## 13. Webhook authentication (`server/utils/verifyPubSubToken.js`)

- Verifies the Bearer OIDC JWT with `google-auth-library` against `PUBSUB_AUDIENCE`, requires `email_verified` and `email === PUBSUB_SERVICE_ACCOUNT_EMAIL`; fails closed (401) on missing config/header/verification errors. **[Verified]** Correct pattern.
- Handler validates structure, ignores unknown users and stale historyIds, then does nothing yet (TODO, `gmailWebhook.js:46`). **[Verified]** No data mutation, so low abuse surface. See `06-gmail-push-webhook.md`.
- **[Risk]** `PUBSUB_AUDIENCE`/`PUBSUB_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PUBSUB_TOPIC` are referenced by `docker-compose.yml:26-28` but never written to `.env` by `deploy.yml:74-85`, so in production they resolve empty and the endpoint returns 401 to every push (safe, but the feature cannot work).

## 14. Secrets, repo hygiene, logging

- No `.env` tracked (`git ls-files`); `server/.gitignore` ignores `.env`; a secret-pattern grep (Google API key / client-secret prefixes) found nothing, and compose files use `${VAR}` substitution. **[Verified]** The grep for inline DB passwords errored on regex syntax and was not re-run; compose DB URLs seen use variables.
- **[Verified] Committed files that should not be:** `server/attachments/WhatsApp Image 2025-04-03 at 12.52.52.jpeg` (197 KB personal image, unreferenced by code) and root `Screenshot 2026-10-25 202354.png` (added in commit `071be9f`). **[Opportunity]** `git rm` both and add `server/attachments/` to `.dockerignore`; history retains them unless rewritten.
- Deploy secrets: `deploy.yml` echoes secrets into a remote `.env` over SSH (`:74-85`); GitHub masks them in logs. It uses `appleboy/ssh-action@master` (**[Risk]** unpinned branch ref, supply-chain; pin to a tag/SHA). See `08-devops-deployment.md`.
- `docker-compose.local.yml:12-13` publishes Postgres on host port 5432 on all interfaces. **[Risk]** local only; prefer `127.0.0.1:5432:5432`.
- Server container runs as the unprivileged `node` user (`server/Dockerfile`). **[Verified]** It runs `prisma db push --accept-data-loss` on every start, a data-safety (not auth) risk; see `05-data-layer.md`.
- Logging: no tokens logged; user IDs and counts only. Request bodies are not logged. `fetchUserData.js` logs a Google ID (dead code). **[Verified]**
- Error leakage: global handler returns generic 500 (`server.js:56-59`); controllers return generic messages; `callback.js` returns plain strings. **[Verified]** `sendEmail` echoes its own validation messages with 400 (safe, intentional).

## 15. Client-side auth bootstrap

- `App.jsx:76-95` calls `GET /auth/me` on load; success sets user, failure shows login; `checkingSession` gates rendering. **[Verified]**
- `api/http.js:14-23`: axios instance with `withCredentials: true`; a global 401 interceptor (skipping `/auth/` URLs) calls `resetSession`. **[Verified]** No tokens in JS-accessible storage, so XSS cannot exfiltrate the session cookie (it could still issue same-origin API calls, which is why sec. 12 matters).
- `GmailOAuthApp.jsx`: login fetches `/auth/url` then navigates; demo navigates to `${baseURL}/auth/demo`. **[Verified]**
- **[Opportunity]** `client/src/api/api.url.js` and `routes/route.js` are unused leftovers (see `07-frontend.md`).

## 16. Dependency observations

- Server: express 4.21.2, cors, cookie-parser, `express-rate-limit` 8.7.1 (pinned), googleapis ^146, google-auth-library ^9.15.1, axios ^1.8.4, Prisma 5.21.1 (pinned, older line). `npm audit` was not run for this review. **[Opportunity]** Run `npm audit --omit=dev` in both packages; Dependabot weekly already covers server, client and Actions.
- Client: `dompurify` 3.4.17 pinned; React Router 7; unused leftover deps per CLAUDE.md (three, react-scripts, syncfusion, websocket) widen supply-chain surface. **[Opportunity]** Remove them.
- No `engines` field; Docker pins Node 22.

## 17. Severity-ranked findings

| # | Sev | Type | Finding | Where |
|---|---|---|---|---|
| 1 | High | Risk | Production cookie config unreachable: `SESSION_SAMESITE`/`COOKIE_DOMAIN` not passed by compose or deploy `.env`; cross-site Amplify -> EC2 will not send Lax cookies | `session.js:31-42`, `docker-compose.yml`, `deploy.yml:74-85` |
| 2 | High | Verified | Refresh and access tokens stored plaintext | `schema.prisma:16-17` |
| 3 | Medium | Verified | No session revocation; logout only clears cookie; 7-day absolute token | `session.js`, `logout.js` |
| 4 | Medium | Risk | Demo branch of `getEmailsByCategory` outside try/catch can crash the process on DB error | `getEmailsByCategory.js:14-38` |
| 5 | Medium | Risk | No limiter on `send-emails` (real mail via victim Gmail) and other Gmail-backed routes | `emailActionRoutes.js:10`, `emailDetailRoutes.js:12` |
| 6 | Medium | Risk | Shared demo user: visitors wipe/see each other's changes; wipe is a public GET with ~16 writes | `demoLogin.js` |
| 7 | Medium | Risk | Production CSP likely absent on Amplify; nginx CSP too loose | `client/nginx.conf` |
| 8 | Medium | Risk | Pub/Sub env vars never delivered to prod; webhook 401s (safe, feature dead) | `deploy.yml`, `docker-compose.yml:26-28` |
| 9 | Medium | Risk | `trust proxy 1` assumption; spoofable XFF if port 5000 exposed | `server.js:26` |
| 10 | Low | Risk | Refresh failure not surfaced (`invalid_grant`); stale token reused | `googleAuthService.js:69-71` |
| 11 | Low | Risk | Google client errors logged whole; may contain auth headers | `getEmailById.js:90`, others |
| 12 | Low | Risk | Category inputs unvalidated; duplicates give 500 | `createCategory.js`, `updateCategory.js` |
| 13 | Low | Risk | State-changing GETs (`/auth/demo`, `/fetch-emails`, `/summarize`) | routes |
| 14 | Low | Risk | `appleboy/ssh-action@master` unpinned | `deploy.yml` |
| 15 | Low | Risk | Granted scopes not verified (`gmail.send` may be unticked) | `callback.js` |
| 16 | Low | Verified | Stray personal image and screenshot committed | `server/attachments/*.jpeg`, root `.png` |
| 17 | Low | Opportunity | Users keyed by email not `google_id`; 16-char secret floor; dead `fetchUserData.js` | `callback.js:49`, `session.js:10` |
| - | Pass | Verified | No IDOR, no raw SQL, MIME injection-safe, DOMPurify strict, OAuth state checked, Pub/Sub OIDC fail-closed, generic errors, no secrets in repo | sections above |

## 18. Prioritized recommendations (small-app sized)

1. **Fix cookie deployment (finding 1).** Prefer one site: custom domain for Amplify (`app.`) and EC2 (`api.`), set `COOKIE_DOMAIN=.example.com`, keep Lax. Add `SESSION_SAMESITE`/`COOKIE_DOMAIN` to `docker-compose.yml` and the `.env` generation step; also `PUBSUB_*` and `GOOGLE_PUBSUB_TOPIC`. Verify with a real login on prod.
2. **Encrypt refresh tokens at rest** with AES-256-GCM, key in env (`TOKEN_ENC_KEY`), via Node `crypto`; one helper used by `callback.js` and `googleAuthService.js`. Needs re-login or a one-time migration (see `05-data-layer.md`).
3. **Add cheap revocation**: `session_version` on `User`, checked in `requireAuth`, bumped on logout; require `SESSION_SECRET` >= 32 chars.
4. **Wrap the demo branch of `getEmailsByCategory` in try/catch** (and audit other async handlers; Express 4 has no async error handling).
5. **Add limiters** for `send-emails` (~10/min) and a general per-user limiter; confirm proxy hop count and block direct access to port 5000.
6. **Demo hardening**: make `/auth/demo` a POST (or skip reseeding when untouched), use `createMany` in a transaction, add `isDemo` guards to category mutations.
7. **Validate category inputs** (string, trim, length) and map duplicate-key errors to 409.
8. **Production CSP and headers** on Amplify; narrow `connect-src` to the API origin; disable `x-powered-by` or add helmet on the API.
9. **Log hygiene**: log `error.message/code` for Google client errors; on `invalid_grant` clear tokens and return 401.
10. **Repo hygiene**: remove the stray jpeg/png, delete `fetchUserData.js`, pin `ssh-action`, run `npm audit`, drop unused client deps.
