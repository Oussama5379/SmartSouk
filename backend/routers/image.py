import asyncio
import os
import time
from io import BytesIO

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from huggingface_hub import InferenceClient
from pydantic import BaseModel

router = APIRouter()

HF_IMAGE_PROVIDER = "nscale"
HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell"
HF_IMAGE_STEPS = 5
IMAGE_RETRY_ATTEMPTS = 4
IMAGE_BASE_BACKOFF_MS = 2500
IMAGE_MIN_INTERVAL_MS = 1800
IMAGE_COOLDOWN_ON_429_MS = 20000
GEMINI_MODEL = "gemini-2.5-flash-lite"

# Module-level rate-limit state
_last_image_request_at: float = 0.0
_image_blocked_until: float = 0.0
_hf_client: InferenceClient | None = None


def _get_hf_client() -> InferenceClient:
    global _hf_client
    if _hf_client is None:
        token = os.environ.get("HF_TOKEN", "").strip()
        if not token:
            raise RuntimeError("HF_TOKEN env var is missing")
        _hf_client = InferenceClient(token=token)
    return _hf_client


def _clean_prompt(text: str) -> str:
    import re
    result = (text or "").strip()
    result = re.sub(r"^prompt\s*:\s*", "", result, flags=re.IGNORECASE)
    result = re.sub(r'^[\'"`]+|[\'"`]+$', "", result)
    result = re.sub(r"\s+", " ", result).strip()
    return result


async def _wait_for_image_slot() -> None:
    global _last_image_request_at, _image_blocked_until
    now = time.monotonic() * 1000  # ms
    cooldown_wait = _image_blocked_until - now
    if cooldown_wait > 0:
        await asyncio.sleep(cooldown_wait / 1000)
    interval_wait = IMAGE_MIN_INTERVAL_MS - (time.monotonic() * 1000 - _last_image_request_at)
    if interval_wait > 0:
        await asyncio.sleep(interval_wait / 1000)


async def _generate_image_hf(prompt: str) -> bytes:
    global _last_image_request_at, _image_blocked_until
    client = _get_hf_client()
    final_prompt = _clean_prompt(prompt)[:520]

    last_error: Exception | None = None
    for attempt in range(1, IMAGE_RETRY_ATTEMPTS + 1):
        await _wait_for_image_slot()
        _last_image_request_at = time.monotonic() * 1000

        try:
            result = client.text_to_image(
                prompt=final_prompt,
                model=HF_IMAGE_MODEL,
                provider=HF_IMAGE_PROVIDER,
                num_inference_steps=HF_IMAGE_STEPS,
            )
            buf = BytesIO()
            result.save(buf, format="JPEG")
            return buf.getvalue()
        except Exception as exc:
            msg = str(exc).lower()
            is_rate_limit = "429" in msg or "rate limit" in msg
            is_transient = is_rate_limit or "timeout" in msg or "network" in msg or "temporar" in msg
            backoff_ms = min(IMAGE_BASE_BACKOFF_MS * attempt, 15000)

            if is_rate_limit:
                _image_blocked_until = max(
                    _image_blocked_until,
                    time.monotonic() * 1000 + max(backoff_ms, IMAGE_COOLDOWN_ON_429_MS),
                )

            last_error = exc
            if is_transient and attempt < IMAGE_RETRY_ATTEMPTS:
                await asyncio.sleep(backoff_ms / 1000)
                continue
            break

    raise RuntimeError(f"Image generation failed after {IMAGE_RETRY_ATTEMPTS} attempts: {last_error}")


# ── Routes ────────────────────────────────────────────────────────────────────

class GenerateImageRequest(BaseModel):
    prompt: str


@router.post("/generate-image")
async def generate_image(body: GenerateImageRequest):
    prompt = _clean_prompt(body.prompt)
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    try:
        image_bytes = await _generate_image_hf(prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return Response(content=image_bytes, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


class EnhancePromptRequest(BaseModel):
    roughPrompt: str
    profile: dict = {}
    article: dict = {}


@router.post("/enhance-prompt")
async def enhance_prompt(body: EnhancePromptRequest):
    rough = _clean_prompt(body.roughPrompt)
    if not rough:
        raise HTTPException(status_code=400, detail="roughPrompt is required")

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    profile = body.profile
    article = body.article

    instruction = "\n".join([
        "You are a professional image prompt engineer.",
        "Rewrite the rough idea into one production-ready prompt for a photorealistic marketing visual.",
        "Priority order: user rough idea + profile fields first, article context second.",
        "Never invent a different domain than the user provided.",
        "Include: subject, composition, camera angle, lighting, mood, materials/textures, and background scene.",
        "Always include: blank white rectangular label with a thin gold border, no text, no logos.",
        "Never ask the model to render words, letters, typography, or brand names.",
        "Return only the final prompt. Keep it under 90 words.",
        "",
        f"Brand: {profile.get('brandName') or 'N/A'}",
        f"Category/Industry: {profile.get('industry') or 'N/A'}",
        f"Visual style preference: {profile.get('visualStyle') or 'N/A'}",
        f"Audience: {profile.get('audience') or 'N/A'}",
        f"Campaign article title (secondary): {article.get('title') or 'N/A'}",
        f"Campaign article context (secondary): {article.get('summary') or 'N/A'}",
        f"User rough idea (highest priority): {rough}",
    ])

    if not api_key:
        # Local fallback
        return {"prompt": rough, "provider": "local-fallback", "warning": "GEMINI_API_KEY missing"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": instruction}]}],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 180},
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = " ".join(p.get("text", "") for p in parts).strip()
            prompt = _clean_prompt(text)
            if not prompt:
                raise ValueError("Empty response from Gemini")
            return {"prompt": prompt, "provider": GEMINI_MODEL}
    except Exception as exc:
        # Fall back to rough prompt if Gemini fails
        return {
            "prompt": rough,
            "provider": "local-fallback",
            "warning": f"Gemini unavailable: {exc}",
        }
