export type BadgeRarity = "common" | "rare" | "mythic";

export type IdentityBadge = {
  id: string;
  title: string;
  house: "Veritas";
  rarity: BadgeRarity;
  crest: string;
  frame: "seal" | "shield" | "compass" | "circle";
  accent: "gold" | "crimson" | "violet";
};

const rarities: BadgeRarity[] = ["common", "rare", "mythic"];
const frames = ["seal", "shield", "compass", "circle"] as const;
const accents = ["gold", "crimson", "violet"] as const;
const crests = ["☾", "☼", "⚔", "✶", "❂", "⟁"];

// A simple deterministic hash function
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function pick<T>(arr: readonly T[], seedStr: string, offset: number): T {
  const hash = simpleHash(seedStr + offset.toString());
  return arr[hash % arr.length];
}

export function generateIdentityBadge(title: string): IdentityBadge {
  // Use simpleHash for ID to keep it deterministic but unique to the title
  const idHash = simpleHash(title).toString(16);
  
  return {
    id: `badge-${idHash}`,
    title,
    house: "Veritas",
    rarity: pick(rarities, title, 1),
    crest: pick(crests, title, 2),
    frame: pick(frames, title, 3),
    accent: pick(accents, title, 4),
  };
}
