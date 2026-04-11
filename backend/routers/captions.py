import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

GEMINI_MODEL = "gemini-2.5-flash-lite"

TONE_LABELS = {
    "professional": "Professional",
    "fun": "Fun & Playful",
    "storytelling": "Storytelling",
}

PLATFORM_GUIDE = {
    "instagram": "Instagram (up to 2200 chars, emoji-friendly, story-driven)",
    "linkedin": "LinkedIn (professional, insight-driven, 1-3 short paragraphs, no emoji overload)",
    "twitter": "X/Twitter (punchy, under 280 chars, hook first)",
    "facebook": "Facebook (conversational, community-focused, medium length)",
    "tiktok": "TikTok (hype-driven, short, bold opening, action-oriented)",
}

TONE_DESCRIPTIONS = {
    "professional": "Authoritative, polished, brand-focused. No slang. Confidence and credibility.",
    "fun": "Playful, energetic, emoji-friendly. Light tone, punchy phrasing, excitement.",
    "storytelling": "Narrative-driven. Pull the reader in emotionally. Paint a picture, build desire.",
}


class GenerateCaptionsRequest(BaseModel):
    article: dict = {}
    profile: dict = {}
    tone: str = "all"
    platform: str = "instagram"
    imagePrompt: str = ""


def _build_fallback_captions(brand: str, article: dict, tones: list[str]) -> list[dict]:
    title = (article.get("title") or "").strip()
    summary = (article.get("summary") or "").strip()
    brand_tag = brand.replace(" ", "")
    fallbacks = {
        "professional": {
            "tone": TONE_LABELS["professional"],
            "caption": f"Introducing the latest from {brand}. {title or 'A new campaign visual'} — crafted for those who demand the best.",
            "hashtags": f"#{brand_tag} #Campaign #Quality #Premium #NewArrival",
        },
        "fun": {
            "tone": TONE_LABELS["fun"],
            "caption": f"✨ Say hello to your new obsession! {title or 'Something big just dropped'} from {brand} 👀🔥",
            "hashtags": f"#{brand_tag} #NewDrop #Vibes #MustHave #TreatYourself",
        },
        "storytelling": {
            "tone": TONE_LABELS["storytelling"],
            "caption": f"Every detail tells a story. {summary or 'This campaign captures something real'} — and {brand} made sure you feel every bit of it.",
            "hashtags": f"#{brand_tag} #BrandStory #Craftsmanship #Campaign #Authentic",
        },
    }
    return [fallbacks[t] for t in tones if t in fallbacks]


@router.post("/generate-captions")
async def generate_captions(body: GenerateCaptionsRequest):
    tones = (
        ["professional", "fun", "storytelling"] if body.tone == "all" else [body.tone]
    )
    brand = (body.profile.get("brandName") or "our brand").strip()
    platform_label = PLATFORM_GUIDE.get(body.platform, body.platform)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        captions = _build_fallback_captions(brand, body.article, tones)
        return {"captions": captions, "warning": "GEMINI_API_KEY missing, used fallback"}

    instruction_lines = [
        f"You are an expert social media copywriter.",
        f"Write {len(tones)} caption(s) for a campaign image post on: {platform_label}.",
        "",
        "Context:",
        f"Brand: {brand}",
        f"Industry: {body.profile.get('industry') or 'N/A'}",
        f"Visual style: {body.profile.get('visualStyle') or 'N/A'}",
        f"Target audience: {body.profile.get('audience') or 'N/A'}",
        f"Campaign article: {body.article.get('title') or 'N/A'}",
        f"Campaign angle: {body.article.get('summary') or 'N/A'}",
    ]
    if body.imagePrompt:
        instruction_lines.append(f"Image description: {body.imagePrompt[:200]}")

    instruction_lines += [
        "",
        'Return ONLY valid JSON — no markdown, no code fences, no extra text.',
        'Format:',
        '{"captions": [',
    ]
    for i, t in enumerate(tones):
        comma = "," if i < len(tones) - 1 else ""
        instruction_lines.append(
            f'  {{"tone": "{TONE_LABELS.get(t, t)}", "caption": "<the caption text>", "hashtags": "<5-8 hashtags>"}}{comma}'
        )
    instruction_lines += [
        "]}",
        "",
        "Tone guidelines:",
    ]
    for t in tones:
        instruction_lines.append(f"- {TONE_LABELS.get(t, t)}: {TONE_DESCRIPTIONS.get(t, '')}")

    instruction = "\n".join(instruction_lines)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": instruction}]}],
        "generationConfig": {"temperature": 0.75, "maxOutputTokens": 900},
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            raw = " ".join(p.get("text", "") for p in parts).strip()

            import json, re
            match = re.search(r"\{[\s\S]*\}", raw)
            if not match:
                raise ValueError("No JSON in Gemini response")
            parsed = json.loads(match.group())
            if not isinstance(parsed.get("captions"), list):
                raise ValueError("Unexpected shape")
            return {"captions": parsed["captions"]}
    except Exception as exc:
        captions = _build_fallback_captions(brand, body.article, tones)
        return {"captions": captions, "warning": f"Gemini unavailable: {exc}"}
