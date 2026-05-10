"use client"

import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { useRef } from "react"

const footerLinks = {
  Platform: ["Documents", "Operations", "Reports", "Dashboards", "Compliance"],
  Resources: ["Documentation", "User Guides", "Training", "Support", "API"],
  Company: ["About", "Contact", "Privacy", "Terms", "Security"],
  Legal: ["BCEA Compliance", "POPIA", "ECT Act", "Audit Logs", "Certifications"],
}

export function Footer() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const { motionEnabled } = useMotion()

  return (
    <footer ref={ref} id="help" className="relative border-t-2 border-primary/30 bg-ink overflow-hidden">
      {/* Ornate Background Elements */}
      <div className="absolute inset-0 archives-texture opacity-30" />
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary to-transparent opacity-50" />
      
      {/* Large Watermark Sigil (Grand Archives Style) */}
      <div className="absolute -bottom-24 -right-24 h-96 w-96 opacity-5 rotate-12 pointer-events-none">
        <Image src="/hv-logo-small.svg" alt="" width={400} height={400} className="grayscale brightness-0 invert" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.8 } : { duration: 0 }}
          className="grid grid-cols-2 gap-12 md:grid-cols-5"
        >
          {/* Brand & Ritual Status */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-6 flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80">
              <Image src="/hv-logo-small.svg" alt="House of Veritas" width={48} height={48} className="drop-shadow-[0_0_10px_rgba(212,175,55,0.2)]" />
              <div className="flex flex-col">
                <span className="font-serif text-lg font-bold text-foreground leading-none tracking-tight">VERITAS</span>
                <span className="font-serif text-[10px] tracking-[0.2em] uppercase text-primary/60">Grand Archives</span>
              </div>
            </Link>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground/80">
              Guarding the ancestral scrolls and digital seals of the estate.
            </p>
            {/* System Status (Alchemical Meter inspired) */}
            <div className="status-badge-parchment py-1.5 px-4">
              <span className="pulse-glow h-2 w-2 rounded-full bg-primary" />
              <span className="font-serif text-[10px] tracking-widest uppercase text-primary/80">Sanctum Stable</span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-serif mb-6 text-xs font-bold text-primary tracking-[0.2em] uppercase">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="group flex items-center gap-2 cursor-pointer text-sm text-muted-foreground/70 transition-colors hover:text-primary"
                    >
                      <span className="text-[10px] opacity-0 transition-all -ml-2 group-hover:opacity-100 group-hover:ml-0">✦</span>
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* "Film Strip" Legal/Sigil Row (Grand Forge Style) */}
        <div className="mt-12">
          <div className="film-strip">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="film-strip-item group">
                <div className="absolute inset-0 flex items-center justify-center opacity-10 transition-opacity group-hover:opacity-40">
                  <Image src="/hv-logo-small.svg" alt="" width={40} height={40} className="grayscale" />
                </div>
                <div className="absolute bottom-1 left-2 text-[8px] font-serif uppercase tracking-tighter text-white/20">
                  ARCHIVE_DOC_{(i + 101).toString(16).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Metadata */}
        <motion.div
          id="contact"
          initial={motionEnabled ? { opacity: 0 } : { opacity: 1 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={motionEnabled ? { duration: 0.6, delay: 0.5 } : { duration: 0 }}
          className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-primary/10 pt-8 sm:flex-row"
        >
          <div className="flex flex-col items-center sm:items-start">
            <p className="font-serif text-[10px] tracking-widest uppercase text-muted-foreground">
              &copy; {new Date().getFullYear()} House of Veritas
            </p>
            <p className="text-[9px] text-primary/40 uppercase tracking-[0.3em]">Integrity through Transparency</p>
          </div>
          
          <div className="flex items-center gap-8">
            <Link href="#" className="font-serif text-[10px] tracking-widest uppercase text-muted-foreground transition-colors hover:text-primary">Legals</Link>
            <Link href="#" className="font-serif text-[10px] tracking-widest uppercase text-muted-foreground transition-colors hover:text-primary">Privileges</Link>
            <Link href="#" className="font-serif text-[10px] tracking-widest uppercase text-muted-foreground transition-colors hover:text-primary">Sanctum Support</Link>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
