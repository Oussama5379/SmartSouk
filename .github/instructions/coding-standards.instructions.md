# Coding Standards — Smart Business Suite
# Domain: Perfume SME

---

## 1. Non-Negotiable Rules

- Python 3.11+ for all backend code
- TypeScript 5+ for all frontend code — no `any` type ever
- No `print()` anywhere in backend — use `logging` module throughout
- No `os.environ` in business logic — all env vars come from `config.py` (pydantic-settings)
- Every function that touches a database, LLM, or external API must be `async def`
- SQLAlchemy 2.0 async style throughout — no synchronous sessions, no raw SQL strings except in Alembic migrations
- Every Celery task must have `bind=True`, `max_retries=3`, `default_retry_delay=60`
- Every FastAPI endpoint must declare a `response_model` in its decorator
- Service folders must not import from each other — cross-service communication only via Redis Streams

---

## 2. Backend Conventions

### Folder-level rules
Each service folder (`service_analytics/`, `service_sales/`, `service_marketing/`) is self-contained. It owns its models, schemas, router, tasks, and services. The only shared code lives in `shared/`. A service folder must never import from another service folder.

```
# FORBIDDEN — breaks the microservice boundary illusion
from service_analytics.models import InsightCard  # inside service_marketing

# CORRECT — communicate via Redis Streams or shared utilities
from shared.llm_client import chat_completion
```

### ORM Models

```python
# models.py in each service
from sqlalchemy import Column, Text, Numeric, Boolean, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from backend.database import Base
import uuid

class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"
    __table_args__ = {"schema": "analytics"}

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id        = Column(UUID(as_uuid=True), nullable=False)
    kpi_name           = Column(Text, nullable=False)
    expected_value     = Column(Numeric)
    actual_value       = Column(Numeric)
    deviation_percent  = Column(Numeric)
    severity           = Column(Text)  # low / medium / high
    explanation        = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    is_read            = Column(Boolean, default=False)
    detected_at        = Column(TIMESTAMPTZ, server_default="NOW()")
```

### Pydantic Schemas

Suffix convention: `CreateIn` for creation requests, `UpdateIn` for updates, `Out` for responses, `DB` for internal use.

```python
# schemas.py
from pydantic import BaseModel, UUID4
from datetime import datetime

class AnomalyEventOut(BaseModel):
    id:                  UUID4
    kpi_name:            str
    expected_value:      float | None
    actual_value:        float | None
    deviation_percent:   float | None
    severity:            str
    explanation:         str
    recommended_action:  str
    is_read:             bool
    detected_at:         datetime

    model_config = {"from_attributes": True}
```

### Router Pattern

```python
# router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.dependencies import get_db, get_current_owner
from .schemas import AnomalyEventOut
from .services.anomaly import get_anomalies_for_business

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get(
    "/anomalies",
    response_model=list[AnomalyEventOut],
    summary="List alarm cards for the business owner"
)
async def list_anomalies(
    db: AsyncSession = Depends(get_db),
    current_owner = Depends(get_current_owner)
) -> list[AnomalyEventOut]:
    return await get_anomalies_for_business(db, current_owner.id)
```

### Service Layer

Services are plain `async` functions — not classes. One file per concern. They receive a `db: AsyncSession` as their first argument and the `business_id: UUID` as the second.

```python
# services/anomaly.py
import logging
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from ..models import AnomalyEvent

logger = logging.getLogger(__name__)

async def get_anomalies_for_business(
    db: AsyncSession,
    business_id: UUID
) -> list[AnomalyEvent]:
    result = await db.execute(
        select(AnomalyEvent)
        .where(AnomalyEvent.business_id == business_id)
        .order_by(AnomalyEvent.is_read.asc(), AnomalyEvent.detected_at.desc())
    )
    return result.scalars().all()

async def mark_alarm_read(db: AsyncSession, anomaly_id: UUID, business_id: UUID) -> None:
    await db.execute(
        update(AnomalyEvent)
        .where(AnomalyEvent.id == anomaly_id, AnomalyEvent.business_id == business_id)
        .values(is_read=True)
    )
    await db.commit()
```

### Celery Task Pattern

```python
# tasks.py
from celery import shared_task
from celery.utils.log import get_task_logger
from backend.database import SyncSessionLocal  # use sync session inside Celery tasks
import asyncio

logger = get_task_logger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60, name="analytics.process_csv_upload")
def process_csv_upload(self, business_id: str, file_path: str) -> dict:
    try:
        asyncio.run(_async_process_csv(business_id, file_path))
        return {"status": "success", "business_id": business_id}
    except Exception as exc:
        logger.error(f"process_csv_upload failed for business {business_id}: {exc}")
        raise self.retry(exc=exc)

async def _async_process_csv(business_id: str, file_path: str) -> None:
    async with SyncSessionLocal() as db:
        # actual business logic here
        pass
```

---

## 3. LLM Client Standards

All LLM calls go through `shared/llm_client.py`. Never import Groq or OpenAI SDK directly in service files.

```python
# shared/llm_client.py — the ONLY file that imports Groq/OpenAI
from groq import AsyncGroq
from openai import AsyncOpenAI
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

async def chat_completion(
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.7,
    json_mode: bool = False,
    model: str = "llama-3.3-70b-versatile"
) -> str:
    if json_mode:
        system_prompt += "\n\nIMPORTANT: Respond ONLY with valid JSON. No preamble, no markdown code fences, no explanation."

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    try:
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model=model,
            messages=full_messages,
            temperature=temperature,
            response_format={"type": "json_object"} if json_mode else None
        )
        return response.choices[0].message.content

    except Exception as e:
        logger.warning(f"Groq call failed: {e} — falling back to OpenAI")
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=full_messages,
            temperature=temperature,
            response_format={"type": "json_object"} if json_mode else None
        )
        return response.choices[0].message.content
```

### Parsing LLM JSON responses

Never assume the LLM returned clean JSON. Always use this pattern:

```python
import json

def parse_llm_json(raw: str) -> dict | list:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())
```

---

## 4. Embedding Standards

All embedding calls go through `shared/embeddings.py`. Never call OpenAI embeddings API directly in service files.

```python
# shared/embeddings.py
from openai import AsyncOpenAI
from backend.config import settings

async def get_embedding(text: str) -> list[float]:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text.replace("\n", " ")
    )
    return response.data[0].embedding
```

Cosine similarity search with pgvector in SQLAlchemy:
```python
from pgvector.sqlalchemy import Vector
from sqlalchemy import func

# cosine distance operator: <=>
# returns most similar entities (lowest distance = most similar)
result = await db.execute(
    select(GraphEntity)
    .where(GraphEntity.business_id == business_id)
    .order_by(GraphEntity.embedding.cosine_distance(query_embedding))
    .limit(5)
)
```

---

## 5. Error Handling

### Custom exceptions per service

Each service defines its own exceptions:

```python
# service_analytics/services/exceptions.py
class CSVParseError(Exception): pass
class GraphIndexingError(Exception): pass
class AnomalyDetectionError(Exception): pass

# service_sales/services/exceptions.py
class FAQNotFoundError(Exception): pass
class LeadScoringError(Exception): pass
class AgentLoopError(Exception): pass

# service_marketing/services/exceptions.py
class ImageGenerationError(Exception): pass
class EmailSendError(Exception): pass
class CopyGenerationError(Exception): pass
```

### Router exception handling

```python
from .services.exceptions import GraphIndexingError

@router.post("/upload-csv", response_model=UploadResponseOut)
async def upload_csv(...):
    try:
        result = await process_upload(db, file, business_id)
        return result
    except CSVParseError as e:
        raise HTTPException(status_code=422, detail=f"CSV format error: {str(e)}")
    except GraphIndexingError as e:
        raise HTTPException(status_code=500, detail=f"Graph indexing failed: {str(e)}")
```

---

## 6. Frontend Conventions

### Component types
- Page components: `page.tsx` inside route folder — server components by default
- Interactive components that need state: add `"use client"` at top
- Never put business logic in page components — extract to hooks or utility functions

### API layer

All API calls via `lib/api.ts` only. Never use `fetch` directly in components.

```typescript
// lib/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
```

### Data fetching with SWR

```typescript
// hooks/useAnomalies.ts
import useSWR from 'swr'
import { api } from '@/lib/api'
import type { AnomalyEvent } from '@/types/analytics'

const fetcher = (url: string) => api.get(url).then(r => r.data)

export function useAnomalies() {
  const { data, error, isLoading, mutate } = useSWR<AnomalyEvent[]>(
    '/api/v1/analytics/anomalies',
    fetcher,
    { refreshInterval: 10_000 }
  )
  return { anomalies: data ?? [], error, isLoading, mutate }
}
```

### TypeScript interfaces — never use `any`

```typescript
// types/analytics.ts
export interface AnomalyEvent {
  id: string
  kpi_name: string
  expected_value: number | null
  actual_value: number | null
  deviation_percent: number | null
  severity: 'low' | 'medium' | 'high'
  explanation: string
  recommended_action: string
  is_read: boolean
  detected_at: string
}

export interface KPISnapshot {
  id: string
  period_start: string
  period_end: string
  revenue_tnd: number
  units_sold: number
  conversion_rate: number
  avg_basket_tnd: number
  top_family: string
  top_product: string
  new_customers: number
  returning_customers: number
}
```

### Styling rules
- Tailwind CSS utility classes only — no custom CSS files, no CSS modules
- shadcn/ui as the base component library
- Never use `style={{}}` inline objects except for dynamic values impossible to express in Tailwind
- Alarm severity colors: `severity === 'high'` → `bg-red-50 border-red-200 text-red-800`, `medium` → `bg-orange-50 border-orange-200 text-orange-800`, `low` → `bg-blue-50 border-blue-200 text-blue-800`
- Lead tier colors: `hot` → red badge, `warm` → amber badge, `cold` → blue badge

---

## 7. config.py — All Environment Variables

```python
# backend/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM
    GROQ_API_KEY: str
    OPENAI_API_KEY: str

    # Image generation
    HUGGINGFACE_API_KEY: str

    # Email
    EMAIL_PROVIDER: str = "smtp"  # "smtp" or "sendgrid"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SENDGRID_API_KEY: str = ""

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440       # 24h for owners
    WIDGET_TOKEN_EXPIRE_MINUTES: int = 120         # 2h for clients

    # Media storage
    MEDIA_DIR: str = "media"

settings = Settings()
```

---

## 8. .env.example

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/smart_business

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here

# Image generation
HUGGINGFACE_API_KEY=your_hf_key_here

# Email — choose smtp or sendgrid
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SENDGRID_API_KEY=

# Auth
JWT_SECRET_KEY=change_this_to_a_long_random_string_in_production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
WIDGET_TOKEN_EXPIRE_MINUTES=120

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 9. Git Conventions

### Branch naming
```
feature/analytics-lightrag-indexing
feature/sales-react-agent-loop
feature/marketing-flux-image-gen
feature/marketing-email-sender
fix/analytics-anomaly-parser
chore/db-add-faq-entries-table
```

### Commit message format
```
feat(analytics): implement AD-LLM anomaly detection with seasonal context
feat(sales): add HippoRAG PPR retrieval for lead memory
feat(marketing): integrate FLUX.1-schnell image generation
feat(marketing): add email campaign sending via SMTP and SendGrid
fix(sales): correct ReAct loop turn limit check
chore(db): add Alembic migration for email_campaigns table
```

Service prefixes: `analytics`, `sales`, `marketing`, `auth`, `frontend`, `shared`, `db`, `docker`

---

## 10. Build Order

Follow this exact sequence when building the project from scratch:

```
1.  docker-compose.yml             → postgres + redis containers
2.  backend/config.py              → settings class
3.  backend/database.py            → async engine + Base
4.  backend/celery_app.py          → Celery instance
5.  backend/redis_streams.py       → publish_event + consume_stream helpers
6.  backend/dependencies.py        → get_db, get_current_owner, optional_auth
7.  backend/auth/                  → models → schemas → services → router
8.  alembic setup + first migration → all 4 schemas + all tables
9.  backend/shared/                → llm_client → embeddings → graph_utils
10. backend/service_analytics/     → models → schemas → services (csv_parser → lightrag → adllm → anomaly → insight_gen) → tasks → events → router
11. backend/service_sales/         → models → schemas → services (faq → hipporag → lead_scorer → intent_cls → pitch_gen → react_agent) → tasks → events → router
12. backend/service_marketing/     → models → schemas → services (lightrag → tone_ctrl → marketingfm → llm_judge → image_gen → email_sender) → tasks → events → router
13. backend/main.py                → mount all routers, CORS, startup events
14. frontend auth pages            → login → register → onboarding wizard
15. frontend dashboard layout      → sidebar + alarm notification dot
16. frontend analytics             → KPICard + AlarmCard + InsightCard + KPIChart
17. frontend leads                 → LeadTable + TierBadge + TranscriptDrawer
18. frontend marketing             → CampaignForm + CopyVariantCard + EmailSendModal
19. frontend chat widget           → ChatWidget (dual mode: FAQ + agent)
```
