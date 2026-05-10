import type { IdentityBadge } from "@/lib/design/badges";

const accentMap = {
  gold: "text-primary border-primary/40",
  crimson: "text-accent border-accent/40",
  violet: "text-secondary border-secondary/40",
};

export function IdentityBadgeCard({ badge }: { badge: IdentityBadge }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-card p-6 shadow-lg transition-transform hover:scale-105 duration-300 ${accentMap[badge.accent]}`}
    >
      <div className="absolute inset-0 bg-linear-to-br from-background/50 to-transparent pointer-events-none" />
      <div className="relative z-10 text-xs uppercase tracking-[0.24em] text-muted-foreground font-sans">
        House of {badge.house}
      </div>
      <div className="relative z-10 mt-4 text-5xl py-4">{badge.crest}</div>
      <div className="relative z-10 mt-4 font-serif text-2xl text-foreground">
        {badge.title}
      </div>
      <div className="relative z-10 mt-2 text-sm text-muted-foreground font-sans">
        {badge.rarity} • {badge.frame}
      </div>
    </div>
  );
}
