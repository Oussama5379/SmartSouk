import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  const { campaignType, product, customerSegment } = await req.json();

  const prompt = `Create a complete email campaign sequence for an e-commerce business:

Campaign Type: ${campaignType}
Product: ${product}
Customer Segment: ${customerSegment}

Generate a 3-email sequence with:

Email 1 - Hook:
- Subject line (high-click rate)
- Preview text
- Body copy
- CTA

Email 2 - Social Proof:
- Subject line
- Preview text
- Body copy with testimonials/social proof
- CTA

Email 3 - Urgency:
- Subject line (FOMO)
- Preview text
- Body copy with limited-time angle
- CTA

Include:
- Send timing (days between emails)
- Target metrics
- A/B testing suggestions

Format as JSON array with email objects.`;

  const result = streamText({
    model: google('gemini-3.1-flash'),
    prompt,
    temperature: 0.8,
  });

  return result.toTextStreamResponse();
}
