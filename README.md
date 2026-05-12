# Scribble Docs

A DocSend-like tool for HTML files. Upload your proposal HTML, get a unique tracked URL, see who opened it, how long they spent, and how far they scrolled.

Built for sending Scribble proposals to prospects.

## What it does

- Upload HTML (paste or .html file) with title and description
- Each doc gets a unique short URL: `yoursite.com/v/abc123`
- Optional email gate before viewing (prospect enters email to open)
- Per-session tracking: open time, time on page, max scroll depth, country/city (via Vercel headers)
- Admin dashboard with view count and analytics drawer per doc
- Single-password access to the admin dashboard

## What it does NOT do (yet)

- No per-section tracking inside the HTML (DocSend tracks per slide; this tracks scroll % only)
- No link expiration or one-time use
- No password protection per doc (the gate is email-only)
- No team accounts (single admin password)

These are easy to add. Open the relevant route and extend.

## Deploy to Vercel

### 1. Create the project

```bash
git init
git add .
git commit -m "init"
# create a GitHub repo and push
```

### 2. Import to Vercel

- Go to vercel.com/new, import the repo
- Framework: Next.js (auto-detected)
- Don't deploy yet — add storage and env vars first

### 3. Add Upstash Redis

In your Vercel project: **Storage tab → Marketplace → Upstash → Add**.

This auto-populates `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in your env.

### 4. Add admin password

In Vercel → Project → Settings → Environment Variables:

```
ADMIN_PASSWORD = <pick something strong>
```

### 5. Deploy

Hit deploy. First load goes to `/login`.

## Run locally

```bash
cp .env.example .env.local
# fill in UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ADMIN_PASSWORD
npm install
npm run dev
```

Open http://localhost:3000 → login with your password → upload an HTML file → share the `/v/{id}` link.

## How tracking works

The viewer renders your HTML inside a sandboxed iframe (`sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`). A small tracking script is injected before `</body>` of the HTML you upload. That script measures scroll depth and elapsed time, then `postMessage`s the parent page, which POSTs to `/api/track`. On unload, `navigator.sendBeacon` fires a final close event so the close timestamp survives even on tab close.

Session IDs are random per-load. If a viewer reloads, that's a new session.

The email gate sets cookies scoped per-doc (`viewer_email_{id}`, `viewer_name_{id}`). Once entered, the viewer doesn't re-prompt for 30 days on the same browser.

## Data model (Redis)

- `doc:{id}` — full doc JSON (id, title, description, html, createdAt, gated)
- `docs:index` — sorted set of doc IDs by createdAt for the dashboard list
- `doc:{id}:views` — list of session IDs (newest first)
- `view:{sessionId}` — view record (email, openedAt, lastSeenAt, closedAt, maxScroll, duration, ip, ua, country, city)

## Cost

Upstash Redis free tier: 10,000 commands/day, 256MB storage. A typical proposal is 10–500KB. Tracking writes ~12 commands per viewer session (1 open + ~10 heartbeats + 1 close). At 100 views/day that's ~1200 commands. Well under the free tier.

Vercel Hobby free tier covers the compute.

## Security notes

- The admin password is stored as an env var and compared in plain text via a cookie. Fine for single-user. If you ever share access, swap for a real session token.
- HTML is rendered in a sandboxed iframe with `allow-scripts allow-same-origin`. Since the iframe is `srcdoc`, it shares the parent origin — your tracking script works, but if you upload truly untrusted HTML, scripts inside could call your `/api/track` endpoint with crafted payloads. Only you upload, so this is OK. If you ever allow others to upload, remove `allow-same-origin` and use cross-origin postMessage instead.
- Viewer email/name cookies are not validated — a viewer could enter `ceo@competitor.com` and you'd log that. This is the same tradeoff DocSend has. Treat email as a soft signal.

## File map

```
app/
  page.tsx                          — admin dashboard (server, gated)
  Dashboard.tsx                     — dashboard UI (client)
  login/page.tsx                    — admin login
  v/[id]/page.tsx                   — viewer entry (server, decides gate vs render)
  v/[id]/Gate.tsx                   — email gate (client)
  v/[id]/Viewer.tsx                 — HTML iframe + tracking (client)
  api/auth/route.ts                 — login/logout
  api/docs/route.ts                 — list, create
  api/docs/[id]/route.ts            — get, delete
  api/docs/[id]/analytics/route.ts  — view records for a doc
  api/track/route.ts                — receive viewer events
lib/
  kv.ts                             — Upstash Redis helpers + types
  auth.ts                           — cookie check
```
