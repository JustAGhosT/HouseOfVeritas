"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ArrowRight, Zap } from "lucide-react"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignIn = async () => {
    setIsLoading(true)
    setError("")
    try {
      await signIn("mystira", { callbackUrl: "/" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setError("")
      setIsLoading(false)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="ritual-modal-content dark-scrollbar max-h-[90vh] max-w-md overflow-hidden p-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-sigilGold to-transparent opacity-50" />
        <div className="p-8">
          <DialogHeader className="mb-10 text-center relative overflow-visible">
            <div className="flex justify-center mb-8 relative">
              <div className="absolute inset-0 energy-blast opacity-30" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-sigilGold/10 rounded-full animate-rotate-sigil opacity-20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-sigilGold/5 rounded-full animate-rotate-sigil-reverse opacity-10" />
              <div className="relative h-28 w-28 wax-seal-header flex items-center justify-center z-10 transition-transform hover:scale-110 active:scale-95 cursor-pointer">
                <div className="absolute -inset-1 border-2 border-veritasCrimson opacity-30 rounded-full" />
              </div>
              <span className="absolute top-0 right-1/2 translate-x-10 h-1 w-1 bg-sigilGold rounded-full animate-pulse shadow-[0_0_10px_var(--primary)]" />
              <span className="absolute bottom-4 left-1/2 -translate-x-12 h-1.5 w-1.5 bg-sigilGold rounded-full animate-pulse delay-700 shadow-[0_0_15px_var(--primary)]" />
            </div>

            <div className="relative z-10">
              <DialogTitle className="mb-3 text-4xl font-bold text-parchment ceremonial-text tracking-[0.3em] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                Bound by Oath
              </DialogTitle>
              <div className="h-px w-24 mx-auto mb-4 bg-linear-to-r from-transparent via-sigilGold/40 to-transparent" />
              <DialogDescription className="text-sigilGold/50 italic font-serif text-base tracking-wide">
                Authenticate via the Mystira covenant
              </DialogDescription>
            </div>
          </DialogHeader>

          {error && (
            <div
              className="mb-6 rounded-sm border border-veritasCrimson/40 bg-veritasCrimson/5 p-4 text-xs text-veritasCrimson ceremonial-text text-center tracking-widest animate-pulse"
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className={`group relative flex w-full items-center justify-center gap-5 overflow-hidden rounded-sm px-4 py-6 font-bold transition-all duration-500 ${
              isLoading
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
                <span className="ceremonial-text text-lg tracking-[0.4em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                  Enter Sanctum
                </span>
                <Zap className="h-5 w-5 text-sigilGold animate-bounce" />
                <ArrowRight className="h-5 w-5 text-sigilGold/60" />
              </>
            )}
          </button>

          <p className="mt-8 text-center text-[10px] text-sigilGold/30 ceremonial-text tracking-[0.3em]">
            Identity verified by Mystira · Access granted by the estate registry
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
