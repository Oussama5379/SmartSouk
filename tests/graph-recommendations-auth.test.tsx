/*
  Manual integration test:
  - Fetches graph recommendations for an authenticated user with onboarding complete.
  Required env:
    APP_ORIGIN=http://localhost:3000
    AUTH_COOKIE='better-auth.session_token=...'
  Run:
    APP_ORIGIN=http://localhost:3000 AUTH_COOKIE='better-auth.session_token=...' npx tsx tests/graph-recommendations-auth.test.tsx
*/

export {}

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000"
const authCookie = process.env.AUTH_COOKIE ?? ""

async function run() {
  if (!authCookie) {
    console.error("AUTH_COOKIE is required")
    process.exit(1)
  }

  const response = await fetch(`${origin}/api/recommendations/graph`, {
    headers: {
      cookie: authCookie,
    },
  })

  const body = await response.json().catch(() => ({}))
  const recommendations = Array.isArray(body?.recommendations) ? body.recommendations : []
  const passes = response.ok && recommendations.length > 0

  console.log(
    JSON.stringify(
      {
        name: "graph recommendations (authenticated)",
        status: response.status,
        count: recommendations.length,
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
