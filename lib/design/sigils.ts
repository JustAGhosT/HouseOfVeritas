export const sigilGlyphs = {
  sacred: ["✦", "✧", "✶", "✴", "❂", "☉", "☾"],
  heraldic: ["⚜", "♜", "♛", "⚔", "⛨"],
  alchemical: ["🜂", "🜄", "🜁", "🜃", "☿"],
  structural: ["⌘", "⟁", "△", "◈", "◇"],
} as const

export type SigilStyle = keyof typeof sigilGlyphs

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function buildSigilText(name: string, style: SigilStyle = "sacred"): string {
  const set = sigilGlyphs[style]
  const h = hash(`${name}:${style}`)
  const left = set[h % set.length]
  const right = set[(h >>> 8) % set.length]
  return `${left} ${name} ${right}`
}
