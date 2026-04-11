import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { getProductById, products } from "@/lib/mock-data"
import { getSessionSignals } from "@/lib/tracking-store"

const inventoryContext = products
  .map(
    (product) =>
      `- ${product.name} (${product.category}): ${product.price_tnd} TND - ${product.stock_status.replace("_", " ")} - ${product.description}`
  )
  .join("\n")

const baseSystemPrompt = `You are a friendly, highly persuasive Tunisian sales assistant for SmartSouk, a Tunisian artisanal concept store.

You have access to this inventory:
${inventoryContext}

Your job is to:
1. Greet customers warmly (use "Marhaba" occasionally)
2. Qualify their needs by asking about their budget, the occasion, or what they're looking for
3. Recommend 1-2 specific items from the inventory based on their answers
4. Highlight the authenticity and craftsmanship of Tunisian products
5. Be concise, warm, and occasionally use Tunisian expressions

Important guidelines:
- Only recommend products that are "in stock" or "low stock"
- If a product is "out of stock", mention it's currently unavailable but suggest alternatives
- Always mention prices in TND (Tunisian Dinar)
- Keep responses friendly but brief - no more than 2-3 sentences usually
- If asked about shipping, say you ship worldwide with tracking`

interface ChatRouteBody {
  messages?: UIMessage[]
  session_id?: string
  current_page_url?: string
  active_product_id?: string
}

function getProductNamesByIds(productIds: string[]): string[] {
  return productIds
    .map((productId) => getProductById(productId)?.name)
    .filter((name): name is string => typeof name === "string")
}

function buildPersonalizationContext(params: {
  currentPageUrl?: string
  activeProductId?: string
  viewedProductIds: string[]
  lastTrackedPage?: string | null
}): string {
  const contextLines: string[] = []
  const { currentPageUrl, activeProductId, viewedProductIds, lastTrackedPage } = params
  const activeProductName = activeProductId ? getProductById(activeProductId)?.name : undefined
  const viewedProductNames = getProductNamesByIds(viewedProductIds)

  if (currentPageUrl) {
    contextLines.push(`Current page URL: ${currentPageUrl}`)
  } else if (lastTrackedPage) {
    contextLines.push(`Last tracked page: ${lastTrackedPage}`)
  }

  if (activeProductName) {
    contextLines.push(`Product currently in focus: ${activeProductName}`)
  }

  if (viewedProductNames.length > 0) {
    contextLines.push(`Products viewed in this session: ${viewedProductNames.join(", ")}`)
  }

  if (contextLines.length === 0) {
    return ""
  }

  return `${contextLines.join("\n")}

Use this context naturally in recommendations. If you reference browsing behavior, only mention products listed in the context.`
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRouteBody

    if (!Array.isArray(body.messages)) {
      return Response.json({ error: "messages array is required" }, { status: 400 })
    }

    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : ""
    const currentPageUrl =
      typeof body.current_page_url === "string" ? body.current_page_url.trim() : ""
    const activeProductId =
      typeof body.active_product_id === "string" ? body.active_product_id.trim() : undefined
    const { viewedProductIds, lastPage } = sessionId
      ? await getSessionSignals(sessionId)
      : { viewedProductIds: [], lastPage: null }

    const personalizedSystemPrompt = buildPersonalizationContext({
      currentPageUrl: currentPageUrl || undefined,
      activeProductId,
      viewedProductIds,
      lastTrackedPage: lastPage,
    })

    const result = streamText({
      model: "openai/gpt-4o-mini",
      system: personalizedSystemPrompt
        ? `${baseSystemPrompt}\n\nCustomer context:\n${personalizedSystemPrompt}`
        : baseSystemPrompt,
      messages: await convertToModelMessages(body.messages),
    })

    return result.toUIMessageStreamResponse()
  } catch {
    return Response.json({ error: "Chat generation failed" }, { status: 500 })
  }
}
