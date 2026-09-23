/**
 * SHOP P1-4 — mobile catalog header brand identity policy.
 *
 * At ~390px, a sibling hours chip + icon controls used to starve ShopWordmark
 * down to "Ra…" or hide the name entirely. Layout keeps logo + stacked name
 * (1–2 lines) and moves hours under the name on small screens; this helper
 * encodes the truncation floor if a caller must shorten by character budget.
 */

/** Never ellipsize a shop brand below this many visible characters when the full name is longer. */
export const CATALOG_BRAND_MIN_CHARS = 8

/**
 * Truncate a catalog brand for a constrained character budget.
 * Identity wins over fit: if `maxChars` is below the minimum readable floor,
 * we still keep `minChars` (avoids unusable stems like "Ra…").
 */
export function truncateCatalogBrandName(
    name: string,
    maxChars: number,
    minChars: number = CATALOG_BRAND_MIN_CHARS,
): string {
    const text = name.trim().replace(/\s+/g, " ")
    if (!text) return ""
    const floor = Math.max(1, Math.floor(minChars))
    if (text.length <= floor) return text
    if (Number.isFinite(maxChars) && maxChars >= text.length) return text

    const budget = Number.isFinite(maxChars) ? Math.floor(maxChars) : floor
    const keep = Math.min(text.length, Math.max(floor, budget))
    if (keep >= text.length) return text

    const slice = text.slice(0, keep)
    // Cut landed on a word boundary — keep the full slice (minus trailing space).
    if (text[keep] === " ") {
        return `${slice.replace(/\s+$/, "")}…`
    }
    // Mid-word cut — prefer the previous complete word when it still meets the floor.
    const atSpace = slice.replace(/\s+\S*$/, "")
    const base = atSpace.length >= floor ? atSpace : slice
    return `${base.replace(/\s+$/, "")}…`
}

/** Tailwind classes for non-compact (shop) brand name — two lines on mobile, single truncate on sm+. */
export const catalogShopBrandNameClassName =
    "block text-lg font-semibold tracking-tight text-foreground line-clamp-2 sm:truncate"

/** Hours under the brand on mobile only (frees horizontal space for identity + controls). */
export const catalogShopHoursUnderBrandClassName =
    "mt-0.5 block truncate text-[11px] font-medium text-cyan-400 sm:hidden"

/** Desktop sibling hours chip (hidden below sm so it cannot starve the wordmark). */
export const catalogShopHoursDesktopChipClassName =
    "hidden min-w-0 max-w-[11rem] truncate text-[11px] font-medium text-cyan-400 sm:inline"
