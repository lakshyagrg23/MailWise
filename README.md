# MailWise

AI-powered Gmail management. MailWise connects to your Gmail account via Google OAuth, sorts incoming mail into categories **you define** using Google Gemini, summarizes emails on demand, and helps you draft and send new ones.

![Screenshot](<Screenshot 2026-10-25 202354.png>)

## Features

- **AI categorization** – new mail is classified by Gemini against your own category names and descriptions. Gmail's own Spam / Promotions / Social labels are routed directly, skipping the AI to save tokens.
- **Custom categories** – create, edit and delete categories; seven defaults are seeded on first sign-in (Essential, Social, Promotions, Updates, Finance, Subscriptions, Miscellaneous).
- **On-demand summaries** – structured bullet summary plus an "Action Item" line, cached in the database after the first request. Hover previews show it in the list.
- **AI-assisted composition** – generate a subject and body from a short description (formal or informal), then send through the Gmail API.
- **Search and full-message view** – read the full body and download attachments, fetched live from Gmail.
- **Demo account** – try the app with seeded data and no Google sign-in.
- **Gmail push notifications (in progress)** – watch registration and a Pub/Sub webhook endpoint exist; processing of pushed history is not implemented yet.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, React Router 7, MUI 7, Tailwind CSS 4, framer-motion, axios |
| Backend | Node 22, Express 4, `googleapis`, `@google/generative-ai` (`gemini-2.5-flash`) |
| Database | PostgreSQL with Prisma 5.21 |
| Infrastructure | Docker, GitHub Actions → GitHub Container Registry → EC2 (docker compose); frontend on AWS Amplify |

## Architecture

```
client (React SPA)  ──HTTP──▶  server (Express)  ──▶  Gmail API (read / send / watch)
                                     │            ──▶  Gemini API (classify / summarize / draft)
                                     └──▶  PostgreSQL (users, email metadata, categories)
```

Only email **metadata** is stored (subject, sender, category, snippet or summary, date, attachment name). Bodies and attachments are fetched from Gmail when you open a message.

**Ingestion pipeline** (runs when the client requests `GET /fetch-emails/:category`):

1. List the 30 most recent Gmail message IDs, excluding trash and drafts.
2. Drop IDs already stored for the user.
3. Fetch the new messages (10 concurrent), then clean the bodies: strip HTML, quoted replies, signatures and footers, and truncate to 1200 characters.
4. Route SPAM, Promotions and Social labels directly; send the rest to Gemini in token-budgeted batches (2 concurrent), requesting only `{email_id, category}`.
5. Validate the returned category against the user's list, falling back to a default on failure, and bulk-insert.
6. Return the stored emails for the requested category.

Gmail and Gemini calls use exponential backoff with jitter for 429, 5xx and network errors.

### Authentication

Google OAuth 2.0 with offline access (`gmail.readonly`, `gmail.send`, user profile). Tokens are stored in Postgres and refreshed automatically when within 5 minutes of expiry. After sign-in the server redirects to the frontend with the token and user ID, which the client keeps in `localStorage` and sends on each request. There are no server-side sessions.

## Project structure

```
client/                 React SPA (Vite)
  src/App.jsx           auth bootstrap, shared context, router
  src/pages/Main.jsx    layout: header, sidebar, content outlet
  src/components/       email list, detail view, compose, category management
server/
  server.js             Express app and route mounting
  controllers/          auth, categories, emails, webhook
  services/             Gmail auth, fetching, classification, watch registration
  utils/                email cleaning, retry, concurrency pool
  prisma/schema.prisma  User, EmailMetadata, CategoryPreference
docker-compose.yml          production backend (external network, GHCR image)
docker-compose.local.yml    local Postgres + backend + frontend
.github/workflows/          build, publish and deploy on push to main
```

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/url` | Google consent URL |
| GET | `/auth/callback` | OAuth callback, creates or updates the user |
| GET | `/auth/demo` | Reset and sign in to the demo account |
| GET | `/fetch-emails/:category` | Sync, classify and list emails (`All` for everything) |
| GET | `/fetch-email/:emailId` | Full body and attachments from Gmail |
| GET | `/fetch-email/email` | AI-draft an email (`type`, `details`) |
| GET | `/email/summarize/:emailId` | AI summary (cached) |
| POST | `/email/send-emails` | Send an email |
| DELETE | `/email/:userId` | Clear stored emails (the demo account is preserved) |
| GET, POST | `/categories/:userId` | List / create categories |
| PUT, DELETE | `/categories/:userId/:categoryName` | Update / delete a category |
| POST | `/webhook/gmail` | Gmail Pub/Sub push endpoint |

Requests authenticate with `access_token` (query string or `Authorization: Bearer`) and `user_id`. The token `demo` selects demo behavior.

## Getting started

### Prerequisites

- Node.js 22 and npm
- PostgreSQL 15 (or Docker)
- A Google Cloud project with the Gmail API enabled and an OAuth 2.0 Web client whose redirect URI is `http://localhost:5000/auth/callback`
- A Gemini API key

### Configuration

Create `server/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/mailwise?schema=public
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/callback
GEMINI_API_KEY=...
FRONTEND_URL=http://localhost:3000
# Optional, enables Gmail push registration:
# GOOGLE_PUBSUB_TOPIC=projects/<project>/topics/<topic>
# PORT=5000
```

Create `client/.env` (optional; this is the default):

```env
VITE_BACKEND_URL=http://localhost:5000
```

### Run locally

```bash
# Backend
cd server
npm install
npx prisma db push
npm start            # http://localhost:5000

# Frontend (new terminal)
cd client
npm install
npm run dev          # http://localhost:3000
```

### Run with Docker

```bash
docker compose -f docker-compose.local.yml up --build
```

This starts Postgres, the backend on `:5000` and the frontend on `:80`. The backend reads `server/.env`; the compose file overrides `DATABASE_URL` to point at the database container.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which:

1. Builds `./server` and pushes `ghcr.io/<owner>/mailwise-backend` (`latest` and the commit SHA).
2. SSHes into the EC2 host, pulls the repo, writes `.env` from GitHub secrets, and runs `docker compose pull && docker compose up -d`.

Required secrets: `EC2_HOST`, `EC2_USERNAME`, `EC2_SSH_KEY`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY`, `FRONTEND_URL`. The production compose file expects an existing external Docker network named `shared-network`.

The server container runs `prisma db push --accept-data-loss` on startup, so review schema changes before deploying. Adding a new environment variable means updating both `docker-compose.yml` and the `.env` generation step in `deploy.yml`.

## Known limitations

- Only the 30 most recent messages are considered per sync, and sync happens when the client requests it. The push-notification path is not finished.
- Renaming or deleting a category does not reclassify or update existing emails.
- Access tokens travel in URLs and query strings, and user-scoped routes do not verify that the caller owns the `user_id`. Treat this as a prototype before exposing it to untrusted users.
- No automated tests.
