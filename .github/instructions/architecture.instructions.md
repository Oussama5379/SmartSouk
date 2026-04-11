---
description: "Use when making architecture decisions, adding routes, or understanding service boundaries."
applyTo: "**/*"
---

# Architecture — Aurea

---

## System Overview

```
Browser
  └─ Next.js 16 (port 3000 or 3001)
       ├─ app/                   ← pages (storefront + dashboard)
       ├─ app/api/               ← serverless API routes (Next.js)
       │    ├─ chat              → OpenAI GPT-4o-mini (streaming)
       │    ├─ marketing         → OpenAI GPT-4o-mini (structured output)
       │    ├─ content-variants  → OpenAI GPT-4o-mini (streaming)
       │    ├─ insights          → OpenAI GPT-4o-mini (streaming)
       │    ├─ recommendations   → OpenAI GPT-4o-mini (streaming)
       │    ├─ email-campaign    → OpenAI GPT-4o-mini (streaming)
       │    ├─ qualify-lead      → OpenAI GPT-4o-mini + tool-calling
       │    ├─ generate-image    → HuggingFace FLUX.1-schnell
       │    └─ enhance-prompt    → Gemini 2.5 Flash Lite
       └─ lib/mock-data.ts       ← all data (hardcoded, no DB)

FastAPI backend (port 8000)
  └─ backend/
       ├─ routers/health.py      GET  /health
       ├─ routers/image.py       POST /api/generate-image
       │                         POST /api/enhance-prompt
       └─ routers/captions.py    POST /api/generate-captions
```

---

## Folder Structure

```
Aurea/
├── app/
│   ├── page.tsx                     # Storefront — product grid + chat widget
│   ├── layout.tsx                   # Root layout
│   ├── globals.css
│   ├── dashboard/
│   │   ├── layout.tsx               # Sidebar navigation
│   │   ├── page.tsx                 # KPI overview
│   │   ├── products/page.tsx
│   │   ├── marketing/page.tsx       # Campaign builder + image gen
│   │   ├── recommendations/page.tsx # Product intelligence
│   │   ├── email-campaigns/page.tsx # Email sequence builder
│   │   ├── analytics/page.tsx       # AI insights dashboard
│   │   ├── tracking/page.tsx        # Session/event tracking view
│   │   └── settings/page.tsx
│   └── api/
│       ├── chat/route.ts            # Vercel AI SDK streaming, GPT-4o-mini
│       ├── marketing/route.ts       # generateText + Zod structured output
│       ├── content-variants/route.ts
│       ├── insights/route.ts
│       ├── recommendations/route.ts
│       ├── email-campaign/route.ts
│       ├── qualify-lead/route.ts    # streamText + tool() with Zod schema
│       ├── generate-image/route.ts  # HuggingFace InferenceClient
│       ├── enhance-prompt/route.ts  # Gemini REST call
│       └── track/route.ts           # In-memory event logging
│
├── backend/                         # FastAPI Python backend
│   ├── main.py                      # App factory, CORS, router mounts
│   ├── requirements.txt
│   ├── .env.example
│   └── routers/
│       ├── __init__.py
│       ├── health.py
│       ├── image.py                 # generate-image + enhance-prompt
│       └── captions.py             # generate-captions
│
├── components/
│   ├── chat-widget.tsx              # Floating sales agent
│   └── ui/                          # shadcn/ui component library
│
├── hooks/
│   ├── use-mobile.ts
│   ├── use-session-tracking.ts
│   └── use-toast.ts
│
├── lib/
│   ├── mock-data.ts                 # Products, sessions, events, orders
│   └── utils.ts
│
├── lunarhack/                       # Legacy Express prototype — ignore
└── public/
```

---

## API Routes — Next.js

All routes live in `app/api/`. They use the Vercel AI SDK.

### Pattern: streaming text
```ts
import { streamText } from 'ai'

export async function POST(req: Request) {
  const result = streamText({ model: 'openai/gpt-4o-mini', prompt })
  return result.toTextStreamResponse()
}
```

### Pattern: structured output (Zod)
```ts
import { generateText, Output } from 'ai'
import { z } from 'zod'

const schema = z.object({ ... })
const result = await generateText({ model: 'openai/gpt-4o-mini', prompt, output: Output.object({ schema }) })
return Response.json(result.object)
```

### Pattern: streaming with tool-calling
```ts
import { streamText, tool } from 'ai'

const result = streamText({
  model: 'openai/gpt-4o-mini',
  system: '...',
  messages,
  tools: {
    myTool: tool({ description: '...', inputSchema: z.object({ ... }), execute: async (input) => ({ ... }) })
  }
})
return result.toTextStreamResponse()
```

---

## API Routes — FastAPI

FastAPI backend is separate. Runs on port 8000. Not proxied from Next.js yet — called directly by the frontend or used independently.

All routes are in `backend/routers/`. Each router file exports a FastAPI `APIRouter` and is mounted in `main.py`.

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import health, image, captions

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://localhost:3001"], ...)
app.include_router(health.router)
app.include_router(image.router, prefix="/api")
app.include_router(captions.router, prefix="/api")
```

---

## Data Layer

All data is in `lib/mock-data.ts`. No database.

```
Products     — 8 items, hardcoded
Sessions     — 3 seeded rows (mockSessions)
ProductEvents — 6 seeded rows (mockProductEvents)
Orders       — 3 seeded rows (mockOrders)
```

`/api/track` POST appends to these in-memory arrays. Data is lost on server restart.

**To add a real DB**: replace `lib/mock-data.ts` exports with Supabase/Prisma queries. The TypeScript interfaces (`Session`, `ProductEvent`, `Order`, `Product`) are already defined — they just need DB-backed implementations.

---

## Environment Variables

### Next.js (`.env.local`)
| Variable | Used by |
|---|---|
| `OPENAI_API_KEY` | All `/api/chat`, `/api/marketing`, etc. routes |
| `HF_TOKEN` | `/api/generate-image` |
| `GEMINI_API_KEY` | `/api/enhance-prompt` |
| `FASTAPI_URL` | Future: proxy Next.js → FastAPI |

### FastAPI (`backend/.env`)
| Variable | Used by |
|---|---|
| `HF_TOKEN` | `routers/image.py` — FLUX.1-schnell |
| `GEMINI_API_KEY` | `routers/image.py` (enhance-prompt), `routers/captions.py` |

---

## Duplication to Resolve

`/api/generate-image` and `/api/enhance-prompt` exist in both Next.js and FastAPI with identical logic. The plan is to proxy Next.js → FastAPI so only one implementation is maintained. Not done yet.
