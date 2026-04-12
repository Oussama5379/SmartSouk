import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { google } from "@ai-sdk/google"
import { getStoreSettings, listStoreProducts } from "@/lib/store-data"
import {
  buildCatalogRetrievalQuery,
  formatRetrievedCatalogContext,
  retrieveCatalogProducts,
} from "@/lib/product-rag"
import type { StoreProduct } from "@/lib/store-types"
import { getSessionSignals } from "@/lib/tracking-store"

function getBaseSystemPrompt(storeName: string): string {
  return `You are a friendly, highly persuasive Tunisian sales assistant for ${storeName}, a Tunisian artisanal concept store.

Use the RETRIEVED CATALOG CONTEXT provided in this prompt as your source of truth.

Your job is to:
1. Greet customers warmly (use "Marhaba" occasionally)
2. Qualify their needs by asking about their budget, the occasion, what they're looking for, and sector when relevant
3. Recommend 1-2 specific items from the retrieved catalog context based on their answers
4. Highlight the authenticity and craftsmanship of Tunisian products
5. Be concise, warm, and occasionally use Tunisian expressions (2-3 sentences usually)

Important guidelines:
- Never invent products, prices, or stock states not present in RETRIEVED CATALOG CONTEXT
- Only recommend products that are "in stock" or "low stock" unless user explicitly asks about unavailable items
- If a product in context is "out of stock", mention it's currently unavailable and suggest alternatives from context
- Always mention prices in TND (Tunisian Dinar)
- If asked about shipping, say you ship worldwide with tracking`
}

interface ChatRouteBody {
  messages?: UIMessage[]
  session_id?: string
  current_page_url?: string
  active_product_id?: string
}

function getMessageText(message: Pick<UIMessage, "parts">): string {
  if (!Array.isArray(message.parts)) {
    return ""
  }

  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim()
}

function getRecentUserIntent(messages: UIMessage[], limit = 3): string {
  const userTurns = messages
    .filter((message) => message.role === "user")
    .map((message) => getMessageText(message))
    .filter((text) => text.length > 0)

  return userTurns.slice(-limit).join(" ")
}

function getProductById(products: StoreProduct[], productId: string): StoreProduct | undefined {
  return products.find((product) => product.id === productId)
}

function getProductNamesByIds(products: StoreProduct[], productIds: string[]): string[] {
  return productIds
    .map((productId) => getProductById(products, productId)?.name)
    .filter((name): name is string => typeof name === "string")
}

function buildPersonalizationContext(params: {
  products: StoreProduct[]
  currentPageUrl?: string
  activeProductId?: string
  viewedProductIds: string[]
  lastTrackedPage?: string | null
}): string {
  const contextLines: string[] = []
  const { products, currentPageUrl, activeProductId, viewedProductIds, lastTrackedPage } = params
  const activeProductName = activeProductId
    ? getProductById(products, activeProductId)?.name
    : undefined
  const viewedProductNames = getProductNamesByIds(products, viewedProductIds)

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
    const [catalogProducts, settings] = await Promise.all([listStoreProducts(), getStoreSettings()])

    if (catalogProducts.length === 0) {
      return Response.json({ error: "No products available in catalog" }, { status: 500 })
    }

    const { viewedProductIds, lastPage } = sessionId
      ? await getSessionSignals(sessionId)
      : { viewedProductIds: [], lastPage: null }

    const personalizedSystemPrompt = buildPersonalizationContext({
      products: catalogProducts,
      currentPageUrl: currentPageUrl || undefined,
      activeProductId,
      viewedProductIds,
      lastTrackedPage: lastPage,
    })
    const retrievalQuery = buildCatalogRetrievalQuery({
      products: catalogProducts,
      conversationText: getRecentUserIntent(body.messages),
      activeProductId,
      viewedProductIds,
      currentPageUrl: currentPageUrl || undefined,
      lastTrackedPage: lastPage,
    })
    const retrievedCatalog = retrieveCatalogProducts({
      products: catalogProducts,
      query: retrievalQuery,
      activeProductId,
      viewedProductIds,
      limit: 4,
    })
    const ragCatalogContext = formatRetrievedCatalogContext(retrievedCatalog)
    const systemPromptSections = [
      getBaseSystemPrompt(settings.store_name),
      `RETRIEVED CATALOG CONTEXT:\n${ragCatalogContext}`,
    ]
    if (personalizedSystemPrompt) {
      systemPromptSections.push(`CUSTOMER CONTEXT:\n${personalizedSystemPrompt}`)
    }

    const result = streamText({
      model: google("gemini-3.1-flash"),
      system: systemPromptSections.join("\n\n"),
      messages: await convertToModelMessages(body.messages),
    })

    return result.toUIMessageStreamResponse()
  } catch {
    return Response.json({ error: "Chat generation failed" }, { status: 500 })
  }
}
