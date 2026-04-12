import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PREFIX = "/dashboard"
const AUTH_PAGES = new Set(["/login", "/signup"])

function isSafeCallback(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith(PROTECTED_PREFIX) && !sessionCookie) {
    const callbackURL = `${pathname}${search}`
    const loginUrl = new URL("/login", request.url)
    if (isSafeCallback(callbackURL)) loginUrl.searchParams.set("callbackURL", callbackURL)
    return NextResponse.redirect(loginUrl)
  }

  if (sessionCookie && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
}
