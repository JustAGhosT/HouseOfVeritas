"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useLoginModal } from "@/lib/login-modal-context"
import { useMotion } from "@/lib/motion-context"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, X, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

const navItems = [
  { label: "Compliance", href: "#compliance" },
  { label: "Operations", href: "#features" },
  { label: "Reports", href: "#dashboard" },
  { label: "Help", href: "#help" },
]

export function Navbar() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { motionEnabled, setMotionEnabled } = useMotion()

  // Keyboard accessibility for mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [mobileMenuOpen])
  const { openLoginModal } = useLoginModal()
  const navRef = useRef<HTMLDivElement>(null)

  return (
    <motion.header
      initial={motionEnabled ? { y: -100, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={
        motionEnabled ? { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } : { duration: 0 }
      }
      className="fixed top-0 right-0 left-0 z-50 w-full min-w-full"
    >
      <nav
        ref={navRef}
        className="nav-glass-refined relative flex w-full max-w-none min-w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8 border-b-2 border-primary/20 shadow-lg shadow-black/40"
      >
        {/* Decorative Filigree Corners */}
        <div className="filigree-corner filigree-tl opacity-40 scale-75" />
        <div className="filigree-corner filigree-tr opacity-40 scale-75" />

        {/* Logo */}
        <Link href="/" className="flex cursor-pointer items-center gap-4 transition-transform hover:scale-105">
          <Image src="/hv-logo-small.svg" alt="House of Veritas" width={44} height={44} className="drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
          <span className="font-serif hidden font-bold text-lg text-foreground sm:block tracking-[0.1em] uppercase">House of Veritas</span>
        </Link>

        {/* Desktop Nav Items */}
        <div className="relative hidden items-center gap-1 md:flex">
          {navItems.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className={`relative cursor-pointer px-4 py-2 text-sm transition-colors hover:text-foreground ${
                hoveredIndex === index ? "nav-signature" : "text-muted-foreground"
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {hoveredIndex === index && (
                <motion.div
                  layoutId={motionEnabled ? "navbar-hover" : undefined}
                  className="absolute inset-0 rounded-full bg-muted"
                  initial={false}
                  transition={
                    motionEnabled
                      ? { type: "spring", stiffness: 500, damping: 30 }
                      : { duration: 0 }
                  }
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Motion Toggle */}
          <div className="flex items-center gap-2 border-r border-border pr-3">
            <Zap size={14} className={motionEnabled ? "text-primary" : "text-muted-foreground"} />
            <Switch
              checked={motionEnabled}
              onCheckedChange={setMotionEnabled}
              className="scale-75"
              aria-label="Toggle animations"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={openLoginModal}
          >
            Login
          </Button>
          <Button
            size="sm"
            className="shimmer-btn cursor-pointer rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
            onClick={openLoginModal}
          >
            Access Documents
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="cursor-pointer p-2 text-muted-foreground hover:text-foreground md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={motionEnabled ? { opacity: 0, y: -10 } : { opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionEnabled ? { opacity: 0, y: -10 } : { opacity: 0 }}
            transition={motionEnabled ? undefined : { duration: 0 }}
            className="absolute top-full right-0 left-0 border-b border-border bg-card/98 p-4 backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="cursor-pointer rounded-lg px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-2 border-border" />
              {/* Motion Toggle */}
              <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className={motionEnabled ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-sm text-muted-foreground">Animations</span>
                </div>
                <Switch
                  checked={motionEnabled}
                  onCheckedChange={setMotionEnabled}
                  className="scale-75"
                  aria-label="Toggle animations"
                />
              </div>
              <Button
                variant="ghost"
                className="cursor-pointer justify-start text-muted-foreground hover:text-foreground"
                onClick={() => {
                  openLoginModal()
                  setMobileMenuOpen(false)
                }}
              >
                Login
              </Button>
              <Button
                className="shimmer-btn cursor-pointer rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  openLoginModal()
                  setMobileMenuOpen(false)
                }}
              >
                Access Documents
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
