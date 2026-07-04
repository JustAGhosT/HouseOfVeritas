"use client"

import { ErrorBoundary } from "@/components/error-boundary"
import { useAuth } from "@/lib/auth-context"
import { signIn } from "next-auth/react"
import { ArrowRight, Shield } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

// Auth.js redirects a failed sign-in back to the configured sign-in page as
// `/login?error=<code>`. Map the codes we can meaningfully act on to friendly
// copy; anything else falls back to a generic message. `AccessDenied` is the
// one users hit most here — it's what our `signIn` callback returns when the
// Mystira identity is unverified or not present in the estate registry.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Your Mystira account isn't recognized by the estate registry. Contact an administrator to be granted access.",
  Configuration: "Sign-in is temporarily unavailable. Please try again in a moment.",
  Verification: "That sign-in link has expired. Please try signing in again.",
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
}
const DEFAULT_AUTH_ERROR = "Sign-in failed. Please try again."

function messageForErrorCode(code: string | null): string {
  if (!code) return ""
  return AUTH_ERROR_MESSAGES[code] ?? DEFAULT_AUTH_ERROR
}

function LoginPageContent() {
  const { isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const [isSigningIn, setIsSigningIn] = useState(false)
  // Seed the error from the `?error=` code Auth.js appends on a failed sign-in
  // redirect, so a rejected user sees why instead of a silent bounce to /login.
  const [error, setError] = useState(() => messageForErrorCode(searchParams.get("error")))

  const callbackUrl = searchParams.get("redirect") ?? "/"

  const handleSignIn = async () => {
    setIsSigningIn(true)
    setError("")
    try {
      await signIn("mystira", { callbackUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
      setIsSigningIn(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="fixed inset-0 -z-10 bg-linear-to-br from-background via-background/90 to-card/50" />
      <div
        className="fixed inset-0 -z-10 bg-[size:50px_50px]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--primary) 3%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--primary) 3%, transparent) 1px, transparent 1px)",
        }}
      />

      <header className="border-b border-border bg-background/40 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/80">
              <span className="font-serif text-lg font-bold text-primary-foreground">HV</span>
            </div>
            <div>
              <h1 className="font-serif font-semibold text-foreground">House of Veritas</h1>
              <p className="text-xs text-muted-foreground">Digital Governance Platform</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-xl shadow-lg"
            data-testid="login-card"
          >
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-bold text-foreground">Welcome Back</h2>
              <p className="text-muted-foreground">Sign in via Mystira to access your dashboard</p>
            </div>

            {error && (
              <div
                className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
                data-testid="login-error"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${
                isSigningIn
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              data-testid="login-submit"
            >
              {isSigningIn ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <>
                  <span>Continue with Mystira</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Authentication is handled by Mystira Identity. Your House of Veritas access is granted
              once your email is recognized by the estate registry.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">© 2026 House of Veritas. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        }
      >
        <LoginPageContent />
      </Suspense>
    </ErrorBoundary>
  )
}
