"use client"

import { Button } from "@/components/ui/button"
import { useLoginModal } from "@/lib/login-modal-context"
import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useRef } from "react"

export function FinalCTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { openLoginModal } = useLoginModal()
  const { motionEnabled } = useMotion()

  return (
    <section className="px-4 py-24">
      <motion.div
        ref={ref}
        initial={motionEnabled ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={
          motionEnabled ? { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } : { duration: 0 }
        }
        className="relative mx-auto max-w-4xl text-center overflow-hidden rounded-3xl p-8"
      >
        <div className="vortex-glow opacity-50" />
        <h2
          className="font-serif ornate-border mb-6 inline-block rounded-2xl px-6 py-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
        >
          Ready to transform your governance?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Join House of Veritas in achieving 100% digital compliance with legally enforceable
          e-signatures and complete operational transparency.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="shimmer-btn h-14 cursor-pointer rounded-full px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20"
            data-testid="final-cta-access-btn"
            onClick={openLoginModal}
          >
            Access Platform
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 cursor-pointer rounded-full border-border bg-transparent px-8 text-base font-medium text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
            data-testid="final-cta-contact-btn"
            asChild
          >
            <Link href="#contact">Contact Administrator</Link>
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Azure-powered • BCEA Compliant • 99.9% Uptime SLA
        </p>
      </motion.div>
    </section>
  )
}
