---
description: "Use when implementing features to align with product requirements and current scope."
applyTo: "**/*"
---

# Product Requirements — Aurea
# Lunar Hack 2.0 · ATIA Club FST · April 11–12, 2026
# Domain: Tunisian Artisanal Products

---

## Product Vision

Aurea gives Tunisian artisanal product shop owners the marketing and analytics capabilities of a full team — AI-generated campaigns, a sales chat agent, product intelligence, and email sequences — in one dashboard.

---

## Users

### Storefront Visitor (`/`)
- Browses 8 Tunisian handcrafted products
- Can open the floating chat widget and ask questions
- Chat agent knows the full product catalog and recommends items

### Business Owner (`/dashboard`)
- Views KPI overview (mock data)
- Generates AI marketing campaigns for any product
- Generates 3 content variants per campaign (Professional / Fun / Storytelling)
- Generates AI product images (FLUX.1-schnell)
- Builds 3-email sequences (Hook → Social Proof → Urgency)
- Views AI-generated analytics insights and product recommendations
- Views session/event tracking data (mock data)

No login. Anyone who opens the dashboard is the "owner."

---

## Features — Current State

### 1. Storefront (`/`)
- Product grid with 8 items, categories, prices in TND, stock status
- Floating chat widget (bottom-right)
- Chat: streaming GPT-4o-mini, knows full catalog, culturally aware (uses "Marhaba")

### 2. Dashboard Overview (`/dashboard`)
- KPI cards: revenue, conversions, sessions, AOV (from mock data)
- Quick links to sub-sections

### 3. Marketing AI (`/dashboard/marketing`)
- Select product + enter campaign goal → generates: Instagram caption, hashtags, image prompt, strategy tip
- "Generate Content Variants" → 3 tones, each with caption, hashtags, CTA, post timing, SEO keywords
- "Generate Image" → FLUX.1-schnell image from the AI-generated prompt

### 4. Product Intelligence (`/dashboard/recommendations`)
- "Generate Insights" → GPT-4o-mini analyzes mock sales data → returns upsell, cross-sell, at-risk, segment analysis

### 5. Email Campaigns (`/dashboard/email-campaigns`)
- Select campaign type + product + customer segment → 3-email sequence (streaming)
- Each email: subject, preview text, body copy, CTA
- Includes A/B suggestions and send timing

### 6. Analytics (`/dashboard/analytics`)
- KPI charts (recharts) — weekly visitors, page views, conversion rate, top products
- "Generate AI Insights" → GPT-4o-mini insight cards with priority levels
- All data from `lib/mock-data.ts`

### 7. User Tracking (`/dashboard/tracking`)
- Displays sessions, product events, conversion metrics
- Data from mock seed + any new events logged via `/api/track` (in-memory, resets on restart)

### 8. Products (`/dashboard/products`)
- Table view of all 8 products with category, price, stock status

### 9. Settings (`/dashboard/settings`)
- UI placeholder — no functional settings yet

---

## API Surface

| Route | Method | What it returns |
|---|---|---|
| `/api/chat` | POST | Streaming text — sales conversation |
| `/api/marketing` | POST | JSON — caption, hashtags, image_prompt, strategy_tip |
| `/api/content-variants` | POST | Streaming JSON array — 3 tone variants |
| `/api/insights` | POST | Streaming JSON array — 3-4 insight cards |
| `/api/recommendations` | POST | Streaming JSON — cross-sell/upsell analysis |
| `/api/email-campaign` | POST | Streaming JSON array — 3-email sequence |
| `/api/qualify-lead` | POST | Streaming text with tool-call — lead score + actions |
| `/api/generate-image` | POST | Raw image bytes (JPEG) |
| `/api/enhance-prompt` | POST | JSON — `{ prompt, provider }` |
| `/api/track` | POST | JSON — tracking confirmation |
| `/api/track` | GET | JSON — session/event/order counts |

FastAPI backend also exposes:
| Route | Method | What it returns |
|---|---|---|
| `/health` | GET | `{ ok: true }` |
| `/api/generate-image` | POST | Raw image bytes (JPEG) |
| `/api/enhance-prompt` | POST | JSON — `{ prompt, provider }` |
| `/api/generate-captions` | POST | JSON — `{ captions: [...] }` |

---

## Out of Scope (not built, not planned for hackathon)

- User authentication / login
- Real database (all data is mock)
- Actual email sending (content is generated only)
- Image storage (generated images not saved)
- Multi-tenant / multi-business support
- Arabic or French UI
- Mobile app
- Payment / checkout flow
- Real-time WebSocket push
- Celery, Redis, pgvector, LightRAG, AD-LLM, HippoRAG — none of these are implemented

---

## Actual Next Steps (priority order)

1. Add `.env.local.example` at repo root with all required env vars
2. Pick one image gen path — Next.js `/api/generate-image` and FastAPI `/api/generate-image` are duplicates
3. Add Supabase/Postgres to persist products, sessions, events, orders
4. Persist `/api/track` writes to real DB instead of in-memory arrays
5. Add image storage (Supabase Storage or R2) so generated images have a URL
6. Add auth (NextAuth or Supabase Auth) to separate storefront visitors from the owner dashboard
7. Retire `lunarhack/` — fully superseded
8. Deploy: Next.js → Vercel, FastAPI → Railway or Fly.io
