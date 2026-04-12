import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

interface ProfileInput {
  brandName?: string;
  industry?: string;
  visualStyle?: string;
  audience?: string;
}

interface ArticleInput {
  title?: string;
  summary?: string;
}

interface SuggestEmailRequestBody {
  article?: ArticleInput;
  profile?: ProfileInput;
  imagePrompt?: string;
  captionText?: string;
}

interface SuggestEmailDraft {
  subject: string;
  preview_text: string;
  campaign_copy: string;
  cta: string;
}

const suggestEmailSchema = z.object({
  subject: z.string().describe("High-conversion email subject line"),
  preview_text: z
    .string()
    .describe("Preview text that appears in the inbox preheader"),
  campaign_copy: z
    .string()
    .describe("Email body copy as plain text, 2-4 short paragraphs"),
  cta: z.string().describe("Single clear call-to-action line"),
});

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function clamp(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }

  return value.slice(0, max).trim();
}

function buildPrompt(input: SuggestEmailRequestBody): string {
  const brandName = normalize(input.profile?.brandName) || "Aurea";
  const industry = normalize(input.profile?.industry) || "premium retail";
  const visualStyle =
    normalize(input.profile?.visualStyle) || "luxury editorial";
  const audience =
    normalize(input.profile?.audience) || "style-conscious customers";
  const angleTitle = normalize(input.article?.title) || "New Signature Scent";
  const angleSummary =
    normalize(input.article?.summary) ||
    "Highlight exclusivity and craftsmanship.";
  const imagePrompt =
    normalize(input.imagePrompt) || "Premium perfume campaign visual.";
  const captionText = normalize(input.captionText);

  return `You are a senior lifecycle email copywriter for a luxury perfume brand.

Create a polished marketing email draft using this campaign context.

Brand: ${brandName}
Industry: ${industry}
Visual style: ${visualStyle}
Audience: ${audience}
Campaign angle title: ${angleTitle}
Campaign angle summary: ${angleSummary}
Generated image context: ${imagePrompt.slice(0, 500)}
${captionText ? `Optional social caption reference: ${captionText.slice(0, 500)}` : ""}

Requirements:
1. Tone must feel premium, elegant, and persuasive.
2. Keep body concise and readable on mobile (2 to 4 short paragraphs).
3. Include emotional hook + product desirability + clear CTA.
4. Do not use markdown, HTML tags, or emojis.
5. Return only a JSON object with keys: subject, preview_text, campaign_copy, cta.`;
}

function buildFallbackSuggestion(
  input: SuggestEmailRequestBody,
): SuggestEmailDraft {
  const brandName = normalize(input.profile?.brandName) || "Aurea";
  const audience = normalize(input.profile?.audience) || "fragrance lovers";
  const angleTitle = normalize(input.article?.title) || "A New Signature Scent";
  const angleSummary =
    normalize(input.article?.summary) ||
    "Crafted for those who seek rare sophistication.";

  return {
    subject: `${brandName}: ${angleTitle}`,
    preview_text: `Discover a refined fragrance moment designed for ${audience}.`,
    campaign_copy: [
      `A new chapter begins with ${brandName}. ${angleSummary}`,
      `Designed for ${audience}, this release balances depth, warmth, and modern elegance in every note.`,
      `Explore the collection today and experience a scent story made to linger.`,
    ].join("\n\n"),
    cta: "Explore the collection",
  };
}

function mergeWithFallback(
  partial: Partial<SuggestEmailDraft>,
  fallback: SuggestEmailDraft,
): SuggestEmailDraft {
  const subject = clamp(normalize(partial.subject) || fallback.subject, 120);
  const previewText = clamp(
    normalize(partial.preview_text) || fallback.preview_text,
    130,
  );
  const campaignCopy = clamp(
    normalize(partial.campaign_copy) || fallback.campaign_copy,
    2200,
  );
  const cta = clamp(normalize(partial.cta) || fallback.cta, 100);

  return {
    subject,
    preview_text: previewText,
    campaign_copy: campaignCopy,
    cta,
  };
}

async function suggestWithOpenAI(prompt: string): Promise<SuggestEmailDraft> {
  const result = await generateText({
    model: "openai/gpt-4o-mini",
    prompt,
    output: Output.object({ schema: suggestEmailSchema }),
  });

  return result.output;
}

async function suggestWithGemini(
  prompt: string,
): Promise<Partial<SuggestEmailDraft>> {
  const apiKey = normalize(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const geminiPrompt = `${prompt}\n\nReturn JSON only. No markdown fences.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }],
      generationConfig: { temperature: 0.65, maxOutputTokens: 900 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini suggestion request failed ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }

  const data = await response.json();
  const raw = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || "")
    .join("")
    .trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON payload in Gemini suggestion response");
  }

  return JSON.parse(jsonMatch[0]) as Partial<SuggestEmailDraft>;
}

export async function POST(request: Request) {
  let body: SuggestEmailRequestBody;

  try {
    body = (await request.json()) as SuggestEmailRequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  const fallback = buildFallbackSuggestion(body);

  try {
    const prompt = buildPrompt(body);
    const warnings: string[] = [];

    if (normalize(process.env.OPENAI_API_KEY)) {
      try {
        const openAiResult = await suggestWithOpenAI(prompt);
        return NextResponse.json(
          {
            success: true,
            provider: "openai",
            ...mergeWithFallback(openAiResult, fallback),
          },
          { status: 200 },
        );
      } catch (error: unknown) {
        warnings.push(
          `OpenAI unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    if (normalize(process.env.GEMINI_API_KEY)) {
      try {
        const geminiResult = await suggestWithGemini(prompt);
        return NextResponse.json(
          {
            success: true,
            provider: "gemini",
            ...mergeWithFallback(geminiResult, fallback),
            warning: warnings.length > 0 ? warnings.join(" | ") : undefined,
          },
          { status: 200 },
        );
      } catch (error: unknown) {
        warnings.push(
          `Gemini unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        provider: "fallback",
        ...fallback,
        warning:
          warnings.length > 0
            ? warnings.join(" | ")
            : "No AI provider key found. Using fallback draft.",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: true,
        provider: "fallback",
        ...fallback,
        warning:
          error instanceof Error
            ? `Suggestion fallback used: ${error.message}`
            : "Suggestion fallback used due to unknown error.",
      },
      { status: 200 },
    );
  }
}
