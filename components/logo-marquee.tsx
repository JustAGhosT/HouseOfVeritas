"use client"

import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"

const logos = [
  { name: "Azure", width: 100 },
  { name: "Stripe", width: 80 },
  { name: "Linear", width: 90 },
  { name: "Notion", width: 100 },
  { name: "Figma", width: 70 },
  { name: "Slack", width: 90 },
  { name: "Discord", width: 100 },
  { name: "GitHub", width: 90 },
]

export function LogoMarquee() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { motionEnabled } = useMotion()

  return (
    <section ref={ref} className="overflow-hidden py-16">
      <motion.div
        initial={motionEnabled ? { opacity: 0 } : { opacity: 1 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
        className="mb-10 text-center"
      >
        <p className="text-sm font-medium tracking-wider text-muted-foreground uppercase">
          Trusted by industry leaders
        </p>
      </motion.div>

      <div className="relative">
        {/* Fade masks */}
        <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-32 bg-linear-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-32 bg-linear-to-l from-background to-transparent" />

        {/* Marquee container */}
        <div className={`flex ${motionEnabled ? "animate-marquee" : ""}`}>
          {[...logos, ...logos].map((logo, index) => (
            <div
              key={index}
              className="mx-8 flex h-16 min-w-[160px] items-center justify-center opacity-50 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <span className="text-xs font-bold">{logo.name[0]}</span>
                </div>
                <span className="[font-family:var(--font-inter)] font-medium">{logo.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
