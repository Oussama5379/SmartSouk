export interface RagDocument<TMetadata = unknown> {
  id: string
  content: string
  metadata?: TMetadata
}

export interface RankedRagDocument<TMetadata = unknown> extends RagDocument<TMetadata> {
  score: number
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "de",
  "des",
  "du",
  "for",
  "from",
  "in",
  "is",
  "it",
  "la",
  "le",
  "les",
  "of",
  "on",
  "or",
  "the",
  "to",
  "un",
  "une",
  "with",
])

function normalizeForRag(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function tokenizeForRag(value: string): string[] {
  const normalized = normalizeForRag(value)
  return normalized
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function toFrequencyMap(tokens: string[]): Map<string, number> {
  const frequency = new Map<string, number>()
  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1)
  }
  return frequency
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let dot = 0
  for (const [token, weight] of left) {
    dot += weight * (right.get(token) ?? 0)
  }

  if (dot === 0) {
    return 0
  }

  const leftMagnitude = Math.sqrt(
    Array.from(left.values()).reduce((sum, weight) => sum + weight ** 2, 0)
  )
  const rightMagnitude = Math.sqrt(
    Array.from(right.values()).reduce((sum, weight) => sum + weight ** 2, 0)
  )

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0
  }

  return dot / (leftMagnitude * rightMagnitude)
}

export function rankDocumentsByQuery<TMetadata>(
  query: string,
  documents: Array<RagDocument<TMetadata>>,
  limit = 5
): Array<RankedRagDocument<TMetadata>> {
  if (documents.length === 0 || limit <= 0) {
    return []
  }

  const queryTokens = tokenizeForRag(query)
  if (queryTokens.length === 0) {
    return documents.slice(0, limit).map((document) => ({ ...document, score: 0 }))
  }

  const queryVector = toFrequencyMap(queryTokens)

  return documents
    .map((document) => {
      const documentVector = toFrequencyMap(tokenizeForRag(document.content))
      return {
        ...document,
        score: cosineSimilarity(queryVector, documentVector),
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.id.localeCompare(right.id)
    })
    .slice(0, limit)
}

export function extractBudgetCeiling(query: string): number | null {
  const normalized = normalizeForRag(query)
  const underMatch = normalized.match(
    /(?:under|below|less than|max|maximum|up to|budget|moins de|inferieur a)\s*(\d+(?:\.\d+)?)/
  )
  if (underMatch) {
    const parsed = Number(underMatch[1])
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  const tndMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:tnd|dt|dinar)/)
  if (tndMatch) {
    const parsed = Number(tndMatch[1])
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}
