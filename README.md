# Aurea — AI-Powered SMB Marketing Platform

An AI platform for small and medium businesses combining marketing automation, sales intelligence, and analytics. Built for LunarHack.

---

## What's Actually Built

### Frontend + Next.js API layer (`/`)
- **Next.js 16** App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- Dashboard with pages: Overview, Products, Marketing AI, Product Intel, Email Campaigns, User Tracking, Analytics, Settings
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
| Data | In-memory mock data (no DB yet) |

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
| `/api/chat` | POST | Streaming sales chat, knows product catalog |
| `/api/marketing` | POST | Campaign generation — caption, hashtags, image prompt, strategy |
| `/api/content-variants` | POST | 3 tone variants (Professional / Fun / Storytelling) |
| `/api/insights` | POST | AI analysis of analytics data |
| `/api/recommendations` | POST | Cross-sell / upsell / at-risk product analysis |
| `/api/email-campaign` | POST | 3-email sequence (Hook → Social Proof → Urgency) |
| `/api/qualify-lead` | POST | Lead scoring with tool-calling |
| `/api/generate-image` | POST | FLUX.1-schnell image generation |
| `/api/enhance-prompt` | POST | Gemini prompt enhancement |
| `/api/track` | POST/GET | In-memory session/event/order tracking |

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
- [ ] **Database** — replace `lib/mock-data.ts` with a real DB (Supabase/Postgres). Products, sessions, events, and orders are all hardcoded in memory right now.
- [ ] **Auth** — no login, no user accounts. Every visitor sees the same dashboard.
- [ ] **Wire Next.js → FastAPI** — the Next.js `generate-image` and `enhance-prompt` routes duplicate the FastAPI logic. Pick one and proxy to it.
- [ ] **`.env.local.example`** — root-level env example file is missing. Add it.

### Nice-to-have
- [ ] **Real tracking** — `/api/track` pushes to in-memory arrays (lost on restart). Needs a DB write.
- [ ] **Image storage** — generated images are returned as raw bytes and not saved anywhere. Add S3/R2/Supabase Storage.
- [ ] **Retire `lunarhack/`** — the Express prototype is superseded by the FastAPI backend.
- [ ] **Streaming from FastAPI** — image gen response is currently blocking. Add SSE or a job-queue pattern for long generations.
- [ ] **Deploy** — Next.js → Vercel, FastAPI → Railway / Render / Fly.io

---

## Data Flow

```
Browser
  └─ storefront / dashboard (Next.js)
       ├─ /api/chat              → OpenAI GPT-4o-mini (streaming)
       ├─ /api/marketing         → OpenAI GPT-4o-mini (structured output)
       ├─ /api/insights          → OpenAI GPT-4o-mini (streaming)
       ├─ /api/content-variants  → OpenAI GPT-4o-mini (streaming)
       ├─ /api/recommendations   → OpenAI GPT-4o-mini (streaming)
       ├─ /api/email-campaign    → OpenAI GPT-4o-mini (streaming)
       ├─ /api/qualify-lead      → OpenAI GPT-4o-mini + tool-calling
       ├─ /api/generate-image    → HuggingFace FLUX.1-schnell
       └─ /api/enhance-prompt    → Gemini 2.5 Flash Lite

FastAPI backend (localhost:8000)
  ├─ /api/generate-image    → HuggingFace FLUX.1-schnell (with retry/rate-limit)
  ├─ /api/enhance-prompt    → Gemini 2.5 Flash Lite
  └─ /api/generate-captions → Gemini 2.5 Flash Lite
```
