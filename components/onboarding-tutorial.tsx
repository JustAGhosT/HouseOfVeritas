"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

interface TutorialStep {
  target?: string
  title: string
  body: string
}

export function OnboardingTutorial({
  steps,
  onComplete,
}: {
  steps: TutorialStep[]
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const pathname = usePathname()

  const current = steps[step]
  const isLast = step === steps.length - 1

  const handleNext = () => {
    if (isLast) {
      onComplete()
    } else {
      setStep((s) => s + 1)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wider uppercase">Guided Tour</span>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-white">{current?.title}</h3>
          <p className="text-sm leading-relaxed text-white/70">{current?.body}</p>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-6 py-4">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-white/60" onClick={handleSkip}>
              Skip
            </Button>
            <Button size="sm" className="shimmer-btn bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleNext}>
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
