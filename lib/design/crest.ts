export type CrestTier = "common" | "rare" | "mythic"

export type CrestParts = {
  prefix: string
  core: string
  suffix: string
  frame: string
  tier: CrestTier
}

const PREFIXES = ["✦", "✶", "⚜", "❂", "✧", "☉"]
const CORES = ["V", "⟁", "☾", "☼", "⚔", "✴", "⌘"]
const SUFFIXES = ["✦", "✶", "⚜", "❂", "✧"]
const FRAMES = ["circle", "shield", "seal", "compass"]

// FNV-1a — gives us a stable 32-bit seed from any name so the crest is
// identical across SSR + client renders and across re-renders.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickAt<T>(arr: readonly T[], h: number): T {
  return arr[h % arr.length]
}

function tierFromHash(h: number): CrestTier {
  const bucket = h % 100
  if (bucket >= 92) return "mythic"
  if (bucket >= 65) return "rare"
  return "common"
}

export function generateCrest(name: string): CrestParts & { label: string } {
  const h = hash(name || "")
  const prefix = pickAt(PREFIXES, h)
  const core = pickAt(CORES, h >>> 5)
  const suffix = pickAt(SUFFIXES, h >>> 11)
  const frame = pickAt(FRAMES, h >>> 17)
  const tier = tierFromHash(h >>> 23)

  return {
    prefix,
    core,
    suffix,
    frame,
    tier,
    label: `${prefix} ${name} ${core} ${suffix}`,
  }
}
