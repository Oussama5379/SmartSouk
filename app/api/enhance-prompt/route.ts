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

  // Core user idea is always first and highest priority
  const rough = cleanPrompt(roughPrompt);
  if (rough) parts.push(rough);

  // Industry / product domain
  const industry = normalize(profile.industry);
  if (industry) parts.push(`${industry} product`);

  // Visual style
  const style = normalize(profile.visualStyle);
  if (style) parts.push(style);

  // Campaign angle from article
  const articleTitle = normalize(article.title);
  const articleSummary = normalize(article.summary);
  if (articleTitle) parts.push(`campaign: ${articleTitle}`);
  if (articleSummary && articleSummary !== articleTitle) parts.push(articleSummary);

  // Target audience context
  const audience = normalize(profile.audience);
  if (audience) parts.push(`for ${audience}`);

  // Fixed quality suffixes for FLUX
  parts.push(
    "photorealistic marketing visual",
    "hero composition",
    "controlled studio lighting",
    "realistic textures",
    "high detail",
    "commercial product photography",
    "blank white rectangular label with thin gold border",
    "no text",
    "no logos"
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
