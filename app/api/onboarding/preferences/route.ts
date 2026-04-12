import { z } from "zod"
import { getAuthenticatedUser } from "@/lib/admin-auth"
import { sql } from "@/lib/db"
import { HARDCODED_BUSINESS_ID } from "@/lib/graph-rag-seed"

const onboardingPreferencesSchema = z.object({
  username: z.string().trim().min(2).max(80),
  budget_range: z.enum(["low", "medium", "high"]),
  preferred_family: z.enum(["Floral", "Oriental", "Fresh", "Woody"]),
  target_occasion: z.enum(["Daily", "Wedding", "Evening", "Gift"]),
  mood: z.enum(["Romantic", "Confident", "Energetic", "Mysterious"]),
})

type OnboardingPreferences = z.infer<typeof onboardingPreferencesSchema>

function toApproxBudgetValue(budgetRange: OnboardingPreferences["budget_range"]): number {
  if (budgetRange === "low") return 120
  if (budgetRange === "high") return 420
  return 260
}

async function upsertLeadProfile(userId: string, profile: OnboardingPreferences) {
  const budgetValue = toApproxBudgetValue(profile.budget_range)

  try {
    await sql`
      INSERT INTO sales.lead_profiles (
        user_id,
        business_id,
        username,
        budget_range,
        preferred_family,
        target_occasion,
        mood,
        updated_at
      )
      VALUES (
        ${userId},
        ${HARDCODED_BUSINESS_ID}::uuid,
        ${profile.username},
        ${profile.budget_range},
        ${profile.preferred_family},
        ${profile.target_occasion},
        ${profile.mood},
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        budget_range = EXCLUDED.budget_range,
        preferred_family = EXCLUDED.preferred_family,
        target_occasion = EXCLUDED.target_occasion,
        mood = EXCLUDED.mood,
        updated_at = NOW()
    `
    return
  } catch {
    try {
      await sql`
        INSERT INTO sales.lead_profiles (
          session_id,
          business_id,
          preferred_family,
          stated_occasion,
          budget_tnd,
          urgency,
          recommended_product,
          score,
          lead_tier
        )
        VALUES (
          ${userId},
          ${HARDCODED_BUSINESS_ID}::uuid,
          ${profile.preferred_family},
          ${profile.target_occasion},
          ${budgetValue},
          'medium',
          '',
          0,
          'warm'
        )
      `
    } catch {
    }
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  let payload: OnboardingPreferences
  try {
    const body = await request.json()
    const parsed = onboardingPreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid onboarding payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    payload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const preferences = {
    username: payload.username,
    budget_range: payload.budget_range,
    preferred_family: payload.preferred_family,
    target_occasion: payload.target_occasion,
    mood: payload.mood,
  }

  try {
    await upsertLeadProfile(user.id, payload)

    await sql`
      CREATE TABLE IF NOT EXISTS public.user_onboarding_profiles (
        user_id text PRIMARY KEY,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        onboarding_completed boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `

    await sql`
      INSERT INTO public.user_onboarding_profiles (user_id, preferences, onboarding_completed, updated_at)
      VALUES (${user.id}, ${JSON.stringify(preferences)}::jsonb, TRUE, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        preferences = EXCLUDED.preferences,
        onboarding_completed = TRUE,
        updated_at = NOW()
    `

    return Response.json({ success: true, preferences })
  } catch (error) {
    console.error("[onboarding/preferences] failed", error)
    return Response.json({ error: "Failed to save onboarding preferences." }, { status: 500 })
  }
}
