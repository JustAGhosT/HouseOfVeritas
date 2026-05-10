"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

export function CustomCursor() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    // Skip on touch devices and when the user prefers reduced motion.
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (isCoarsePointer || prefersReducedMotion) return
    setEnabled(true)

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const interactive =
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a") ||
        target.classList.contains("cursor-pointer")
      setIsHovering(Boolean(interactive))
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseover", handleMouseOver)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseover", handleMouseOver)
    }
  }, [])

  if (!enabled) return null

  return (
    <motion.div
      className="custom-cursor pointer-events-none fixed top-0 left-0 z-[60] h-5 w-5 rounded-full mix-blend-difference"
      style={{ backgroundColor: "#D4AF37" }}
      animate={{
        x: mousePos.x - 10,
        y: mousePos.y - 10,
        scale: isHovering ? 2.5 : 1,
        opacity: isHovering ? 0.6 : 1,
      }}
      transition={{ type: "spring", damping: 25, stiffness: 250, mass: 0.5 }}
      aria-hidden="true"
    />
  )
}
