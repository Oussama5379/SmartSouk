---
description: "Use when making architecture decisions, service boundaries, and integration choices."
applyTo: "**/*"
---

# Architecture Instructions — Smart Business Suite
# Domain: Perfume SME

---

## 1. System Architecture Overview

The system is a **single FastAPI monolith** structured internally as three independent service modules that mirror microservice architecture. One running process, one PostgreSQL database, one Redis instance, one Celery worker pool. The folder boundaries and Redis Streams communication pattern are identical to what a real microservice deployment would use.

```
┌──────────────────────────────────────────────────────────┐
│                  Next.js 14 Frontend                     │
│         Vercel · App Router · TypeScript · Tailwind      │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTP REST
┌─────────────────────────▼────────────────────────────────┐
│              FastAPI Monolith  (Render)                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │               API Gateway Layer                    │  │
│  │  /api/v1/auth/**        → auth router              │  │
│  │  /api/v1/analytics/**   → analytics router         │  │
│  │  /api/v1/sales/**       → sales router             │  │
│  │  /api/v1/marketing/**   → marketing router         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │service_analyt│ │ service_sales│ │service_marketing│  │
│  │ics/          │ │              │ │                 │  │
│  │ router.py    │ │ router.py    │ │ router.py       │  │
│  │ models.py    │ │ models.py    │ │ models.py       │  │
│  │ schemas.py   │ │ schemas.py   │ │ schemas.py      │  │
│  │ tasks.py     │ │ tasks.py     │ │ tasks.py        │  │
│  │ services/    │ │ services/    │ │ services/       │  │
│  │  lightrag    │ │  react_agent │ │  lightrag       │  │
│  │  adllm       │ │  hipporag    │ │  marketingfm    │  │
│  │  anomaly     │ │  lead_scorer │ │  image_gen      │  │
│  │  csv_parser  │ │  faq         │ │  email_sender   │  │
│  │  insight_gen │ │  intent_cls  │ │  llm_judge      │  │
│  │              │ │  pitch_gen   │ │  tone_ctrl      │  │
│  └──────┬───────┘ └──────┬───────┘ └────────┬────────┘  │
│         │                │                  │           │
│  ┌──────▼────────────────▼──────────────────▼────────┐  │
│  │           Shared Celery Worker Pool               │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼──────┐ ┌───────▼────────┐ ┌────▼───────────┐
│  PostgreSQL 16  │ │    Redis 7     │ │ External APIs  │
│  + pgvector     │ │ ┌────────────┐ │ │                │
│                 │ │ │Celery Queue│ │ │ Groq API       │
│  schema: auth   │ │ └────────────┘ │ │ OpenAI API     │
│  schema: analyt │ │ ┌────────────┐ │ │ HuggingFace    │
│  schema: sales  │ │ │Redis Stream│ │ │ FLUX.1-schnell │
│  schema: market │ │ │lead_qualif │ │ │ SMTP/SendGrid  │
│                 │ │ │insight_gen │ │ │                │
└─────────────────┘ │ └────────────┘ │ └────────────────┘
                    └────────────────┘
```

---

## 2. Full Folder Structure

```
smart-business-suite/
│
├── .github/
│   └── instructions/
│       ├── PRD.instructions.md
│       ├── architecture.instructions.md
│       ├── coding-standards.instructions.md
│       └── overview.instructions.md
│
├── backend/
│   ├── main.py                        # FastAPI app factory, registers all routers, CORS, exception handlers
│   ├── config.py                      # pydantic-settings Settings class — all env vars loaded here
│   ├── database.py                    # SQLAlchemy async engine + session factory + Base
│   ├── celery_app.py                  # Celery app instance, beat schedule, autodiscover tasks
│   ├── redis_streams.py               # publish_event(), consume_stream() helpers for Redis Streams
│   ├── dependencies.py                # get_db, get_current_owner, get_current_client, optional_auth
│   │
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── router.py                  # POST /auth/register, /auth/login, /auth/widget-token
│   │   ├── models.py                  # BusinessOwner, RegisteredClient ORM models (schema: auth)
│   │   ├── schemas.py                 # RegisterIn, LoginIn, TokenOut, RegisteredClientIn
│   │   └── services.py                # create_owner(), authenticate(), create_widget_token(), hash/verify password
│   │
│   ├── service_analytics/
│   │   ├── __init__.py
│   │   ├── router.py                  # All /api/v1/analytics/** endpoints
│   │   ├── models.py                  # KPISnapshot, InsightCard, GraphEntity, AnomalyEvent ORM models
│   │   ├── schemas.py                 # All Pydantic In/Out schemas for analytics
│   │   ├── tasks.py                   # Celery tasks: process_csv_upload, run_full_analytics_pipeline
│   │   ├── events.py                  # Redis Streams consumer for this service + event handlers
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── csv_parser.py          # Parse uploaded CSV → list of KPISnapshot dicts
│   │       ├── lightrag.py            # LightRAG: extract entities, build graph, dual-level retrieval
│   │       ├── adllm.py               # AD-LLM: compute KPI deltas, build prompt, call LLM, parse anomalies
│   │       ├── anomaly.py             # Alarm generation: classify severity, generate recommended_action
│   │       └── insight_generator.py   # LightRAG retrieval → LLM → InsightCard text
│   │
│   ├── service_sales/
│   │   ├── __init__.py
│   │   ├── router.py                  # All /api/v1/sales/** endpoints
│   │   ├── models.py                  # Conversation, LeadProfile, KGTriple, LeadScore, FAQEntry ORM models
│   │   ├── schemas.py                 # ChatIn, ChatOut, LeadOut, FAQEntryIn, RegisteredClientIn
│   │   ├── tasks.py                   # Celery tasks: index_lead_to_graph, embed_faq_entry
│   │   ├── events.py                  # Redis Streams publisher for lead_qualified
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── react_agent.py         # ReAct orchestrator: Thought/Act/Observe loop, tool dispatch
│   │       ├── hipporag.py            # HippoRAG: store triples, build adjacency, run PPR, return top-k
│   │       ├── lead_scorer.py         # B2B scoring formula for perfume retail (5 features → 0-100)
│   │       ├── faq.py                 # FAQ mode: embed query, cosine search faq_entries, return best match
│   │       ├── intent_classifier.py   # classify_intent() tool: LLM prompt → intent + confidence
│   │       └── pitch_generator.py     # generate_pitch() tool: LightRAG on product KB → fragrance recommendation
│   │
│   ├── service_marketing/
│   │   ├── __init__.py
│   │   ├── router.py                  # All /api/v1/marketing/** endpoints
│   │   ├── models.py                  # Campaign, GeneratedCopy, BrandContext, EvalScore, EmailCampaign ORM models
│   │   ├── schemas.py                 # CampaignCreateIn, CopyVariantOut, EmailSendIn, BrandContextIn
│   │   ├── tasks.py                   # Celery tasks: run_marketing_pipeline, send_email_campaign_task
│   │   ├── events.py                  # Redis Streams consumer for lead_qualified + insight_generated
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── lightrag.py            # LightRAG on brand_context (same algorithm, different data domain)
│   │       ├── marketingfm.py         # MarketingFM pipeline: retrieve context → generate 3 variants
│   │       ├── tone_controller.py     # 3 tone prompts: professional / storytelling / playful
│   │       ├── llm_judge.py           # LLM-as-Judge: score each variant on 4 dimensions, return breakdown
│   │       ├── image_gen.py           # Derive visual prompt from copy → call FLUX.1-schnell → return image URL
│   │       └── email_sender.py        # SMTP or SendGrid dispatch, HTML template rendering
│   │
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── llm_client.py              # Groq primary + OpenAI fallback, chat_completion() unified interface
│   │   ├── embeddings.py              # get_embedding() via OpenAI text-embedding-3-small
│   │   └── graph_utils.py             # PPR implementation, triple formatting, adjacency list builder
│   │
│   ├── alembic/
│   │   ├── env.py                     # Alembic environment — imports all models, uses async engine
│   │   └── versions/                  # Auto-generated migration files
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx             # Sidebar nav + top bar + alarm notification dot
│   │   │   ├── page.tsx               # KPI overview + unread alarm cards + recent insights
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx           # Full analytics: KPI charts + all insight cards + alarm list
│   │   │   ├── leads/
│   │   │   │   └── page.tsx           # Lead table + tier filter + transcript drawer
│   │   │   └── marketing/
│   │   │       └── page.tsx           # Campaign form + variant cards + image display + email modal
│   │   ├── onboarding/
│   │   │   └── page.tsx               # First-login wizard: business profile + product catalog + FAQ setup
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── analytics/
│   │   │   ├── KPICard.tsx
│   │   │   ├── AlarmCard.tsx          # Severity badge + explanation + recommended_action + mark-read button
│   │   │   ├── InsightCard.tsx        # Insight text + "Why?" button
│   │   │   └── KPIChart.tsx           # Recharts line/bar chart
│   │   ├── leads/
│   │   │   ├── LeadTable.tsx
│   │   │   ├── LeadTierBadge.tsx      # Hot/Warm/Cold colored badge
│   │   │   └── TranscriptDrawer.tsx   # Slide-in panel with full conversation
│   │   ├── marketing/
│   │   │   ├── CampaignForm.tsx       # Brief input form
│   │   │   ├── CopyVariantCard.tsx    # Copy text + FLUX.1 image + score breakdown + select/send buttons
│   │   │   ├── ScoreBreakdown.tsx     # 4-dimension score bars + judge reasoning text
│   │   │   └── EmailSendModal.tsx     # Recipient list input + subject field + send button
│   │   ├── onboarding/
│   │   │   ├── BusinessProfileStep.tsx
│   │   │   ├── ProductCatalogStep.tsx
│   │   │   └── FAQSetupStep.tsx
│   │   └── widget/
│   │       └── ChatWidget.tsx         # Embeddable chat UI — detects token → renders FAQ or agent mode
│   │
│   ├── lib/
│   │   ├── api.ts                     # Axios instance with JWT interceptor
│   │   └── auth.ts                    # Token storage, decode, refresh helpers
│   │
│   ├── types/
│   │   ├── analytics.ts               # KPISnapshot, InsightCard, AnomalyEvent interfaces
│   │   ├── sales.ts                   # LeadProfile, Conversation, FAQEntry interfaces
│   │   └── marketing.ts               # Campaign, GeneratedCopy, EvalScore, EmailCampaign interfaces
│   │
│   ├── public/
│   │   └── widget.js                  # Standalone bundle — embeddable on any SME website via <script>
│   │
│   ├── package.json
│   └── next.config.ts
│
├── docker-compose.yml
└── README.md
```

---

## 3. Database Schemas

### Schema: auth

```sql
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.business_owners (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE NOT NULL,
    hashed_password     TEXT NOT NULL,
    business_name       TEXT NOT NULL,
    business_sector     TEXT DEFAULT 'perfume',
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.registered_clients (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID NOT NULL REFERENCES auth.business_owners(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL,
    name             TEXT,
    email            TEXT,
    preferences      JSONB DEFAULT '{}',
    graph_node_id    TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, external_user_id)
);
```

### Schema: analytics

```sql
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.kpi_snapshots (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id          UUID NOT NULL,
    period_start         DATE NOT NULL,
    period_end           DATE NOT NULL,
    revenue_tnd          NUMERIC(12,2),
    units_sold           INTEGER,
    conversion_rate      NUMERIC(5,4),
    avg_basket_tnd       NUMERIC(10,2),
    top_family           TEXT,
    top_product          TEXT,
    new_customers        INTEGER,
    returning_customers  INTEGER,
    raw_data             JSONB,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics.graph_entities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL,
    entity_name   TEXT NOT NULL,
    entity_type   TEXT CHECK (entity_type IN ('product','customer','family','season','channel','brand')),
    description   TEXT,
    relationships JSONB DEFAULT '{}',
    embedding     VECTOR(1536),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics.insight_cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         UUID NOT NULL,
    trigger             TEXT NOT NULL,
    severity            TEXT CHECK (severity IN ('low','medium','high')),
    affected_entities   JSONB,
    insight_text        TEXT NOT NULL,
    recommended_action  TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics.anomaly_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         UUID NOT NULL,
    kpi_name            TEXT NOT NULL,
    expected_value      NUMERIC,
    actual_value        NUMERIC,
    deviation_percent   NUMERIC,
    severity            TEXT CHECK (severity IN ('low','medium','high')),
    explanation         TEXT NOT NULL,
    recommended_action  TEXT NOT NULL,
    is_read             BOOLEAN DEFAULT FALSE,
    detected_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema: sales

```sql
CREATE SCHEMA IF NOT EXISTS sales;

CREATE TABLE sales.faq_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    embedding   VECTOR(1536),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales.conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL,
    business_id UUID NOT NULL,
    client_id   UUID REFERENCES auth.registered_clients(id),
    is_anonymous BOOLEAN DEFAULT TRUE,
    role        TEXT CHECK (role IN ('user','assistant')),
    content     TEXT NOT NULL,
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales.lead_profiles (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id           TEXT NOT NULL,
    business_id          UUID NOT NULL,
    client_id            UUID REFERENCES auth.registered_clients(id),
    preferred_family     TEXT,
    stated_occasion      TEXT,
    budget_tnd           NUMERIC,
    decision_authority   BOOLEAN,
    urgency              TEXT CHECK (urgency IN ('browsing','seeking_recommendation','ready_to_buy','gift_shopping')),
    recommended_product  TEXT,
    score                INTEGER CHECK (score >= 0 AND score <= 100),
    lead_tier            TEXT CHECK (lead_tier IN ('hot','warm','cold')),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales.kg_triples (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    subject     TEXT NOT NULL,
    predicate   TEXT NOT NULL,
    object      TEXT NOT NULL,
    context     JSONB DEFAULT '{}',
    embedding   VECTOR(1536),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales.lead_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      TEXT NOT NULL,
    source_weight   NUMERIC,
    family_weight   NUMERIC,
    urgency_weight  NUMERIC,
    authority_weight NUMERIC,
    budget_weight   NUMERIC,
    total_score     NUMERIC,
    computed_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema: marketing

```sql
CREATE SCHEMA IF NOT EXISTS marketing;

CREATE TABLE marketing.campaigns (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID NOT NULL,
    product_name     TEXT,
    fragrance_family TEXT,
    target_audience  TEXT,
    platform         TEXT CHECK (platform IN ('instagram','email','sms','linkedin')),
    tone_requested   TEXT,
    trigger_source   TEXT CHECK (trigger_source IN ('manual','auto_lead_event','auto_insight_event')),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing.generated_copy (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id       UUID NOT NULL REFERENCES marketing.campaigns(id) ON DELETE CASCADE,
    variant_index     INTEGER CHECK (variant_index IN (1,2,3)),
    tone              TEXT,
    caption_text      TEXT NOT NULL,
    hashtags          TEXT[],
    recommended_time  TEXT,
    image_url         TEXT,
    image_prompt      TEXT,
    quality_score     NUMERIC,
    selected_by_user  BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing.brand_context (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID NOT NULL,
    content_type TEXT CHECK (content_type IN ('tone_guide','past_post','product_info','target_audience','brand_identity')),
    content_text TEXT NOT NULL,
    embedding    VECTOR(1536),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing.eval_scores (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copy_id               UUID NOT NULL REFERENCES marketing.generated_copy(id) ON DELETE CASCADE,
    fluency_score         NUMERIC CHECK (fluency_score >= 0 AND fluency_score <= 10),
    relevance_score       NUMERIC CHECK (relevance_score >= 0 AND relevance_score <= 10),
    brand_alignment_score NUMERIC CHECK (brand_alignment_score >= 0 AND brand_alignment_score <= 10),
    ctr_proxy_score       NUMERIC CHECK (ctr_proxy_score >= 0 AND ctr_proxy_score <= 10),
    total_score           NUMERIC,
    judge_reasoning       TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing.email_campaigns (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id    UUID NOT NULL REFERENCES marketing.campaigns(id),
    copy_id        UUID NOT NULL REFERENCES marketing.generated_copy(id),
    recipient_list TEXT[] NOT NULL,
    subject        TEXT NOT NULL,
    sent_at        TIMESTAMPTZ,
    status         TEXT CHECK (status IN ('pending','sent','failed')) DEFAULT 'pending',
    error_message  TEXT
);
```

---

## 4. Redis Streams Event Bus

### Streams

| Stream key | Published by | Consumed by | Payload fields |
|---|---|---|---|
| `lead_qualified` | service_sales | service_analytics, service_marketing | `business_id, session_id, preferred_family, budget_tnd, score, lead_tier` |
| `insight_generated` | service_analytics | service_marketing (optional) | `business_id, insight_id, severity, affected_kpi` |

### Publisher pattern (in `redis_streams.py`)
```python
async def publish_event(stream: str, payload: dict) -> None:
    await redis.xadd(stream, {k: str(v) for k, v in payload.items()})
```

### Consumer pattern (in each `service_*/events.py`)
```python
# Each service registers its own consumer group
# Celery beat task polls every 5 seconds
async def consume_lead_qualified_events() -> None:
    messages = await redis.xreadgroup(
        groupname="marketing_service",
        consumername="worker_1",
        streams={"lead_qualified": ">"},
        count=10,
        block=5000
    )
    for stream, msgs in messages:
        for msg_id, data in msgs:
            await handle_lead_qualified(data)
            await redis.xack("lead_qualified", "marketing_service", msg_id)
```

---

## 5. Algorithm Implementations

### LightRAG (used in service_analytics and service_marketing)

Two phases — indexing and retrieval. Called from different services on different data but the algorithm is identical.

**Indexing** (runs after CSV upload in analytics, after brand upload in marketing):
```
input: raw text / structured rows
  → LLM prompt: "Extract all entities (name, type, description) and relationships (source, relation, target) from this text. Return JSON."
  → parse → for each entity: get_embedding(description) → insert into graph_entities
  → for each relationship: update graph_entities[source].relationships += {target: relation}
```

**Retrieval** (runs when generating insight card or marketing copy):
```
input: query string
  → Low-level path: get_embedding(query) → cosine search graph_entities.embedding → top-5 specific entities
  → High-level path: LLM("What conceptual patterns or themes relate to: {query}? Return keywords.") → embed keywords → cosine search → top-5 thematic patterns
  → merge results → deduplicate → format as context string
  → return context string (injected into LLM prompt for final generation)
```

### AD-LLM (service_analytics only)

```
input: current_snapshot, previous_snapshot (both KPISnapshot rows)
  → compute deltas for each KPI field: deviation_percent = ((current - prev) / prev) * 100
  → inject seasonal context: check if current period overlaps known peak seasons (Eid, Valentine, Mother's Day)
  → build structured prompt:
      "You are a business analyst for a perfume shop.
       Here are KPI changes vs last period:
       - Revenue (TND): {delta}% [NOTE: Eid season expected +40%]
       - Units sold: {delta}%
       - Top family performance: {details}
       ...
       Identify anomalous metrics. For each: rate severity (low/medium/high),
       explain in 2 sentences in perfume business context,
       give one specific action the shop owner should take.
       Return JSON array: [{kpi_name, severity, explanation, recommended_action}]"
  → call LLM (json_mode=True)
  → parse → insert each item into anomaly_events table
  → publish insight_generated event to Redis Stream
```

### ReAct Agent (service_sales only)

```
receive_message(session_id, content, auth_mode)
  if auth_mode == "anonymous":
    return faq_lookup(content)

  # Full ReAct loop for registered clients
  history = load_conversation_history(session_id)  # last 10 turns
  lead_profile = load_or_create_lead_profile(session_id)

  for turn in range(max_turns=6):
    thought = llm(system=REACT_SYSTEM_PROMPT, messages=history + [{"role":"user","content":f"Think: what do I know about this visitor and what do I need to ask or do next?"}])
    action_json = llm(messages=history + [thought, {"role":"user","content":"Now decide: which tool to call? Options: classify_intent, retrieve_similar_leads, score_lead, generate_pitch. Return JSON {tool, args}."}])
    action = parse_json(action_json)
    observation = dispatch_tool(action.tool, action.args)
    history.append(thought, action_json, observation)

    if action.tool == "generate_pitch":
      break

  final_response = llm(messages=history + [{"role":"user","content":"Now write your response to the customer based on all observations."}])
  save_conversation(session_id, final_response)
  if lead_profile.score > threshold:
    publish_event("lead_qualified", lead_profile)
  return final_response
```

### HippoRAG (service_sales only)

**Storage** — after each qualifying conversation:
```python
# Example triples added for a completed conversation
("loyal_customer_segment", "prefers_family", "oriental")
("oriental_buyer", "has_budget", "300-500_tnd")
("oriental_buyer_300tnd", "converted_with", "oud_al_sahara_edp")
("gift_shopper", "converted_with", "rose_collection_gift_set")
```

**Retrieval** — Personalized PageRank:
```
input: current visitor entity mentions (e.g. ["oriental", "gift", "300 TND"])
  → for each entity: get_embedding(entity) → cosine search kg_triples.(subject+object embedding) → find seed node IDs
  → build adjacency dict from all kg_triples for this business_id
  → run PPR:
      scores = {node: 1/len(seeds) if node in seeds else 0 for all nodes}
      for iteration in range(20):
        new_scores = {}
        for node in all_nodes:
          new_scores[node] = (1 - alpha) * teleport(node, seeds) + alpha * sum(scores[neighbor] / out_degree(neighbor) for neighbor in in_neighbors(node))
        scores = new_scores  # alpha = 0.85
  → return top-3 nodes by final PPR score → format as "past customer patterns" context
```

### FLUX.1 Image Generation (service_marketing only)

```python
async def generate_marketing_image(
    caption_text: str,
    fragrance_family: str,
    tone: str,
    platform: str
) -> str:
    # Step 1: derive a visual prompt from the copy
    visual_prompt = await llm_client.chat_completion(
        messages=[{"role": "user", "content": f"Create a short image generation prompt (max 60 words) for a {tone} perfume marketing post. Fragrance family: {fragrance_family}. Caption: {caption_text}. Platform: {platform}. Focus on visual aesthetics: bottle, atmosphere, colors, mood. No text in image."}],
        system_prompt="You generate image prompts for luxury perfume marketing. Output only the prompt, no preamble.",
        temperature=0.8
    )

    # Step 2: call FLUX.1-schnell
    response = requests.post(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        headers={"Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}"},
        json={"inputs": visual_prompt},
        timeout=60
    )
    response.raise_for_status()

    # Step 3: save image bytes to local storage or cloud, return URL
    filename = f"marketing_{uuid4()}.png"
    image_path = Path("media") / filename
    image_path.write_bytes(response.content)
    return f"/media/{filename}"
```

### Email Sender (service_marketing only)

```python
# email_sender.py supports two providers, switched via EMAIL_PROVIDER env var

async def send_campaign_email(
    recipients: list[str],
    subject: str,
    caption_text: str,
    image_url: str | None,
    sender_name: str
) -> None:
    html_body = render_html_template(caption_text, image_url, sender_name)

    if settings.EMAIL_PROVIDER == "sendgrid":
        await _send_via_sendgrid(recipients, subject, html_body)
    else:
        await _send_via_smtp(recipients, subject, html_body)

async def _send_via_smtp(recipients, subject, html_body):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USER
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        for recipient in recipients:
            msg["To"] = recipient
            server.send_message(msg)

async def _send_via_sendgrid(recipients, subject, html_body):
    sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    for recipient in recipients:
        message = Mail(from_email=settings.SMTP_USER, to_emails=recipient, subject=subject, html_content=html_body)
        sg.send(message)
```

---

## 6. API Endpoints Reference

### Auth
| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | No | Register business owner |
| POST | `/api/v1/auth/login` | No | Login, returns JWT |
| POST | `/api/v1/auth/widget-token` | Owner JWT | Issue short-lived token for registered client |

### Analytics
| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/v1/analytics/upload-csv` | Owner JWT | Upload CSV, triggers Celery pipeline |
| GET | `/api/v1/analytics/kpis` | Owner JWT | Current KPI snapshot |
| GET | `/api/v1/analytics/insights` | Owner JWT | List insight cards |
| GET | `/api/v1/analytics/anomalies` | Owner JWT | List alarm cards (unread first) |
| PATCH | `/api/v1/analytics/anomalies/{id}/read` | Owner JWT | Mark alarm as read |
| GET | `/api/v1/analytics/insights/{id}/explain` | Owner JWT | Deep LightRAG drill-down |

### Sales
| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/v1/sales/chat` | Optional (detects mode) | Send message to chatbot |
| GET | `/api/v1/sales/leads` | Owner JWT | List all leads |
| GET | `/api/v1/sales/leads/{id}/transcript` | Owner JWT | Full conversation transcript |
| POST | `/api/v1/sales/faq` | Owner JWT | Add FAQ entry |
| GET | `/api/v1/sales/faq` | Owner JWT | List FAQ entries |
| DELETE | `/api/v1/sales/faq/{id}` | Owner JWT | Delete FAQ entry |
| POST | `/api/v1/sales/clients` | Owner JWT | Register a new client (creates graph node) |

### Marketing
| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/v1/marketing/campaigns` | Owner JWT | Create brief, triggers generation pipeline |
| GET | `/api/v1/marketing/campaigns` | Owner JWT | List all campaigns |
| GET | `/api/v1/marketing/campaigns/{id}/variants` | Owner JWT | Get 3 variants with scores + images |
| POST | `/api/v1/marketing/campaigns/{id}/generate-image` | Owner JWT | Trigger FLUX.1 for a variant |
| POST | `/api/v1/marketing/campaigns/{id}/send-email` | Owner JWT | Send email campaign |
| GET | `/api/v1/marketing/email-campaigns` | Owner JWT | List email send history |
| POST | `/api/v1/marketing/brand-context` | Owner JWT | Upload brand context item |
| GET | `/api/v1/marketing/brand-context` | Owner JWT | List brand context items |
| DELETE | `/api/v1/marketing/brand-context/{id}` | Owner JWT | Delete brand context item |

---

## 7. Authentication Flow

```
Business Owner login:
  POST /auth/login {email, password}
  → verify password hash
  → return JWT: { sub: owner_id, role: "owner", business_id: ..., exp: now+24h }
  → all dashboard requests: Authorization: Bearer {token}

Registered Client widget token:
  SME website calls POST /auth/widget-token {external_user_id, business_id}
  → validate business_id exists
  → upsert registered_client row
  → return JWT: { sub: client_id, role: "client", business_id: ..., exp: now+2h }
  → widget attaches token to all /sales/chat requests

Anonymous visitor:
  No token sent to /sales/chat
  → dependency optional_auth() returns None
  → router routes to FAQ mode
```

---

## 8. Deployment

### docker-compose.yml services
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: smart_business
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    ports: ["8000:8000"]
    depends_on: [postgres, redis]
    env_file: ./backend/.env

  worker:
    build: ./backend
    command: celery -A celery_app worker --loglevel=info --concurrency=4
    depends_on: [postgres, redis]
    env_file: ./backend/.env

  beat:
    build: ./backend
    command: celery -A celery_app beat --loglevel=info
    depends_on: [postgres, redis]
    env_file: ./backend/.env
```

### Build order for development
1. Start docker-compose (postgres + redis)
2. Run `alembic upgrade head` to create all schemas and tables
3. Start backend + worker + beat
4. Run `npm run dev` for frontend
5. Hit `/api/v1/auth/register` to create first business owner
6. Complete onboarding wizard to seed the knowledge graph
