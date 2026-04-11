import { NextRequest, NextResponse } from "next/server";

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
  visualStyle?: string;
  audience?: string;
}

interface ArticleInput {
  title?: string;
  summary?: string;
}

function buildPrompt(
  roughPrompt: string,
  profile: ProfileInput,
  article: ArticleInput
): string {
  const parts: string[] = [];

  const brandName = normalize(profile.brandName);

  // ── Label instruction FIRST — diffusion models weight earlier tokens more ──
  // Being explicit here prevents any other word in the prompt from bleeding
  // onto the label surface.
  if (brandName) {
    parts.push(
      `product label reads only "${brandName}" in elegant serif font`,
      `only the word "${brandName}" on the label — no other text anywhere on the product`
    );
  } else {
    parts.push("blank white rectangular label with thin gold border, no text on label");
  }

  // ── Core visual idea ──────────────────────────────────────────────────────
  const rough = cleanPrompt(roughPrompt);
  if (rough) parts.push(rough);

  // Industry / product domain
  const industry = normalize(profile.industry);
  if (industry) parts.push(`${industry} product`);

  // Visual style
  const style = normalize(profile.visualStyle);
  if (style) parts.push(style);

  // Campaign angle — use only the article title for visual mood, not the full
  // summary, to avoid random words being read as label text by the model
  const articleTitle = normalize(article.title);
  if (articleTitle) parts.push(articleTitle);

  // ── Quality suffixes ──────────────────────────────────────────────────────
  parts.push(
    "photorealistic marketing visual",
    "hero composition",
    "controlled studio lighting",
    "realistic textures",
    "high detail",
    "commercial product photography"
  );

  return parts.join(", ");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const roughPrompt = normalize(body.roughPrompt);
  if (!roughPrompt) {
    return NextResponse.json({ error: "roughPrompt is required" }, { status: 400 });
  }

  const profile: ProfileInput = body.profile || {};
  const article: ArticleInput = body.article || {};

  const prompt = buildPrompt(roughPrompt, profile, article);

  return NextResponse.json({ prompt, provider: "local" });
}
