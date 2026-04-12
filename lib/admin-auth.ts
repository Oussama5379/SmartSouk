import { auth } from "@/lib/auth"

export interface AuthenticatedUser {
  id: string
  email: string | null
  displayName: string | null
}

type AdminAccessResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: number; error: string }

const configuredAdminEmails = new Set(
  [process.env.ADMIN_EMAILS, process.env.AUTH_ADMIN_EMAILS]
    .flatMap((v) => v?.split(",") ?? [])
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
)

function isAdminUser(email: string | null): boolean {
  // Security: deny by default when no admin emails configured — never grant access to everyone.
  if (configuredAdminEmails.size === 0) return false
  const normalized = email?.trim().toLowerCase()
  return normalized ? configuredAdminEmails.has(normalized) : false
}

export function adminErrorResponse(result: Extract<AdminAccessResult, { ok: false }>): Response {
  return Response.json({ error: result.error }, { status: result.status })
}

export async function getAuthenticatedUser(request?: Request): Promise<AuthenticatedUser | null> {
  try {
    const headers = request?.headers ?? new Headers()
    const session = await auth.api.getSession({ headers })
    if (!session?.user) return null
    const u = session.user as { id?: string; email?: string; name?: string }
    const id = typeof u.id === "string" ? u.id.trim() : ""
    if (!id) return null
    return {
      id,
      email: typeof u.email === "string" ? u.email.trim().toLowerCase() : null,
      displayName: typeof u.name === "string" ? u.name.trim() : null,
    }
  } catch (error) {
    console.error("[admin-auth] Failed to read Better Auth session.", error)
    return null
  }
}

export async function requireAdminAccess(request: Request): Promise<AdminAccessResult> {
  let user: AuthenticatedUser | null = null

  try {
    user = await getAuthenticatedUser(request)
  } catch (error) {
    console.error("[admin-auth] Failed to verify Better Auth session.", error)
    return { ok: false, status: 500, error: "Failed to verify authentication session." }
  }

  if (!user) return { ok: false, status: 401, error: "Authentication required." }
  if (!isAdminUser(user.email)) return { ok: false, status: 403, error: "Admin privileges are required." }

  return { ok: true, user }
}
