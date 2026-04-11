---
description: "Use when writing or reviewing code to enforce conventions and implementation rules."
applyTo: "**/*"
---

# Coding Standards — Aurea

---

## TypeScript (Next.js app)

- TypeScript 5 throughout — no `any`, no `// @ts-ignore`
- No `console.log` left in production code
- All Next.js API routes export `async function POST` / `GET` — use `NextRequest`/`NextResponse` or plain `Request`/`Response`
- All AI calls use the Vercel AI SDK — never call OpenAI SDK directly in route handlers

### Vercel AI SDK patterns

**Streaming text** (most routes):
```ts
import { streamText } from 'ai'

export async function POST(req: Request) {
  const { someInput } = await req.json()
  const result = streamText({ model: 'openai/gpt-4o-mini', prompt: `...${someInput}...` })
  return result.toTextStreamResponse()
}
```

**Structured output** (when you need a guaranteed JSON shape):
```ts
import { generateText, Output } from 'ai'
import { z } from 'zod'

const mySchema = z.object({ field: z.string() })

export async function POST(req: Request) {
  const result = await generateText({
    model: 'openai/gpt-4o-mini',
    prompt: '...',
    output: Output.object({ schema: mySchema }),
  })
  return Response.json(result.object)
}
```

**Tool-calling** (qualify-lead style):
```ts
import { streamText, tool } from 'ai'
import { z } from 'zod'

const result = streamText({
  model: 'openai/gpt-4o-mini',
  system: '...',
  messages,
  tools: {
    toolName: tool({
      description: '...',
      inputSchema: z.object({ score: z.number() }),
      execute: async (input) => ({ result: input.score }),
    }),
  },
})
return result.toTextStreamResponse()
```

### React / Next.js

- Page components in `app/dashboard/*/page.tsx` — server components by default
- Add `"use client"` only when you need state, effects, or browser APIs
- All UI components from shadcn/ui in `components/ui/` — don't build primitives from scratch
- Tailwind CSS utility classes only — no inline `style={{}}` except for dynamic values

---

## Python (FastAPI backend)

- Python 3.11+
- No `print()` — use the standard `logging` module
- All I/O-bound functions must be `async def`
- Use `httpx.AsyncClient` for external HTTP calls (not `requests`)
- Pydantic v2 for all request/response models — use `BaseModel`
- Every router endpoint gets a `response_model` where practical

### Route pattern
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class MyRequest(BaseModel):
    input_field: str

@router.post("/my-endpoint")
async def my_endpoint(body: MyRequest):
    if not body.input_field:
        raise HTTPException(status_code=400, detail="input_field is required")
    # ...
    return {"result": "..."}
```

### External API calls
```python
import httpx

async with httpx.AsyncClient(timeout=20) as client:
    resp = await client.post(url, json=payload)
    resp.raise_for_status()
    data = resp.json()
```

### Environment variables
Read from `os.environ` directly for now. No pydantic-settings yet.
```python
import os
api_key = os.environ.get("GEMINI_API_KEY", "").strip()
if not api_key:
    # return fallback, don't raise
```

---

## Error Handling

- In Next.js routes: return `Response.json({ error: '...' }, { status: 4xx/5xx })` for errors — don't throw unhandled exceptions
- In FastAPI: raise `HTTPException(status_code=..., detail='...')` — never return raw exception objects
- For AI calls that may fail: always have a fallback (local template, cached result, or graceful error message)
- Never expose raw stack traces or internal error details in API responses

---

## Mock Data

All mock data lives in `lib/mock-data.ts`. When adding features:
- Define the TypeScript interface there
- Add seeded mock rows there
- Wire the route to read from the mock array
- Leave a comment: `// TODO: replace with DB query`

---

## What NOT to Do

- Don't call OpenAI SDK directly — use Vercel AI SDK
- Don't add Celery, Redis, or PostgreSQL unless explicitly decided — not in scope yet
- Don't add authentication middleware — no auth system exists yet
- Don't use `find` or `filter` on large datasets in API routes — mock data is small, but add a note if a real DB query would be needed
- Don't commit `.env` or `.env.local` files — only commit `.env.example` files
