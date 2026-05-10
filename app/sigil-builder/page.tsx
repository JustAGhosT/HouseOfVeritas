"use client";

import { useMemo, useState, useEffect } from "react";
import { generateCrest } from "@/lib/design/crest";
import { sigilGlyphs, type SigilStyle } from "@/lib/design/sigils";

const styles = Object.keys(sigilGlyphs) as SigilStyle[];

export default function SigilBuilderPage() {
  const [name, setName] = useState("Veritas");
  const [style, setStyle] = useState<SigilStyle>("sacred");
  const [seed, setSeed] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const crest = useMemo(() => generateCrest(name), [name, seed]);
  const left = sigilGlyphs[style][0];
  const right = sigilGlyphs[style][1] ?? sigilGlyphs[style][0];

  if (!isMounted) return null; // avoid hydration mismatch on random

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12 md:py-24 font-sans selection:bg-primary/30">
      <div className="noise-overlay" />
      <div className="vortex-glow opacity-50" />
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-4 text-center md:text-left">
          <h1 className="font-serif text-5xl md:text-6xl text-primary">Sigil Builder</h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Compose your House of Veritas identity mark.
          </p>
        </header>

        <section className="grid gap-8 md:grid-cols-2 items-start">
          <div className="rounded-2xl border border-border bg-card p-8 space-y-8 shadow-2xl">
            <label className="block space-y-3">
              <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Inscribe Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-4 py-3 text-foreground font-serif text-xl focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Enter your name..."
              />
            </label>

            <label className="block space-y-3">
              <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Select Arcane Style</span>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as SigilStyle)}
                className="w-full rounded-lg bg-background border border-border px-4 py-3 text-foreground font-sans focus:outline-none focus:border-primary/50 transition-colors appearance-none"
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
              className="shimmer-btn w-full rounded-lg px-6 py-4 text-primary-foreground font-bold tracking-widest uppercase mt-4"
            >
              Regenerate Crest
            </button>
          </div>

          <div className="ornate-border rounded-2xl bg-linear-to-b from-card to-background p-12 shadow-[0_0_40px_-10px_rgba(212,175,55,0.15)] flex flex-col justify-center min-h-[400px]">
            <div className="text-center space-y-8 flex flex-col items-center">
              <div className="text-6xl md:text-7xl text-primary drop-shadow-md">
                {crest.prefix} {crest.core} {crest.suffix}
              </div>
              <div className="font-serif text-3xl md:text-4xl tracking-widest text-foreground drop-shadow-sm">
                {left} {name || "Name"} {right}
              </div>
              <div className="inline-flex gap-4 items-center">
                <span className="h-px bg-border w-12"></span>
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-primary/80">
                  {crest.tier} • {crest.frame}
                </div>
                <span className="h-px bg-white/20 w-12"></span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
