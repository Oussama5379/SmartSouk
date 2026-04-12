"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RecommendationProduct {
  id: string
  name: string
  description: string
  price_tnd: number
  image_url?: string | null
  score?: number
  graphScore?: number
}

interface GraphRecommendationResponse {
  recommendations?: RecommendationProduct[]
}

export function RecommendedSection() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [recommendations, setRecommendations] = useState<RecommendationProduct[]>([])

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const response = await fetch("/api/recommendations/graph", { cache: "no-store" })
        if (response.status === 401) {
          setRecommendations([])
          return
        }

        if (!response.ok) {
          setError("Could not load personalized recommendations.")
          return
        }

        const payload = (await response.json()) as GraphRecommendationResponse
        setRecommendations(Array.isArray(payload.recommendations) ? payload.recommendations : [])
      } catch {
        setError("Could not load personalized recommendations.")
      } finally {
        setLoading(false)
      }
    }

    void loadRecommendations()
  }, [])

  if (loading || recommendations.length === 0) {
    return null
  }

  const formatScore = (item: RecommendationProduct): string => {
    const rawScore = typeof item.score === "number" ? item.score : item.graphScore
    return typeof rawScore === "number" ? rawScore.toFixed(2) : "0.00"
  }

  return (
    <section className="border-t bg-muted/30 py-16">
      <div className="container">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Recommended for You</h2>
          <p className="mt-2 text-muted-foreground">
            Picks based on your preferences and similar shopper profiles.
          </p>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{item.price_tnd} TND</span>
                  <span className="text-xs text-muted-foreground">Score: {formatScore(item)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
