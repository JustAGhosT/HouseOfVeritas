"use client"

import { useMemo, useState } from "react"
import { generateCrest } from "@/lib/design/crest"
import { sigilGlyphs, type SigilStyle } from "@/lib/design/sigils"

const styles = Object.keys(sigilGlyphs) as SigilStyle[]

export default function SigilBuilderPage() {
  const [name, setName] = useState("Veritas")
  const [style, setStyle] = useState<SigilStyle>("sacred")
  const [seed, setSeed] = useState(0)

  const crest = useMemo(() => generateCrest(`${name}:${seed}`), [name, seed])
  const left = sigilGlyphs[style][0]
  const right = sigilGlyphs[style][1] ?? sigilGlyphs[style][0]

  return (
    <main className="bg-background text-foreground selection:bg-primary/30 min-h-screen px-6 py-12 font-sans md:py-24">
      <div className="noise-overlay" />
      <div className="vortex-glow opacity-50" />
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-4 text-center md:text-left">
          <h1 className="text-primary font-serif text-5xl md:text-6xl">Sigil Builder</h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Compose your House of Veritas identity mark.
          </p>
        </header>

        <section className="grid items-start gap-8 md:grid-cols-2">
          <div className="border-border bg-card space-y-8 rounded-2xl border p-8 shadow-2xl">
            <label className="block space-y-3">
              <span className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
                Inscribe Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-border text-foreground focus:border-primary/50 w-full rounded-lg border px-4 py-3 font-serif text-xl transition-colors focus:outline-none"
                placeholder="Enter your name..."
              />
            </label>

            <label className="block space-y-3">
              <span className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
                Select Arcane Style
              </span>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as SigilStyle)}
                className="bg-background border-border text-foreground focus:border-primary/50 w-full appearance-none rounded-lg border px-4 py-3 font-sans transition-colors focus:outline-none"
              >
                {styles.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Symbols
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => setSeed((x) => x + 1)}
              className="shimmer-btn text-primary-foreground mt-4 w-full rounded-lg px-6 py-4 font-bold tracking-widest uppercase"
            >
              Regenerate Crest
            </button>
          </div>

          <div className="ornate-border from-card to-background flex min-h-[400px] flex-col justify-center rounded-2xl bg-linear-to-b p-12 shadow-[0_0_40px_-10px_rgba(212,175,55,0.15)]">
            <div className="flex flex-col items-center space-y-8 text-center">
              <div className="text-primary text-6xl drop-shadow-md md:text-7xl">
                {crest.prefix} {crest.core} {crest.suffix}
              </div>
              <div className="text-foreground font-serif text-3xl tracking-widest drop-shadow-sm md:text-4xl">
                {left} {name || "Name"} {right}
              </div>
              <div className="inline-flex items-center gap-4">
                <span className="bg-border h-px w-12"></span>
                <div className="text-primary/80 text-xs font-bold tracking-[0.3em] uppercase">
                  {crest.tier} • {crest.frame}
                </div>
                <span className="h-px w-12 bg-white/20"></span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
