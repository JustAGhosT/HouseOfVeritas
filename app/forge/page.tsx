"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Shield, Zap, Star, Plus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const HERITAGE_SYMBOLS = [
  { id: "gryphon", label: "Gryphon", icon: "🦅" },
  { id: "shield", label: "Shield", icon: "🛡️" },
  { id: "eagle", label: "Eagle", icon: "🦅" },
]

const ARCANE_GLYPHS = [
  { id: "alpha", char: "α" },
  { id: "omega", char: "Ω" },
  { id: "sigil", char: "Σ" },
  { id: "delta", char: "Δ" },
]

const COLORS = [
  { id: "crimson", value: "#8B1E2D" },
  { id: "violet", value: "#4B2E83" },
  { id: "gold", value: "#D4AF37" },
]

export default function ForgePage() {
  const [selectedSymbol, setSelectedSymbol] = useState(HERITAGE_SYMBOLS[0].id)
  const [selectedGlyph, setSelectedGlyph] = useState(ARCANE_GLYPHS[0].id)
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value)
  const [isSealing, setIsSealing] = useState(false)
  const [isSealed, setIsSealed] = useState(false)

  const handleSeal = () => {
    setIsSealing(true)
    setTimeout(() => {
      setIsSealing(false)
      setIsSealed(true)
    }, 2000)
  }

  return (
    <div className={`flex min-h-screen flex-col bg-obsidian transition-all duration-1000 ${isSealing ? "ritual-shake brightness-150" : ""}`}>
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 pt-24 relative overflow-hidden">
        {/* Background Ritual Circle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[800px] h-[800px] border border-sigilGold/20 rounded-full animate-rotate-sigil flex items-center justify-center">
             <div className="w-[600px] h-[600px] border border-sigilGold/10 rounded-full animate-rotate-sigil-reverse" />
          </div>
        </div>

        <header className="mb-12 text-center z-10">
          <h2 className="ceremonial-text text-4xl lg:text-5xl font-bold text-parchment mb-4 tracking-tighter">Forge of Identity</h2>
          <p className="manuscript-body text-sigilGold/60 italic text-lg leading-relaxed max-w-2xl mx-auto">
            Create your digital sigil and seal your lineage. Permanently bind your identity to the House.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 w-full max-w-6xl z-10">
          
          {/* Left Drawer: Heritage Symbols */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-morphism-dark p-8 rounded-sm metalic-glow"
          >
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-sigilGold h-5 w-5" />
              <h3 className="ceremonial-text text-sm font-bold text-sigilGold tracking-widest">Heritage Symbols</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {HERITAGE_SYMBOLS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSymbol(s.id)}
                  aria-label={s.label}
                  aria-pressed={selectedSymbol === s.id}
                  className={`h-16 flex items-center justify-center text-3xl transition-all border ${
                    selectedSymbol === s.id ? "bg-sigilGold/10 border-sigilGold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-parchment/5 hover:border-parchment/20"
                  }`}
                >
                  {s.icon}
                </button>
              ))}
            </div>
            <p className="manuscript-body text-parchment/40 text-xs italic">Select ancient emblems of your ancestry.</p>
          </motion.div>

          {/* Center Component: The Sigil Forge */}
          <div className="flex flex-col items-center justify-center relative min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedSymbol}-${selectedGlyph}-${selectedColor}`}
                initial={{ scale: 0.8, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.2, opacity: 0, rotate: 45 }}
                transition={{ type: "spring", stiffness: 100 }}
                className="relative w-64 h-64 flex items-center justify-center"
              >
                {/* Visual Representation of the Sigil */}
                <div 
                  className="absolute inset-0 rounded-full border-2 border-sigilGold/40 animate-rotate-sigil-reverse" 
                  style={{ boxShadow: `0 0 50px ${selectedColor}20` }}
                />
                <div className="absolute inset-4 rounded-full border border-sigilGold/20 animate-rotate-sigil" />
                
                <div className="z-10 text-center">
                  <span className="block text-6xl mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    {HERITAGE_SYMBOLS.find(s => s.id === selectedSymbol)?.icon}
                  </span>
                  <span className="ceremonial-text text-4xl font-bold rune-glow" style={{ color: selectedColor }}>
                    {ARCANE_GLYPHS.find(g => g.id === selectedGlyph)?.char}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="absolute -bottom-8">
              <span className="ceremonial-text text-[10px] text-sigilGold/40 tracking-[0.5em] font-bold">FORGE YOUR SIGIL</span>
            </div>
          </div>

          {/* Right Drawer: Arcane Glyphs */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-morphism-dark p-8 rounded-sm metalic-glow"
          >
            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-sigilGold h-5 w-5" />
              <h3 className="ceremonial-text text-sm font-bold text-sigilGold tracking-widest">Arcane Glyphs</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {ARCANE_GLYPHS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGlyph(g.id)}
                  aria-label={`Glyph ${g.id}`}
                  aria-pressed={selectedGlyph === g.id}
                  className={`h-16 flex items-center justify-center text-2xl transition-all border font-bold ${
                    selectedGlyph === g.id ? "bg-sigilGold/10 border-sigilGold text-sigilGold" : "border-parchment/5 text-parchment/40 hover:border-parchment/20"
                  }`}
                >
                  {g.char}
                </button>
              ))}
            </div>
            
            <div className="border-t border-sigilGold/10 pt-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Star className="text-sigilGold h-5 w-5" />
                <h3 className="ceremonial-text text-sm font-bold text-sigilGold tracking-widest">Chromatic Oaths</h3>
              </div>
              <div className="flex gap-4">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedColor(c.value)}
                    aria-label={`Chromatic oath: ${c.id}`}
                    aria-pressed={selectedColor === c.value}
                    className={`w-10 h-10 rounded-full transition-all ring-offset-2 ring-offset-obsidian ${
                      selectedColor === c.value ? "ring-2 ring-sigilGold scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer Seal Action */}
        <div className="mt-24 text-center z-10">
          <button
            disabled={isSealing || isSealed}
            onClick={handleSeal}
            className={`group relative overflow-hidden transition-all duration-500 ${
              isSealed ? "bg-sigilGold text-obsidian px-12 py-5" : "bg-veritasCrimson text-parchment px-16 py-6"
            } rounded-sm shadow-[0_0_30px_rgba(139,30,45,0.3)] hover:shadow-[0_0_50px_rgba(139,30,45,0.5)]`}
          >
            <div className="flex items-center gap-4">
              <div className={`wax-seal scale-75 ${isSealed ? "bg-obsidian text-sigilGold" : ""}`}>
                <span className="ceremonial-text text-lg">V</span>
              </div>
              <span className="ceremonial-text text-xl font-bold tracking-[0.2em]">
                {isSealed ? "IDENTITY SEALED" : isSealing ? "BINDING..." : "SEAL THE OATH"}
              </span>
              {isSealed && <Check className="h-6 w-6" />}
            </div>
          </button>
          
          <div className="mt-6">
            <p className="manuscript-body text-parchment/20 text-xs tracking-widest uppercase">
              Permanently bind your identity to the House.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
