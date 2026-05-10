"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Smartphone,
  ArrowLeft,
  Copy,
  Check,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const { login } = useAuth()
  const [view, setView] = useState<"login" | "reset">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [resetMethod, setResetMethod] = useState<"sms" | "email">("sms")
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    setError("")

    try {
      const result = await login(email, password)

      if (!result.success) {
        setError(result.error || "Login failed")
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
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

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after animation
    setTimeout(() => {
      setView("login")
      setEmail("")
      setPassword("")
      setError("")
      setResetEmail("")
      setResetSuccess(null)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="ritual-modal-content dark-scrollbar max-h-[90vh] max-w-md overflow-hidden p-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-sigilGold to-transparent opacity-50" />
        {/* Login View */}
        {view === "login" && (
          <div className="p-8">
            <DialogHeader className="mb-10 text-center relative overflow-visible">
              <div className="flex justify-center mb-8 relative">
                {/* Ritual Energy Backdrops */}
                <div className="absolute inset-0 energy-blast opacity-30" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-sigilGold/10 rounded-full animate-rotate-sigil opacity-20" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-sigilGold/5 rounded-full animate-rotate-sigil-reverse opacity-10" />
                
                {/* The Sigil Seal */}
                <div className="relative h-28 w-28 wax-seal-header flex items-center justify-center z-10 transition-transform hover:scale-110 active:scale-95 cursor-pointer">
                  <div className="absolute -inset-1 border-2 border-veritasCrimson opacity-30 rounded-full" />
                </div>

                {/* Sparkling Embers */}
                <span className="absolute top-0 right-1/2 translate-x-10 h-1 w-1 bg-sigilGold rounded-full animate-pulse shadow-[0_0_10px_var(--primary)]" />
                <span className="absolute bottom-4 left-1/2 -translate-x-12 h-1.5 w-1.5 bg-sigilGold rounded-full animate-pulse delay-700 shadow-[0_0_15px_var(--primary)]" />
              </div>

              <div className="relative z-10">
                <DialogTitle className="mb-3 text-4xl font-bold text-parchment ceremonial-text tracking-[0.3em] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                  Bound by Oath
                </DialogTitle>
                <div className="h-px w-24 mx-auto mb-4 bg-linear-to-r from-transparent via-sigilGold/40 to-transparent" />
                <DialogDescription className="text-sigilGold/50 italic font-serif text-base tracking-wide">
                  Your identity is recognized within these halls
                </DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={handleLogin} className="space-y-7 relative z-10" data-testid="login-form">
              <div>
                <label htmlFor="email" className="mb-2 block text-[10px] font-bold text-sigilGold/50 ceremonial-text tracking-[.25em] pl-1">
                  Designate Entity
                </label>
                <div className="relative group">
                  <Mail className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-sigilGold/20 group-focus-within:text-sigilGold transition-all duration-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="entity@houseofv.com"
                    className="w-full rounded-sm border-0 arcane-input py-5 pr-4 pl-14 text-parchment placeholder-parchment/5 focus:outline-none text-base"
                    data-testid="email-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-[10px] font-bold text-sigilGold/50 ceremonial-text tracking-[.25em] pl-1">
                  Unlock Cipher
                </label>
                <div className="relative group">
                  <Lock className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-sigilGold/20 group-focus-within:text-sigilGold transition-all duration-500" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-sm border-0 arcane-input py-5 pr-14 pl-14 text-parchment placeholder-parchment/5 focus:outline-none text-base"
                    data-testid="password-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-5 -translate-y-1/2 text-sigilGold/20 transition-colors hover:text-sigilGold"
                    data-testid="toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="rounded-sm border border-veritasCrimson/40 bg-veritasCrimson/5 p-4 text-xs text-veritasCrimson ceremonial-text text-center tracking-widest animate-pulse"
                  data-testid="login-error"
                >
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className={`group relative flex w-full items-center justify-center gap-5 overflow-hidden rounded-sm px-4 py-6 font-bold transition-all duration-500 ${
                    isLoading || !email || !password
                      ? "cursor-not-allowed bg-muted/5 text-muted-foreground/20 border border-white/5 opacity-50"
                      : "bg-veritasCrimson text-parchment shadow-[0_10px_40px_rgba(139,30,45,0.5)] hover:shadow-[0_15px_50px_rgba(139,30,45,0.8)] border border-sigilGold/20 active:scale-[0.98] hover:-translate-y-1"
                  }`}
                  data-testid="login-submit"
                >
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {isLoading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-parchment/30 border-t-parchment" />
                  ) : (
                    <>
                      <span className="ceremonial-text text-lg tracking-[0.4em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">Enter Sanctum</span>
                      <Zap className="h-5 w-5 text-sigilGold animate-bounce" />
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setView("reset")
                  setError("")
                  setResetEmail(email)
                }}
                className="w-full text-center text-[10px] text-sigilGold/30 ceremonial-text tracking-[.3em] transition-all hover:text-sigilGold/60 hover:tracking-[.4em]"
                data-testid="forgot-password"
              >
                Recall Memory?
              </button>
            </form>

            {/* Demo Credentials - Ritual Sealed Scrolls */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-16 pt-10 border-t border-sigilGold/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-at-top from-sigilGold/5 to-transparent opacity-30 pointer-events-none" />
                <div className="flex items-center justify-between mb-8 relative">
                  <p className="ceremonial-text text-[9px] text-sigilGold/40 font-bold tracking-[0.4em] uppercase">Archival Attestations</p>
                  <div className="h-[1px] flex-1 mx-8 bg-linear-to-r from-sigilGold/20 via-sigilGold/10 to-transparent" />
                </div>
                
                <div className="grid grid-cols-1 gap-6 relative">
                  {[
                    { email: "demo-user-1@example.com", pass: "password123", label: "Ancient Sovereign", role: "ADMIN" },
                    { email: "demo-user-2@example.com", pass: "password123", label: "Loyal Scribe", role: "CHAR" },
                  ].map((demo, idx) => (
                    <div key={idx} className="sealed-scroll group">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-sigilGold/10 text-[8px] text-sigilGold font-bold tracking-widest border border-sigilGold/20">{demo.role}</span>
                            <p className="ceremonial-text text-[10px] text-parchment font-bold tracking-widest">{demo.label}</p>
                          </div>
                          <p className="text-xs text-parchment/30 truncate italic font-serif leading-relaxed pr-4">{demo.email}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => copyToClipboard(demo.email, `e-${idx}`)}
                            className={`p-3 rounded-full transition-all border ${
                              copiedId === `e-${idx}` 
                                ? "bg-green-500/20 border-green-500/40 text-green-400" 
                                : "bg-white/5 border-white/10 text-sigilGold/30 hover:text-sigilGold hover:border-sigilGold/40 hover:bg-white/10 hover:scale-110"
                            }`}
                            title="Harvest Email"
                          >
                            {copiedId === `e-${idx}` ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(demo.pass, `p-${idx}`)}
                            className={`p-3 rounded-full transition-all border ${
                              copiedId === `p-${idx}` 
                                ? "bg-green-500/20 border-green-500/40 text-green-400" 
                                : "bg-white/5 border-white/10 text-sigilGold/30 hover:text-sigilGold hover:border-sigilGold/40 hover:bg-white/10 hover:scale-110"
                            }`}
                            title="Harvest Cipher"
                          >
                            {copiedId === `p-${idx}` ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Password Reset View */}
        {view === "reset" && (
          <div className="p-8">
            {/* Back Button */}
            <button
              onClick={() => {
                setView("login")
                setResetSuccess(null)
                setError("")
              }}
              className="mb-6 flex items-center gap-2 text-white/60 transition-colors hover:text-white"
              data-testid="back-to-login"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to login</span>
            </button>

            <DialogHeader className="mb-8 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary/20">
                <Lock className="h-8 w-8 text-secondary" />
              </div>
              <DialogTitle className="mb-2 text-2xl font-bold text-white">
                Reset Password
              </DialogTitle>
              <DialogDescription className="text-white/60">
                We&apos;ll send a new password to your phone or email
              </DialogDescription>
            </DialogHeader>

            {/* Email Input */}
            <div className="mb-6">
              <label htmlFor="reset-email" className="mb-2 block text-sm font-medium text-white/80">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@houseofv.com"
                  className="w-full rounded-xl border border-border bg-white/5 py-3 pr-4 pl-12 text-white placeholder-white/40 transition-all focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                  data-testid="reset-email-input"
                  required
                />
              </div>
            </div>

            {/* Reset Method Selection */}
            <div className="mb-6 space-y-3" data-testid="reset-method-selection">
              <p className="mb-2 text-sm text-white/60">Delivery method:</p>
              <button
                type="button"
                onClick={() => setResetMethod("sms")}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                  resetMethod === "sms"
                    ? "border-primary/30 bg-primary/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
                data-testid="reset-method-sms"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    resetMethod === "sms" ? "bg-primary/20" : "bg-white/10"
                  }`}
                >
                  <Smartphone
                    className={`h-5 w-5 ${resetMethod === "sms" ? "text-primary" : "text-white/60"}`}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p
                    className={`font-medium ${resetMethod === "sms" ? "text-white" : "text-white/80"}`}
                  >
                    SMS
                  </p>
                  <p className="text-sm text-white/50">Send to registered cellphone</p>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    resetMethod === "sms" ? "border-primary bg-primary" : "border-white/30"
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setResetMethod("email")}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                  resetMethod === "email"
                    ? "border-primary/30 bg-primary/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
                data-testid="reset-method-email"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    resetMethod === "email" ? "bg-primary/20" : "bg-white/10"
                  }`}
                >
                  <Mail
                    className={`h-5 w-5 ${resetMethod === "email" ? "text-primary" : "text-white/60"}`}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p
                    className={`font-medium ${resetMethod === "email" ? "text-white" : "text-white/80"}`}
                  >
                    Email
                  </p>
                  <p className="text-sm text-white/50">Send to registered email</p>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    resetMethod === "email" ? "border-primary bg-primary" : "border-white/30"
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
                className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 p-4"
                data-testid="reset-success"
              >
                <p className="font-medium text-primary">{resetSuccess}</p>
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={isLoading || !resetEmail}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${
                isLoading || !resetEmail
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "shimmer-btn bg-linear-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70"
              }`}
              data-testid="reset-submit"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
      </DialogContent>
    </Dialog>
  )
}
