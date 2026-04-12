import { sql } from "@/lib/db"
import { DEFAULT_GRAPH_BUSINESS_ID, embedText } from "@/lib/graph-rag"

export const HARDCODED_BUSINESS_ID = DEFAULT_GRAPH_BUSINESS_ID

type SeedTriple = {
  subject: string
  predicate: string
  object: string
  context: Record<string, string>
}

const SEED_TRIPLES: SeedTriple[] = [
  { subject: "Floral", predicate: "suits_occasion", object: "Wedding", context: { kind: "family_occasion" } },
  { subject: "Oriental", predicate: "suits_occasion", object: "Evening", context: { kind: "family_occasion" } },
  { subject: "Fresh", predicate: "suits_occasion", object: "Daily", context: { kind: "family_occasion" } },
  { subject: "Woody", predicate: "suits_occasion", object: "Office", context: { kind: "family_occasion" } },
  { subject: "Wedding", predicate: "best_in_season", object: "Spring", context: { kind: "occasion_season" } },
  { subject: "Evening", predicate: "best_in_season", object: "Winter", context: { kind: "occasion_season" } },
  { subject: "Floral", predicate: "evokes_mood", object: "Romantic", context: { kind: "family_mood" } },
  { subject: "Fresh", predicate: "evokes_mood", object: "Energetic", context: { kind: "family_mood" } },
  { subject: "Woody", predicate: "evokes_mood", object: "Confident", context: { kind: "family_mood" } },
  { subject: "Oriental", predicate: "evokes_mood", object: "Mysterious", context: { kind: "family_mood" } },
  { subject: "budget_low", predicate: "often_prefers", object: "Fresh", context: { kind: "budget_family" } },
  { subject: "budget_mid", predicate: "often_prefers", object: "Floral", context: { kind: "budget_family" } },
  { subject: "budget_high", predicate: "often_prefers", object: "Oriental", context: { kind: "budget_family" } },
  { subject: "Rose Elixir", predicate: "belongs_to_family", object: "Floral", context: { kind: "product_family" } },
  { subject: "Oud Noir", predicate: "belongs_to_family", object: "Oriental", context: { kind: "product_family" } },
  { subject: "Citrus Breeze", predicate: "belongs_to_family", object: "Fresh", context: { kind: "product_family" } },
  { subject: "Cedar Mist", predicate: "belongs_to_family", object: "Woody", context: { kind: "product_family" } },
  { subject: "Rose Elixir", predicate: "recommended_for", object: "Wedding", context: { kind: "product_occasion" } },
  { subject: "Oud Noir", predicate: "recommended_for", object: "Evening", context: { kind: "product_occasion" } },
  { subject: "Citrus Breeze", predicate: "recommended_for", object: "Daily", context: { kind: "product_occasion" } },
  { subject: "Cedar Mist", predicate: "recommended_for", object: "Office", context: { kind: "product_occasion" } },
  { subject: "Gift", predicate: "often_prefers", object: "Floral", context: { kind: "occasion_family" } },
]

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`
}

export async function seedKgTriples(): Promise<number> {
  let insertedCount = 0

  for (const triple of SEED_TRIPLES) {
    const embedding = await embedText(`${triple.subject} ${triple.predicate} ${triple.object}`)
    const result = (await sql`
      INSERT INTO sales.kg_triples (business_id, subject, predicate, object, embedding, context)
      VALUES (
        ${HARDCODED_BUSINESS_ID}::uuid,
        ${triple.subject},
        ${triple.predicate},
        ${triple.object},
        ${toVectorLiteral(embedding)}::vector,
        ${JSON.stringify(triple.context)}::jsonb
      )
      ON CONFLICT DO NOTHING
      RETURNING id::text AS id
    `) as Array<{ id: string }>

    if (result.length > 0) {
      insertedCount += 1
    }
  }

  return insertedCount
}
