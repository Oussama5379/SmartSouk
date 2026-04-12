import { generateText, tool } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { getStoreSettings, listStoreProducts } from "@/lib/store-data"
import type { StoreProduct } from "@/lib/store-types"
import { getSessionSignals } from "@/lib/tracking-store"
import type { LeadQualificationResult } from "@/lib/tracking-types"

interface ConversationTurn {
  role: "user" | "assistant"
  content: string
}

interface QualifyLeadBody {
  conversationHistory?: ConversationTurn[]
  session_id?: string
  current_page_url?: string
  active_product_id?: string
}

function formatConversationHistory(conversationHistory: ConversationTurn[]): string {
  return conversationHistory
    .filter((turn) => turn.content.trim().length > 0)
    .map((turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.content.trim()}`)
    .join("\n")
}

function buildSessionContext(params: {
  products: StoreProduct[]
  currentPageUrl?: string
  activeProductId?: string
  viewedProductIds: string[]
  lastTrackedPage: string | null
}): string {
  const contextLines: string[] = []

  const getProductById = (id: string) => params.products.find((product) => product.id === id)

  if (params.currentPageUrl) {
    contextLines.push(`Current page URL: ${params.currentPageUrl}`)
  } else if (params.lastTrackedPage) {
    contextLines.push(`Last tracked page: ${params.lastTrackedPage}`)
  }

  if (params.activeProductId) {
    const activeProduct = getProductById(params.activeProductId)
    if (activeProduct) {
      contextLines.push(`Current focused product: ${activeProduct.name}`)
    }
  }

  if (params.viewedProductIds.length > 0) {
    const viewedProducts = params.viewedProductIds
      .map((productId) => getProductById(productId)?.name)
      .filter((name): name is string => typeof name === "string")

    if (viewedProducts.length > 0) {
      contextLines.push(`Viewed products in this session: ${viewedProducts.join(", ")}`)
    }
  }

  return contextLines.length > 0 ? contextLines.join("\n") : "No tracked browsing context available."
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QualifyLeadBody

    if (!Array.isArray(body.conversationHistory) || body.conversationHistory.length < 2) {
      return Response.json(
        { error: "conversationHistory with at least two turns is required" },
        { status: 400 }
      )
    }

    const conversationHistory = body.conversationHistory.filter(
      (turn): turn is ConversationTurn =>
        (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string"
    )

    if (conversationHistory.length < 2) {
      return Response.json({ error: "Not enough valid conversation turns" }, { status: 400 })
    }

    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : ""
    const activeProductId =
      typeof body.active_product_id === "string" ? body.active_product_id.trim() : undefined
    const currentPageUrl =
      typeof body.current_page_url === "string" ? body.current_page_url.trim() : undefined
    const [products, settings] = await Promise.all([listStoreProducts(), getStoreSettings()])

    const { viewedProductIds, lastPage } = sessionId
      ? await getSessionSignals(sessionId)
      : { viewedProductIds: [], lastPage: null }

    const sessionContext = buildSessionContext({
      products,
      currentPageUrl,
      activeProductId,
      viewedProductIds,
      lastTrackedPage: lastPage,
    })

    const result = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: `You are a sales qualification assistant for ${settings.store_name}.
Your task is to score this lead and recommend the best next action.
You must call scoreAndRecommend exactly once with a pragmatic sales assessment.`,
      prompt: `Conversation transcript:
${formatConversationHistory(conversationHistory)}

Tracked context:
${sessionContext}

Based on the transcript + context, qualify the lead now.`,
      tools: {
        scoreAndRecommend: tool({
          description: "Score the lead and return personalized recommendations and next steps.",
          inputSchema: z.object({
            score: z.number().min(1).max(10),
            products: z.array(z.string()).min(1).max(3),
            actions: z.array(z.string()).min(1).max(3),
            analysis: z.string().min(1),
          }),
          execute: async (input) => input,
        }),
      },
      toolChoice: {
        type: "tool",
        toolName: "scoreAndRecommend",
      },
    })

    const scoreResult = result.toolResults.find(
      (toolResult) => toolResult.toolName === "scoreAndRecommend"
    )

    if (!scoreResult) {
      return Response.json({ error: "Lead qualification tool did not return a result" }, { status: 500 })
    }

    const output = scoreResult.output as Omit<LeadQualificationResult, "summary">
    const summary = `Lead score: ${output.score}/10. Recommended products: ${output.products.join(", ")}. Next step: ${output.actions[0]}.`

    return Response.json({
      ...output,
      summary,
    } satisfies LeadQualificationResult)
  } catch {
    return Response.json({ error: "Lead qualification failed" }, { status: 500 })
  }
}
