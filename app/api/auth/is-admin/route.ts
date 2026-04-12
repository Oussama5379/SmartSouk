import { requireAdminAccess } from "@/lib/admin-auth"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const authResult = await requireAdminAccess(request)
  return NextResponse.json({ isAdmin: authResult.ok })
}
