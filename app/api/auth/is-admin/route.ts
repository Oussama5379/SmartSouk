import { getAuthenticatedUser } from "@/lib/admin-auth"
import { NextResponse } from "next/server"

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
)

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ isAdmin: false })
  const isAdmin = adminEmails.size > 0 && !!user.email && adminEmails.has(user.email.toLowerCase())
  return NextResponse.json({ isAdmin })
}
