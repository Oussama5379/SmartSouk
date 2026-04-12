import "server-only"
import { betterAuth } from "better-auth"
import { Pool } from "pg"
import { Resend } from "resend"

const globalForAuth = globalThis as typeof globalThis & { _pgPool?: Pool }

const pool =
  globalForAuth._pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== "production") {
  globalForAuth._pgPool = pool
}

const secret = process.env.BETTER_AUTH_SECRET?.trim()
if (!secret || secret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to a random string of at least 32 characters."
  )
}

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const resendApiKey = process.env.RESEND_API_KEY?.trim()
const fromEmail = process.env.EMAIL_FROM?.trim() || "Aurea <onboarding@resend.dev>"
const baseURL =
  process.env.BETTER_AUTH_URL?.trim() ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() ||
  "http://localhost:3000"

const resend = resendApiKey ? new Resend(resendApiKey) : null

export const auth = betterAuth({
  appName: "Aurea",
  baseURL,
  secret,
  trustedOrigins: [baseURL].filter(Boolean),
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: !!resend,
    sendResetPassword: resend
      ? async ({ user, url }) => {
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: "Reset your Aurea password",
            html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
          })
        }
      : undefined,
  },
  emailVerification: resend
    ? {
        sendVerificationEmail: async ({ user, url }) => {
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: "Verify your Aurea email",
            html: `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
          })
        },
      }
    : undefined,
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
})
