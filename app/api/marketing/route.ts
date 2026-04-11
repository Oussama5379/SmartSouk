import { generateText, Output } from "ai"
import { z } from "zod"
import type { Product } from "@/lib/mock-data"

const campaignSchema = z.object({
  instagram_caption: z
    .string()
    .describe("A catchy, engaging Instagram caption with emojis"),
  hashtags: z.array(z.string()).describe("5 relevant hashtags"),
  image_prompt: z
    .string()
    .describe("A detailed Midjourney-style prompt to generate an image for this post"),
  strategy_tip: z
    .string()
    .describe("One sentence on the best time/way to post this"),
})

export async function POST(req: Request) {
  const { product, goal }: { product: Product; goal: string } = await req.json()

  const prompt = `Act as an expert digital marketer specializing in artisanal and handcrafted products from Tunisia.

Product to promote:
- Name: ${product.name}
- Category: ${product.category}
- Price: ${product.price_tnd} TND
- Description: ${product.description}

Campaign Goal: ${goal}

Create compelling social media marketing content for this product. The content should:
1. Highlight the authenticity and craftsmanship of Tunisian artisans
2. Appeal to customers who value unique, handmade products
3. Include a strong call-to-action
4. Be culturally sensitive and celebratory of Tunisian heritage

Generate an Instagram caption, hashtags, an AI image prompt, and a strategy tip.`

  const result = await generateText({
    model: "openai/gpt-4o-mini",
    prompt,
    output: Output.object({ schema: campaignSchema }),
  })

  return Response.json(result.object)
}
