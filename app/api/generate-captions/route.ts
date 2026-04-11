import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const TONE_LABELS: Record<string, string> = {
  professional: "Professional",
  fun: "Fun & Playful",
  storytelling: "Storytelling",
};

function normalize(value: unknown): string {
  return (value || "").toString().trim();
}

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

interface CaptionPayload {
  article?: ArticleInput;
  profile?: ProfileInput;
  tone?: string;
  platform?: string;
  imagePrompt?: string;
}

function buildCaptionInstruction(payload: CaptionPayload): string {
  const { article, profile, tone = "all", platform = "instagram", imagePrompt = "" } = payload;

  const tones = tone === "all" ? ["professional", "fun", "storytelling"] : [tone];

  const platformGuide: Record<string, string> = {
    instagram: "Instagram (up to 2200 chars, emoji-friendly, story-driven)",
    linkedin: "LinkedIn (professional, insight-driven, 1–3 short paragraphs, no emoji overload)",
    twitter: "X/Twitter (punchy, under 280 chars, hook first)",
    facebook: "Facebook (conversational, community-focused, medium length)",
    tiktok: "TikTok (hype-driven, short, bold opening, action-oriented)",
  };

  const toneDescriptions: Record<string, string> = {
    professional: "Authoritative, polished, brand-focused. No slang. Confidence and credibility.",
    fun: "Playful, energetic, emoji-friendly. Light tone, punchy phrasing, excitement.",
    storytelling: "Narrative-driven. Pull the reader in emotionally. Paint a picture, build desire.",
  };

  const lines = [
    `You are an expert social media copywriter.`,
    `Write ${tones.length} caption(s) for a campaign image post on: ${platformGuide[platform] || platform}.`,
    ``,
    `Context:`,
    `Brand: ${normalize(profile?.brandName) || "N/A"}`,
    `Industry: ${normalize(profile?.industry) || "N/A"}`,
    `Visual style: ${normalize(profile?.visualStyle) || "N/A"}`,
    `Target audience: ${normalize(profile?.audience) || "N/A"}`,
    `Campaign article: ${normalize(article?.title) || "N/A"}`,
    `Campaign angle: ${normalize(article?.summary) || "N/A"}`,
    imagePrompt ? `Image description: ${normalize(imagePrompt).slice(0, 200)}` : null,
    ``,
    `Return ONLY valid JSON — no markdown, no code fences, no extra text.`,
    `Format:`,
    `{`,
    `  "captions": [`,
    ...tones.map((t, i) =>
      [
        `    {`,
        `      "tone": "${TONE_LABELS[t] || t}",`,
        `      "caption": "<the caption text>",`,
        `      "hashtags": "<5-8 relevant hashtags>"`,
        `    }${i < tones.length - 1 ? "," : ""}`,
      ].join("\n")
    ),
    `  ]`,
    `}`,
    ``,
    `Tone guidelines:`,
    ...tones.map((t) => `- ${TONE_LABELS[t]}: ${toneDescriptions[t]}`),
  ]
    .filter((l) => l !== null)
    .join("\n");

  return lines;
}

async function generateCaptionsWithGemini(payload: CaptionPayload) {
  const apiKey = normalize(process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const instruction = buildCaptionInstruction(payload);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: 900 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini caption request failed ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p?.text || "")
    .join("")
    .trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini returned no valid JSON for captions");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed?.captions)) throw new Error("Unexpected caption response shape");

  return parsed.captions;
}

function buildFallbackCaptions(payload: CaptionPayload) {
  const { article, profile, tone = "all" } = payload;
  const brand = normalize(profile?.brandName) || "our brand";
  const tones = tone === "all" ? ["professional", "fun", "storytelling"] : [tone];

  const map: Record<string, { tone: string; caption: string; hashtags: string }> = {
    professional: {
      tone: TONE_LABELS.professional,
      caption: `Introducing the latest from ${brand}. ${normalize(article?.title) || "A new campaign visual"} — crafted for those who demand the best. Discover more.`,
      hashtags: `#${brand.replace(/\s+/g, "")} #Campaign #Quality #Premium #NewArrival`,
    },
    fun: {
      tone: TONE_LABELS.fun,
      caption: `✨ Say hello to your new obsession! ${normalize(article?.title) || "Something big just dropped"} from ${brand} and we're OBSESSED. You coming? 👀🔥`,
      hashtags: `#${brand.replace(/\s+/g, "")} #NewDrop #Vibes #MustHave #TreatYourself`,
    },
    storytelling: {
      tone: TONE_LABELS.storytelling,
      caption: `Every detail tells a story. ${normalize(article?.summary) || "This campaign captures something real"} — and ${brand} made sure you feel every bit of it.`,
      hashtags: `#${brand.replace(/\s+/g, "")} #BrandStory #Craftsmanship #Campaign #Authentic`,
    },
  };

  return tones.map((t) => map[t]).filter(Boolean);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { article, profile, tone = "all", platform = "instagram", imagePrompt = "" } = body;

  try {
    const captions = await generateCaptionsWithGemini({ article, profile, tone, platform, imagePrompt });
    return NextResponse.json({ captions });
  } catch (err) {
    console.warn("[captions] Gemini failed, using fallback:", (err as Error).message);
    const captions = buildFallbackCaptions({ article, profile, tone });
    return NextResponse.json({ captions, warning: "Used fallback captions (Gemini unavailable)." });
  }
}
