"use client"

import { ErrorBoundary } from "@/components/error-boundary"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Shield, Smartphone } from "lucide-react"
import React, { Fragment, useState } from "react"

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth()
  const [view, setView] = useState<"login" | "reset">("login")
  const [error, setError] = useState("")

  // Safe JSON parsing helper
  const safeParseDemoUsers = (jsonString: string | undefined) => {
    if (!jsonString) return []
    try {
      const parsed = JSON.parse(jsonString)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.warn("Failed to parse demo users JSON:", e)
      return []
    }
  }
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetMethod, setResetMethod] = useState<"sms" | "email">("sms")
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    setError("")

    const result = await login(email, password)

    if (!result.success) {
      setError(result.error || "Login failed")
    }
    setIsLoading(false)
  }

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setError("Please enter your email address")
      return
    }

    setIsLoading(true)
    setError("")
    setResetSuccess(null)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          method: resetMethod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Password reset failed")
        setIsLoading(false)
        return
      }

      setResetSuccess(data.message)
    } catch (err) {
      setError("Connection error. Please try again.")
    } finally {
      setIsLoading(false)
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
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Background Pattern */}
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-background via-background/90 to-card/50" />
        <div
          className="fixed inset-0 -z-10 bg-[size:50px_50px]"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in srgb, var(--primary) 3%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--primary) 3%, transparent) 1px, transparent 1px)",
          }}
        />

        {/* Header */}
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

        {/* Main Content */}
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Login View */}
            {view === "login" && (
              <div
                className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-xl shadow-lg"
                data-testid="login-card"
              >
                {/* Header */}
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="mb-2 font-serif text-2xl font-bold text-foreground">Welcome Back</h2>
                  <p className="text-muted-foreground">Sign in to access your dashboard</p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5" data-testid="login-form">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground/80">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@houseofv.com"
                        className="w-full rounded-xl border border-border bg-background py-3 pr-4 pl-12 text-foreground placeholder-muted-foreground transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        data-testid="email-input"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-medium text-foreground/80"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-border bg-background py-3 pr-12 pl-12 text-foreground placeholder-muted-foreground transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        data-testid="password-input"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        data-testid="toggle-password"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword ? "true" : "false"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
                      data-testid="login-error"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !email || !password}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${
                      isLoading || !email || !password
                        ? "cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    data-testid="login-submit"
                  >
                    {isLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setView("reset")
                      setError("")
                      setResetEmail(email)
                    }}
                    className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                    data-testid="forgot-password"
                  >
                    Forgot your password?
                  </button>
                </form>

                {/* Demo Credentials - only shown in non-production environments */}
                {process.env.NODE_ENV !== "production" && (
                  <div className="mt-8 rounded-xl border border-muted/20 bg-muted/10 p-4">
                    <p className="mb-2 text-sm font-medium text-foreground">Demo Credentials</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {process.env.NEXT_PUBLIC_DEMO_USERS ? (
                        safeParseDemoUsers(process.env.NEXT_PUBLIC_DEMO_USERS).map(
                          (user: { email: string; password: string }, index: number) => (
                            <Fragment key={index}>
                              <div>{user.email}</div>
                              <div className="opacity-70">{user.password}</div>
                            </Fragment>
                          )
                        )
                      ) : (
                        <>
                          <div>hans@houseofv.com</div>
                          <div className="opacity-70">hans123</div>
                          <div>charl@houseofv.com</div>
                          <div className="opacity-70">charl123</div>
                          <div>lucky@houseofv.com</div>
                          <div className="opacity-70">lucky123</div>
                          <div>irma@houseofv.com</div>
                          <div className="opacity-70">irma123</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Password Reset View */}
            {view === "reset" && (
              <div
                className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-xl shadow-lg"
                data-testid="reset-card"
              >
                {/* Back Button */}
                <button
                  onClick={() => {
                    setView("login")
                    setResetSuccess(null)
                    setError("")
                  }}
                  className="mb-6 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  data-testid="back-to-login"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to login</span>
                </button>

                {/* Header */}
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary/10">
                    <Lock className="h-8 w-8 text-secondary" />
                  </div>
                  <h2 className="mb-2 font-serif text-2xl font-bold text-foreground">Reset Password</h2>
                  <p className="text-muted-foreground">
                    We&apos;ll send a new password to your phone or email
                  </p>
                </div>

                {/* Email Input */}
                <div className="mb-6">
                  <label
                    htmlFor="reset-email"
                    className="mb-2 block text-sm font-medium text-foreground/80"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@houseofv.com"
                      className="w-full rounded-xl border border-border bg-background py-3 pr-4 pl-12 text-foreground placeholder-muted-foreground transition-all focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                      data-testid="reset-email-input"
                      required
                    />
                  </div>
                </div>

                {/* Reset Method Selection */}
                <div className="mb-6 space-y-3" data-testid="reset-method-selection">
                  <p className="mb-2 text-sm text-muted-foreground">Delivery method:</p>
                  <button
                    type="button"
                    onClick={() => setResetMethod("sms")}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                      resetMethod === "sms"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                    data-testid="reset-method-sms"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        resetMethod === "sms" ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <Smartphone
                        className={`h-5 w-5 ${resetMethod === "sms" ? "text-primary" : "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`font-medium ${resetMethod === "sms" ? "text-foreground" : "text-foreground/80"}`}
                      >
                        SMS
                      </p>
                      <p className="text-sm text-muted-foreground">Send to registered cellphone</p>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        resetMethod === "sms" ? "border-primary bg-primary" : "border-muted"
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetMethod("email")}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                      resetMethod === "email"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                    data-testid="reset-method-email"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        resetMethod === "email" ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <Mail
                        className={`h-5 w-5 ${resetMethod === "email" ? "text-primary" : "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`font-medium ${resetMethod === "email" ? "text-foreground" : "text-foreground/80"}`}
                      >
                        Email
                      </p>
                      <p className="text-sm text-muted-foreground">Send to registered email</p>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        resetMethod === "email" ? "border-primary bg-primary" : "border-muted"
                      }`}
                    />
                  </button>
                </div>

                {error && (
                  <div
                    className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
                    data-testid="reset-error"
                  >
                    {error}
                  </div>
                )}

                {resetSuccess && (
                  <div
                    className="mb-6 rounded-xl border border-secondary/20 bg-secondary/10 p-4"
                    data-testid="reset-success"
                  >
                    <p className="font-medium text-secondary">{resetSuccess}</p>
                  </div>
                )}

                <button
                  onClick={handleResetPassword}
                  disabled={isLoading || !resetEmail || !!resetSuccess}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${
                    isLoading || !resetEmail || !!resetSuccess
                      ? "cursor-not-allowed bg-muted text-muted-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  }`}
                  data-testid="reset-submit"
                >
                  {isLoading ? (
                     <div className="h-5 w-5 animate-spin rounded-full border-2 border-secondary-foreground/30 border-t-secondary-foreground" />
                  ) : (
                    <>
                      <span>Send New Password</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {resetSuccess && (
                  <button
                    onClick={() => {
                      setView("login")
                      setResetSuccess(null)
                    }}
                    className="mt-4 w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 font-medium text-primary transition-all hover:bg-primary/20"
                    data-testid="return-to-login"
                  >
                    Return to Login
                  </button>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6">
          <div className="container mx-auto px-6 text-center">
            <p className="text-sm text-muted-foreground">© 2026 House of Veritas. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
