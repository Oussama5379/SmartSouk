---
description: "Use when you need product context, scope, and domain terminology for Aurea."
applyTo: "**/*"
---

# Project Overview — Aurea
# Lunar Hack 2.0 · ATIA Club FST · April 11–12, 2026
# Domain: Tunisian Artisanal Products (rugs, ceramics, oils)

---

## What This Project Is

Aurea is an AI-powered marketing and analytics platform for Tunisian artisanal product SMBs. It gives a shop owner AI-generated marketing campaigns, a sales chat agent, analytics insights, and email campaign tools — all in one dashboard.

The storefront sells 8 Tunisian handcrafted products (rugs, ceramics, oils). The dashboard is the owner's control panel.

---

## Architecture in One Line

Next.js 16 monorepo (frontend + serverless API routes) + a separate FastAPI Python backend for heavy AI work (image generation, prompt enhancement, captions).

---

## Three Pillars

### Pillar 1 — Analytics & Insights
- KPI overview (revenue, conversions, sessions — from mock data)
- AI insights: owner clicks "Generate Insights" → GPT-4o-mini analyzes mock analytics data → returns 3-4 actionable insight cards
- Product intelligence: cross-sell, upsell, at-risk product recommendations (GPT-4o-mini)
- Route: `POST /api/insights`, `POST /api/recommendations`

### Pillar 2 — Sales Intelligence Agent
- Floating chat widget on the storefront (`/`)
- GPT-4o-mini with streaming — knows the full product catalog (name, price, stock, description)
- Lead qualification with tool-calling (`scoreAndRecommend` tool)
- Route: `POST /api/chat`, `POST /api/qualify-lead`

### Pillar 3 — Marketing AI
- Campaign generator: product + goal → caption, hashtags, image prompt, strategy tip (GPT-4o-mini structured output)
- 3-tone content variants: Professional / Fun & Casual / Storytelling
- AI image generation: FLUX.1-schnell via HuggingFace (Next.js route + FastAPI route)
- Prompt enhancement: Gemini 2.5 Flash Lite rewrites rough ideas into production prompts
- Email campaign builder: 3-email sequences (Hook → Social Proof → Urgency)
- Routes: `/api/marketing`, `/api/content-variants`, `/api/generate-image`, `/api/enhance-prompt`, `/api/email-campaign`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui |
| Next.js API routes | Vercel AI SDK 6 — OpenAI GPT-4o-mini (streaming + structured output with Zod) |
| Python backend | FastAPI + Uvicorn · httpx · Pillow |
| Image generation | HuggingFace Inference API — FLUX.1-schnell (nscale provider) |
| Prompt/caption AI | Google Gemini 2.5 Flash Lite |
| Data | In-memory mock data — 8 products, 3 sessions, 6 events, 3 orders (no DB) |

---

## Users

| User | Where | What they do |
|---|---|---|
| Storefront visitor | `/` | Browses products, chats with AI sales agent |
| Business owner | `/dashboard` | Views analytics, generates campaigns, builds email sequences |

No authentication exists. Everyone sees the same data.

---

## Product Catalog (mock data in `lib/mock-data.ts`)

8 products across 3 categories:
- **Rugs**: Handwoven Berber Rug (150 TND), Kairouan Kilim Runner (220 TND)
- **Ceramics**: Nabeul Ceramic Vase (45 TND), Sejnane Pottery Bowl Set (80 TND), Guellala Ceramic Plate (55 TND, out of stock)
- **Oils**: Organic Olive Oil 1L (35 TND), Prickly Pear Seed Oil 30ml (95 TND), Argan Oil 100ml (65 TND)

---

## What Does NOT Exist Yet

- Real database (Supabase, Postgres, etc.)
- User authentication
- Image storage (generated images returned as raw bytes, not saved)
- Real session/event/order tracking (all in-memory, resets on restart)
- Email sending (only generates content, does not send)
