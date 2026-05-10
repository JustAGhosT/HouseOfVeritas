import Link from "next/link"
import { Home, ArrowLeft, BookX } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-obsidian p-6 relative overflow-hidden">
      {/* Ghostly background watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <BookX className="w-[600px] h-[600px] text-sigilGold" />
      </div>

      <div className="max-w-md text-center z-10">
        <h1 className="mb-4 text-9xl font-bold text-sigilGold/10 ceremonial-text tracking-tighter">404</h1>
        <p className="ceremonial-text text-[10px] text-sigilGold mb-2 tracking-[0.5em] font-bold">SECTION RESTRICTED</p>
        <h2 className="mb-4 text-3xl font-serif font-bold text-parchment">Lost in the Stacks</h2>
        <p className="mb-10 manuscript-body text-parchment/60 leading-relaxed italic">
          The records you seek have vanished into the void, or perhaps they were never meant for mortal eyes. Return to the light before the shadows lengthen.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-3 rounded-sm border border-sigilGold/20 bg-sigilGold/5 px-6 py-3 text-sigilGold ceremonial-text text-xs font-bold transition-all hover:bg-sigilGold/10 hover:border-sigilGold/40"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link
            href="/?login=true"
            className="inline-flex items-center justify-center gap-3 rounded-sm bg-veritasCrimson px-8 py-3 text-parchment shadow-lg shadow-veritasCrimson/20 transition-all hover:bg-veritasCrimson/90 hover:shadow-veritasCrimson/40 ceremonial-text text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            Identity
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 text-center w-full">
        <p className="ceremonial-text text-[8px] text-sigilGold/20 tracking-[0.4em]">
          HOUSE OF VERITAS • ARCHIVAL REGISTRY
        </p>
      </div>
    </div>
  )
}
