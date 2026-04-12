import { getAuthenticatedUser } from "@/lib/admin-auth"
import { sql } from "@/lib/db"

interface UserOnboardingRow {
  onboarding_completed: boolean | null
  preferences: unknown
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.user_onboarding_profiles (
        user_id text PRIMARY KEY,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        onboarding_completed boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `

    const rows = (await sql`
      SELECT onboarding_completed, preferences
      FROM public.user_onboarding_profiles
      WHERE user_id = ${user.id}
      LIMIT 1
    `) as UserOnboardingRow[]

    const row = rows[0]
    return Response.json({
      onboarding_completed: !!row?.onboarding_completed,
      preferences: row?.preferences ?? null,
    })
  } catch (error) {
    console.error("[onboarding/status] failed", error)
    return Response.json({ error: "Failed to fetch onboarding status." }, { status: 500 })
  }
}
