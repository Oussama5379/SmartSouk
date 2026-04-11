import { streamText } from 'ai';

export async function POST(req: Request) {
  const { salesData, customerBehavior } = await req.json();

  const prompt = `Analyze this e-commerce data and provide smart product recommendations strategy:

Sales Data: ${JSON.stringify(salesData)}
Customer Behavior: ${JSON.stringify(customerBehavior)}

Provide:
1. Top 3 products to push this month
2. Cross-sell opportunities (which products sell together)
3. Upsell recommendations (what customers buy after)
4. At-risk products (low conversion)
5. Customer segments and their preferences
6. Seasonal trends and predictions

Format as structured JSON with these exact keys. Be specific and data-driven.`;

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    prompt,
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
