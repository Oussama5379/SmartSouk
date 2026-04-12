import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  const { product, audience, campaignGoal } = await req.json();

  const prompt = `You are a creative marketing AI. Generate 3 distinct variations of marketing content for this product:

Product: ${product}
Target Audience: ${audience}
Campaign Goal: ${campaignGoal}

For each variation, provide:
1. Tone: (Professional / Fun & Casual / Storytelling)
2. Copy: Instagram caption (150 chars max)
3. Hashtags: 8-10 relevant hashtags
4. CTA: Call to action
5. Best time to post: Day/time recommendation
6. SEO keywords: 3-5 keywords

Format as JSON array with these exact keys. Make each variation unique and compelling.`;

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    prompt,
    temperature: 0.8,
  });

  return result.toTextStreamResponse();
}
