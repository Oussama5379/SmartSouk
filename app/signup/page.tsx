"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signUp, useSession } from "@/lib/auth-client"

function resolveCallbackURL(value: string | null): string {
  if (!value) return "/dashboard"
  const n = value.trim()
  if (!n.startsWith("/") || n.startsWith("//")) return "/dashboard"
  return n
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackURL = useMemo(
    () => resolveCallbackURL(searchParams.get("callbackURL")),
    [searchParams]
  )
  const { data: session, isPending } = useSession()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  useEffect(() => {
    if (!isPending && session) router.replace(callbackURL)
  }, [callbackURL, isPending, router, session])

  const handleEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")
    const normalizedName = name.trim()
    const normalizedEmail = email.trim()
    if (normalizedName.length < 2) { setErrorMessage("Name must be at least 2 characters."); return }
    if (!isEmail(normalizedEmail)) { setErrorMessage("Please enter a valid email address."); return }
    if (password.length < 8) { setErrorMessage("Password must be at least 8 characters."); return }
    if (password !== confirmPassword) { setErrorMessage("Passwords do not match."); return }

    setSubmitting(true)
    const response = await signUp.email({ name: normalizedName, email: normalizedEmail, password, callbackURL })
    setSubmitting(false)

    if (response.error) {
      setErrorMessage(response.error.message || "Unable to create your account.")
      return
    }
    router.replace(callbackURL)
  }

  const handleGoogleSignup = async () => {
    setErrorMessage("")
    setGoogleSubmitting(true)
    const response = await signIn.social({ provider: "google", callbackURL })
    setGoogleSubmitting(false)
    if (response?.error) setErrorMessage(response.error.message || "Unable to continue with Google.")
  }

  if (isPending && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Start using your protected dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <form className="space-y-4" onSubmit={(e) => void handleEmailSignup(e)}>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || googleSubmitting}>
              {submitting ? "Creating account..." : "Create account with email"}
            </Button>
          </form>

          <Button type="button" variant="outline" className="w-full"
            onClick={() => void handleGoogleSignup()} disabled={submitting || googleSubmitting}>
            {googleSubmitting ? "Redirecting..." : "Continue with Google"}
          </Button>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`} className="underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
