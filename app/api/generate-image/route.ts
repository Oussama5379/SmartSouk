import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

const HF_IMAGE_PROVIDER = "nscale";
const HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
const HF_IMAGE_STEPS = 5;
const IMAGE_RETRY_ATTEMPTS = 4;
const IMAGE_BASE_BACKOFF_MS = 2500;
const IMAGE_MIN_INTERVAL_MS = 1800;
const IMAGE_COOLDOWN_ON_429_MS = 20000;

// Module-level rate limiting state (persists across requests in the same process)
let lastImageRequestAt = 0;
let imageBlockedUntil = 0;
let hfClient: InferenceClient | null = null;

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

function clampPromptForImage(prompt: string): string {
  return cleanPrompt(prompt).slice(0, 520);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHfClient(): InferenceClient {
  if (hfClient) return hfClient;
  const token = normalize(process.env.HF_TOKEN);
  if (!token) throw new Error("HF_TOKEN is missing");
  hfClient = new InferenceClient(token);
  return hfClient;
}

function getStatusFromError(error: unknown): number | null {
  const err = error as Record<string, unknown>;
  if (Number.isFinite(err?.status)) return Number(err.status);
  const resp = err?.response as Record<string, unknown> | undefined;
  if (Number.isFinite(resp?.status)) return Number(resp?.status);

  const message = normalize(err?.message || "");
  const match = message.match(/\b(?:status(?:\s*code)?\s*[:=]?\s*)(\d{3})\b/i);
  if (match) return Number(match[1]);
  if (/\b429\b/.test(message)) return 429;
  return null;
}

async function waitForImageSlot(): Promise<void> {
  const now = Date.now();
  const cooldownWaitMs = imageBlockedUntil - now;
  if (cooldownWaitMs > 0) await sleep(cooldownWaitMs);

  const intervalWaitMs = IMAGE_MIN_INTERVAL_MS - (Date.now() - lastImageRequestAt);
  if (intervalWaitMs > 0) await sleep(intervalWaitMs);
}

async function generateWithHuggingFace(prompt: string): Promise<Buffer> {
  const client = getHfClient();
  const finalPrompt = clampPromptForImage(prompt);

  for (let attempt = 1; attempt <= IMAGE_RETRY_ATTEMPTS; attempt++) {
    await waitForImageSlot();
    lastImageRequestAt = Date.now();

    try {
      const result = await client.textToImage({
        provider: HF_IMAGE_PROVIDER as "nscale",
        model: HF_IMAGE_MODEL,
        inputs: finalPrompt,
        parameters: { num_inference_steps: HF_IMAGE_STEPS },
      });

      const arrayBuffer = await (result as unknown as Blob).arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      const status = getStatusFromError(error);
      const message = normalize((error as Error)?.message || "unknown inference error");
      const lowerMessage = message.toLowerCase();
      const isRateLimit =
        status === 429 ||
        lowerMessage.includes("rate limit") ||
        /\b429\b/.test(lowerMessage);
      const isTransient =
        isRateLimit ||
        (Number.isFinite(status) && (status as number) >= 500) ||
        lowerMessage.includes("timeout") ||
        lowerMessage.includes("network") ||
        lowerMessage.includes("temporar") ||
        lowerMessage.includes("fetch failed");
      const backoffMs = Math.min(IMAGE_BASE_BACKOFF_MS * attempt, 15000);

      if (isRateLimit) {
        imageBlockedUntil = Math.max(
          imageBlockedUntil,
          Date.now() + Math.max(backoffMs, IMAGE_COOLDOWN_ON_429_MS)
        );
      }

      if (isTransient && attempt < IMAGE_RETRY_ATTEMPTS) {
        await sleep(backoffMs);
        continue;
      }

      const statusPart = Number.isFinite(status) ? `status ${status}` : "request failed";
      throw new Error(`${statusPart} after ${attempt} attempts`);
    }
  }

  throw new Error("image generation retries exhausted");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt = cleanPrompt(body?.prompt);

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const imageBuffer = await generateWithHuggingFace(prompt);
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Image generation failed at Hugging Face",
        details: (error as Error).message || "unknown image generation error",
      },
      { status: 502 }
    );
  }
}
