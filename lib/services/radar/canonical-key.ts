/**
 * House of Veritas - Property Deal Radar: canonicalKey field normaliser (§5.2)
 *
 * Radar 1 defines the `canonicalKey` FIELD and a deterministic normaliser only.
 * Fuzzy candidate matching / cross-portal dedupe is Radar 2 — NOT implemented here.
 */

export interface CanonicalKeyFields {
  suburb: string
  erfSizeM2?: number | null
  /** Present only when the source exposes an address / geocode. */
  geohash?: string | null
  bedrooms?: number | null
}

/** erf bucket width (m²) — tolerates capture jitter without fuzzy matching. */
export const ERF_BUCKET_M2 = 50

function normaliseSuburb(suburb: string): string {
  return suburb
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function erfBucket(erfSizeM2: number | null | undefined): string {
  if (erfSizeM2 == null || !Number.isFinite(erfSizeM2) || erfSizeM2 <= 0) return "na"
  return String(Math.round(erfSizeM2 / ERF_BUCKET_M2) * ERF_BUCKET_M2)
}

/**
 * Deterministic normalised key. When a geohash is present it anchors the key
 * (geohash + erf bucket); otherwise it falls back to a composite of the
 * non-address facts. This is purely the stored field — it performs NO matching.
 */
export function computeCanonicalKey(fields: CanonicalKeyFields): string {
  const erf = erfBucket(fields.erfSizeM2)
  if (fields.geohash) {
    return `geo:${fields.geohash}:erf${erf}`
  }
  const suburb = normaliseSuburb(fields.suburb)
  const beds = fields.bedrooms != null && fields.bedrooms > 0 ? String(fields.bedrooms) : "na"
  return `sub:${suburb}:erf${erf}:bed${beds}`
}
