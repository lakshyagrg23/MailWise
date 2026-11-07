# 04 - AI Features and Gmail Actions (summarize, draft, send, read, clear)

Scope: `summarizeEmail.js`, `generateAiEmail.js`, `sendEmail.js`, `getEmailById.js`, `clearUserEmails.js`, `utils/mimeBuilder.js`, `controllers/helpFunctions/extractBody.js`, their routes, and client callers. Server paths are relative to `server/`, client paths to `client/src/`.

Related: [01-architecture](01-architecture.md), [02-auth-security](02-auth-security.md), [03-ingestion-classification](03-ingestion-classification.md), [05-data-layer](05-data-layer.md), [07-frontend](07-frontend.md), [09-scalability-reliability](09-scalability-reliability.md).

Labels: **[Verified]** = confirmed in code. **[Risk]** = plausible, not reproduced / depends on external behaviour. **[Opportunity]** = improvement.

## 1. Route map (actual)

| Method + path | Router line | Handler | Limiter |
|---|---|---|---|
| `POST /email/send-emails` and `POST /emails/send-emails` | `routes/emailActionRoutes.js:10` | `sendEmail` | none |
| `GET /email/summarize/:emailId` (and `/emails/...`) | `emailActionRoutes.js:13` | `summarizeEmail` | `summarizeLimiter` 60/min/user |
| `DELETE /email/` and `DELETE /emails/` | `emailActionRoutes.js:16` | `clearUserEmails` | none |
| `POST /fetch-email/email` | `routes/emailDetailRoutes.js:9` | `generateAiEmail` | `aiDraftLimiter` 20/min/user |
| `GET /fetch-email/:emailId` | `emailDetailRoutes.js:12` | `getEmailById` | none |

All behind `requireAuth` (`server.js:49-53`). Corrections to CLAUDE.md: the delete route is `DELETE /` (user comes from the session), not `DELETE /:userId`; there is no `userId` param anywhere. Client callers use `/email/send-emails` (`components/Compose.jsx:82`), `/email/summarize/:id` (`DisplayEmail.jsx:135`, `ViewEmails.jsx:70`), `/fetch-email/email` (`Auto_email.jsx:29`), `/fetch-email/:id` (`ViewEmails.jsx:49`). Nothing in the client calls the DELETE route (`api/api.url.js` `deleteEmail` is an unused leftover).

### 1.1 Duplicate mounts and the "/email before /:emailId" hazard

- **[Verified] Duplicate mount** `/email` + `/emails` (`server.js:52-53`) serves identical routes. The client uses only `/email`. There is also a naming trap: `/email/*` (actions) vs `/fetch-email/*` (detail), and `/fetch-email/email` is the AI-draft endpoint. The `/emails` alias appears to be legacy; removing it is safe if no external caller exists (none in repo). **[Opportunity]** drop one mount.
- **[Verified] The ordering hazard in CLAUDE.md is currently moot.** `router.post("/email")` and `router.get("/:emailId")` differ by HTTP method, so Express would not confuse them regardless of order. The only live collision is `GET /fetch-email/email`, which falls through to `getEmailById` with id `"email"` and returns 500 from Gmail. The ordering only matters if someone adds a POST `/:something` or turns the draft endpoint into GET. Keep the comment but it is defensive; a cleaner fix is to mount drafts at a distinct path (e.g. `POST /ai/draft`). Low priority.

## 2. Summarize flow and caching (`controllers/emails/summarizeEmail.js`)

Flow:
1. Demo short-circuit returns a canned bulleted summary with `isCached:true` (`:27-33`).
2. `getAuthenticatedClient({userId})` (`:36`) is called **before** the cache check, so even cache hits pay a user lookup and possibly a token refresh. **[Opportunity]** check cache first, create the Gmail client only on a miss.
3. Cache check (`:40-61`): reads `emailsummary`; treated as an AI summary if it contains `•` or `Action Item:` (`:51-52`).
4. On miss: `messages.get(format:'full')` (`:70`, no retry), `extractBody`, `cleanEmailForAI(raw, 3000)` (`:81`). If Gmail throws, falls back to the DB row and uses its **snippet** as the "body" (`:84-95`), which yields a summary of a 140-char snippet with no indication to the user.
5. Gemini `gemini-2.5-flash` plain text (no JSON mode), prompt at `:100-117`, wrapped in `executeWithRetry` (3 retries, `:119-128`).
6. Cache: `updateMany({where:{user_id,email_id}, data:{emailsummary}})` (`:132-140`), failure only warned. **[Verified]** the original snippet is overwritten permanently.

Findings:
- **[Verified] Email not in DB**: the summary is generated, `updateMany` matches 0 rows, and nothing is cached, so every request re-calls Gemini.
- **[Verified] No in-flight de-duplication**: double-clicks or two tabs run two Gemini calls; last write wins. Limiter is 60/min.
- **[Verified] Prompt-injection posture**: email is wrapped in `<email>` tags and labelled as data (`:104-111`), but subject/sender/body are not escaped, so `</email>` can break out. Output is shown as text only (`whiteSpace: pre-line` in a `Typography`, `DisplayEmail.jsx:305`, `ViewEmails.jsx:259`), so XSS is not possible via the summary; the risk is a misleading summary (e.g. "no action needed" in a phishing mail). **[Risk]** moderate for trust, low for security.
- **[Verified] Empty/no body** still triggers Gemini ("No body content.", `:110`); pointless spend. **[Opportunity]** short-circuit.
- **[Verified] Safety-blocked or empty responses**: `response.text()` throws on a block, is not retried (not transient), and returns 500 `"Failed to generate AI summary"` (`:149-152`). An empty string is returned as a 200 with `summary: ""` and is not cached (`if (userId && aiSummary)`), so it repeats.
- **[Verified] Cost**: 3000-char cap (~750 tokens) in, 60-80 words out. Cheap per call; cached after first success only if the marker check will recognize it (next section).

## 3. The snippet-vs-summary convention: every check site

The `emailsummary` column holds either a ~140-char plain snippet (written at ingestion by `generateBodySnippet`, `services/batchClassificationService.js:20-26`) or a Gemini summary. The only discriminator is "contains `•` or `Action Item:`".

All places that evaluate it:

| Location | Purpose |
|---|---|
| `server/controllers/emails/summarizeEmail.js:51-52` | Decide cache hit |
| `client/src/components/DisplayEmail.jsx:105-106` | Initial `summaryText` for a row |
| `client/src/components/DisplayEmail.jsx:129` | Skip refetch when toggling summary |
| `client/src/components/ViewEmails.jsx:38-39` | Initial `summary` in detail view |
| `client/src/components/ViewEmails.jsx:107` | `isRichSummary` flag |

Other consumers of `emailsummary` that do **not** use the marker: the list row preview (`DisplayEmail.jsx:221`, strips tags, shows 90 chars of whatever is stored) and search (`SearchResults.jsx:22`, treats it as body text). Fallback paths: `summarizeEmail.js:93` feeds `emailsummary` to Gemini as a body.

Fragility assessment:
- **[Verified] False positives (snippet mistaken for summary).** `•` is very common in newsletter/marketing mail ("• Free shipping • New arrivals"). The snippet (first 140 cleaned chars) can contain it, so the client shows the raw snippet as the "AI summary" and the server will return it as a cached summary and never call Gemini. `Action Item:` is rarer but plausible in task/project-tool mail. Direct-bucket mail (Promotions/Social) is the most likely to contain bullets.
- **[Verified] False negatives (real summary not recognized).** The prompt asks for `• ` bullets and a conditional `Action Item:` line (`summarizeEmail.js:114-115`), but plain-text generation (no schema) can legitimately return `*`/`-` bullets or prose. Such a summary is cached but fails the marker test on the next read, so the server re-summarizes and re-bills on every open, and the client refetches each time. Impact: wasted Gemini calls and flicker; the limiter (60/min) bounds it.
- **[Verified] Five duplicated literals** of the same check across two codebases; any change must be made in five places, and the server/client could drift.
- **[Verified] The ingestion fallback and a snippet containing the marker collide**: `generateBodySnippet` could be sliced just after a `•`; no escape.
- **[Verified] Not a type**: the column mixes two semantic values; there is no way to tell "summary pending" vs "summary failed" vs "snippet".

**[Opportunity] Preferred fix (small, fits Prisma + `db push`)**: add a nullable `ai_summary String?` column (or `summary_generated_at DateTime?`) and keep `emailsummary` as the snippet. Server cache check becomes `if (existing.ai_summary)`, client gets `ai_summary` in the list payload and uses `email.ai_summary`. This removes all five string checks and also preserves the snippet. Note the deploy runs `prisma db push --accept-data-loss` on start ([08](08-devops-deployment.md)); adding a nullable column is non-destructive. A zero-schema alternative: have Gemini always prefix output with a distinctive sentinel (e.g. `[AI]`) and have the server normalize any output to start with it; still a string convention, but at least unambiguous. Also see [05](05-data-layer.md).

## 4. AI draft generation (`controllers/emails/generateAiEmail.js`)

- Input validation (`:14-27`): `type` must be `formal` or `informal` (default formal), `details` a non-empty string <= 1000 chars. Output is clamped: subject 200, body 5000 (`:83-84`).
- Demo returns a canned draft (`:30-35`).
- Prompt (`:38-63`): description wrapped in `<description>` with a "treat as data" rule; JSON mode (`responseMimeType: application/json`, `:65-68`); 3 retries (`:70-74`); `JSON.parse` after stripping fences (`:76`); shape check gives 502 (`:77-80`).
- **[Verified] Client/server enum mismatch.** `Auto_email.jsx:68-69` offers `executive` and `inquiry`, but the server accepts only `formal|informal` (`:11`). Choosing either gives 400 `"Invalid type"`; the client only `console.error`s (`Auto_email.jsx:34-35`), so the user sees nothing happen. Fix: add the two types to the server set and give each a tone line in the prompt (the prompt only distinguishes "formal" vs else, `:48`), or remove the options.
- **[Verified] No sender context in the prompt**, so drafts commonly end with placeholders such as "[Your Name]" and are then sent as-is by the user. **[Opportunity]** pass the user's display name (available server-side from `getAuthenticatedClient`) and instruct "no placeholders"; no extra Gmail call needed, though this requires loading the user for non-demo.
- **[Verified] Parse failures are not retried**: a malformed JSON (rare under JSON mode) gives 500. A single retry on parse error is cheap.
- **[Risk] Injection** via `details` (`</description>`) only affects the user's own draft. Non-issue.
- **[Verified] The draft body is plain text with `\n`.** It is then sent as `text/html` and loses line breaks (section 5.3). That is the actual user-visible defect of this flow.
- **[Verified]** The endpoint does not need Gmail and works without a Gmail token, but needs a session. `aiDraftLimiter` is 20/min; no daily cap (see shared-key note in [03](03-ingestion-classification.md) section 7).

## 5. Sending (`controllers/emails/sendEmail.js`, `utils/mimeBuilder.js`)

### 5.1 Request handling

- Demo returns success without sending (`sendEmail.js:7-9`).
- **[Verified] The request shape is awkward.** The client posts `{headers:{...}, body: JSON.stringify(hook.data)}` as the JSON body (`Compose.jsx:82-85`): it passes `headers` as a body field (axios sees it as data), and the real payload is a JSON string nested in `body`. The server unwraps three shapes (`sendEmail.js:15-33`) and `mimeBuilder.extractExtra` re-parses the same string again (`mimeBuilder.js:73-86`). It works, but it is fragile: **[Verified]** a body string that parses as JSON `null` (`"null"`) makes `parsed.to` throw a TypeError -> 500 (the `try` only protects `JSON.parse`, `:19-21`). **[Opportunity]** have the client send `{to, cc, bcc, subject, body}` directly and delete the unwrapping code and `extractExtra`.
- **[Verified] No rate limiter on send** (`emailActionRoutes.js:10`). Bounded only by Gmail's own daily limit (consumer ~500/day). A hijacked session (see [02](02-auth-security.md)) could send spam from the user's account. **[Opportunity]** add a `make(10)`-style limiter to the existing `rateLimit.js` (one line).
- **[Verified] No client double-submit guard.** `sendMail` (`Compose.jsx:79-96`) has no `sending` state, so a double click sends two emails.
- **[Verified] Failure is silent on the client**: errors are `console.error` only (`Compose.jsx:91,94`); the dialog stays open with no message. Server error responses are generic (`sendEmail.js:51-52`); validation errors are surfaced as 400 with a message, but the client never displays them.
- No retry on send (correct: `messages.send` is not idempotent).
- `from` is taken from the DB user's email, never from the request (`sendEmail.js:11`, `mimeBuilder.js:115-119`); Gmail would override a spoofed From for the authenticated account anyway.

### 5.2 Header-injection resistance

- **[Verified] Good.** `asString` rejects `\r`, `\n`, `\0` in every header field (`mimeBuilder.js:16,22-27`); applied to `to`, `cc`, `bcc` and `subject`. Recipients must match `ADDR_RE` (ATOM dot-atoms `@` DNS labels, length <= 254, `:19,46-70`) and an optional display name is restricted by `NAMED_RE` (`:20`) and then RFC 2047 encoded (`encodeWords`, `:32-44`). Subjects are always B-encoded, so no raw user text reaches header lines. From is validated. Recipient count capped at 50 total (`:5`, `:98-101`).
- **[Verified] Limitations of validation**: (a) quoted display names with commas (`"Doe, John" <x@y.com>`) are rejected: the list is split on `,` (`:55`) and `NAMED_RE` forbids `"` and `,`. (b) No IDN or non-ASCII local-parts. (c) A display name containing `@`, `:` or `;` is rejected. These produce a 400 and are not security problems; they are usability limits. Users typing `Name <addr>` work.
- `Date` header uses `toUTCString()`: valid RFC 5322 (`GMT`). No `Message-ID` (Gmail adds one).

### 5.3 Body, encoding, size

- **[Verified] Body is always sent as `text/html`** (`mimeBuilder.js:130`), base64 with CRLF at 76 cols (`wrap76`, `:88`, `:134`), `charset="UTF-8"`. Because the compose box is a plain multiline text field (`Compose.jsx:140-155`) and AI drafts contain `\n`, **newlines collapse**: the recipient sees a single paragraph. Also `<`/`&` typed by the user are interpreted as HTML (`a < b` can swallow text; a pasted `<script>` is stripped by Gmail but still garbles). This is the most user-visible bug in the send path. **[Opportunity] fix**: either send `text/plain; charset=UTF-8`, or HTML-escape and convert `\n` to `<br>` (the client already has `escapeHtml` in `utils/formatEmailBody.js`; server needs its own few lines). Best: `multipart/alternative` with plain + html, which also improves spam scoring; this is about 15 lines.
- **[Verified] Size limit unreachable.** `MAX_BODY_BYTES = 1 MiB` (`mimeBuilder.js:5`, check at `:108-112`), but `server.js:42` uses `express.json()` with the default **100 kb** limit. Larger bodies are rejected by body-parser (413) and `server.js:56-59` turns every error into `500 "Internal Server Error"`, so the user gets a 500 instead of a clear 413/400. Align the two: set `express.json({limit:'1mb'})` only on the send route, or lower `MAX_BODY_BYTES`; and make the error handler honor `err.status`.
- **[Verified] No attachments are supported**: no multipart/mixed, no upload route, no client UI. Therefore no attachment size/filename handling exists (no injection surface either). Gmail's 25 MB / 35 MB raw limits are irrelevant today.
- **[Verified] No reply threading**: no `In-Reply-To`, `References` or `threadId` (compose only creates new mail; no reply UI in the code read).
- CRLF handling elsewhere: header folding for long recipient lists and encoded words uses `',\r\n '` and `'\r\n '` joins (`:131-132`, `:44`); folded lines remain valid. Subject length check counts characters pre-encoding (`:104-106`) while Gmail folds the encoded form, so very long subjects remain valid.
- Base64url output without padding (`:135-139`) is accepted by Gmail.

## 6. Reading one email (`controllers/emails/getEmailById.js`)

- Demo returns a canned HTML body (`:11-24`).
- `messages.get({userId:'me', id})` with default format (full), **no retry**, no `fields` filtering (`:28`). Any Gmail error (including 404 not found or an invalid id) returns 500 `"Failed to fetch email"` (`:89-93`); the `if (!msg.data)` 404 branch (`:30-32`) is effectively unreachable.
- **[Verified] Header lookup is case-sensitive** (`h.name === "Subject"`, `:35-36`) whereas ingestion lowercases (`gmailFetchService.js:101`). Gmail normally returns canonical case, so it works, but the inconsistency would yield "No Subject" for odd headers. Fix: shared `getHeader(headers,name)`.
- **[Verified] Attachments are fetched eagerly and serially** for every top-level part with a filename and `attachmentId` (`:42-75`), base64-encoded into the JSON response. Opening an email with several large attachments downloads them all from Gmail into server memory and then to the browser (up to ~25 MB each, ~33% base64 overhead) before the body is shown. **[Opportunity]** return only metadata (`filename, mimeType, size, attachmentId`) and add `GET /fetch-email/:id/attachment/:attachId` that streams one on click. Also **[Verified]** only `payload.parts` at the top level are scanned; attachments inside nested multiparts (`multipart/mixed > multipart/related`) are missed, while `findAttachmentName` (ingestion) recurses, so the list may show a paperclip name that the detail view cannot fetch.
- `attachmentResponse.data.data` converts base64url -> base64 (`:61-63`); inline images (Content-ID) are not mapped into the HTML.
- **[Verified]** `receivedAt = new Date(parseInt(internalDate)).toISOString()` (`:38`) throws RangeError if `internalDate` is missing -> 500. Ingestion guards this (`gmailFetchService.js:109-111`).
- Response contains redundant `_id` and `userId` both set to `emailId` (`:16-18`, `:81-85`): legacy MongoDB-era fields; client uses `email_id`.
- **Authorization**: Gmail's API is scoped to the user's own mailbox, so passing another user's message id simply 404s -> 500. No ownership issue here (identity is the session, see [02](02-auth-security.md)).
- Rendering safety is on the client: `Emailbody.jsx` uses DOMPurify via `utils/formatEmailBody.js`, blocks remote images, strips scripts/styles/forms (`formatEmailBody.js:23-61`), then `dangerouslySetInnerHTML` (`Emailbody.jsx:144`). Sound approach; details in [07](07-frontend.md).

## 7. Body extraction (`controllers/helpFunctions/extractBody.js`)

- Algorithm: depth-first for the first `text/plain` part with `body.data` (`:22-33`), else first `text/html` (`:39-50`), else the top-level `body.data` (`:56`). Decoding: replace `-`/`_` and `Buffer.from(...,'base64').toString('utf-8')` (`:11-19`).
- **[Verified] base64url handled** (Node also accepts url-safe input natively; the replace is redundant but harmless; padding is not required by Node).
- **[Verified] Charset ignored.** Always UTF-8. Gmail's `body.data` is the raw bytes after transfer-decoding, so `ISO-8859-1`, `windows-1252`, `GBK`, `Shift_JIS` etc. produce mojibake in the reader and in classification/summary input. Part headers (`Content-Type; charset=`) are available in `part.headers`. **[Opportunity]** use `TextDecoder(charset)` (Node has full ICU) with a UTF-8 fallback; ~8 lines.
- **[Verified] Plain wins over HTML even when plain is a stub** ("Please view in an HTML-capable client") or a poor rendering, and only the **first** text part is taken, so multi-part bodies (body + forwarded text) lose content. For display, many clients prefer HTML; for classification, plain is cheaper and usually fine. A whitespace-only plain part is truthy and wins over a full HTML part (`:28`, `:36`): `if (plainBody)` is true for `"\n"`. **[Opportunity]** `plainBody?.trim()`.
- **[Verified] `message/rfc822` attachments and text/plain attachments** with inline data can be selected as "the body" because the search recurses into all parts without checking `Content-Disposition`/`filename`.
- **[Verified] The single-part fallback does not check mime type**, so a lone `image/*` body would be decoded as UTF-8 text.
- Empty `""` is returned for no body; callers handle that.

## 8. Destructive delete (`controllers/emails/clearUserEmails.js`)

- `DELETE /email` (and `/emails`) runs `emailMetadata.deleteMany({where:{user_id: req.user.id}})` (`:10`): scoped to the session user, demo user is skipped (`:4-6`). Gmail mail itself is untouched (only metadata is stored).
- **[Verified] No confirmation, no limiter, no client caller.** An authenticated request (or a session hijack) wipes all classifications **and cached AI summaries**. Recovery re-ingests only the newest 20 messages (window, [03](03-ingestion-classification.md) section 3), so older mail disappears from the app permanently. CSRF exposure is reduced by `SameSite=lax` default cookies (`utils/session.js:32`) plus CORS allow-list; if `SESSION_SAMESITE=none` is used for cross-site Amplify/EC2 hosting, `DELETE` with credentials depends on CORS only ([02](02-auth-security.md)).
- **[Opportunity]** If the feature is unused, delete the route and controller. If kept, require a confirmation token/body (`{confirm:true}`) and add a limiter. Also, `deletedRows` returned is correct (`:13`).

## 9. Demo handling summary

All five controllers short-circuit on `req.user.isDemo` before touching Gmail/Gemini (`summarizeEmail.js:27`, `generateAiEmail.js:30`, `sendEmail.js:7`, `getEmailById.js:11`, `clearUserEmails.js:4`). Notes: demo `getEmailById` returns the same HTML for every id (acceptable); demo summarize returns a canned summary regardless of the email, and for demo rows `emailsummary` plain text lacks markers, so the client calls the endpoint (works). No issues beyond the generic ones above.

## 10. Error handling overview

- Controllers return generic 500s and log details (consistent with the "never leak err.message" stance in `server.js:55-59`). Validation errors in send/draft correctly use 400.
- Missing: mapping Gmail 401/403/404/429 to meaningful statuses (all become 500), so the client cannot show "reconnect Google" or "try again later" ([02](02-auth-security.md), [09](09-scalability-reliability.md)).
- No timeouts on Gemini or Gmail calls; no retry on Gmail `messages.get` in summarize/getEmailById/send (send correctly un-retried).
- The client swallows nearly all failures into `console.error` (`Compose.jsx`, `Auto_email.jsx`, `DisplayEmail.jsx:140`, `ViewEmails.jsx:74`), which hides every server-side defect above.

## 11. Prioritized recommendations

1. **Fix outgoing line breaks** (5.3): send `text/plain` (or escape + `<br>`, ideally `multipart/alternative`). Real user-visible bug affecting every composed and AI-drafted mail.
2. **Replace the marker convention with a real field** (3): add nullable `ai_summary`; remove the five `includes('•')` checks. Eliminates false positives (bullet newsletters) and repeat Gemini spend on summaries without bullets.
3. **Align tone options** (4): add `executive`/`inquiry` to `TYPES` and the prompt, or remove them from `Auto_email.jsx:68-69`; surface errors to the user.
4. **Send path hardening**: rate-limit `send-emails`, add a `sending` flag in `Compose.jsx`, show failures; align `express.json` limit with `MAX_BODY_BYTES` and let the error handler pass through 4xx (5.1, 5.3).
5. **Lazy attachments** (6): metadata only plus a streaming download endpoint; also recurse nested parts.
6. **Cache-first summarize** (2): check DB before `getAuthenticatedClient`; skip Gemini for empty bodies; optionally an in-flight `Map` to avoid duplicate calls.
7. **extractBody charset + whitespace-only fix** (7): `TextDecoder` with the part charset; treat whitespace-only plain as empty; prefer HTML when plain is a stub.
8. **Decide on DELETE /email**: remove it or require confirmation and a limiter (8).
9. Simplify request shape (client sends flat JSON; delete `extractExtra` and unwrapping), drop the `/emails` duplicate mount, and pass the user's name into the draft prompt (1.1, 4, 5.1).
10. Add timeouts and Gmail-error status mapping (404/401/429) in these controllers; low effort, improves UX and debuggability.
