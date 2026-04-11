---
description: "Use when you need product context, scope, and domain terminology for Smart Business Suite."
applyTo: "**/*"
---

# Project Overview — Smart Business Suite
# Lunar Hack 2.0 · ATIA Club FST · April 11–12, 2026
# Domain: Perfume / Fragrance SME

---

## What This Project Is

Smart Business Suite is an AI-powered platform for perfume and fragrance SMEs. It gives any perfume shop owner the capabilities of a data science team, a sales agent, and a marketing department — unified in one system that speaks the language of the perfume industry (olfactory families, notes, sillage, occasion, season, TND pricing).

---

## Architecture in One Line

Single FastAPI monolith structured into three service folders that mirror microservice architecture, with PostgreSQL + pgvector for storage, Celery + Redis for background jobs, Redis Streams for cross-service events, and a Next.js 14 dashboard as the frontend.

---

## The Microservice Illusion

The codebase is organized into `service_analytics/`, `service_sales/`, and `service_marketing/`. Each folder has its own router, models, schemas, Celery tasks, and services directory — exactly as in a real microservice system. They communicate via Redis Streams events, not by importing from each other. The jury sees microservice architecture. The deployment is a single process.

---

## Three Pillars

### Pillar 1 — Analytics (service_analytics/)
The business owner uploads a monthly sales CSV. The system builds a knowledge graph from the data, detects KPI anomalies, and delivers:
- **Alarm cards**: severity-rated alerts with plain-language explanation and one specific recommended action
- **Insight cards**: AI-generated analysis of what happened and why, in perfume business context
- **Why drill-down**: owner clicks any card to get a deep LightRAG explanation

### Pillar 2 — Sales Agent (service_sales/)
A chat widget embedded on the perfume shop's website. Two modes:
- **Anonymous visitors**: FAQ-only mode, answers from the static FAQ the owner configured
- **Registered clients**: Full ReAct + HippoRAG intelligent agent — personalizes fragrance recommendations, scores the visitor as a lead, stores the conversation in the owner's dashboard

### Pillar 3 — Marketing Assistant (service_marketing/)
The owner fills a brief. The system:
1. Retrieves brand context via LightRAG
2. Generates 3 copy variants (professional / storytelling / playful)
3. Generates a perfume marketing image for each variant using FLUX.1 (Hugging Face)
4. Scores each variant with LLM-as-Judge on 4 dimensions
5. Owner selects a variant and sends it as an email campaign directly from the platform

---

## Research Papers

| Paper | Service | Role in the system |
|---|---|---|
| LightRAG (EMNLP 2025, arXiv:2410.05779) | Analytics + Marketing | Knowledge graph indexing + dual-level retrieval (specific entity + thematic pattern simultaneously) |
| AD-LLM (arXiv:2412.11142, Dec 2024) | Analytics | Zero-shot KPI anomaly detection — feeds metric deltas to LLM, outputs severity + explanation + action |
| ReAct (ICLR 2023, arXiv:2210.03629) | Sales | Agent reasoning loop — Thought → Act (tool) → Observe per message turn |
| HippoRAG (NeurIPS 2024, arXiv:2405.14831) | Sales | Long-term agent memory via knowledge graph + Personalized PageRank over past lead outcomes |
| B2B Lead Scoring (Frontiers AI, PMC11925937, Feb 2025) | Sales | 5-feature scoring formula adapted for perfume retail |
| MarketingFM (arXiv:2506.17863, Jun 2025) | Marketing | RAG-based content generation pipeline + LLM-as-Judge evaluation |
| CTG Instruction-Tuning Era (arXiv:2405.01490, 2024) | Marketing | Justifies 3-prompt tone control over fine-tuning |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui |
| Backend | FastAPI (monolith, 3 service folders) |
| Background jobs | Celery 5 + Redis |
| Event bus | Redis Streams |
| Database | PostgreSQL 16 + pgvector |
| ORM + migrations | SQLAlchemy 2.0 async + Alembic |
| LLM primary | Groq API — `llama-3.3-70b-versatile` |
| LLM fallback | OpenAI API — `gpt-4o-mini` |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| Image generation | Hugging Face Inference API — `black-forest-labs/FLUX.1-schnell` |
| Email | SMTP or SendGrid (switched via `EMAIL_PROVIDER` env var) |
| Auth | JWT — python-jose + passlib bcrypt |
| Local dev | Docker Compose |
| Deployment | Vercel (frontend) + Render (backend + Celery worker) |

---

## Users

| User | Logs into | Chatbot experience | What they do |
|---|---|---|---|
| Business Owner | Platform dashboard (JWT, 24h) | No chatbot — uses dashboard | Upload data, view alarms, manage leads, create campaigns, send emails |
| Registered Client | SME website (JWT widget token, 2h) | Full ReAct + HippoRAG agent | Chat for fragrance advice, gets personalized recommendations, scored as lead |
| Anonymous Visitor | Nobody | FAQ-only static answers | Ask basic questions (hours, stock, policy) |

---

## Alarm System Detail

Every KPI anomaly detected by AD-LLM becomes an alarm card on the owner's dashboard:

```
┌─────────────────────────────────────────────────────┐
│ 🔴 HIGH   Floral family revenue                     │
│           -35% vs last month                        │
│                                                     │
│ Your floral collection revenue dropped sharply.     │
│ Rose and jasmine EDPs were out of stock for 8 days  │
│ during the peak wedding season period.              │
│                                                     │
│ Recommended action:                                 │
│ Restock rose and jasmine EDPs immediately and       │
│ contact your 3 top floral buyers with an early      │
│ access offer for the next shipment.                 │
│                                                     │
│ 2 hours ago                          [Mark as read] │
└─────────────────────────────────────────────────────┘
```

Unread alarms show a notification dot in the sidebar. The owner can drill down into any alarm to get a deep LightRAG explanation linking related graph entities.

---

## Email Campaign Flow

```
Owner fills campaign brief
        ↓
System generates 3 copy variants + FLUX.1 perfume images
        ↓
LLM-as-Judge scores each variant (4 dimensions)
        ↓
Owner reviews variants, picks the best one
        ↓
Owner opens email modal → enters recipient list + edits subject
        ↓
System sends HTML email (copy + image) via SMTP or SendGrid
        ↓
email_campaigns row updated: status=sent, sent_at=now
```

---

## Cross-Service Intelligence Loop

```
[Sales] hot lead qualified — oriental family, 350 TND budget
    → publishes "lead_qualified" to Redis Stream
    → [Analytics] increments hot_leads_today KPI counter
    → [Marketing] auto-creates campaign brief for oriental family segment

[Analytics] anomaly detected — floral revenue -35%
    → generates alarm card with recommended action
    → publishes "insight_generated" to Redis Stream
    → [Marketing] (optional) suggests promotional floral campaign
```

---

## Quick Start

```bash
# 1. Copy and fill env vars
cp backend/.env.example backend/.env
# Required: DATABASE_URL, GROQ_API_KEY, OPENAI_API_KEY, HUGGINGFACE_API_KEY, JWT_SECRET_KEY
# For email: SMTP_* or SENDGRID_API_KEY

# 2. Start all infrastructure
docker-compose up --build

# 3. Create database schemas and tables
docker-compose exec backend alembic upgrade head

# 4. Start frontend
cd frontend && npm install && npm run dev

# 5. Open http://localhost:3000
# Register as business owner → complete onboarding wizard → upload sample CSV → explore
```

---

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app factory, all routers mounted |
| `backend/config.py` | All environment variables via pydantic-settings |
| `backend/shared/llm_client.py` | Only file that calls Groq/OpenAI — all LLM calls go here |
| `backend/shared/embeddings.py` | Only file that calls OpenAI embeddings |
| `backend/redis_streams.py` | publish_event() and consume_stream() for cross-service events |
| `backend/service_analytics/services/lightrag.py` | LightRAG indexing + dual retrieval over sales data |
| `backend/service_analytics/services/adllm.py` | AD-LLM anomaly detection + alarm generation |
| `backend/service_sales/services/react_agent.py` | ReAct loop orchestrator — the heart of the chatbot |
| `backend/service_sales/services/hipporag.py` | HippoRAG knowledge graph + PPR traversal |
| `backend/service_marketing/services/image_gen.py` | FLUX.1-schnell image generation |
| `backend/service_marketing/services/email_sender.py` | SMTP / SendGrid email dispatch |
| `frontend/components/analytics/AlarmCard.tsx` | Alarm card with severity badge + recommended action |
| `frontend/components/marketing/CopyVariantCard.tsx` | Copy + FLUX.1 image + scores + send button |
| `frontend/components/widget/ChatWidget.tsx` | Dual-mode chat widget (FAQ or full agent) |
