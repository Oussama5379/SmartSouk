import { sql } from "@/lib/db"

export const DEFAULT_GRAPH_BUSINESS_ID = "00000000-0000-0000-0000-000000000001"

export type KgTriple = {
  id: string
  subject: string
  predicate: string
  object: string
  context: unknown
}

export type StoreProduct = {
  id: string
  name: string
  category: string
  description: string
  price_tnd: number
  stock_status: string
  image: string | null
  created_at: number | null
  updated_at: number | null
  deleted_at: number | null
}

export type RankedProduct = StoreProduct & {
  graphScore: number
  matchedEntities: string[]
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`
}

function extractEmbeddingFromGeminiPayload(payload: unknown): number[] {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid Gemini embedding response")
  }

  const payloadRecord = payload as Record<string, unknown>
  const embeddingRecord = payloadRecord.embedding
  if (typeof embeddingRecord !== "object" || embeddingRecord === null) {
    throw new Error("Gemini response missing embedding object")
  }

  const values = (embeddingRecord as Record<string, unknown>).values
  if (!Array.isArray(values)) {
    throw new Error("Gemini response missing embedding values")
  }

  const vector = values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (vector.length === 0) {
    throw new Error("Gemini returned empty embedding")
  }

  return vector
}

export async function embedText(text: string): Promise<number[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required for Graph RAG embeddings")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }],
        },
      }),
      cache: "no-store",
    }
  )

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new Error(`Gemini embedding request failed (${response.status}): ${errorPayload}`)
  }

  const payload = (await response.json()) as unknown
  return extractEmbeddingFromGeminiPayload(payload)
}

export async function searchKgTriples(embedding: number[], businessId: string, topK = 10): Promise<KgTriple[]> {
  const rows = (await sql`
    SELECT id::text AS id, subject, predicate, object, context
    FROM sales.kg_triples
    WHERE business_id = ${businessId}::uuid
    ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
    LIMIT ${topK}
  `) as Array<{
    id: string
    subject: string
    predicate: string
    object: string
    context: unknown
  }>

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    predicate: row.predicate,
    object: row.object,
    context: row.context,
  }))
}

export function traverseGraph(anchorTriples: KgTriple[], allTriples: KgTriple[], depth = 2): string[] {
  const discovered = new Set<string>()
  const frontier = new Set<string>()

  for (const triple of anchorTriples) {
    discovered.add(triple.subject)
    discovered.add(triple.object)
    frontier.add(triple.subject)
    frontier.add(triple.object)
  }

  for (let level = 0; level < depth; level += 1) {
    const nextFrontier = new Set<string>()
    for (const triple of allTriples) {
      if (frontier.has(triple.subject) || frontier.has(triple.object)) {
        if (!discovered.has(triple.subject)) {
          discovered.add(triple.subject)
          nextFrontier.add(triple.subject)
        }
        if (!discovered.has(triple.object)) {
          discovered.add(triple.object)
          nextFrontier.add(triple.object)
        }
      }
    }
    if (nextFrontier.size === 0) {
      break
    }
    frontier.clear()
    for (const node of nextFrontier) {
      frontier.add(node)
    }
  }

  return [...discovered]
}

export function rankProductsByGraph(entityNames: string[], products: StoreProduct[]): RankedProduct[] {
  const normalizedEntities = entityNames
    .map((entity) => entity.trim())
    .filter(Boolean)
    .map((entity) => ({
      original: entity,
      normalized: normalizeText(entity),
    }))

  return products
    .map((product) => {
      const searchable = normalizeText(`${product.name} ${product.category} ${product.description}`)
      const matchedEntities: string[] = []

      for (const entity of normalizedEntities) {
        if (searchable.includes(entity.normalized)) {
          matchedEntities.push(entity.original)
        }
      }

      return {
        ...product,
        graphScore: matchedEntities.length,
        matchedEntities,
      }
    })
    .filter((product) => product.graphScore > 0)
    .sort((left, right) => right.graphScore - left.graphScore)
}

async function listCandidateProducts(): Promise<StoreProduct[]> {
  const products = (await sql`
    SELECT
      id::text AS id,
      name,
      category,
      description,
      price_tnd,
      stock_status,
      image,
      created_at,
      updated_at,
      deleted_at
    FROM public.store_products
    WHERE deleted_at IS NULL
      AND stock_status != 'out_of_stock'
  `) as Array<{
    id: string
    name: string
    category: string
    description: string
    price_tnd: number | string
    stock_status: string
    image: string | null
    created_at: number | string | null
    updated_at: number | string | null
    deleted_at: number | string | null
  }>

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    price_tnd: Number(product.price_tnd),
    stock_status: product.stock_status,
    image: product.image,
    created_at: product.created_at === null ? null : Number(product.created_at),
    updated_at: product.updated_at === null ? null : Number(product.updated_at),
    deleted_at: product.deleted_at === null ? null : Number(product.deleted_at),
  }))
}

async function getFallbackRecommendations(): Promise<RankedProduct[]> {
  const products = await listCandidateProducts()
  return products.slice(0, 5).map((product, index) => ({
    ...product,
    graphScore: Math.max(0.1, 1 - index * 0.1),
    matchedEntities: [],
  }))
}

async function readProfile(userId: string, businessId: string): Promise<{
  preferred_family: string | null
  stated_occasion: string | null
  budget_tnd: number | null
}> {
  try {
    const rows = (await sql`
      SELECT
        preferred_family,
        COALESCE(stated_occasion, target_occasion) AS stated_occasion,
        COALESCE(
          budget_tnd,
          CASE budget_range
            WHEN 'low' THEN 120
            WHEN 'medium' THEN 260
            WHEN 'high' THEN 420
            ELSE NULL
          END
        ) AS budget_tnd
      FROM sales.lead_profiles
      WHERE user_id::text = ${userId}
        AND business_id = ${businessId}::uuid
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `) as Array<{
      preferred_family: string | null
      stated_occasion: string | null
      budget_tnd: number | string | null
    }>

    const profile = rows[0]
    return {
      preferred_family: profile?.preferred_family ?? null,
      stated_occasion: profile?.stated_occasion ?? null,
      budget_tnd: profile?.budget_tnd === null || profile?.budget_tnd === undefined ? null : Number(profile.budget_tnd),
    }
  } catch {
    const rows = (await sql`
      SELECT
        preferred_family,
        stated_occasion,
        budget_tnd
      FROM sales.lead_profiles
      WHERE session_id = ${userId}
        AND business_id = ${businessId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{
      preferred_family: string | null
      stated_occasion: string | null
      budget_tnd: number | string | null
    }>

    const profile = rows[0]
    return {
      preferred_family: profile?.preferred_family ?? null,
      stated_occasion: profile?.stated_occasion ?? null,
      budget_tnd: profile?.budget_tnd === null || profile?.budget_tnd === undefined ? null : Number(profile.budget_tnd),
    }
  }
}

export async function getGraphRagRecommendations(
  userId: string,
  businessId = DEFAULT_GRAPH_BUSINESS_ID
): Promise<RankedProduct[]> {
  const profile = await readProfile(userId, businessId)
  if (!profile.preferred_family || !profile.stated_occasion || profile.budget_tnd === null) {
    return getFallbackRecommendations()
  }

  let anchorTriples: KgTriple[] = []
  try {
    const queryText = `${profile.preferred_family} perfume for ${profile.stated_occasion} occasion budget ${profile.budget_tnd} TND`
    const embedding = await embedText(queryText)
    anchorTriples = await searchKgTriples(embedding, businessId, 10)
  } catch {
    return getFallbackRecommendations()
  }

  const allTriples = (await sql`
    SELECT id::text AS id, subject, predicate, object, context
    FROM sales.kg_triples
    WHERE business_id = ${businessId}::uuid
  `) as Array<{
    id: string
    subject: string
    predicate: string
    object: string
    context: unknown
  }>

  const traversedEntities = traverseGraph(
    anchorTriples,
    allTriples.map((triple) => ({
      id: triple.id,
      subject: triple.subject,
      predicate: triple.predicate,
      object: triple.object,
      context: triple.context,
    })),
    2
  )

  const normalizedProducts = await listCandidateProducts()

  const ranked = rankProductsByGraph(traversedEntities, normalizedProducts).slice(0, 5)
  if (ranked.length === 0) {
    return getFallbackRecommendations()
  }

  return ranked
}