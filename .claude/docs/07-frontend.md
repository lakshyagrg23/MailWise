> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 07 - Frontend (client/)

Scope: everything under `client/src` (about 3,560 lines, 31 files), plus `client/package.json`, `vite.config.js`, `eslint.config.js`, `index.html`, `nginx.conf`.
All paths below are relative to `client/` unless stated. Labels: **[Verified]** = confirmed in code (or by running a read-only command), **[Risk]** = likely to bite, **[Opportunity]** = improvement.

Related docs: [01-architecture.md](01-architecture.md), [02-auth-security.md](02-auth-security.md), [03-ingestion-classification.md](03-ingestion-classification.md), [04-ai-and-gmail-actions.md](04-ai-and-gmail-actions.md), [05-data-layer.md](05-data-layer.md), [06-gmail-push-webhook.md](06-gmail-push-webhook.md), [08-devops-deployment.md](08-devops-deployment.md), [09-scalability-reliability.md](09-scalability-reliability.md).

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 1. Summary

A small React 19 SPA (Vite 6, react-router 7.6, MUI 7, a little Tailwind 4) with one 17-field context in `App.jsx`, no tests, and a lot of repeated inline-styled MUI. Functionally it is clean enough. The main problems are:

- A broken or accidental Tailwind setup (runtime CDN script plus an unprocessed `@import`).
- Unused heavy dependencies in `package.json` (three, react-three, syncfusion, react-scripts, websocket, and others).
- Several UI actions that only look like they work (delete email, route-driven category).
- Silent error handling (everything is `console.error`).
- An email sanitizer that is actually good (`utils/formatEmailBody.js`) but has no tests.

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 2. Drift from the root CLAUDE.md (auth and API calls)

The root `CLAUDE.md` says the client stores `mailwise_token` / `mailwise_user_id` in `localStorage` and sends `?access_token=` plus `user_id` on every call. **That is stale.**

- **[Verified]** `grep` for `localStorage|mailwise_token` in `src/` returns nothing.
- **[Verified]** `src/api/http.js:3-5`: a single axios instance with `baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'` and `withCredentials: true`. No token, no query param, no Authorization header. Auth is an HttpOnly cookie set by the server (see [02-auth-security.md](02-auth-security.md)).
- **[Verified]** Session bootstrap is `GET /auth/me` on mount (`src/App.jsx:75-95`). 200 means authenticated. Otherwise `GmailOAuthApp` (login screen) is rendered.
- **[Verified]** Login: `GET /auth/url` then `window.location.href = authUrl` (`src/GmailOAuthApp.jsx:9-19`). Demo: a full-page navigation to `${baseURL}/auth/demo` (`GmailOAuthApp.jsx:112`).
- **[Verified]** Logout: `POST /auth/logout` then `resetSession()` (`src/components/Optionsmenu.jsx:20-27`).
- **[Verified]** Global 401 handling: a response interceptor calls a registered handler (`resetSession`) on any 401 whose URL does not contain `/auth/` (`src/api/http.js:14-23`, registered in `App.jsx:70-73`).
- **[Verified]** The demo token `"demo"` no longer exists client-side. The server marks the session as demo (`req.user.isDemo`, `server/controllers/emails/getEmailsByCategory.js:14`). The client treats a demo user like any other.
- Other claims in the root file that are still accurate: `routes/route.js` and `api/api.url.js` are leftovers (section 5.2, 9), and the unused deps (section 9).

No CSRF token is sent. Cookie-session plus `withCredentials` means CSRF protection depends on the server's SameSite/CORS settings. See [02-auth-security.md](02-auth-security.md).

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 3. Bootstrap, routing, layout

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 3.1 Boot sequence

1. `src/main.jsx:6-10`: `StrictMode` then `<App/>`. `index.css` imports Tailwind.
2. `App.jsx` renders inside `<Suspense fallback={<SuspenseLoader/>}>` and the context provider. Three states (`App.jsx:127-133`):
   - `checkingSession` true: `SuspenseLoader`.
   - not authenticated: `<GmailOAuthApp setAuthenticated=.../>`.
   - authenticated: `<RouterProvider router={router}/>`.
3. After `authenticated` flips true, an effect calls `fetchEmailData(category)`, which calls `GET /fetch-emails/All`. This is the ingestion endpoint ([03-ingestion-classification.md](03-ingestion-classification.md)), so first paint of the inbox waits on Gmail list, fetch and Gemini classification.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 3.2 GmailOAuthApp.jsx

- **[Verified]** It is used. It is the unauthenticated screen (`App.jsx:4,130`), not dead code. It is a 206-line marketing/login page (framer-motion + lucide-react + Tailwind classes).
- **[Verified]** It receives the `setAuthenticated` prop but never uses it (the OAuth flow leaves the SPA by full redirect). Harmless dead prop.
- **[Verified]** Login failure (`/auth/url` rejected) only `console.error`s and re-enables the button (lines 15-17). The user sees nothing.
- Name drift: the file is `GmailOAuthApp`, the component is `MailWiseLogin`. Rename to `Login.jsx`.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 3.3 Router

- **[Verified]** `createBrowserRouter` is built at module level (`App.jsx:22-33`), with `createRoutesFromElements`:
  ```
  /            -> Main (lazy)         [layout: Header + SideBar + <Outlet/>]
    index      -> Navigate /emails/inbox (replace)
    emails/:type -> Email (lazy)
    view         -> ViewEmails (lazy)
  *            -> Navigate /emails/inbox
  ```
- **[Verified]** `DEFAULT_ROUTE = "/emails/inbox"` (`App.jsx:19`) does not correspond to any category. Real categories come from the DB (default seed names such as Essential, Finance, and so on, plus "All"). The `:type` param `inbox` is never read (see 3.4), so it works by accident. `Error.jsx:50` navigates to `/emails/All` instead. Pick one default (`/emails/All`).
- **[Verified]** `<Route ... Error={<Error />} />` (`App.jsx:27-28`). `Error` is not a react-router route property. In 7.6 the typings only declare `errorElement` / `ErrorBoundary` (`node_modules/react-router/dist/development/index.d.ts:159`). Net effect: **route-level errors are never caught by the custom error page** and fall to react-router's default error screen. The `Error` component also shadows the global `Error` in `App.jsx`. **[Risk]**
- **[Verified]** The router only exists inside the authenticated branch, so `/` and every deep link are shown only after `/auth/me` returns. Fine for this app. There is no route-level auth guard.
- `ViewEmails` relies on `location.state.email` (`ViewEmails.jsx:27-28`). A page reload on `/view` loses the state and shows "No email selected." There is no `/view/:emailId` route. **[Verified]**, and a UX limitation (no shareable or reloadable email URL).

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 3.4 URL versus context for the active category (a real bug)

- **[Verified]** The sidebar link `NavLink to=/emails/${name}` also calls `setCategory(name)` in `onClick` (`SideBarContent.jsx:145-148`).
- **[Verified]** `Email.jsx` never calls `useParams`. It filters by the context `category` (`Email.jsx:32-40`).
- Consequences **[Verified by reading]**: loading `/emails/Finance` directly, using the browser back/forward buttons, or reloading shows the right URL but the wrong list (context `category` resets to "All" on reload). Sidebar highlighting uses `useParams().type` (`SideBarContent.jsx:141`), so highlight and list disagree.
- Fix: derive the category from `useParams()` inside `Email.jsx` and delete `category` / `setCategory` from the context. See section 10.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 3.5 Layout (pages/Main.jsx)

- `Main` owns `openDrawer` (local `useState`) and passes it to `SideBar` and via `<Outlet context={{openDrawer}}/>`. Both consumers (`Email.jsx:24`, `ViewEmails.jsx:29`) destructure it and never use it (lint errors). **[Verified]**
- The layout is `100vh/100vw`, fixed `HEADER_HEIGHT = 64`, sidebar width 270 duplicated in `Main.jsx:9` and `SideBar.jsx:5` and hard-coded `64px` in `SideBar.jsx:20-21`. **[Opportunity]** Share constants.
- The sidebar is `variant="persistent"`, and the content has `marginLeft: 270px` when open. There is **no responsive behaviour**: on a phone the sidebar occupies 270px of the viewport and the row layout (220px sender + 200px actions) overflows. **[Verified by reading]** Not mobile-ready.
- `SideBar.jsx:7` accepts `setSelectedCategory`, which `Main` never passes, and `SideBarContent` ignores it. Dead prop. **[Verified]**

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 4. The emailContext (App.jsx:14, 35-54, 117-126)

A single `createContext()` (no default value, so a consumer outside the provider destructures `undefined` and crashes) with a fresh object literal as `value` on every `App` render. Every `useContext(emailContext)` consumer re-renders whenever any `App` state changes, because the `value` identity changes each render and nothing is memoized. **[Verified]**

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 4.1 Every state value, who reads and writes it

| State (setter) | Written by | Read by | Notes |
|---|---|---|---|
| `emails` (`setEmails`) | `App.fetchEmailData`; `ViewEmails.deleteEmail` (`:83`); `resetSession` | `Email`, `Header`->`SearchResults`, `SideBarContent` (counts) | Core data. Initial fetch is the only fetch (see 6.2). |
| `category` (`setCategory`) | `SideBarContent:148`; `resetSession` | `Email`, `Optionsmenu`? (no), `App` effect | Duplicates URL param (3.4). |
| `loaded` (`setLoaded`) | `App.fetchEmailData`; `resetSession` | `Email:212` (spinner) | Never set back to false on a re-fetch. No error state. |
| `selectedUser` (`setSelectedUser`) | `App` `/auth/me`; `resetSession` | `SideBarContent:61` (gate for `/categories` fetch), `App` effect deps | Only used as a "has session" flag. |
| `name`, `email`, `picture` | `App` (`/auth/me`, `fetchEmailData`) | `Optionsmenu` | `email`/`picture` set from two sources (`/auth/me` and the ingestion response). `setName/setEmail/setPicture` are exposed but not called outside `App`. |
| `selectedEmails` (`setSelectedEmails`) | `resetSession` only | **nobody** | Dead. Leftover from multi-select. |
| `categories` (`setCategories`) | `SideBarContent` effect (`:49-62`), `NewCategory` | `SideBarContent`, `Header` (scope selector), `NewCategory` | Always seeded with a synthetic "All". |
| `data` (`setData`) | `Compose` (form fields), `Auto_email` | `Compose` | Compose form state held globally. |
| `openAi` (`setOpenAi`) | `Compose`, `Auto_email` | `Compose` | Modal flag held globally. |
| `messageSent` (`setmessageSent`) | `Compose:87` | `Email:61-93` (banner + 4s timer) | Note camelCase inconsistency (`setmessageSent`). |
| `update` (`setUpdate`) | `NewCategory` | `NewCategory` | A counter the client increments and sends to the server as `update` (`NewCategory.jsx:46,70,94`). Its server meaning is the BigInt `update` column (see [05-data-layer.md](05-data-layer.md)). Client sends `parseInt(update)+1`, and `setUpdate` increments again, so the value is client-authoritative. Plain `useState` race-prone. |
| `date` (`setDate`) | **nobody** | **nobody** | Dead (`new Date()` in state). |
| `newMailsLoaded`, `mailsReceived` | **nobody** | **nobody** | Dead. |
| `message` (`setMessage`) | **nobody** | **nobody** | Dead. |
| `authenticated` (`setAuthenticated`) | `App`; passed to `GmailOAuthApp` (unused) | `App` | `setAuthenticated` also exposed on context, nobody calls it. |
| `checkingSession` | `App` | `App` | Not in context. |
| `fetchEmailData` | defined in `App` | exposed, **nobody consumes** | Re-fetch is not wired anywhere (Refresh reloads the page). |
| `resetSession` | defined in `App` | `Optionsmenu` (logout) and 401 handler | OK. |

**[Verified]** Dead values: `selectedEmails`, `date`, `newMailsLoaded`, `mailsReceived`, `message` (5 of 17 are never read or written by any component). `fetchEmailData`, `setAuthenticated`, `setName`, `setEmail`, `setPicture`, `setSelectedUser`, `setLoaded` are exposed but unused outside `App`. Grep for each name across `src/components` and `src/pages` confirms this.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 4.2 Re-render implications (small app, so keep this proportionate)

- With about 16 `useContext` consumers and lists capped by the server's 30-email ingestion window plus stored history, a context-wide re-render is **not currently a measurable problem**. The costly consumers are `Email` (paginated to at most 50 rows) and `SideBarContent` (counts computed by 1 filter per category per render, `SideBarContent.jsx:32-38`).
- But: typing in Compose calls `setData` which updates `App` state, re-renders `App`, a new `value` object, and every consumer, including the email list on each keystroke. **[Verified by reading]**, **[Risk]** (likely sluggish typing once the list is large; each row has MUI `styled`, Tooltips, framer-motion).
- `App` itself holds the router-level `RouterProvider`. `router` is module-level, so `App` re-renders do not recreate it. Good (`App.jsx:21`).

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 4.3 Coupling

- Components import the context from `../App` (`App.jsx` exports a component and a context, which is why eslint warns `react-refresh/only-export-components` at `App.jsx:14`). Circular-ish import: `App` lazy-imports `Email`, `Email` imports `{emailContext}` from `App`. Works because of lazy loading, but fragile. **[Verified]**
- Server-state (emails, categories, user) and UI-state (modal open, compose form, success banner) are mixed in one object.

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 5. Data-fetching layer

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 5.1 api/http.js and api/api.js

- **[Verified]** `http.js` is the only axios instance; every component imports it directly except `fetchEmails` (`api/api.js`, 19 lines, used only by `App.jsx:5,106`).
- **[Verified]** `api.js:13-16` swallows every error and returns `{emails: []}`. The UI then shows "no mails" (the `NoMails` empty state) for a network failure, a 500, or an ingestion timeout. `loaded` is set to true regardless (`App.jsx:112`). A user cannot distinguish "empty inbox" from "backend down". **[Risk]**
- **[Verified]** No `timeout` on the axios instance. `/fetch-emails/:category` performs Gmail and Gemini work server-side (see [03](03-ingestion-classification.md)), so the first load can legitimately take many seconds and there is no cancel or retry UI. **[Risk]**
- **[Verified]** No request cancellation (`AbortController`) anywhere. `ViewEmails` and `App` do guard with a `cancelled` flag in `App` only (`App.jsx:77,89`); `ViewEmails` does not guard, so quick navigation can `setState` after unmount (React 18+ no longer warns, but stale responses can write the wrong email). **[Verified]**
- All endpoints used by the client (cross-check against server routes in [01](01-architecture.md)):

| Call | File:line | Purpose |
|---|---|---|
| `GET /auth/me` | `App.jsx:78` | Session bootstrap |
| `GET /auth/url`, `GET /auth/demo` (navigation), `POST /auth/logout` | `GmailOAuthApp.jsx:12,112`, `Optionsmenu.jsx:22` | Login/logout |
| `GET /fetch-emails/:category` | `api/api.js:5` | List + ingest |
| `GET /fetch-email/:id` | `ViewEmails.jsx:49` | Live body + attachments |
| `GET /email/summarize/:id` | `DisplayEmail.jsx:135`, `ViewEmails.jsx:70` | On-demand summary |
| `POST /fetch-email/email` | `Auto_email.jsx:30` | AI draft |
| `POST /email/send-emails` | `Compose.jsx:82` | Send |
| `GET/POST/PUT/DELETE /categories[/:name]` | `SideBarContent.jsx:52`, `NewCategory.jsx:43,67,93` | Category CRUD |

- **[Verified] No server delete/trash call exists in the client.** `ViewEmails.deleteEmail` (`ViewEmails.jsx:81-85`) only filters the in-memory `emails` array and navigates back. The email is not deleted in Gmail nor in the DB, and it reappears on the next reload. The trash icon is misleading. **[Risk]** (user-visible lie).
- **[Verified]** `Compose.sendMail` posts `{ headers: {...}, body: JSON.stringify(hook.data) }` as the JSON payload (`Compose.jsx:82-85`). It looks like a fetch-options object pasted into axios. The server explicitly contains a compatibility branch for this "legacy frontend Compose.jsx" shape (`server/controllers/emails/sendEmail.js:15-30`, route in `server/routes/emailActionRoutes.js:10`). Simplify to `http.post('/email/send-emails', hook.data)` and remove the server shim afterwards. **[Opportunity]** See [04-ai-and-gmail-actions.md](04-ai-and-gmail-actions.md).
- **[Verified]** Send failure is only `console.error`ed (`Compose.jsx:90-95`). The dialog stays open with no message and no pending state (no double-click guard on Send). **[Risk]**
- Error-handling pattern throughout: `try { await http... } catch (e) { console.error(...) }`, in 10 places. There is no toast, no inline error, no retry, and `react-hot-toast` is installed but never imported (section 9). **[Verified]**

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 5.2 api/api.url.js and routes/route.js

- **[Verified]** `api/api.url.js` (26 lines, `API_URLS`: save, bin, starred, delete...) has no importer (`grep API_URLS` finds only its own definition). Dead, and it describes endpoints that do not exist.
- **[Verified]** `routes/route.js` is imported only for its `.path` strings (`DisplayEmail.jsx:8`, `SearchResults.jsx:4`, `SideBarContent.jsx:17`). It also eagerly defines three `lazy()` components that nothing uses (`element:` values), and `routes.email.path = '/emails'` while `routes.invalid`/`main` are unused. Replace with two string constants or just literals. Note `lazy()` at import time is harmless but misleading.

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 6. Component inventory (size, responsibility, smells)

Line counts from `wc -l`.

| File | Lines | Responsibility | Main smells |
|---|---|---|---|
| `App.jsx` | 139 | Auth bootstrap, context, router | God context (4.1); a blanket `/* eslint-disable no-unused-vars */` (line 1) that eslint itself reports as unused; `Error` import shadows global; effect deps incomplete (`App.jsx:97-101`). |
| `GmailOAuthApp.jsx` | 206 | Login/landing page | Unused `setAuthenticated` prop; silent failure; marketing copy mixed with logic. |
| `pages/Main.jsx` | 72 | Shell layout | Unused-by-consumers outlet context; magic numbers. |
| `components/Header.jsx` | 201 | App bar, search input, scope select, refresh | Owns search UI state; `Refresh` = `window.location.reload()`; `OptionsMenu` is rendered here but uses `position: fixed` (see below). |
| `components/Optionsmenu.jsx` | 167 | Help popover + profile/logout popover | Clickable `div`s (no keyboard/ARIA); Tailwind and MUI and framer mixed in one file; unused `motion` lint is a false positive (it is used as `<motion.div>`). |
| `components/SearchResults.jsx` | 153 | Search dropdown | Client-side filter inside render (see 8). |
| `components/SideBar.jsx` | 38 | MUI Drawer wrapper | Dead prop `setSelectedCategory`. |
| `components/SideBarContent.jsx` | 366 | Compose button, category list + counts, system buckets, "Customize" dialog host, categories fetch | Does 5 jobs. Fetches `/categories` in an effect with `categoryHook` missing from deps. Long repeated `sx`. Imports unused `motion`. |
| `components/NewCategory.jsx` | 328 | Category CRUD UI | Local `loading`, no error display; `window.confirm` for delete; ~100-line JSX with repeated styles. |
| `components/Compose.jsx` | 223 | Compose dialog + AI draft dialog host | Form state in global context; no validation, no "To" format check, no close-on-backdrop; errors swallowed. Local `Header` styled component name collides conceptually with `Header.jsx`. |
| `components/Auto_email.jsx` | 115 | AI draft form | File name violates the PascalCase convention (`Auto_email`); catches errors silently. |
| `components/Email.jsx` | 282 | List page: filter, sort, client pagination, banner | ~160 of 282 lines are toolbar markup. Imports unused `motion`, `openDrawer`. |
| `components/DisplayEmail.jsx` | 315 | One list row + inline summary drawer | 4 styled components + `sx` + formatters inline; makes its own summary request. Not `React.memo`. |
| `components/ViewEmails.jsx` | 327 | Email detail: fetch body, summary, attachments, "delete" | Largest and most tangled. Duplicates sender parsing and summary check. Unused `setEmail`, `isRichSummary`, `openDrawer` (3 lint errors). |
| `components/Emailbody.jsx` | 150 | Renders sanitized HTML | Good (see 7). Resets `allowImages` in an effect keyed on `email?.id`, which is undefined for this data shape (emails use `email_id`), so it effectively keys on `body` only. |
| `components/error/Error.jsx`, `NoMails.jsx`, `SuspenseLoader.jsx` | 65, 91, 26 | Fallback UIs | `Error.jsx` is never actually mounted (3.3). `NoMails` "Refresh Inbox" reloads the whole page. |
| `components/Refresh.jsx` | 2 | `export const Refresh = () => window.location.reload()` | Not a component; a function named like one. Used by `Header`, `SideBarContent.handleSave`, `NoMails`. Reload re-runs ingestion on the server. |
| `content/getColor.js` | 48 | Category/sender color from name hash | Named `getRandomColor` but is deterministic (fine, misleading name). Default categories are hard-coded by name. |
| `content/SideBar.content.js` | 38 | Static category list | **[Verified]** Not imported anywhere (dead). |
| `utils/formatEmailBody.js` | 88 | Sanitizer | Good; has an injectable factory "so it can be tested under jsdom" but there are no tests. |

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 6.1 Duplication (all **[Verified]**)

- Sender display-name parsing, `senderRaw.includes('<') ? senderRaw.split('<')[0].replace(/['"]/g,'').trim() : senderRaw`, appears in `DisplayEmail.jsx:111-113`, `ViewEmails.jsx` (about line 98-100), `SearchResults.jsx:64-65`.
- Rich-summary check `includes('•') || includes('Action Item:')` appears 4 times: `DisplayEmail.jsx:105,129`, `ViewEmails.jsx:38,107` (see 6.3).
- Category filter `email.category?.toLowerCase() === x.toLowerCase()` in `Email.jsx:37`, `SearchResults.jsx:17`, `SideBarContent.jsx:36`.
- Date formatting in three styles (`DisplayEmail`, `ViewEmails`, `SearchResults`).
- The design tokens (`#2563eb`, `#e2e8f0`, `#64748b`, `#0f172a`, `#f1f5f9`...) are hard-coded as hex literals in virtually every component (hundreds of occurrences); there is no MUI `createTheme` and no `ThemeProvider` (grep confirms neither is used). Buttons restyle `textTransform: 'none'`, `borderRadius`, hover colour each time. **[Opportunity]** One `theme.js` would delete most of the `sx` noise.
- `'Inter'` is used as font-family in many places, but `index.html:8` loads only IBM Plex Serif and Merriweather from Google Fonts. **[Verified]** Inter is never loaded, so it silently falls back to `sans-serif`; the two loaded fonts are not used by any code I read. (Check: `grep -rn "Plex\|Merriweather" src` is empty.)

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 6.2 Fetch and refresh model (what happens when)

- **[Verified]** Emails are fetched exactly once per session by the `App.jsx:97-101` effect, whose guard `emails.length === 0` also means: if the first fetch legitimately returns zero emails, changing `category` or `selectedUser` re-triggers the fetch (and re-triggers ingestion on the server) each time. Changing category does not refetch for non-empty lists, because the list is client-filtered. The first call always asks for `All`.
- **[Verified]** To see new mail, the user must reload the page (`Refresh`). The server's push work ([06-gmail-push-webhook.md](06-gmail-push-webhook.md)) has no client counterpart (no polling, no SSE, no websocket; the `websocket` npm package is unused).
- **[Verified]** Category count badges (`SideBarContent.jsx:32-38`) count loaded emails only (those held in memory), not DB totals.
- **[Verified]** After category edit/delete, `NewCategory` updates only `categories`. Existing emails keep their stale category string in `emails` (matches the server-side caveat in the root CLAUDE.md), and `handleSave` ("Apply & Refresh") reloads the page. See [05-data-layer.md](05-data-layer.md).

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 6.3 Snippet-vs-summary convention on the client

`emailsummary` is either a short snippet or an AI summary. The client tells them apart by substring `•` or `Action Item:`:

- `DisplayEmail.jsx:105-108`: initial state of the drawer's `summaryText` is the stored value only if it matches, else `''`.
- `DisplayEmail.jsx:129`: on click, if `summaryText` matches, skip the API call; else `GET /email/summarize/:id` (server caches into the same column).
- `DisplayEmail.jsx:221`: the row preview prints `emailsummary` (HTML tags stripped via regex, `slice(0,90)`) **whether it is a snippet or a full summary**, so a cached AI summary shows `• ...` bullet text as the preview line.
- `ViewEmails.jsx:38-40` and `:107` (the latter is dead, `isRichSummary` is unused).
- **[Risk]** Fragile: a snippet that naturally contains a bullet character (common in marketing emails, and the cleaner caps at 1200 chars before the snippet is cut) is treated as an AI summary, so the user sees the raw snippet and never gets the Gemini summary. Conversely an AI summary lacking both markers triggers a re-fetch each time. Opportunity: a single helper `isAiSummary(text)` in `utils/` as the first step, and long-term a boolean column such as `has_ai_summary` (needs server and schema change; coordinate with [05-data-layer.md](05-data-layer.md) and [04-ai-and-gmail-actions.md](04-ai-and-gmail-actions.md)). Do not change either side alone.
- After `GET /email/summarize` in the list drawer, the new summary is kept only in the row's local state, not written back to the `emails` context, so `ViewEmails` (which reads `location.state.email`, a snapshot) will not see it, and vice versa. **[Verified]** Minor duplicate network call and an AI request.

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 7. XSS handling of email HTML

Rendering: `Emailbody.jsx:454-460` uses `dangerouslySetInnerHTML={{ __html: html }}` where `html` comes only from `formatEmailBody` (`utils/formatEmailBody.js`). This is the right place to concentrate trust. **[Verified]** the only `dangerouslySetInnerHTML` in `src` (grep).

DOMPurify 3.4.17 (exact-pinned in `package.json`, good) is configured at `formatEmailBody.js:517-523`:

- `USE_PROFILES: { html: true }` (no svg/mathml/svgFilters).
- `FORBID_TAGS`: style, form, iframe, object, embed, script, link, meta, base, video, audio, source, svg, math, input, button, textarea, select.
- `FORBID_ATTR`: style, srcset, background, poster, action, formaction, plus 4 `on*` names (belt-and-braces; DOMPurify already strips event handlers by default).
- `ALLOWED_URI_REGEXP`: `https?:`, `mailto:`, and `data:image/(png|gif|jpe?g|webp);base64,` only.
- `ALLOW_DATA_ATTR: false`.
- Hook `afterSanitizeAttributes` (`:491-515`): anchors with non-http(s)/mailto `href` lose the href; every `<a>` gets `target=_blank rel="noopener noreferrer"`; images: data URIs allowed, remote images removed unless `allowImages`, in which case `referrerpolicy=no-referrer`; otherwise the node is removed and `blocked` is counted.
- Plain-text emails: escaped, then URL-linkified with a regexp that stops at escaped entities, newlines to `<br/>`, then sanitized as well (`:533-545`). Single code path through `sanitize()`. Good.
- HTML detection `HTML_HINT` regexp (`:468`) decides html vs text.

Assessment:

- **[Verified]** Strong for a small app: remote content (tracking pixels) blocked by default with a user opt-in banner, `style` attribute and `<style>` forbidden (kills CSS-based exfiltration and UI redress), forms/inputs removed (no phishing forms), `javascript:` URLs blocked, links hardened.
- **[Verified]** The nginx CSP (`nginx.conf:7-8`) is an additional layer: `script-src 'self' https://cdn.jsdelivr.net`, `object-src 'none'`, `frame-ancestors 'none'`. But `img-src 'self' data: https:` allows remote images once the user clicks "Load images", which is the intended behaviour.
- **[Risk]** `addHook` is registered on the global DOMPurify singleton on first use and is never removed (`:491`). Any other future code calling `DOMPurify.sanitize` anywhere in the app would also get this hook (images removed). It is currently the only user, so harmless; document it or use `DOMPurify(window)` to create a private instance (one line: `createFormatter(DOMPurify(window))`).
- **[Risk]** The formatter keeps mutable module state (`state.allowImages`, `state.blocked`) shared between calls. It is synchronous so there is no interleaving; fine, but not re-entrant.
- **[Risk]** `<img>` with `data:image/...` is allowed; `svg` data images are excluded by the regexp (good).
- **[Risk]** Attachment download links use `href="data:${att.mimeType};base64,${att.data}"` (`ViewEmails.jsx:311`). `mimeType` comes from the sender via Gmail and `att.data` is the whole attachment in JSON. Browsers block top-level navigation to data URLs, and with `download` attribute it only downloads, so exploitation is unlikely, but the entire attachment payload sits in memory/React state, and a text/html mimeType is attacker controlled. Prefer a blob URL or a server stream. See [04-ai-and-gmail-actions.md](04-ai-and-gmail-actions.md) for the endpoint.
- **[Verified]** No DOMPurify tests (the factory is "injectable so it can be tested under jsdom", but `@testing-library/*` are installed and unused; no test runner such as vitest/jest and no `test` script).
- **[Opportunity]** For maximum isolation, render HTML bodies in a sandboxed `<iframe sandbox srcdoc>` with `csp`; probably overkill given the current sanitizer. Do not do it unless real-world emails show layout/CSS leakage (email CSS is stripped entirely today, so many newsletters render unstyled; this is a legitimate quality trade-off).
- Other output points: `DisplayEmail.jsx:221` strips tags with `/<[^>]+>/g` and renders as React text (safe, React escapes). Summaries are rendered as text in `Typography` with `whiteSpace: pre-line` (safe).

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 8. Search, pagination, states, accessibility

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 8.1 Search

- **[Verified]** Pure client-side, in-memory, run during render of `SearchResults` (`SearchResults.jsx:13-25`). Every keystroke in `Header` re-renders `Header` (local state) and re-filters. No debounce, no memo, no result cap (the dropdown renders all matches).
- **[Verified]** It searches `subject`, `sender`, and `email.body || email.emailsummary`. `email.body` is **never** present on list items (only metadata is stored, see root CLAUDE.md and [05-data-layer.md](05-data-layer.md)), so body search is effectively "snippet / AI summary only". The placeholder "Search emails by subject, sender, or content..." overpromises. **[Risk]** (expectation mismatch).
- Scope limit: only emails already loaded (at most what `/fetch-emails/All` returned), not all of Gmail.
- Whole-word AND semantics via `split(" ")`; no highlight; result click navigates to `/view` with state. `Escape` does not close the dropdown; the dropdown closes only on outside `mousedown`. **[Verified]**
- Verdict: adequate for the dataset size. **[Opportunity]** `useDeferredValue` plus cap of 20 results is a cheap win. Server-side search is not needed unless history grows.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 8.2 Pagination / infinite scroll

- **[Verified]** No infinite scroll. Client-side paging over the already-fetched array: page size 10/25/50 (`Email.jsx:29`, selector `:145-165`), prev/next only, resets to page 1 on category/length change (`:43-45`), `validCurrentPage` clamps out-of-range pages. Footer pager shown only when `totalCount > pageSize`.
- **[Verified]** The server returns the whole stored set for the user and category (see `getEmailsByCategory.js:21-26` demo path `findMany` without `take`; the real path similarly returns stored rows). There is no cursor/limit contract. At thousands of emails the payload, `new Date()` sort on every filter change (`Email.jsx:39`), and sidebar counts get heavy. **[Risk]** at scale; see [09-scalability-reliability.md](09-scalability-reliability.md). Server-side pagination would require a new query contract; not needed yet.
- The page-size and page state are local to `Email` and are lost when navigating to `/view` and back (state resets to page 1/25). **[Verified]** (annoying UX: reading item 20 then going back returns to page 1).

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 8.3 Loading / error / empty states

| Surface | Loading | Error | Empty |
|---|---|---|---|
| Session check | `SuspenseLoader` | falls to login | n/a |
| Email list | spinner while `!loaded` (`Email.jsx:212`) | **none**: failure appears as empty (`api.js:13-16`) | `NoMails` (`Email.jsx:234`) |
| Email body | `loading` flag in `ViewEmails` | console only; shows empty body | "No message content available." |
| Summary | spinner in row drawer / detail | console only; "No summary available" | same text |
| Categories | none | console only | n/a |
| Compose / AI draft | button spinner in `Auto_email` only | console only | n/a |

**[Verified]** Error states are essentially absent. The project already contains `react-hot-toast` (unused); a toast helper in the axios interceptor would cover most of this in under 30 lines. **[Opportunity]**

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 8.4 Accessibility

All **[Verified by reading]**:

- `DisplayEmail.jsx:149-155`: row has `role="button"` and `tabIndex={0}` but **no `onKeyDown`** (Enter/Space do nothing), so keyboard users can focus but not open an email. 0 `onKeyDown`/`onKeyPress` in all of `src`.
- `Optionsmenu.jsx:34-40, 85-91`: help and avatar menus are clickable `<div>`s with no role, no tabIndex, no `aria-*`, no Escape/outside-click close. Not keyboard-accessible, so a keyboard user cannot sign out.
- `SearchResults` items are `ListItem` with `onClick` only (not `ListItemButton`); no `role=listbox`, no arrow-key navigation.
- Only 5 `aria-*`/`alt` attributes in the whole `src`. Icon-only buttons in `Header` (refresh) and `DisplayEmail` (sparkle) rely on MUI `Tooltip` titles, which do add `aria-label` to the child; the toggle and search clear button do not all have labels.
- `NavLink` wrapping a `ListItem` (li inside a, inside ul) yields invalid list markup (`SideBarContent.jsx:145-151`).
- Colour contrast: `#94a3b8` on white (counts, timestamps in places) is about 2.6:1, below WCAG AA. Hex literals make a sweep hard.
- `<html lang="en">` is set; no skip link; dialogs rely on MUI focus-trap (fine). The `Compose` main dialog has no `onClose`/`aria-labelledby`.

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9. Styling, dependencies, build

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9.1 Styling mix

- **[Verified]** Four mechanisms: (1) MUI `sx` prop (dominant), (2) MUI `styled()` template literals (`Header`, `DisplayEmail`, `Compose`, `Emailbody`), (3) Tailwind utility classes (`GmailOAuthApp.jsx`, `Optionsmenu.jsx`), (4) global `index.css` (16 lines; `App.css` is empty, 0 bytes, and unreferenced).
- `Optionsmenu.jsx` is positioned `fixed top-3 right-4 z-50` (Tailwind) on top of the `Header` toolbar instead of inside it, which is fragile (it overlaps if the toolbar layout changes). **[Verified]**

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9.2 Tailwind setup is not what it seems

- **[Verified]** `package.json` has `tailwindcss ^4.1.7` and `autoprefixer`/`postcss`, but there is no `@tailwindcss/vite` or `@tailwindcss/postcss` plugin, no `postcss.config.*`, no `tailwind.config.*`, and `vite.config.js` only loads the React SWC plugin.
- **[Verified]** `src/index.css:1` has `@import "tailwindcss";` which, with no Tailwind plugin, is just Vite resolving the package's raw CSS (the `@tailwind`/`@theme` directives are not compiled).
- **[Verified]** `index.html:9` loads `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4` (unpinned major, no SRI): the Tailwind browser (JIT-in-the-browser) build, which Tailwind documents as development-only. Utility classes actually work in production only because of this CDN script. The nginx CSP whitelists `cdn.jsdelivr.net` for scripts solely for this (`nginx.conf:7`).
- **[Risk]** (a) third-party runtime script with no integrity attribute on every page load (supply chain + `script-src` hole); (b) FOUC and runtime CPU; (c) offline/CDN-blocked clients lose all Tailwind styling (login page, options menu); (d) the CSP cannot be tightened while it exists.
- **[Opportunity]** Either install `@tailwindcss/vite` and add it to `vite.config.js` (3-line change, then drop the CDN script and the jsdelivr CSP entry) or remove Tailwind altogether, because only two files use utility classes. Cheaper decision: since MUI already dominates, converting those 2 files to `sx` and dropping Tailwind completely removes `tailwindcss`, `autoprefixer`, `postcss` and the CDN script. Weighed either way: removal is less work long-term, the plugin is less work short-term. Cross-ref [08-devops-deployment.md](08-devops-deployment.md) (CSP/nginx).

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9.3 Dependency audit (each grepped over `src/`, `index.html`, `vite.config.js`)

| Package | Imported? | Verdict |
|---|---|---|
| `react`, `react-dom`, `react-router-dom` | yes | needed. Note v7 recommends the `react-router` package; `react-router-dom` still re-exports (7.6). |
| `@mui/material`, `@mui/icons-material` | yes | needed. `@mui/icons-material` imports are per-icon path imports except `Email`... `SideBarContent.jsx:12` `import { CreateOutlined } from "@mui/icons-material"` (barrel import, can slow dev start and bloat if tree-shaking fails; Vite prod usually shakes it). |
| `@emotion/react`, `@emotion/styled` | no direct import | **required peer deps of MUI**, keep. |
| `axios` | yes | needed. |
| `dayjs` | yes (3 files) | needed (could be `Intl.DateTimeFormat`, not worth it). |
| `dompurify` | yes | needed (3.4.17 pinned). |
| `framer-motion` | yes (6 files) | used for small fades, whileHover and `AnimatePresence`; real cost is about 30-60 KB+ gzipped in the main bundle. **[Opportunity]** replace with CSS transitions or `LazyMotion` if bundle size matters. Keep for now. |
| `lucide-react` | 1 file (`GmailOAuthApp`) | used only on the login page while the app proper uses MUI icons; two icon libraries. Low priority. |
| `react-hot-toast` | **no** | unused. |
| `react-hot` | **no** | unused (and a junk 0.0.1 package, likely a typo for the above). |
| `react-calendar` | **no** | unused. |
| `@mui/x-date-pickers` | **no** | unused. |
| `three`, `@react-three/fiber`, `@react-three/drei` | **no** | unused; very large install (hundreds of MB of node_modules), zero bundle impact only because nothing imports them. |
| `@syncfusion/ej2-react-notifications` | **no** | unused (commercial-licence library). |
| `websocket` | **no** | unused; it is a Node-oriented package (native build deps) and has no use in a browser. |
| `react-scripts` | **no** | unused CRA leftover (pulls in webpack, babel, jest, hundreds of transitive packages and a long audit list); the project uses Vite. |
| `web-vitals` | **no** | unused. |
| `@testing-library/{jest-dom,react,user-event}` | **no** | unused, no test runner exists. |
| dev: `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `@types/react*`, `@vitejs/plugin-react-swc`, `vite` | yes (config) | needed (`@types/*` are not needed without TypeScript, harmless). |
| dev: `tailwindcss`, `autoprefixer`, `postcss` | not wired | see 9.2. |

**[Verified]** That is 14 safe-to-remove runtime dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `@syncfusion/ej2-react-notifications`, `websocket`, `react-hot`, `react-scripts`, `react-calendar`, `@mui/x-date-pickers`, `web-vitals`, the three `@testing-library/*`, and (if you decide to use the toast later, keep) `react-hot-toast`. Removal has no effect on the Vite bundle (unimported code is never bundled) but shrinks `npm install` time and the Docker build stage (`client/Dockerfile` runs `npm install`, not `npm ci`) and reduces vulnerability-scanner noise. **Do this removal as a package.json change plus lockfile regeneration; I did not touch it** (read-only task).

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9.4 Bundle size

- A pre-existing `client/dist/assets` snapshot (dated Oct 25; it may be stale vs `src`, and I did not rebuild): main `index-*.js` about 545 KB (minified, before gzip), `Main` 61 KB, `Refresh` chunk 65 KB (MUI pieces shared into an oddly named chunk), `ViewEmails` 41 KB, `Email` 16 KB, `AutoAwesome` 57 KB (icon chunk mis-named, again shared MUI code), CSS about 20 KB. Total about 810 KB on disk.
- **[Verified]** Route-level `lazy()` splitting exists (`App.jsx:10-12`), but `Main` pulls in nearly all of MUI so the main chunk is big. It is acceptable for a logged-in tool app. Nothing else here is worth chasing before removing the Tailwind CDN script and fixing the real issues.
- `dist/` is not tracked (git ls-files found none), good.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9.5 Vite config, env, lint, tests

- **[Verified]** `vite.config.js`: React SWC plugin; dev server `host: '0.0.0.0'`, `port: 3000`. No alias, no proxy, no build options, no `base`, no manual chunks. Exposing the dev server on all interfaces is convenient for Docker but exposes it on the LAN.
- **[Verified]** Env: only `VITE_BACKEND_URL` (`http.js:3`), falling back to `http://localhost:5000`. `client/.env` exists with the value commented out (`> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# VITE_BACKEND_URL=`) and is untracked. In a production build, if the variable is not provided at build time the client silently targets `localhost:5000`, and Vite inlines the value at build time (so it must be passed as a build arg in the frontend host, e.g., Amplify). The client `Dockerfile` does not declare an `ARG VITE_BACKEND_URL`, so the local nginx image would also call `localhost:5000`, which only works from the host browser. **[Risk]** See [08-devops-deployment.md](08-devops-deployment.md). The nginx CSP hard-codes `connect-src ... http://localhost:5000 https:`.
- **[Verified]** ESLint (flat config, `eslint.config.js`): `@eslint/js` recommended + react-hooks + react-refresh. Missing `eslint-plugin-react` (`jsx-uses-vars`), so `no-unused-vars` flags `motion` in files where it is used as `<motion.div>`. The pattern `varsIgnorePattern: '^[A-Z_]'` is the Vite template's workaround for JSX components, and lowercase `motion` falls outside it. I ran `npx eslint src` read-only (node_modules present): **14 problems (8 errors, 6 warnings)**:
  - True positives: unused `motion` (`Email.jsx:21`, `SideBarContent.jsx:20`), unused `openDrawer` (`Email.jsx:24`, `ViewEmails.jsx:29`), unused `setEmail` (`ViewEmails.jsx:32`), unused `isRichSummary` (`ViewEmails.jsx:107`).
  - False positives: `motion` in `GmailOAuthApp.jsx:3` and `Optionsmenu.jsx:4` (used as JSX member expressions).
  - Warnings: `exhaustive-deps` in `App.jsx:101`, `Email.jsx:67`, `SideBarContent.jsx:62`; react-refresh in `App.jsx:14`; two unused `eslint-disable` directives (`App.jsx:1`, `routes/route.js:1`).
  - Quick fix: allow `^(motion|[A-Z_])` in `varsIgnorePattern`, or add `eslint-plugin-react`'s `jsx-uses-vars`. `npm run lint` currently exits non-zero.
- **[Verified]** No tests: no `test` script, no vitest/jest config, no `*.test.*`/`__tests__` files; testing-library packages installed but unused. No CI step runs lint or build for the client (see [08](08-devops-deployment.md)). The sanitizer and the summary-detection helper are the two best candidates for first tests (pure functions).
- **[Verified]** Language: JS only; `@types/react*` installed but there is no TS or JSDoc type checking.

##> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 9.6 Naming and file conventions

- Mixed casing: `Auto_email.jsx` (snake), `Emailbody.jsx` and `Optionsmenu.jsx` (lowercase second word; the component is named `EmailBody`/`OptionsMenu`, while the import path is lowercase), `SideBar.content.js`, `getColor.js` exporting `getRandomColor`, `GmailOAuthApp.jsx` exporting `MailWiseLogin`, `setmessageSent`. Also `components/error/Error.jsx` plus `pages/Main.jsx` but `Email.jsx`/`ViewEmails.jsx` (route pages) under `components/`.
- On case-insensitive Windows dev machines mismatched case between import path and file name (e.g. `Emailbody` vs `EmailBody`) works but breaks on Linux CI/Docker if someone "fixes" one side. Currently imports match file names exactly (verified by the working `dist` build on Alpine). Renames must be done with `git mv` and a case-only rename on Windows needs care.
- `README.md` in client is the Vite template or stale (not read in depth).

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 10. Issue index

| > **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# | Label | Issue | Location |
|---|---|---|---|
| 1 | Verified | Tailwind works only through the runtime CDN `@tailwindcss/browser@4` script (no SRI, unpinned); build has no Tailwind plugin; `@import "tailwindcss"` is inert | `index.html:9`, `index.css:1`, `vite.config.js` |
| 2 | Verified | "Delete email" only mutates local state, no API call | `ViewEmails.jsx:81-85` |
| 3 | Verified | Category in URL ignored by list; list uses context `category`; deep link/reload/back mismatch; default route `/emails/inbox` is not a category | `Email.jsx:32-40`, `SideBarContent.jsx:141-148`, `App.jsx:19` |
| 4 | Verified | `Error={...}` is not a route prop; custom error page never used | `App.jsx:27-28` |
| 5 | Verified | Fetch errors become an empty list (no error UI); no axios timeout; no cancel | `api/api.js:13-16`, `http.js:5` |
| 6 | Verified | Every failure is `console.error` only; `react-hot-toast` installed, unused | 10 call sites |
| 7 | Verified | 5 of 17 context fields are dead, many setters unused; value object recreated each render; Compose typing re-renders all consumers | `App.jsx:35-54,117-126` |
| 8 | Verified | 14 unused deps (three, react-three, syncfusion, websocket, react-hot, react-scripts, calendar, x-date-pickers, web-vitals, testing-library x3, plus toast unused) | `package.json` |
| 9 | Verified | Dead files: `api/api.url.js`, `content/SideBar.content.js`, `App.css` (empty), `routes/route.js` lazy exports, `src/assets/react.svg` (0 bytes) | |
| 10 | Verified | `npm run lint` fails (8 errors, 6 warnings); config lacks JSX-uses-vars so some are false positives | `eslint.config.js` |
| 11 | Verified | No tests, no test runner, no CI for client | |
| 12 | Verified | Keyboard accessibility gaps (row `role=button` without key handler; clickable divs for menus) | `DisplayEmail.jsx:149-155`, `Optionsmenu.jsx:34,85` |
| 13 | Verified | `Compose` sends a fetch-shaped payload; server has a compat shim; no send error UI or pending state | `Compose.jsx:79-96`, `server/.../sendEmail.js:15-30` |
| 14 | Verified | Search promises "content" but list items have no `body`; searches subject, sender, snippet/summary only | `SearchResults.jsx:22` |
| 15 | Verified | No responsive layout (fixed 270px sidebar, fixed-width row columns) | `Main.jsx`, `DisplayEmail.jsx:157,227` |
| 16 | Verified | `Inter` font referenced but never loaded; loaded fonts unused | `index.html:8` |
| 17 | Verified | `/view` depends on router state; reload loses the email | `ViewEmails.jsx:27-28` |
| 18 | Risk | `'•'`/`'Action Item:'` summary detection duplicated 4x; false positives on bulleted snippets | section 6.3 |
| 19 | Risk | DOMPurify hook registered on the global singleton; attachments as data-URI in JSON/state | `formatEmailBody.js:491`, `ViewEmails.jsx:311` |
| 20 | Risk | Full-page `Refresh` re-runs server ingestion; only way to get new mail; no push consumer on the client | `Refresh.jsx`, [06](06-gmail-push-webhook.md) |
| 21 | Risk | `VITE_BACKEND_URL` is build-time; local Docker image and CSP assume localhost | `http.js:3`, `Dockerfile`, `nginx.conf` |
| 22 | Risk | `update` counter is client-incremented and sent to the server | `NewCategory.jsx:46,70,94` |
| 23 | Opportunity | MUI `createTheme` to replace hundreds of hex/`sx` duplicates | whole `components/` |
| 24 | Opportunity | `useDeferredValue` or debounce and result cap for search | `SearchResults.jsx` |
| 25 | Opportunity | Preserve page/page-size in URL search params | `Email.jsx` |

---

#> **Path note:** components were regrouped after this analysis was written: `components/{layout,mail,compose,categories,common}/`, routed screens in `pages/` (`Email.jsx`, `ViewEmails.jsx`), `emailContext` in `context/emailContext.js`, HTTP calls in `api/*.js`, `getColor` in `utils/`. File names below may refer to the old locations.

# 11. Prioritized, incremental refactor recommendations

Principle: this is a small app. No Redux/Zustand/React Query is justified yet. The state graph is small enough that fixing the context and using `useParams` is enough. Revisit React Query only if you later add refetch/polling/optimistic updates for several resources, since it would replace `loaded`, the manual fetch effect and error handling in one go.

**Tier 1 - cheap, high value, low risk (do first)**

1. Fix the Tailwind situation (issue 1): either add `@tailwindcss/vite` or convert the two Tailwind files to MUI and delete the CDN script and `cdn.jsdelivr.net` from the CSP. This removes a third-party script from every page.
2. Make "delete" honest (issue 2): either remove the trash button, or add a server endpoint (Gmail trash + DB delete) and call it. Coordinate with [04](04-ai-and-gmail-actions.md). Until then, hide it.
3. Surface errors (issues 5, 6, 13): add a tiny `notify.error()` using the already-installed `react-hot-toast`, `<Toaster/>` in `App`, call it from the axios response interceptor for non-401 failures, and stop swallowing in `api.js` (let `App` set an `error` state and render a retry card instead of `NoMails`). Add `timeout: 60000` to axios (ingestion is slow). Add a `sending` flag to Compose.
4. Category from the URL (issue 3): `const { type } = useParams()` in `Email.jsx`; delete `category`/`setCategory` from the context and the `onClick` in the sidebar. Set `DEFAULT_ROUTE = "/emails/All"`. Remember the `emails.length === 0` effect depends on `category`; it should just fetch "All" once.
5. Route errors: change `Error=` to `errorElement=` (or add one on the parent route).
6. Lint to green: allow `motion` in `varsIgnorePattern`, delete the true unused vars and the two blanket `eslint-disable` comments. Add `npm run lint` and `npm run build` to a CI step (see [08](08-devops-deployment.md)).

**Tier 2 - hygiene (one commit each, no behaviour change)**

7. Remove the unused dependencies listed in 9.3 and dead files (`api.url.js`, `SideBar.content.js`, `App.css`, `routes/route.js` after replacing with constants). Regenerate the lockfile; switch the client `Dockerfile` to `npm ci`.
8. Trim the context to what is used: remove the 5 dead fields and unused setters. Move `data`, `openAi`, `messageSent` into a `ComposeProvider` (or local state inside `SideBarContent`/`Compose`) so typing doesn't re-render the inbox. Wrap the remaining provider value in `useMemo`. Move the context to `src/context/EmailContext.js` (fixes the circular import and the react-refresh warning).
9. Extract `utils/email.js` with `senderName()`, `isAiSummary()`, `matchesCategory()`, `formatDate()` and use it in the 3-4 duplicated places. Cheapest fix for the summary-convention fragility on the client side; keep the server convention unchanged for now.
10. Add keyboard support: `onKeyDown` Enter/Space on `EmailRow`; turn the menu `div`s in `Optionsmenu` into `IconButton`s with `aria-label`/`aria-expanded`; Escape closes search.
11. Fix the `ViewEmails` unmount/stale-response race with a cancelled flag or `AbortController`; write back generated summaries to `emails` context (or use a shared helper), so list and detail agree.

**Tier 3 - when you next touch these areas**

12. Introduce a MUI theme (`createTheme` with the blue/slate palette, `textTransform: none`, radii) and strip repeated `sx`. Then split `SideBarContent` (category list / customize dialog host / compose button) and slim `ViewEmails` (header, summary card, attachments).
13. Mobile: make the drawer `temporary` on `sm` and below; collapse row columns.
14. Add `/view/:emailId` route plus persisted pagination in search params so reload and back are stable.
15. Simplify `Compose` payload (`http.post('/email/send-emails', data)`) and then remove the server's legacy shim.
16. Replace `Refresh` page reloads with `fetchEmailData()` (already in the context, unused) and optionally a "check for new mail" button; this also prepares a polling or push consumer ([06](06-gmail-push-webhook.md)).
17. Add Vitest with 2 test files only: `formatEmailBody` (script/style/img/link/`javascript:` cases using the existing injectable `createFormatter` with jsdom) and `utils/email.js`. Keep `@testing-library` only if you will test components.

**Leave alone**

- The sanitizer design (`formatEmailBody.js`) and the image-blocking UX: they are the best-engineered part of the client.
- Route-level lazy loading, framer-motion (small, keep until bundle size actually matters), dayjs, client-side pagination and search at current data volumes.
- The `http.js` interceptor + cookie auth design (consistent with [02](02-auth-security.md)); just add error notification and a timeout.
- Do not introduce TypeScript, Redux, or a new UI library now.
