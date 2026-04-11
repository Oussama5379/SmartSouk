# Aurea — Feature Status

Real implementation status. No fluff.

---

## What's Working

### AI Chat — Sales Agent
- Floating chat widget on the storefront (`/`)
- GPT-4o-mini via Vercel AI SDK, streaming responses
- System prompt includes the full product catalog (8 products) so the model can recommend by name, price, stock status
- Route: `POST /api/chat`

### Marketing Campaign Generator
- Select a product + enter a campaign goal → GPT-4o-mini generates: Instagram caption, hashtags, image prompt, strategy tip
- Uses structured output (Zod schema) — response is always valid JSON
- Route: `POST /api/marketing`

### Content Variants
- Takes a product + audience + goal → returns 3 tone variants: Professional, Fun & Casual, Storytelling
- Each variant includes caption, hashtags, CTA, best posting time, SEO keywords
- Route: `POST /api/content-variants` (streaming)

### Email Campaign Builder
- Input: campaign type + product + customer segment
- Output: 3-email sequence (Hook → Social Proof → Urgency), each with subject, preview text, body copy, CTA, send timing, A/B suggestions
- Route: `POST /api/email-campaign` (streaming)

### AI Analytics Insights
- Sends analytics data to GPT-4o-mini, returns 3-4 actionable insights with priority levels
- Route: `POST /api/insights` (streaming)

### Product Recommendations
- Sends sales data + customer behavior → returns cross-sell, upsell, at-risk products, segment analysis
- Route: `POST /api/recommendations` (streaming)

### Lead Qualification
- GPT-4o-mini with tool-calling (`scoreAndRecommend` tool)
- Scores lead 1-10, recommends products, suggests next steps
- Route: `POST /api/qualify-lead` (streaming)

### Image Generation
- HuggingFace Inference API — FLUX.1-schnell model via nscale provider
- Rate limiting + exponential backoff + 4 retry attempts built in
- Available in two places:
  - Next.js route: `POST /api/generate-image`
  - FastAPI route: `POST /api/generate-image` (same logic, Python)

### Prompt Enhancement
- Gemini 2.5 Flash Lite rewrites a rough user idea into a production-ready image prompt
- Falls back to local template if Gemini is unavailable
- Available in two places:
  - Next.js route: `POST /api/enhance-prompt`
  - FastAPI route: `POST /api/enhance-prompt`

### Caption Generation (FastAPI only)
- Gemini 2.5 Flash Lite generates captions per tone (Professional / Fun / Storytelling) and per platform (Instagram, LinkedIn, Twitter, Facebook, TikTok)
- FastAPI route: `POST /api/generate-captions`

### Session / Event Tracking
- Tracks session start, page views, product views, add-to-cart, purchases
- Route: `POST /api/track`, `GET /api/track`
- **Caveat: in-memory only — data resets on server restart. Not persisted.**

---

## What's Mock / Placeholder

| Thing | Status |
|---|---|
| Product catalog | Hardcoded in `lib/mock-data.ts` — 8 products, no DB |
| Sessions / Events / Orders | Hardcoded seed data in `lib/mock-data.ts` |
| `/api/track` writes | Pushes to in-memory arrays — lost on restart |
| Dashboard KPI numbers | Derived from mock data, not real analytics |
| User authentication | Does not exist |
| Image storage | Images returned as raw bytes, nothing saved |

---

## FastAPI Backend

New Python backend at `backend/`. Runs separately on port 8000.

```
backend/
├── main.py
├── requirements.txt
├── .env.example
└── routers/
    ├── health.py       GET  /health
    ├── image.py        POST /api/generate-image
    │                   POST /api/enhance-prompt
    └── captions.py     POST /api/generate-captions
```

Start: `uvicorn main:app --reload --port 8000`  
Docs: `http://localhost:8000/docs`

---

## Actual Next Steps (priority order)

1. **Add `.env.local.example` at repo root** — OPENAI_API_KEY, HF_TOKEN, GEMINI_API_KEY, FASTAPI_URL are all undocumented for new devs
2. **Pick one image gen path** — Next.js `/api/generate-image` and FastAPI `/api/generate-image` are identical. Either proxy Next.js → FastAPI, or drop the FastAPI one for now
3. **Real database** — `lib/mock-data.ts` needs to become real Postgres/Supabase tables: `products`, `sessions`, `product_events`, `orders`
4. **Persist `/api/track`** — currently writes to a module-level array that resets on every cold start
5. **Image storage** — save generated images to S3/R2/Supabase Storage and return a URL instead of raw bytes
6. **Auth** — no login exists at all. Next.js middleware + Supabase Auth or NextAuth
7. **Retire `lunarhack/`** — standalone Express prototype, fully superseded by the Next.js app + FastAPI backend
8. **Deploy** — Next.js → Vercel, FastAPI → Railway or Fly.io
