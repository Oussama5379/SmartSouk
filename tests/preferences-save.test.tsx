/*
  Manual integration test:
  - Saves onboarding preferences for an authenticated user.
  Required env:
    APP_ORIGIN=http://localhost:3000
    AUTH_COOKIE='better-auth.session_token=...'
  Run:
    APP_ORIGIN=http://localhost:3000 AUTH_COOKIE='better-auth.session_token=...' npx tsx tests/preferences-save.test.tsx
*/

export {}

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000"
const authCookie = process.env.AUTH_COOKIE ?? ""

const payload = {
  username: "Test User",
  budget_range: "medium",
  preferred_family: "Floral",
  target_occasion: "Gift",
  mood: "Romantic",
}

async function run() {
  if (!authCookie) {
    console.error("AUTH_COOKIE is required")
    process.exit(1)
  }

  const response = await fetch(`${origin}/api/onboarding/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => ({}))
  const passes = response.ok && body?.success === true

  console.log(
    JSON.stringify(
      {
        name: "preferences save",
        status: response.status,
        body,
        pass: passes,
      },
      null,
      2
    )
  )

  if (!passes) {
    process.exitCode = 1
  }
}

void run()
