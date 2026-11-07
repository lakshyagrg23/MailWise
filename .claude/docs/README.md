# MailWise - Technical Knowledge Base (index)

Evidence-based analysis of the repo, produced by reading the code (not generic advice). Each finding is labelled **[Verified]** (seen in code), **[Risk]** (plausible, not proven) or **[Opportunity]**. Application code was not modified.

> The original `CLAUDE.md` and `README.md` were substantially stale (token-in-URL auth, `localStorage`, 30 emails, an existing `gmailWatchService`). The drift is catalogued in [01, section 10](01-architecture.md) and the root `CLAUDE.md` has been rewritten to match the code.

## Documents

| # | File | Covers |
|---|---|---|
| 01 | [Architecture](01-architecture.md) | Component map, request lifecycle, flows, 16-endpoint contract, conventions, doc drift table |
| 02 | [Auth & security](02-auth-security.md) | OAuth, cookie session, demo mode, ownership matrix, CORS/CSRF, rate limits, XSS, token storage, 17 ranked findings |
| 03 | [Ingestion & classification](03-ingestion-classification.md) | Gmail fetch, dedupe, Gemini batching/prompt, fallback persistence, retry/pool helpers |
| 04 | [AI features & Gmail actions](04-ai-and-gmail-actions.md) | Summaries, drafts, send/MIME, body extraction, the `•` convention, route ordering |
| 05 | [Data layer](05-data-layer.md) | Schema, migrations, queries/indexes, stale categories, transactions, demo reset |
| 06 | [Gmail push / webhook](06-gmail-push-webhook.md) | What exists vs. missing, webhook auth, a right-sized completion design, and whether push is worth it |
| 07 | [Frontend](07-frontend.md) | `emailContext`, data layer, components, deps audit, XSS sanitizer, lint, UX bugs |
| 08 | [DevOps & deployment](08-devops-deployment.md) | CI/CD, Docker, nginx, env-var inventory, ops gaps, dependency hygiene |
| 09 | [Scalability & reliability](09-scalability-reliability.md) | What breaks first, queue/cache/replica verdicts, ordered work list |

## Consolidated top findings (cross-checked across documents)

Items I re-verified directly in the code are marked (✔).

### Fix first (correctness / data-loss / production-breaking)
1. **Production start command can drop data** (✔): `server/Dockerfile:27` runs `prisma db push --accept-data-loss`, contradicting `server/prisma/migrations/README.md`. Docs [05](05-data-layer.md), [08](08-devops-deployment.md), [09](09-scalability-reliability.md).
2. **Production env gaps** (✔): `deploy.yml` writes `SESSION_SECRET` but not `SESSION_SAMESITE`, `COOKIE_DOMAIN` or the `PUBSUB_*` vars. The result is uncontrolled cross-site cookies (Amplify vs EC2) and a webhook that always 401s. Docs [02](02-auth-security.md), [06](06-gmail-push-webhook.md), [08](08-devops-deployment.md).
3. **Possible process crash**: the demo branch of `getEmailsByCategory.js` does DB work outside try/catch. Docs [01](01-architecture.md), [02](02-auth-security.md).
4. **Gemini failures persisted forever** with the default category and no retry marker. Doc [03](03-ingestion-classification.md).
5. **Category rename/delete leaves `email_metadata.category` stale**, and neither operation uses a transaction. Docs [03](03-ingestion-classification.md), [05](05-data-layer.md).
6. **Outgoing mail always `text/html`**: plain-text compose and AI drafts lose line breaks. Draft tones `executive`/`inquiry` are rejected by the server. Doc [04](04-ai-and-gmail-actions.md).
7. **Frontend**: the category list ignores the URL param (deep links and reload break), the trash button doesn't call the API, `<Route Error=…>` is a wrong prop so the error page never mounts, and Tailwind works only through a runtime CDN script. Doc [07](07-frontend.md).

### Security (no IDOR or raw SQL found; sanitizer is strong)
- Google access/refresh tokens are stored **plaintext** in `users`. High. Doc [02](02-auth-security.md).
- No session revocation (7-day HMAC cookie, logout only clears the cookie). Medium.
- Shared demo user wiped by any visitor via a public state-changing `GET /auth/demo`. Docs [02](02-auth-security.md), [05](05-data-layer.md).
- `send-emails` and `fetch-email/:id` are unrate-limited; attachments are inlined with no size cap. Docs [02](02-auth-security.md), [04](04-ai-and-gmail-actions.md).

### Maintainability
- The `•` / `Action Item:` snippet-vs-summary heuristic is duplicated in ~5 places; a nullable `ai_summary` column would remove it and stop re-billing Gemini. Doc [04](04-ai-and-gmail-actions.md).
- ~14 unused client deps, dead files (`api.url.js`, `routes/route.js`, `SideBar.content.js`, `fetchUserData.js`), and 5 of 17 context values unused. ESLint reports 8 errors and 6 warnings. No tests anywhere, no CI. Docs [07](07-frontend.md), [08](08-devops-deployment.md).
- Gemini is configured in three places with a hard-coded model; a service imports from `controllers/`. Doc [01](01-architecture.md).
- Gmail push is inert (no watch service, no schema columns, no client channel). Decide: finish it deliberately or delete the surface. Doc [06](06-gmail-push-webhook.md).

### Scalability stance
The single-instance shape is appropriate. Queues, Redis and replicas are **not** recommended now. See [09](09-scalability-reliability.md).

## Suggested sequencing
1. Production safety: items 1-3 above, `/healthz`, CI gate ([08](08-devops-deployment.md), [09](09-scalability-reliability.md)).
2. Data correctness: failed-batch handling, category cascade in a transaction, `ai_summary` column, index + `take` ([03](03-ingestion-classification.md), [05](05-data-layer.md)).
3. UX bugs and quick frontend wins ([07](07-frontend.md)).
4. Security hardening: token encryption, session versioning, remaining rate limits ([02](02-auth-security.md)).
5. Cleanup: dependencies, dead code, Gemini config consolidation, tests for the sanitizer, MIME builder and classifier parsing.

## Caveats
- Nothing was executed against a live DB, Gmail, or Gemini; two **[Risk]** items in [03](03-ingestion-classification.md) (#7 surrogate truncation, #8 `includeSpamTrash` default) are unconfirmed.
- Compose/nginx line citations in [08](08-devops-deployment.md) came from concatenated output; spot-check them.
- `npm audit` was not run. Real production domains aren't in the repo, so the cross-site cookie finding stays a **[Risk]** until the deployed domains are checked.
- The `webhook` branch was not diffed in depth beyond confirming the watch service is missing there too.
