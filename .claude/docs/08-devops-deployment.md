# 08 - DevOps and Deployment

Scope: CI/CD, Docker, compose, nginx, env vars, repo hygiene, observability, dependencies, dev experience, README accuracy.
Labels: **[Verified]** = confirmed in files read; **[Risk]** = plausible problem; **[Opportunity]** = improvement.
Related: [01-architecture](01-architecture.md), [02-auth-security](02-auth-security.md), [03-ingestion-classification](03-ingestion-classification.md), [04-ai-and-gmail-actions](04-ai-and-gmail-actions.md), [05-data-layer](05-data-layer.md), [06-gmail-push-webhook](06-gmail-push-webhook.md), [07-frontend](07-frontend.md), [09-scalability-reliability](09-scalability-reliability.md).

## 1. Deployment topology (as implemented)

- Push to `main` -> GitHub Actions builds `./server` -> pushes `ghcr.io/<owner>/mailwise-backend:{latest,sha}` -> SSH to EC2 -> `git pull`, regenerate `.env`, `docker compose pull && up -d --remove-orphans` (`.github/workflows/deploy.yml`).
- Only the backend is containerised in production. `docker-compose.yml` has a single `backend` service (no Postgres service) on an **external** network `shared-network` with alias `mailwise-api` (`docker-compose.yml:30-37`). `DATABASE_URL` targets host `postgres:5432` (`docker-compose.yml:16`), so a separately managed Postgres container must already be on that network. Nothing in the repo defines, backs up or documents it. **[Risk]**
- Frontend is on AWS Amplify (README/CLAUDE.md); no Amplify config exists in the repo. No TLS/reverse-proxy config exists in the repo either, although the code assumes one (`app.set('trust proxy', 1)`, `server/server.js:26`). **[Verified]** (absence).

## 2. GitHub Actions (`.github/workflows/deploy.yml`)

| Aspect | Finding |
|---|---|
| Trigger | `push` to `main` only (lines 3-6). No `pull_request`, no `workflow_dispatch` (cannot redeploy/rollback manually). |
| Quality gate | **[Verified]** None: no `npm ci`, lint, client build, tests or `prisma validate` before push+deploy. A broken commit on `main` goes straight to prod. |
| Permissions | `build-and-push` has `contents: read, packages: write` - least privilege, good. `deploy` job has no `permissions:` block (repo default). |
| Action pinning | `checkout@v4`, `login-action@v3`, `metadata-action@v5`, `build-push-action@v5` are major-tag pinned. **`appleboy/ssh-action@master`** floats on a third-party branch while receiving the SSH key and all secrets. **[Risk]** Pin to a version/SHA. |
| Image tags | `latest` + `sha-<short>` (metadata step). But compose references only `:latest` (`docker-compose.yml:5`), so SHA tags are not usable for rollback without editing the file. |
| Rollback | **[Verified]** No mechanism. **[Opportunity]** `image: ...:${IMAGE_TAG:-latest}`, write `IMAGE_TAG` into `.env`, add a `workflow_dispatch` input. |
| Build cache | No `cache-from/to`; slower builds only. |
| Concurrency | No `concurrency:` group; rapid pushes can race at `compose up`. **[Risk]** low. |
| Dead env | Top-level `IMAGE_NAME` is defined but unused (metadata step hard-codes `mailwise-backend`). Harmless drift. |
| Registry auth on EC2 | Deploy does `docker login ghcr.io` with `secrets.GITHUB_TOKEN`. That token expires with the job, and the `deploy` job has default permissions that may lack `packages: read`; a private package may fail to pull, and later manual `docker compose pull` on the host will fail once the token dies. **[Risk]** (inferred, not tested). |
| Frontend | Not built/deployed here; the client has no CI at all. |

### 2.1 Secrets handling / writing `.env` on EC2

- `.env` is built with `echo "KEY=${{ secrets.X }}" > .env`. **[Risk]** Actions substitutes secrets into the script text before the remote shell runs it. Values with `"`, `$`, backticks, `\` or newlines are mangled or interpreted by the shell (command injection if a secret contains `$(...)`). Safer: pass through ssh-action `envs:` and write with `printf '%s\n'`.
- `DATABASE_URL` is concatenated with an unencoded `DB_PASSWORD`; a password containing `@ : / # ?` silently breaks the URL. **[Risk]**
- `.env` sits in the git checkout (`~/MailWise/.env`) and there is no root `.gitignore` (see section 7); an accidental `git add -A` on the server would commit secrets. **[Risk]**
- `git pull origin main` failing (dirty tree/conflict) does not abort the script unless `script_stop`/`set -e` is set; a stale compose could run with a new image. **[Risk]**
- **Env mismatch [Verified]:** the generated `.env` writes `DB_*`, `DATABASE_URL`, `GOOGLE_*`, `GEMINI_API_KEY`, `FRONTEND_URL`, `SESSION_SECRET`, but **not** `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PUBSUB_TOPIC`, which `docker-compose.yml:26-28` interpolates. They resolve to empty strings (compose warns). Effect: `verifyPubSubToken` fails closed with 401 (`server/utils/verifyPubSubToken.js:14-17`), so the webhook is non-functional in prod. See [06](06-gmail-push-webhook.md).
- `SESSION_SECRET` is passed (good; server exits at boot if missing or <16 chars: `server/utils/session.js:8-13`, `server/server.js:19`).

### 2.2 Start-up behaviour: CLAUDE.md vs migrations README

- **Drift verdict:** `server/prisma/migrations/README.md:9` says the container starts with `npx prisma migrate deploy && npm start`, but **`server/Dockerfile:27` still runs `npx prisma db push --accept-data-loss && npm start`**, and its comment (lines 24-26) says to switch "once migrations are baselined". So **CLAUDE.md is correct and the migrations README is ahead of the code**; nothing applies migrations yet. **[Verified]**
- Consequence: any schema change that drops a column/table silently drops production data on the next deploy. A baseline migration exists (`server/prisma/migrations/20261025000000_baseline`) but is unused, and the one-time `migrate resolve --applied` step has not been enforced. **[Risk]** high. See [05-data-layer](05-data-layer.md).
- If Postgres is unreachable at start, `db push` fails, the container exits and `restart: unless-stopped` loops it; there is no healthcheck/`depends_on` since the DB is external. **[Risk]** low.

## 3. Dockerfiles

### server/Dockerfile (27 lines)
- Base `node:22-alpine` (floating tag, line 1); installs `openssl` for Prisma (line 5), correct for Alpine.
- Single stage; `npm ci` keeps devDependencies on purpose because the `prisma` CLI is a devDependency needed at runtime (lines 9-11). **[Opportunity]** move `prisma` to `dependencies` and use `--omit=dev`.
- Layer caching good: `package*.json` copied before source (lines 7, 13); `npx prisma generate` at build (line 16).
- Non-root: `chown -R node:node /app` then `USER node` (lines 19-20) **[Verified]**. The recursive chown duplicates the `node_modules` layer; `COPY --chown` avoids it. **[Opportunity]**
- No `HEALTHCHECK`; `NODE_ENV` is not set in the image (compose sets it at runtime). `CMD` uses `sh -c`, and there is no SIGTERM handler (section 8), so `docker stop` waits 10 s then SIGKILLs. **[Risk]** low.
- `server/.dockerignore`: `node_modules, npm-debug.log, .env, .git, .github, .dockerignore, Dockerfile` **[Verified]**. `.env` excluded, so secrets are not baked into images. `attachments/` (a stray tracked JPEG) is not excluded; trivial.

### client/Dockerfile (used by local compose only)
- Two stages (node:22-alpine build -> nginx:alpine), good pattern. But `npm install` (line 8) instead of `npm ci`, so lockfile is not enforced. **[Opportunity]**
- `VITE_BACKEND_URL` is build-time but there is no `ARG` and compose passes no build args, so the image always bakes in the fallback `http://localhost:5000` (`client/src/api/http.js:3`). Works for local compose only. **[Verified]**
- `client/.dockerignore` excludes `node_modules, dist, .env, .git, .github`; since `.env` is excluded, `client/.env` cannot influence Docker builds.
- Floating `nginx:alpine`; master runs as root (standard); no healthcheck.

## 4. docker-compose files

| | `docker-compose.yml` (prod) | `docker-compose.local.yml` |
|---|---|---|
| Services | backend only | db (postgres:15-alpine), backend (build), frontend (build) |
| `version:` | `"3.8"` (obsolete key; modern compose warns) | `'3.8'` same |
| Env | explicit `environment:` allowlist interpolated from generated `.env` (lines 9-28) | `env_file: ./server/.env` plus override of `DB_HOST`, `DB_PORT`, `DATABASE_URL` (lines 27-33) |
| Healthchecks | none | none; `depends_on: db` waits for start, not readiness, so backend `db push` can race Postgres (`restart: always` masks it). **[Risk]** low |
| Volumes | none (DB is external) | named `postgres_data_local` (lines 15, 44) |
| Ports | none published; reached through the shared-network proxy | `5432:5432`, `5000:5000`, `80:80`. Publishing 5432 on all interfaces is unnecessary; use `127.0.0.1:5432:5432`. **[Risk]** low |
| Postgres | not defined | `POSTGRES_PASSWORD: ${DB_PASSWORD:?set DB_PASSWORD in .env}` fail-fast |
| NODE_ENV | `production` (line 24) | unset, so localhost CORS origins are allowed (`server.js:31-33`) and cookies are not `Secure` (intended for dev) |

Gotcha **[Verified by compose semantics, not run]**: `${DB_PASSWORD:?...}` in the local file is resolved by compose interpolation from the shell or a project-dir `.env`, **not** from `env_file: ./server/.env` (that only feeds the container). The repo root has no `.env` and the README does not mention one, so `docker compose -f docker-compose.local.yml up` errors unless the user passes `--env-file server/.env` or exports the variable. Also, the prod compose hard-codes the owner `lakshyagrg23` in the image name (line 5).

## 5. nginx (`client/nginx.conf`), local frontend image only

- SPA fallback `try_files $uri $uri/ /index.html` (line 14) **[Verified]**.
- Headers: CSP, `X-Content-Type-Options`, `Referrer-Policy` set at server level (lines 8-10) and repeated inside `location /` (lines 16-18) because `add_header` in a location discards inherited ones (the file notes this). No HSTS (HTTP-only, local) or `X-Frame-Options` (CSP `frame-ancestors 'none'` covers it).
- CSP weaknesses: `connect-src ... https:` permits any HTTPS origin; `style-src 'unsafe-inline'` (MUI/emotion); `script-src` includes `cdn.jsdelivr.net` (need unverified). **[Risk]** low.
- **This CSP does not protect production**: the frontend is on Amplify and no `customHttp.yml` exists in the repo, so prod may serve no CSP at all. **[Risk]**
- Caching: none configured. Hashed `/assets/*` could be `immutable`, `index.html` `no-cache`. Gzip: not enabled (`gzip on;` absent) despite a heavy bundle (MUI, three, framer-motion). **[Opportunity]** (Amplify compresses in prod.)
- `error_page ... /50x.html` (line 21) refers to a file Vite's `dist` does not contain. Minor.

## 6. Environment variable inventory

From grep of `process.env.*` / `import.meta.env.*` (excluding node_modules):

| Variable | Used at | In README | In `docker-compose.yml` | Written by `deploy.yml` | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma:7` | yes | yes | yes | |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | `services/googleAuthService.js:12-14`, `routes/authRoutes.js:15-17` | yes | yes | yes | two separate OAuth client constructions ([02](02-auth-security.md)) |
| `GEMINI_API_KEY` | `generateAiEmail.js:6`, `summarizeEmail.js:11`, `batchClassificationService.js:9` | yes | yes | yes | |
| `FRONTEND_URL` | `server.js:30`, `auth/callback.js:101`, `auth/demoLogin.js:73` | yes | yes | yes | sole prod CORS origin and redirect target |
| `SESSION_SECRET` | `utils/session.js:9` | **no** | yes | yes | required, >=16 chars |
| `SESSION_SAMESITE` | `utils/session.js:32` | **no** | **no** | **no** | optional, default `lax`; cannot reach prod container |
| `COOKIE_DOMAIN` | `utils/session.js:40` | **no** | **no** | **no** | same |
| `NODE_ENV` | `server.js:31`, `session.js:35` | no | hard-set `production` | n/a | unset in local compose |
| `PORT` | `server.js:61` | commented | no | no | default 5000 |
| `PUBSUB_AUDIENCE` | `utils/verifyPubSubToken.js:11` | **no** | yes | **no** | empty in prod -> webhook 401 |
| `PUBSUB_SERVICE_ACCOUNT_EMAIL` | `verifyPubSubToken.js:12` | **no** | yes | **no** | same |
| `GOOGLE_PUBSUB_TOPIC` | **no code reads it** | yes ("enables push registration") | yes | **no** | dead: `server/services` contains only batchClassificationService, gmailFetchService, googleAuthService; grep for "topic"/"watch" in server JS finds nothing. README and CLAUDE.md describe `gmailWatchService`, which no longer exists. **[Verified]** drift |
| `DB_HOST`, `DB_PORT` | not read by code | no | yes | no (DB_HOST/PORT) | dead |
| `DB_USER/PASSWORD/NAME` | only for compose/Postgres and building `DATABASE_URL` | no | yes | yes | |
| `VITE_BACKEND_URL` | `client/src/api/http.js:3` | yes | n/a | n/a (Amplify env, invisible) | build-time; Docker build cannot receive it |

Consequences: because compose uses an explicit allowlist, **`SESSION_SAMESITE` and `COOKIE_DOMAIN` cannot reach the production container**. With the SPA on an Amplify domain and the API elsewhere and `withCredentials: true` (`client/src/api/http.js:5`), the default `SameSite=Lax` cookie is not sent on cross-site XHR. Login works only if both share a registrable domain (and then `COOKIE_DOMAIN` may be needed), otherwise the cookie needs `SameSite=None; Secure`. Neither is settable via current deploy files. **[Risk]** high; actual prod domains cannot be confirmed from the repo. Cross-ref [02](02-auth-security.md), [07](07-frontend.md). `trust proxy 1` is right for exactly one proxy hop; CloudFront plus ALB would break `req.ip` (rate limiting keys). **[Risk]** low.

## 7. Repo hygiene and secrets

- **No root `.gitignore`** **[Verified]**. Only `client/.gitignore` and `server/.gitignore` (both end with `.env`; the server one also lists `CLAUDE.md`). Root-level `.env` (created by deploy on the host), `.claude/`, `*.log` are unprotected; `git status` shows `.claude/` untracked. **[Risk]** low.
- `git ls-files` shows **no `.env` tracked**; `server/.env` and `client/.env` exist locally and are ignored. **[Verified]** no secrets in the current tree (values not read into this doc). Git history was not scanned. **[Opportunity]** one-off `gitleaks` run.
- A stray binary is tracked: `server/attachments/WhatsApp Image 2025-04-03 at 12.52.52.jpeg`. **[Verified]** Remove it.
- `client/dist` is ignored. Root `CLAUDE.md` shows as deleted in git status while `server/.gitignore` lists `CLAUDE.md`; intent unclear.

## 8. Logging, health, shutdown, observability, backups

- **Logging [Verified]:** `console.log/error` only, in ~28 server files; no logger, request IDs, access log, `helmet` or `morgan`. Compose has no `logging:` options, so Docker's json-file logs are unrotated and can fill the EC2 disk. **[Risk]** add `max-size: 10m, max-file: 3`.
- **Health endpoint [Verified]:** none in `server.js`; hence no `HEALTHCHECK`/compose healthcheck/monitor target. **[Opportunity]** `GET /healthz` (optionally `SELECT 1`) mounted outside `authLimiter`.
- **Graceful shutdown [Verified]:** none. `app.listen` result is not captured (`server.js:62`), no SIGTERM/SIGINT handler, no `prisma.$disconnect()`, no `unhandledRejection` handler. Express 4 does not catch rejected async handlers, so an uncaught rejection can crash the process; `restart: unless-stopped` is the only recovery. **[Risk]**
- **Observability:** no metrics, tracing, error tracking or alerting. **[Opportunity]** Sentry free tier plus an uptime monitor on `/healthz` suffices.
- **Backups [Verified absent]:** none in the repo; only a manual `pg_dump` suggestion in the migrations README. Given `db push --accept-data-loss` at every start this is the biggest ops gap. Email metadata is re-derivable; categories, cached summaries and stored Google refresh tokens are not. **[Risk]**
- **TLS/proxy:** the app speaks plain HTTP on 5000 with nothing published in prod; TLS must come from an external proxy/ALB. `Secure` cookies in production (`session.js:35`) require correct `X-Forwarded-Proto`. Undocumented. No `helmet`; `X-Powered-By: Express` is exposed. **[Opportunity]**
- `express.json()` uses the default 100kb limit (`server.js:42`); see [04](04-ai-and-gmail-actions.md) for send-email size implications.

## 9. Dependency hygiene

- Both lockfiles committed. Server image uses `npm ci`; client Dockerfile uses `npm install`. Amplify build command not visible.
- **Mixed pinning:** server exact `@prisma/client` and `prisma` `5.21.1`, `express-rate-limit` `8.7.1`; all else caret (`server/package.json`). Client exact `dompurify` `3.4.17`, rest caret. Prisma client/CLI pinned in lock-step is good; 5.21 is dated. **[Opportunity]**
- No `engines` field in either package.json and no `.nvmrc`; Node 22 exists only in the Dockerfiles. **[Opportunity]**
- Server package.json: `"main": "index.js"` (file does not exist), empty description/author. `pg` is listed but Prisma does not need it; usage not verified. **[Risk]** (unverified)
- Client leftovers present in `client/package.json` dependencies: `three`, `@react-three/drei`, `@react-three/fiber`, `react-scripts` (CRA, large transitive audit surface while Vite is used), `@syncfusion/ej2-react-notifications`, `websocket`, `react-hot` (0.0.1, alongside `react-hot-toast`), and `@testing-library/*` with no test runner. CLAUDE.md calls these unused; I did not re-grep imports. **[Opportunity]**
- **Dependabot** (`.github/dependabot.yml`): github-actions `/`, npm `/server`, npm `/client`, all weekly, no grouping, no `docker` ecosystem for either Dockerfile. With no CI, update PRs are merged blind. **[Opportunity]**

## 10. Developer experience

- Server: only `"start": "node server.js"`; no dev/watch, lint, format or tests. Client: `dev`, `build`, `lint` (eslint 9 flat config), `preview`; no test script. **[Verified]** Node 22 supports `node --watch server.js`.
- Vite dev server `host: '0.0.0.0', port: 3000` (`client/vite.config.js:7-9`) exposes it on the LAN. **[Risk]** low.
- README local flow says `npx prisma db push`, inconsistent with the migrations README (`migrate dev`/`deploy`). **[Verified]** drift.
- `/auth/demo` allows UI work without Google OAuth setup ([02](02-auth-security.md)).

## 11. README accuracy

Root `README.md` drift:
1. The Authentication section still describes token-in-redirect, `localStorage`, "no server-side sessions" and `access_token`/`user_id` per request; code now uses a signed HttpOnly cookie (`server/utils/session.js`, `withCredentials` in `client/src/api/http.js`) and `requireAuth` (`server/server.js:49-53`). **[Verified]** (CLAUDE.md shares this staleness.) The API table's auth sentence is likewise stale.
2. The sample `server/.env` and the secrets list omit `SESSION_SECRET`; a developer following the README crashes at boot with "SESSION_SECRET is missing or too short" (`session.js:11`). **[Verified]** highest-impact doc bug. Pub/Sub vars are also missing from the secrets list.
3. It claims push watch registration exists and `GOOGLE_PUBSUB_TOPIC` enables it; no such code exists (section 6). **[Verified]**
4. Project-structure block omits `middleware/`.
5. Docker instructions omit the `--env-file server/.env` need and the `VITE_BACKEND_URL` build caveat (sections 3-4).
6. `client/README.md` is the untouched Vite template. **[Verified]**

## 12. Prioritized recommendations

### Quick wins
1. README: add `SESSION_SECRET` (min 16 chars, `openssl rand -base64 32`), fix auth section, remove the push-watch claim, document `--env-file server/.env`.
2. deploy.yml: pin `appleboy/ssh-action`, add `script_stop: true`, `workflow_dispatch`, `concurrency`.
3. Write `.env` safely (`envs:` + `printf '%s\n'`); URL-encode or constrain `DB_PASSWORD`.
4. Decide on cookie config: confirm prod domains, then pass `SESSION_SAMESITE`/`COOKIE_DOMAIN` through compose and deploy.yml. Pass Pub/Sub vars too, or remove them from compose until the webhook is finished.
5. Add `/healthz`, a SIGTERM handler (`server.close()` + `prisma.$disconnect()`) and an `unhandledRejection` logger.
6. Compose log rotation; root `.gitignore` (`.env`, `.claude/`, `*.log`); `git rm` the stray JPEG.
7. Resolve the migration strategy: either drop `--accept-data-loss` so destructive changes fail loudly, or do the documented `migrate resolve` and switch CMD to `prisma migrate deploy`; correct whichever doc is wrong. `pg_dump` first.
8. Nightly `pg_dump` to S3 via host cron; test one restore.

### Later
- PR/main CI before build: `npm ci`, client `lint` + `build`, `prisma validate`, `node --check`; gate `deploy` on it; a tiny smoke test on `/healthz`.
- Rollback via `IMAGE_TAG`; GHA build cache.
- Server `dev` script (`node --watch`), `engines`/`.nvmrc`, `prisma` into dependencies with `--omit=dev`.
- Prune client deps, use `npm ci` and `ARG VITE_BACKEND_URL` in the client Dockerfile.
- Production frontend headers (CSP, HSTS) via Amplify; tighten CSP `connect-src` to the API origin; add gzip/caching to nginx.
- Dependabot: add `docker`, group minor/patch.
- helmet, structured logging (pino), Sentry, uptime monitor; `gitleaks` history scan.
- Document (or fold into prod compose with volume + healthcheck) the external `shared-network`, Postgres and TLS proxy. See also [09-scalability-reliability](09-scalability-reliability.md).
