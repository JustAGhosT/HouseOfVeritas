/** Search endpoints for the merchants the estate actually buys from. */
export const STORE_SEARCH_URLS = {
  cashbuild: "https://www.cashbuild.co.za/search?q=",
  builders: "https://www.builders.co.za/search/?text=",
  makro: "https://www.makro.co.za/search/?text=",
  stodels: "https://www.stodels.co.za/catalogsearch/result/?q=",
} as const

export type StoreId = keyof typeof STORE_SEARCH_URLS

export function isStoreId(value: unknown): value is StoreId {
  return typeof value === "string" && value.toLowerCase() in STORE_SEARCH_URLS
}

/** Returns null for an unknown store rather than a link that goes nowhere. */
export function buildStoreSearchUrl(store: unknown, query: string): string | null {
  if (!isStoreId(store)) return null
  return `${STORE_SEARCH_URLS[store.toLowerCase() as StoreId]}${encodeURIComponent(query)}`
}
