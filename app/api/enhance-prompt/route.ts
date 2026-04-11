import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

function normalize(value: unknown): string {
  return (value || "").toString().trim();
}

function cleanPrompt(text: string): string {
  let result = normalize(text);
  result = result.replace(/^prompt\s*:\s*/i, "");
  result = result.replace(/^['\"`]+|['\"`]+$/g, "");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

interface ProfileInput {
  brandName?: string;
  industry?: string;
  restaurantType?: string;
  visualStyle?: string;
  audience?: string;
}

interface ArticleInput {
  title?: string;
  summary?: string;
}

interface PromptInput {
  profile: {
    brandName: string;
    industry: string;
    visualStyle: string;
    audience: string;
  };
  article: {
    title: string;
    summary: string;
  };
  roughPrompt: string;
}

function buildPromptPayload(payload: {
  roughPrompt?: unknown;
  profile?: ProfileInput;
  article?: ArticleInput;
}): PromptInput {
  return {
    profile: {
      brandName: normalize(payload.profile?.brandName),
      industry: normalize(payload.profile?.industry || payload.profile?.restaurantType),
      visualStyle: normalize(payload.profile?.visualStyle),
      audience: normalize(payload.profile?.audience),
    },
    article: {
      title: normalize(payload.article?.title),
      summary: normalize(payload.article?.summary),
    },
    roughPrompt: normalize(payload.roughPrompt),
  };
}

function buildInstruction(input: PromptInput): string {
  return [
    "You are a professional image prompt engineer.",
    "Rewrite the rough idea into one production-ready prompt for a photorealistic marketing visual.",
    "Priority order: user rough idea + profile fields first, article context second.",
    "Never invent a different domain than the user provided.",
    "If profile and rough idea indicate perfume/fragrance, do not add food, dishes, restaurant tables, or cuisine scenes.",
    "If article context conflicts with profile or rough idea, ignore conflicting article details.",
    "Include: subject, composition, camera angle, lighting, mood, materials/textures, and background scene.",
    "Always include: blank white rectangular label with a thin gold border, no text, no logos.",
    "Never ask the model to render words, letters, typography, or brand names.",
    "Return only the final prompt. Keep it under 90 words.",
    "",
    `Brand: ${input.profile.brandName || "N/A"}`,
    `Category/Industry: ${input.profile.industry || "N/A"}`,
    `Visual style preference: ${input.profile.visualStyle || "N/A"}`,
    `Audience: ${input.profile.audience || "N/A"}`,
    `Campaign article title (secondary): ${input.article.title || "N/A"}`,
    `Campaign article context (secondary): ${input.article.summary || "N/A"}`,
    `User rough idea (highest priority): ${input.roughPrompt || "N/A"}`,
  ].join("\n");
}

function buildFallbackPrompt(input: PromptInput): string {
  const parts = [
    "photorealistic marketing campaign visual,",
    input.roughPrompt || "hero product concept,",
    input.profile.industry ? `${input.profile.industry} category,` : "product-focused category,",
    input.profile.visualStyle ? `${input.profile.visualStyle},` : "premium clean style,",
    input.article.title ? `campaign angle: ${input.article.title},` : "campaign-driven concept,",
    input.article.summary ? `${input.article.summary},` : "strong promotional mood,",
    "hero composition, controlled studio lighting, realistic textures,",
    "blank white rectangular label with thin gold border, no text, no logos,",
    "high detail, commercial product photography",
  ];
  return cleanPrompt(parts.join(" "));
}

async function generateWithGemini(input: PromptInput): Promise<string> {
  const apiKey = normalize(process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildInstruction(input) }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 180 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${errorText.slice(0, 350)}`);
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || "")
    .join(" ");

  const prompt = cleanPrompt(text);
  if (!prompt) throw new Error("Gemini returned empty prompt");
  return prompt;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const input = buildPromptPayload(body);

  if (!input.roughPrompt) {
    return NextResponse.json({ error: "roughPrompt is required" }, { status: 400 });
  }

  try {
    const prompt = await generateWithGemini(input);
    return NextResponse.json({ prompt, provider: "gemini-2.5-flash-lite" });
  } catch {
    const fallbackPrompt = buildFallbackPrompt(input);
    return NextResponse.json({
      prompt: fallbackPrompt,
      provider: "local-fallback",
      warning: "Gemini unavailable. Used local prompt enhancer.",
    });
  }
}
