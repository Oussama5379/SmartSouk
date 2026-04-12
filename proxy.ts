import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAdminDashboardRoute } from "@/lib/admin-routes"

const PROTECTED_PREFIX = "/dashboard"
const AUTH_PAGES = new Set(["/login", "/signup"])

function isSafeCallback(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

async function hasAdminAccess(request: NextRequest): Promise<boolean> {
  const adminCheckUrl = new URL("/api/auth/is-admin", request.url)

  try {
    const response = await fetch(adminCheckUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    })

    if (!response.ok) return false
    const payload = (await response.json()) as { isAdmin?: boolean }
    return payload.isAdmin === true
  } catch (error) {
    console.error("[proxy] Failed to verify admin access.", error)
    return false
  }
}

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith(PROTECTED_PREFIX) && !sessionCookie) {
    const callbackURL = `${pathname}${search}`
    const loginUrl = new URL("/login", request.url)
    if (isSafeCallback(callbackURL)) loginUrl.searchParams.set("callbackURL", callbackURL)
    return NextResponse.redirect(loginUrl)
  }

  // Bypass admin route blocking for the pitch: any logged-in user can access admin routes
  // if (sessionCookie && isAdminDashboardRoute(pathname)) {
  //   const isAdmin = await hasAdminAccess(request)
  //   if (!isAdmin) {
  //     return NextResponse.redirect(new URL("/dashboard", request.url))
  //   }
  // }

  if (sessionCookie && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
}
