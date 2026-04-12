"use client"

import { createAuthClient } from "better-auth/react"

const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim()

export const authClient = createAuthClient(baseURL ? { baseURL } : undefined)

export const { signIn, signOut, signUp, useSession } = authClient
