"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type BudgetRange = "low" | "medium" | "high"
type PreferredFamily = "Floral" | "Oriental" | "Fresh" | "Woody"
type TargetOccasion = "Daily" | "Wedding" | "Evening" | "Gift"
type Mood = "Romantic" | "Confident" | "Energetic" | "Mysterious"

interface OnboardingState {
  username: string
  budget_range: BudgetRange | ""
  preferred_family: PreferredFamily | ""
  target_occasion: TargetOccasion | ""
  mood: Mood | ""
}

interface OnboardingStatusResponse {
  onboarding_completed: boolean
  preferences: Partial<OnboardingState> | null
}

const STEP_COUNT = 4

const budgetOptions: Array<{ label: string; value: BudgetRange; note: string }> = [
  { label: "Low", value: "low", note: "Entry-friendly choices" },
  { label: "Medium", value: "medium", note: "Balanced value and quality" },
  { label: "High", value: "high", note: "Premium fragrance selection" },
]

const familyOptions: PreferredFamily[] = ["Floral", "Oriental", "Fresh", "Woody"]
const occasionOptions: TargetOccasion[] = ["Daily", "Wedding", "Evening", "Gift"]
const moodOptions: Mood[] = ["Romantic", "Confident", "Energetic", "Mysterious"]

const initialState: OnboardingState = {
  username: "",
  budget_range: "",
  preferred_family: "",
  target_occasion: "",
  mood: "",
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [state, setState] = useState<OnboardingState>(initialState)

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/onboarding/status", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/login?callbackURL=/onboarding")
          return
        }

        if (!response.ok) {
          setError("Failed to load onboarding status.")
          return
        }

        const body = (await response.json()) as OnboardingStatusResponse
        if (body.onboarding_completed) {
          router.replace("/dashboard")
          return
        }

        if (body.preferences) {
          setState((current) => ({ ...current, ...body.preferences }))
        }
      } catch {
        setError("Failed to load onboarding status.")
      } finally {
        setLoading(false)
      }
    }

    void loadStatus()
  }, [router])

  const canContinue = useMemo(() => {
    if (step === 1) return state.username.trim().length >= 2
    if (step === 2) return state.budget_range !== ""
    if (step === 3) return state.preferred_family !== "" && state.target_occasion !== ""
    return state.mood !== ""
  }, [state, step])

  const nextStep = () => {
    if (!canContinue || step >= STEP_COUNT) {
      return
    }
    setStep((current) => Math.min(STEP_COUNT, current + 1))
    setError("")
  }

  const previousStep = () => {
    setStep((current) => Math.max(1, current - 1))
    setError("")
  }

  const handleSubmit = async () => {
    if (!canContinue || saving) {
      return
    }

    setSaving(true)
    setError("")

    try {
      const response = await fetch("/api/onboarding/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      })

      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Failed to save preferences.")
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Failed to save preferences.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container py-10">
        <Card>
          <CardContent className="pt-6">Loading onboarding...</CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container py-10">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Let&apos;s personalize your recommendations</CardTitle>
          <CardDescription>
            Step {step} of {STEP_COUNT}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {step === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="username">What should we call you?</Label>
              <Input
                id="username"
                placeholder="e.g. Sarah"
                value={state.username}
                onChange={(event) => setState((current) => ({ ...current, username: event.target.value }))}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <Label>Select your budget range</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {budgetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-md border p-3 text-left transition-colors ${
                      state.budget_range === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setState((current) => ({ ...current, budget_range: option.value }))}
                  >
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.note}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label>Preferred scent family</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {familyOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        state.preferred_family === value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                      onClick={() => setState((current) => ({ ...current, preferred_family: value }))}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Target occasion</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {occasionOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        state.target_occasion === value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                      onClick={() => setState((current) => ({ ...current, target_occasion: value }))}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <Label>How do you want to feel?</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {moodOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      state.mood === value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setState((current) => ({ ...current, mood: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" disabled={step === 1 || saving} onClick={previousStep}>
              Back
            </Button>

            {step < STEP_COUNT ? (
              <Button type="button" disabled={!canContinue || saving} onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button type="button" disabled={!canContinue || saving} onClick={() => void handleSubmit()}>
                {saving ? "Saving..." : "Finish"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
