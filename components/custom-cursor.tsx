"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

// Base diameter of the dot in px (matches the h-3 w-3 Tailwind classes below).
const DOT_SIZE = 12

export function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false)
  const [enabled, setEnabled] = useState(false)

  // Motion values write straight to the DOM transform on each rAF frame, so
  // pointer movement never triggers a React re-render (the old version called
  // setState on every mousemove, re-rendering dozens of times per second).
  // Start off-screen so the dot doesn't flash in the top-left corner on mount.
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  // Snappy spring: enough follow-through to feel smooth, without a laggy trail.
  const springConfig = { damping: 30, stiffness: 800, mass: 0.25 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)

  useEffect(() => {
    if (typeof window === "undefined") return
    // Skip on touch devices and when the user prefers reduced motion.
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (isCoarsePointer || prefersReducedMotion) return
    // One-time client-only enable after the pointer-type check (can't run during
    // SSR without a hydration mismatch). Fires once on mount, not per frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(true)

    const handleMouseMove = (e: MouseEvent) => {
      x.set(e.clientX - DOT_SIZE / 2)
      y.set(e.clientY - DOT_SIZE / 2)
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // One selector match instead of several tag/class checks.
      const interactive = target.closest("button, a, [role='button'], .cursor-pointer") !== null
      setIsHovering(interactive)
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    window.addEventListener("mouseover", handleMouseOver, { passive: true })

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseover", handleMouseOver)
    }
  }, [x, y])

  if (!enabled) return null

  return (
    <motion.div
      className="custom-cursor pointer-events-none fixed top-0 left-0 z-[60] h-3 w-3 rounded-full mix-blend-difference"
      style={{ x: springX, y: springY, backgroundColor: "#D4AF37" }}
      animate={{
        scale: isHovering ? 1.8 : 1,
        opacity: isHovering ? 0.6 : 1,
      }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      aria-hidden="true"
    />
  )
}
