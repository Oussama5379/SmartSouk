import { streamText, tool } from 'ai';
import { z } from 'zod';

const leadData = {
  name: '',
  industry: '',
  budget: '',
  challenges: '',
  timeline: '',
  interest: '',
};

export async function POST(req: Request) {
  const { conversationHistory } = await req.json();

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: `You are a brilliant sales AI for SmartSouk - a platform selling authentic Tunisian handcrafted products and services.
Your goal is to:
1. Qualify the lead by understanding their needs, budget, and timeline
2. Score them 1-10 based on fit and urgency
3. Recommend the perfect product/service from our catalog
4. Suggest next steps (meeting, email, follow-up)

Be conversational, empathetic, and insightful. Ask smart follow-up questions to understand their real pain points.
Always think about personalized recommendations based on their industry and needs.`,
    messages: conversationHistory,
    tools: {
      scoreAndRecommend: tool({
        description: 'Score the lead and generate recommendations',
        inputSchema: z.object({
          leadScore: z.number().min(1).max(10),
          recommendedProducts: z.array(z.string()),
          nextSteps: z.array(z.string()),
          reasoning: z.string(),
        }),
        execute: async (input) => {
          return {
            score: input.leadScore,
            products: input.recommendedProducts,
            actions: input.nextSteps,
            analysis: input.reasoning,
          };
        },
      }),
    },
  });

  return result.toTextStreamResponse();
}
