import "server-only"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

export const sql = neon(databaseUrl)
