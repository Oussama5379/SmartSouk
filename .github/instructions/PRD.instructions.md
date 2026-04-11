---
description: "Use when implementing features to align behavior with product requirements and user roles."
applyTo: "**/*"
---

# Product Requirements Document — Smart Business Suite
# Lunar Hack 2.0 · ATIA Club FST · April 11–12, 2026
# Domain: Perfume / Fragrance SME

---

## 1. Product Vision

Smart Business Suite is an AI-powered platform built for perfume and fragrance SMEs. It gives any perfume shop owner or boutique fragrance brand the intelligence of a data science team, a sales agent, and a marketing department — without hiring any of them. The platform unifies data analytics, sales qualification, and marketing automation into one system that understands the perfume industry: product families (floral, woody, oriental, fresh), seasonal sales patterns, customer fragrance preferences, and the language of scent.

---

## 2. Domain Context — Perfume Industry

All AI prompts, knowledge graph entities, lead scoring signals, and marketing copy generation are perfume-aware.

**Product entities the system understands:**
- Fragrance name, olfactory family (floral / woody / oriental / fresh / chypre / fougère)
- Top / middle / base notes
- Concentration (EDP / EDT / EDC / parfum)
- Gender classification (masculine / feminine / unisex)
- Bottle size in ml, price in TND
- Brand origin (niche / designer / local)

**Customer signals the agent extracts:**
- Stated preference for note families or specific ingredients (oud, rose, musk, vanilla, citrus)
- Occasion: daily wear / evening / gift / wedding / Eid
- Budget stated in TND
- Skin chemistry mentions ("perfumes fade on me fast")
- Loyalty signals: repeat buyer, gift buyer, collector

**Seasonal context injected into anomaly detection:**
- Eid al-Adha, Eid al-Fitr, Valentine's Day, Mother's Day, and wedding season are expected revenue spikes — the AD-LLM prompt is given this context so it does not flag seasonal peaks as anomalies

**Marketing language:**
- Copy uses sensory and emotional vocabulary: notes, sillage, longevity, mood, memory, occasion, warmth, freshness, depth
- Platform-adapted: Instagram (visual + sensory storytelling), Email (loyalty and narrative), SMS (flash offer, direct)

---

## 3. Users & Roles

### 3.1 Business Owner (the only login role on the platform)
The perfume shop owner or brand manager.

**Capabilities:**
- Upload monthly sales CSV (columns: date, product_name, olfactory_family, concentration, bottle_size_ml, price_tnd, quantity_sold, customer_id, customer_type, channel)
- View KPI dashboard: revenue (TND), units sold, top fragrance family, average basket (TND), conversion rate, repeat customer rate, top 5 products
- Receive alarm notifications when KPIs are anomalous — each alarm includes severity, explanation, and one specific recommended action
- View all qualified leads: tier badge, score, fragrance preference, stated budget, transcript
- Configure lead score thresholds and FAQ entries (store hours, return policy, fragrance consultation availability, stock questions)
- Create marketing campaigns: brief → 3 AI-generated copy variants + AI-generated perfume images via FLUX.1 → select variant → send as email campaign
- Upload brand guidelines, past Instagram posts, product catalog, tone guide
- Complete onboarding wizard on first login to seed the knowledge graph

### 3.2 Registered Client (the shop's loyalty customer)
A customer with an account on the perfume shop's website or loyalty program.

**Capabilities:**
- Chat with the full ReAct + HippoRAG intelligent agent
- Receive personalized fragrance recommendations (product name, notes, why it fits them)
- Be scored and tiered as a lead
- Their conversation and lead profile appear in the owner's dashboard

### 3.3 Anonymous Visitor
Anyone who opens the chat widget without being logged in.

**Capabilities:**
- Ask questions answered only from the static FAQ list configured by the owner
- Examples: "Do you have Baccarat Rouge 540?", "What are your opening hours?", "Do you offer gift wrapping?"
- No LLM reasoning, no graph access, no lead scoring
- Unknown question fallback: "For personalized fragrance advice, visit us or email [address]."

---

## 4. Feature Requirements Per Pillar

### Pillar 1 — Analytics Service

| Feature | Description |
|---|---|
| CSV Upload | Upload monthly sales file → triggers Celery pipeline → parse → graph index → anomaly detection → insight generation |
| KPI Dashboard | Revenue (TND), units sold, top olfactory family, average basket, conversion rate, new vs returning ratio, top 5 fragrances |
| Knowledge Graph | LightRAG graph: entities = fragrances, customers, olfactory families, seasons, channels. Relationships = sold_to, belongs_to_family, peaks_in_season, frequently_bought_with |
| Insight Cards | AI-generated plain language cards. Example: "Oriental family sales dropped 22%. Your two best-selling ouds were out of stock for 11 days." |
| Anomaly Detection | AD-LLM zero-shot detection. KPI deltas fed to LLM with perfume-domain + seasonal context. Outputs structured JSON array of anomaly objects. |
| Alarm System | Each anomaly → one alarm card: severity badge (high=red / medium=orange / low=blue), metric name, deviation %, 2–3 sentence explanation, one specific recommended action. Unread alarms show a notification dot in the sidebar. |
| Why Drill-Down | Owner clicks insight card → LightRAG dual retrieval → detailed explanation linking fragrances, customer segments, and seasons |
| Proactive Advice | "3 VIP customers haven't purchased in 45 days — consider a re-engagement offer for their preferred oud family" |

### Pillar 2 — Sales Agent Service

| Feature | Description |
|---|---|
| Chat Widget | Embeddable JS snippet. Detects JWT on load → routes to FAQ mode or full agent mode |
| Dual Mode | No token → FAQ only (static lookup). Valid JWT → ReAct + HippoRAG full agent |
| ReAct Loop | Thought → Act (tool call) → Observe → repeat until generate_pitch is called |
| HippoRAG Memory | Past lead outcomes stored as triples. PPR traversal finds chains of similar past customers and what converted them |
| Lead Scoring | 5-feature formula: source channel + fragrance family affinity + purchase authority (self vs gift) + urgency + stated budget (TND) → score 0–100 |
| Lead Tiers | Hot >75: ready to buy, knows what they want. Warm 40–75: exploring, needs guidance. Cold <40: browsing, no clear intent |
| Personalized Recommendation | Agent recommends specific fragrance by name, olfactory family, key notes, occasion fit, and price in TND |
| Lead Dashboard | Owner sees: tier badge, score, preferred family, budget, recommended product, full transcript |
| Onboarding Graph Seeding | First-login wizard → owner enters product catalog → each fragrance becomes a graph node |
| Client Node | Registered client first chat → node created from purchase history + stated preferences |

**4 Agent Tools:**
1. `classify_intent(message)` → intent: browsing / seeking_recommendation / ready_to_buy / gift_shopping + confidence score
2. `retrieve_similar_leads(entities)` → HippoRAG PPR over kg_triples → top-3 past customers with similar profile + conversion outcome
3. `score_lead(profile)` → weighted formula → 0–100 score + tier label
4. `generate_pitch(family, occasion, budget_tnd)` → LightRAG on product KB → fragrance name + notes + why it fits + price

### Pillar 3 — Marketing Assistant Service

| Feature | Description |
|---|---|
| Campaign Brief Form | Product/family, target audience, platform (instagram/email/sms), tone |
| Brand Context Retrieval | LightRAG retrieval from brand_context table → past posts, tone guide, product descriptions |
| 3 Tone Variants | Professional (elegant, sophisticated), Storytelling (sensory narrative, memory-evoking), Playful (casual, emoji-friendly, trending) |
| FLUX.1 Image Generation | After each variant is generated: derive a visual prompt from the copy tone + product notes → call Hugging Face FLUX.1-schnell → return generated perfume image URL |
| LLM-as-Judge | Score each variant 0–10 on: fluency, relevance to perfume brand, brand alignment, CTR proxy. Show score breakdown + judge reasoning to owner. |
| Email Sending | Owner selects variant → enters recipient list or selects from registered_clients → system sends HTML email (copy + FLUX.1 image embedded) via SMTP or SendGrid |
| Auto-trigger | When hot lead qualified → Redis Stream event → system auto-creates pre-filled campaign brief for that lead's fragrance family and budget segment |
| Brand Upload | Owner uploads: past posts, tone guidelines, product catalog PDF, brand color palette description |

**Email campaign detail:**
- Subject: auto-generated from copy variant, editable before sending
- HTML body: rendered template with caption text, hashtags, and FLUX.1 image
- Recipient list: manually typed addresses or pulled from registered_clients table for the business
- Status tracking: pending / sent / failed with error message on failure

---

## 5. Cross-Service Intelligence Loop

```
[Sales Service]
Hot lead qualified — oriental family, 350 TND budget
        ↓  publishes → "lead_qualified" stream
[Analytics] → increments hot_leads_today KPI
[Marketing] → auto-creates campaign brief: oriental collection, high-budget segment

[Analytics Service]
Anomaly detected — floral family revenue -35% vs last month
        ↓  generates alarm card (severity=high, recommended action)
        ↓  publishes → "insight_generated" stream
[Marketing] → (optional) suggests promotional campaign for floral collection
```

---

## 6. Architecture Decision — Monolith with Microservice Structure

The application runs as a **single FastAPI monolith** for hackathon deployment simplicity. The codebase is structured into three independent service folders (`service_analytics/`, `service_sales/`, `service_marketing/`) that mirror microservice architecture exactly in their internal design, naming, and boundaries. Cross-service communication uses Redis Streams — the same pattern used in a real microservice deployment, without the network hop.

This structure allows demonstrating microservice architecture thinking to the jury while running and deploying as a single process.

---

## 7. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| LLM (primary) | Groq API — `llama-3.3-70b-versatile` |
| LLM (fallback) | OpenAI API — `gpt-4o-mini` |
| Image generation | Hugging Face Inference API — `black-forest-labs/FLUX.1-schnell` |
| Embeddings | OpenAI `text-embedding-3-small` — 1536 dims |
| Email sending | SMTP or SendGrid — switched via `EMAIL_PROVIDER` env var |
| Background tasks | Celery 5 + Redis — LLM calls, graph indexing, image generation, email sending all async |
| Event bus | Redis Streams — streams: `lead_qualified`, `insight_generated` |
| Database | PostgreSQL 16 + pgvector — schemas: `auth`, `analytics`, `sales`, `marketing` |
| ORM + migrations | SQLAlchemy 2.0 async + Alembic |
| Auth | JWT via python-jose + passlib bcrypt — 24h owner tokens, 2h client widget tokens |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Local dev | Docker Compose |
| Deployment | Vercel (frontend) + Render (backend + worker) |

---

## 8. Out of Scope

- Payment / subscription management
- Real-time WebSocket push (10s polling is acceptable for demo)
- Mobile app
- Fine-tuning any model
- Arabic or French UI (English only for demo)
- Inventory management
