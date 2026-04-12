# Aurea — AI-Powered SMB Marketing Platform

An AI platform for small and medium businesses combining marketing automation, sales intelligence, and analytics. Built for LunarHack.

---

## What's Actually Built

### Frontend + Next.js API layer (`/`)
- **Next.js 16** App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- Dashboard with pages: Overview, Products, Marketing AI, Product Intel, Email Campaigns, User Tracking, Analytics, Settings
- Better Auth login/signup flow (`/login`, `/signup`) with email/password and Google OAuth
- Floating chat widget on the storefront (sales agent)
- All AI calls go through Next.js API routes, which proxy to OpenAI via Vercel AI SDK

### Python Backend (`/backend`)
- **FastAPI** server handling image generation and prompt enhancement
- `POST /api/generate-image` — HuggingFace FLUX.1-schnell (via nscale provider)
- `POST /api/enhance-prompt` — Gemini 2.5 Flash Lite rewrites rough prompts into production-ready image prompts
- `POST /api/generate-captions` — Gemini 2.5 Flash Lite generates social media captions per tone/platform
- `GET  /health`

### Separate Express prototype (`/lunarhack`)
- Standalone vanilla HTML/CSS/JS app with its own Express server
- Duplicate of image gen + caption logic — predates the Next.js app and FastAPI backend
- Can be retired once FastAPI is confirmed working

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Next.js AI routes | Vercel AI SDK 6, OpenAI GPT-4o-mini (streaming + structured output) |
| Python backend | FastAPI, Uvicorn, httpx, Pillow |
| Image generation | HuggingFace Inference API — FLUX.1-schnell (nscale provider) |
| Prompt/caption AI | Google Gemini 2.5 Flash Lite |
| Data | Mock product catalog + Neon Postgres tracking + Upstash session context cache |

---

## Project Structure

```
Aurea/
├── app/
│   ├── page.tsx                      # Storefront homepage + chat widget
│   ├── dashboard/
│   │   ├── layout.tsx                # Sidebar navigation
│   │   ├── page.tsx                  # Overview KPIs
│   │   ├── products/page.tsx
│   │   ├── marketing/page.tsx        # Campaign builder + image gen
│   │   ├── recommendations/page.tsx  # Product intelligence
│   │   ├── email-campaigns/page.tsx  # Email sequence builder
│   │   ├── analytics/page.tsx        # AI insights dashboard
│   │   ├── tracking/page.tsx         # Session / event tracking
│   │   └── settings/page.tsx
│   └── api/
│       ├── chat/route.ts             # Streaming sales chat (GPT-4o-mini)
│       ├── marketing/route.ts        # Campaign generation (GPT-4o-mini, structured output)
│       ├── content-variants/route.ts # 3-tone content variants
│       ├── insights/route.ts         # Analytics AI insights
│       ├── recommendations/route.ts  # Cross-sell / upsell recommendations
│       ├── email-campaign/route.ts   # 3-email sequence generation
│       ├── qualify-lead/route.ts     # Lead scoring with tool-calling
│       ├── generate-image/route.ts   # HuggingFace FLUX image gen (mirrors backend)
│       └── enhance-prompt/route.ts   # Gemini prompt enhancement (mirrors backend)
├── backend/                          # FastAPI Python backend
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── routers/
│       ├── health.py
│       ├── image.py                  # /api/generate-image, /api/enhance-prompt
│       └── captions.py              # /api/generate-captions
├── components/
│   ├── chat-widget.tsx
│   └── ui/                           # shadcn/ui components
├── lib/
│   ├── mock-data.ts                  # Products + mock sessions/events/orders
│   └── utils.ts
├── lunarhack/                        # Standalone Express prototype (legacy)
└── public/
```

---

## Getting Started

### Prerequisites
- Node.js 18+, pnpm
- Python 3.11+

### Next.js app

```bash
pnpm install
cp .env.local.example .env.local   # fill in OPENAI_API_KEY
pnpm dev                            # http://localhost:3000 (or 3001 if backend is on 3000)
```

### FastAPI backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                # fill in GEMINI_API_KEY and HF_TOKEN
uvicorn main:app --reload --port 8000
```

Backend runs on `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

---

## Environment Variables

### Next.js (`.env.local`)
```env
OPENAI_API_KEY=sk-...        # GPT-4o-mini for all chat/marketing/insights routes
HF_TOKEN=hf_...              # HuggingFace token for image generation
GEMINI_API_KEY=AIza...       # Gemini 2.5 Flash Lite for prompt enhancement
FASTAPI_URL=http://localhost:8000   # FastAPI backend URL (optional, for proxying)
DATABASE_URL=postgresql://...       # Neon Postgres URL for sessions/events/orders tracking
BETTER_AUTH_SECRET=...              # 32+ char secret used by Better Auth
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...                # Google OAuth app client ID
GOOGLE_CLIENT_SECRET=...            # Google OAuth app client secret
UPSTASH_REDIS_REST_URL=https://...  # Upstash Redis REST URL for session context cache
UPSTASH_REDIS_REST_TOKEN=...        # Upstash Redis REST token
PAYMENT_WEBHOOK_SECRET=...          # Shared secret used by /api/webhooks/payment
ADMIN_EMAILS=admin@example.com      # Comma-separated admin emails allowed for protected admin APIs
```

### FastAPI backend (`backend/.env`)
```env
GEMINI_API_KEY=AIza...
HF_TOKEN=hf_...
```

---

## API Endpoints

### Next.js API routes (serverless, streaming)
| Endpoint | Method | What it does |
|---|---|---|
| `/api/auth/[...all]` | GET/POST | Better Auth handler for session, email/password, and OAuth flows |
| `/api/chat` | POST | Streaming sales chat with session/page/product context + retrieved catalog grounding (RAG) |
| `/api/marketing` | POST | Campaign generation — caption, hashtags, image prompt, strategy |
| `/api/content-variants` | POST | 3 tone variants (Professional / Fun / Storytelling) |
| `/api/insights` | POST | AI analysis of analytics data |
| `/api/recommendations` | GET/POST | Deterministic market-basket/RFM/inventory signals + analytics RAG synthesis for insight summary and actions (protected) |
| `/api/email-campaign` | POST | 3-email sequence (Hook → Social Proof → Urgency) |
| `/api/qualify-lead` | POST | JSON lead score + recommendations with tool-calling |
| `/api/generate-image` | POST | FLUX.1-schnell image generation |
| `/api/enhance-prompt` | POST | Gemini prompt enhancement |
| `/api/track` | POST/GET | POST ingests session/product events; GET returns tracking dashboard data and now requires authenticated admin access |
| `/api/webhooks/payment` | POST | Secure server-side order logging from confirmed payment webhooks with idempotency enforced by `payment_reference` |

### Admin API protection
- `POST /api/store/products`, `PATCH/DELETE /api/store/products/[id]`, `PUT /api/store/settings`, `GET/POST /api/recommendations`, and `GET /api/track` require an authenticated session.
- If `ADMIN_EMAILS` is configured, only those emails (or users with `role = "admin"`) can call protected admin routes.
- `POST /api/track` and `POST /api/store/purchase` now ignore spoofed `user_id` payload values and trust authenticated session identity when present.

### Better Auth + Neon migrations
```bash
pnpm auth:generate   # generates SQL at db/migrations/better-auth.sql
pnpm auth:migrate    # applies Better Auth tables to current DATABASE_URL
```

These commands are repeatable and safe for branch databases. Re-run `auth:migrate` after enabling new Better Auth options/plugins.

### Neon branch-per-git-branch workflow
```bash
# Create a Neon branch for your current git branch (or pass -BranchName)
pnpm neon:branch -- -ProjectId <neon-project-id> -ParentBranch main

# Equivalent raw CLI example
neon branches create --project-id <neon-project-id> --name <git-branch-name> --parent main
neon connection-string <git-branch-name> --project-id <neon-project-id>
```

Set `DATABASE_URL` from that branch connection string, then run `pnpm auth:migrate` so auth users/sessions remain isolated per branch.

### FastAPI backend (long-running, Python)
| Endpoint | Method | What it does |
|---|---|---|
| `/health` | GET | Health check |
| `/api/generate-image` | POST | FLUX.1-schnell via HuggingFace (with retry + rate limiting) |
| `/api/enhance-prompt` | POST | Gemini 2.5 Flash Lite prompt enhancement |
| `/api/generate-captions` | POST | Gemini captions per tone + platform |

---

## What's Missing / Actual Next Steps

### Must-have for a real product
- [ ] **Product catalog DB** — tracking now uses Neon, but products are still hardcoded in `lib/mock-data.ts`.
- [x] **Auth** — Better Auth wired with email/password + Google sign-in, protected dashboard/admin APIs, and Neon-backed auth tables.
- [ ] **Wire Next.js → FastAPI** — the Next.js `generate-image` and `enhance-prompt` routes duplicate the FastAPI logic. Pick one and proxy to it.
- [x] **`.env.local.example`** — root-level env example file is now included.

### Nice-to-have
- [x] **Real tracking** — `/api/track` writes sessions/events to Neon, and confirmed orders are logged server-side via `/api/webhooks/payment`.
- [ ] **Image storage** — generated images are returned as raw bytes and not saved anywhere. Add S3/R2/Supabase Storage.
- [ ] **Retire `lunarhack/`** — the Express prototype is superseded by the FastAPI backend.
- [ ] **Streaming from FastAPI** — image gen response is currently blocking. Add SSE or a job-queue pattern for long generations.
- [ ] **Deploy** — Next.js → Vercel, FastAPI → Railway / Render / Fly.io

---

## Data Flow

```
Browser
  └─ storefront / dashboard (Next.js)
       ├─ /api/chat              → GPT-4o-mini (streaming) + retrieved product context (RAG)
       ├─ /api/marketing         → OpenAI GPT-4o-mini (structured output)
       ├─ /api/insights          → OpenAI GPT-4o-mini (streaming)
       ├─ /api/content-variants  → OpenAI GPT-4o-mini (streaming)
       ├─ /api/recommendations   → SQL-backed recommendation signals + RAG evidence retrieval + GPT insight synthesis
       ├─ /api/email-campaign    → OpenAI GPT-4o-mini (streaming)
       ├─ /api/webhooks/payment  → Secure confirmed-payment order writes
       ├─ /api/qualify-lead      → OpenAI GPT-4o-mini + tool-calling
       ├─ /api/generate-image    → HuggingFace FLUX.1-schnell
       └─ /api/enhance-prompt    → Gemini 2.5 Flash Lite

FastAPI backend (localhost:8000)
  ├─ /api/generate-image    → HuggingFace FLUX.1-schnell (with retry/rate-limit)
  ├─ /api/enhance-prompt    → Gemini 2.5 Flash Lite
  └─ /api/generate-captions → Gemini 2.5 Flash Lite
```
