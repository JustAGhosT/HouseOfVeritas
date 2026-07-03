"use client"

import type React from "react"

import { useEffect } from "react"
import Lenis from "lenis"

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Respect reduced-motion: skip the smooth-scroll hijack and use native scroll.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    let rafId = 0
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }

    rafId = requestAnimationFrame(raf)

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="#"]')
      if (anchor) {
        const href = anchor.getAttribute("href")
        if (href && href !== "#") {
          e.preventDefault()
          const id = href.slice(1)
          const el = document.getElementById(id)
          if (el) lenis.scrollTo(el, { offset: -80, duration: 1.2 })
        }
      }
    }

    document.addEventListener("click", handleAnchorClick, true)

    return () => {
      document.removeEventListener("click", handleAnchorClick, true)
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
