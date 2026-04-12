/*
  Manual integration test:
  - Verifies unauthenticated dashboard request redirects to login.
  Run:
    APP_ORIGIN=http://localhost:3000 npx tsx tests/onboarding-redirect.test.tsx
*/

export {}

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000"

async function run() {
  const response = await fetch(`${origin}/dashboard`, {
    method: "GET",
    redirect: "manual",
  })

  const location = response.headers.get("location") ?? ""
  const passes = response.status >= 300 && response.status < 400 && location.includes("/login")

  console.log(
    JSON.stringify(
      {
        name: "onboarding redirect (unauthenticated)",
        status: response.status,
        location,
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
