import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  const { analyticsData } = await req.json();

  const prompt = `Analyze this sales analytics data and generate 3-4 actionable AI insights for a Tunisian artisanal products business. 
  
Data: ${JSON.stringify(analyticsData)}

For each insight, provide:
1. The insight itself (what you discovered)
2. Why it matters (business impact)
3. Recommended action (specific, actionable step)

Format as JSON array with objects containing: insight, impact, action, priority (high/medium/low)`;

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    prompt,
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
