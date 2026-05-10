"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Shield, Lock, Hash, History, Users, Plus } from "lucide-react"

const CATEGORIES = [
  { id: "all", label: "All Records", icon: Hash },
  { id: "blood", label: "The Blood Covenant", icon: Shield },
  { id: "silent", label: "Silent Pacts", icon: Lock },
  { id: "ancient", label: "Ancient Decrees", icon: History },
  { id: "shadow", label: "Shadow Liaisons", icon: Users },
]

const OATHS = [
  {
    id: "0012",
    title: "The Blood Binding of Valerius",
    era: "Second Eclipse",
    content: '"By the blood spilt upon the obsidian altar, I hereby bind my lineage to the service of Veritas until the stars fade from the firmament..."',
    note: "A blood-bound pact ensuring loyalty across generations.",
    status: "Active",
    type: "COVENANT",
    border: "border-veritasCrimson",
    sealColor: "bg-veritasCrimson",
  },
  {
    id: "8841",
    title: "The Silent Pact of Shadows",
    era: "The Golden Age",
    content: '"Words spoken in shadow shall remain in shadow. Let the tongue that betrays be silenced by the cold steel of the Arch-Keeper..."',
    note: "The foundational document for the House's intelligence network.",
    status: "Restricted",
    type: "DECREE",
    border: "border-sigilGold",
    sealColor: "bg-veritasCrimson",
  },
  {
    id: "049",
    title: "The Ancient Decree of Veritas",
    era: "Primordial Void",
    content: '"Veritas lux mea. Truth is the only weapon that carves through the veil of mortal deception. Wear this mark, and never falter."',
    note: "The original proclamation of the House's sovereign purpose.",
    status: "Eternal",
    type: "ARCANUM",
    border: "border-arcaneViolet",
    sealColor: "bg-veritasCrimson",
  },
  {
    id: "0098",
    title: "The Marrow Exchange",
    era: "Third Reaping",
    content: '"A gift of bone, a gift of spirit. We hold the records of those who traded their essence for the wisdom of the High Librarians."',
    note: "Deeply arcane ritual document requiring bio-authentication.",
    status: "Active",
    type: "COVENANT",
    border: "border-veritasCrimson",
    sealColor: "bg-veritasCrimson",
  },
]

export default function LibraryPage() {
  const [activeCategory, setActiveCategory] = useState("all")

  return (
    <div className="flex min-h-screen flex-col bg-obsidian">
      <Navbar />
      
      <div className="flex flex-1 overflow-hidden pt-20">
        {/* Sidebar */}
        <aside className="hidden w-72 border-r border-sigilGold/10 bg-obsidian/50 p-8 lg:block overflow-y-auto">
          <div className="mb-10">
            <h3 className="ceremonial-text text-[10px] text-sigilGold/40 mb-6 font-bold tracking-[0.2em]">Classifications</h3>
            <ul className="space-y-4">
              {CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-4 transition-all group w-full text-left ${
                      activeCategory === cat.id ? "text-sigilGold" : "text-parchment/40 hover:text-sigilGold/80"
                    }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${
                      activeCategory === cat.id ? "bg-sigilGold shadow-[0_0_8px_rgba(212,175,55,0.6)]" : "border border-parchment/20"
                    }`} />
                    <span className="ceremonial-text text-xs tracking-widest">{cat.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto pt-10 border-t border-sigilGold/10">
            <div className="rounded-sm border border-arcaneViolet/20 bg-arcaneViolet/5 p-4">
              <p className="ceremonial-text text-[8px] text-parchment/30 mb-2">Security Level</p>
              <p className="ceremonial-text text-[10px] text-sigilGold tracking-[0.2em] font-bold">
                ENCRYPTED: CLEARANCE 04
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto archives-scrollable p-8 lg:p-12">
          <header className="mb-16">
            <p className="ceremonial-text text-[10px] text-sigilGold mb-3 tracking-[0.4em] font-bold">REPOSITORIUM CODEX</p>
            <h2 className="font-serif text-5xl font-bold text-parchment mb-6 tracking-tight">Library of Oaths</h2>
            <div className="h-1 w-32 bg-linear-to-r from-sigilGold via-sigilGold/50 to-transparent" />
          </header>

          {/* Archival Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
            {OATHS.map((oath, i) => (
              <motion.article
                key={oath.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`oath-card parchment-texture p-10 flex flex-col min-h-[450px] border-l-[6px] ${oath.border} overflow-hidden`}
              >
                {/* Decorative Pattern Watermark */}
                <div className="absolute top-6 right-6 text-sigilGold/10 pointer-events-none">
                  <Shield className="h-20 w-20 rotate-12" />
                </div>

                <div className="mb-8 flex justify-between items-start">
                  <span className={`ceremonial-text text-[10px] font-bold tracking-[0.2em] ${
                    oath.type === 'ARCANUM' ? 'text-arcaneViolet' : oath.type === 'DECREE' ? 'text-sigilGold' : 'text-veritasCrimson'
                  }`}>
                    {oath.type} #{oath.id}
                  </span>
                  <span className="manuscript-body text-[10px] text-black/40 italic">Era: {oath.era}</span>
                </div>

                <h3 className="ceremonial-text text-2xl text-black mb-6 leading-tight tracking-normal font-bold">
                  {oath.title}
                </h3>

                <div className="flex-1">
                  <p className="manuscript-body text-black/80 leading-relaxed text-base italic mb-6">
                    {oath.content}
                  </p>
                  <p className="manuscript-body text-black/60 text-xs border-t border-black/5 pt-4">
                    {oath.note}
                  </p>
                </div>

                <div className="mt-10 flex justify-between items-end">
                  <div>
                    <p className="ceremonial-text text-[8px] text-black/40 font-bold mb-2 tracking-widest uppercase">Status</p>
                    <span className={`px-3 py-1 text-[10px] border font-bold ceremonial-text tracking-widest ${
                      oath.status === 'Active' ? 'bg-veritasCrimson/10 border-veritasCrimson/20 text-veritasCrimson' :
                      oath.status === 'Eternal' ? 'bg-arcaneViolet/10 border-arcaneViolet/20 text-arcaneViolet' :
                      'bg-sigilGold/10 border-sigilGold/20 text-sigilGold'
                    }`}>
                      {oath.status}
                    </span>
                  </div>
                  
                  {/* Wax Seal */}
                  <div className="wax-seal">
                    <span className="ceremonial-text text-xl font-bold">V</span>
                  </div>
                </div>
              </motion.article>
            ))}
          </section>

          {/* Pagination-style Footer */}
          <footer className="mt-20 py-10 flex flex-col md:flex-row justify-between items-center border-t border-sigilGold/10 gap-8">
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={`w-10 h-10 ceremonial-text text-xs flex items-center justify-center border transition-all ${
                    n === 1 ? "bg-sigilGold border-sigilGold text-obsidian font-bold" : "border-sigilGold/20 text-sigilGold/40 hover:border-sigilGold/60"
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="mx-2 text-sigilGold/20">...</span>
              <button className="w-10 h-10 ceremonial-text text-xs flex items-center justify-center border border-sigilGold/20 text-sigilGold/40 hover:border-sigilGold/60">
                14
              </button>
            </div>
            
            <div className="flex flex-col items-center md:items-end">
              <p className="ceremonial-text text-[10px] text-sigilGold/30 tracking-[0.3em] font-bold">
                ALL RIGHTS RESERVED © 814 HOUSE OF VERITAS ARCHIVISTS
              </p>
              <p className="ceremonial-text text-[8px] text-sigilGold/10 tracking-[0.5em] mt-1">
                TRUTH SCRIBED IN IMMUTABLE BLOOD
              </p>
            </div>
          </footer>
        </main>
      </div>

      {/* Floating Action (New Pact) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-10 right-10 bg-arcaneViolet hover:bg-arcaneViolet/90 text-parchment p-5 rounded-full shadow-2xl flex items-center gap-3 group transition-all z-50 ring-2 ring-arcaneViolet/20"
      >
        <span className="ceremonial-text text-[10px] hidden group-hover:block transition-all pl-2 tracking-widest font-bold">Forge New Pact</span>
        <Plus className="h-6 w-6" />
      </motion.button>
    </div>
  )
}
