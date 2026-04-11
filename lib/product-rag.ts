import { getProductById, products, type Product } from "@/lib/mock-data"
import { extractBudgetCeiling, rankDocumentsByQuery, tokenizeForRag, type RagDocument } from "@/lib/rag-utils"

export interface RetrievedCatalogProduct {
  product: Product
  score: number
  reasons: string[]
}

const CATEGORY_INTENT_KEYWORDS: Record<Product["category"], string[]> = {
  ceramics: [
    "ceramic",
    "ceramics",
    "pottery",
    "plate",
    "vase",
    "bowl",
    "tableware",
    "decor",
    "decoration",
  ],
  rugs: ["rug", "rugs", "kilim", "runner", "home", "living", "floor", "interior", "style"],
  oils: [
    "oil",
    "oils",
    "olive",
    "argan",
    "prickly",
    "skin",
    "hair",
    "beauty",
    "cooking",
    "gift",
  ],
}

const STOCK_ORDER: Record<Product["stock_status"], number> = {
  in_stock: 2,
  low_stock: 1,
  out_of_stock: 0,
}

const catalogDocuments: Array<RagDocument<Product>> = products.map((product) => ({
  id: product.id,
  metadata: product,
  content: [
    product.name,
    product.category,
    `${product.price_tnd} tnd`,
    product.stock_status.replace(/_/g, " "),
    product.description,
  ].join(" "),
}))

function detectCategoryIntent(query: string): Set<Product["category"]> {
  const tokens = new Set(tokenizeForRag(query))
  const detected = new Set<Product["category"]>()

  for (const [category, keywords] of Object.entries(CATEGORY_INTENT_KEYWORDS) as Array<
    [Product["category"], string[]]
  >) {
    for (const keyword of keywords) {
      if (tokens.has(keyword)) {
        detected.add(category)
        break
      }
    }
  }

  return detected
}

function applyBudgetScore(price: number, budgetCeiling: number): number {
  if (price <= budgetCeiling) {
    return 0.08
  }

  if (price <= budgetCeiling * 1.15) {
    return 0.02
  }

  return -0.08
}

export function buildCatalogRetrievalQuery(params: {
  conversationText: string
  activeProductId?: string
  viewedProductIds?: string[]
  currentPageUrl?: string
  lastTrackedPage?: string | null
}): string {
  const lines: string[] = []
  if (params.conversationText.trim()) {
    lines.push(params.conversationText.trim())
  }

  if (params.activeProductId) {
    const activeProduct = getProductById(params.activeProductId)
    if (activeProduct) {
      lines.push(`Customer is focused on ${activeProduct.name} (${activeProduct.category}).`)
    }
  }

  const viewedProductNames = (params.viewedProductIds ?? [])
    .map((productId) => getProductById(productId)?.name)
    .filter((name): name is string => Boolean(name))
  if (viewedProductNames.length > 0) {
    lines.push(`Viewed products: ${viewedProductNames.join(", ")}.`)
  }

  if (params.currentPageUrl) {
    lines.push(`Current page: ${params.currentPageUrl}.`)
  } else if (params.lastTrackedPage) {
    lines.push(`Last tracked page: ${params.lastTrackedPage}.`)
  }

  return lines.join(" ")
}

export function retrieveCatalogProducts(params: {
  query: string
  activeProductId?: string
  viewedProductIds?: string[]
  limit?: number
  includeOutOfStock?: boolean
}): RetrievedCatalogProduct[] {
  const limit = params.limit ?? 4
  const ranked = rankDocumentsByQuery(params.query, catalogDocuments, catalogDocuments.length)
  const scoreById = new Map(ranked.map((entry) => [entry.id, entry.score]))
  const viewedProductSet = new Set((params.viewedProductIds ?? []).map((id) => id.trim()).filter(Boolean))
  const categoryIntent = detectCategoryIntent(params.query)
  const budgetCeiling = extractBudgetCeiling(params.query)

  const scoredProducts: RetrievedCatalogProduct[] = products.map((product) => {
    let score = scoreById.get(product.id) ?? 0
    const reasons: string[] = []

    if (score > 0) {
      reasons.push("semantic relevance")
    }

    if (params.activeProductId && product.id === params.activeProductId) {
      score += 0.35
      reasons.push("active product focus")
    }

    if (viewedProductSet.has(product.id)) {
      score += 0.18
      reasons.push("viewed in this session")
    }

    if (categoryIntent.has(product.category)) {
      score += 0.12
      reasons.push("category intent match")
    }

    if (budgetCeiling !== null) {
      score += applyBudgetScore(product.price_tnd, budgetCeiling)
      reasons.push(`budget signal (${budgetCeiling} TND)`)
    }

    if (product.stock_status === "out_of_stock") {
      score -= 0.2
      reasons.push("out of stock penalty")
    }

    return {
      product,
      score,
      reasons,
    }
  })

  const includeOutOfStock = params.includeOutOfStock ?? false
  const filtered = includeOutOfStock
    ? scoredProducts
    : scoredProducts.filter((entry) => entry.product.stock_status !== "out_of_stock")

  const candidates = filtered.length > 0 ? filtered : scoredProducts

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      const stockDiff = STOCK_ORDER[right.product.stock_status] - STOCK_ORDER[left.product.stock_status]
      if (stockDiff !== 0) {
        return stockDiff
      }

      return left.product.name.localeCompare(right.product.name)
    })
    .slice(0, Math.max(1, limit))
    .map((entry) => ({
      ...entry,
      score: Number(entry.score.toFixed(4)),
    }))
}

export function formatRetrievedCatalogContext(retrieved: RetrievedCatalogProduct[]): string {
  if (retrieved.length === 0) {
    return "No product retrieved."
  }

  return retrieved
    .map(
      (entry) =>
        `- [${entry.product.id}] ${entry.product.name} | ${entry.product.category} | ${entry.product.price_tnd} TND | ${entry.product.stock_status.replace(
          /_/g,
          " "
        )} | ${entry.product.description}`
    )
    .join("\n")
}
