import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PREFIX = "/dashboard"
const AUTH_PAGES = new Set(["/login", "/signup"])
const ONBOARDING_PATH = "/onboarding"

function isSafeCallback(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

function needsOnboardingCheck(pathname: string): boolean {
  return pathname.startsWith(PROTECTED_PREFIX)
}

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname, search } = request.nextUrl

  if ((pathname.startsWith(PROTECTED_PREFIX) || pathname === ONBOARDING_PATH) && !sessionCookie) {
    const callbackURL = `${pathname}${search}`
    const loginUrl = new URL("/login", request.url)
    if (isSafeCallback(callbackURL)) loginUrl.searchParams.set("callbackURL", callbackURL)
    return NextResponse.redirect(loginUrl)
  }

  if (sessionCookie && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (sessionCookie && (pathname === ONBOARDING_PATH || needsOnboardingCheck(pathname))) {
    try {
      const statusUrl = new URL("/api/onboarding/status", request.url)
      const statusResponse = await fetch(statusUrl, {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      })

      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as { onboarding_completed?: boolean }
        const onboardingCompleted = !!status.onboarding_completed

        if (pathname === ONBOARDING_PATH && onboardingCompleted) {
          return NextResponse.redirect(new URL("/dashboard", request.url))
        }

        if (needsOnboardingCheck(pathname) && !onboardingCompleted) {
          return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url))
        }
      }
    } catch {
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/onboarding"],
}
