import type { PrismaClient } from "@prisma/client"
import { ensureTryHotelDemo, TRY_HOTEL } from "./try-hotel-seed"

/** Canonical Haven Hinoo showcase slug (TRY_KITS / seeded demo). */
export const TRY_HOTEL_CANONICAL_SLUG = TRY_HOTEL.slug

/**
 * Marketing / discovery aliases that historically soft-404'd while /try-hotel worked.
 * Mapped to the canonical showcase (same approach as SHOP P1-2 grocery→try-shop redirects).
 */
export const STAY_DISCOVERY_ALIASES = ["hotel", "try-stay", "try-bnb"] as const

export type StayDiscoveryAlias = (typeof STAY_DISCOVERY_ALIASES)[number]

export const STAY_DISCOVERY_DESTINATION = `/${TRY_HOTEL_CANONICAL_SLUG}` as const

export type StayDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect table for stay discovery aliases (exact + nested paths). */
export function stayDiscoveryRedirects(): StayDiscoveryRedirect[] {
    const rows: StayDiscoveryRedirect[] = []
    for (const alias of STAY_DISCOVERY_ALIASES) {
        rows.push({ source: `/${alias}`, destination: STAY_DISCOVERY_DESTINATION, permanent: false })
        rows.push({
            source: `/${alias}/:path*`,
            destination: `${STAY_DISCOVERY_DESTINATION}/:path*`,
            permanent: false,
        })
    }
    return rows
}

export function isStayDiscoveryAlias(slug?: string | null): slug is StayDiscoveryAlias {
    return Boolean(slug && (STAY_DISCOVERY_ALIASES as readonly string[]).includes(slug))
}

export function isTryHotelShowcaseSlug(slug?: string | null): boolean {
    return slug === TRY_HOTEL_CANONICAL_SLUG
}

/** Resolve a path's stay-discovery redirect target, or null if not an alias. */
export function stayDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const alias of STAY_DISCOVERY_ALIASES) {
        if (path === `/${alias}`) return STAY_DISCOVERY_DESTINATION
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `${STAY_DISCOVERY_DESTINATION}/${path.slice(prefix.length)}`
        }
    }
    return null
}

export type TryHotelEnsureAction = "noop-unrelated" | "ensure-canonical"

export type TryHotelEnsurePlan = {
    action: TryHotelEnsureAction
    slug: string
    canonicalSlug: string
}

/** Pure planner — only the canonical try-hotel slug triggers seed ensure. */
export function planTryHotelEnsure(slug: string): TryHotelEnsurePlan {
    if (!isTryHotelShowcaseSlug(slug)) {
        return { action: "noop-unrelated", slug, canonicalSlug: TRY_HOTEL_CANONICAL_SLUG }
    }
    return { action: "ensure-canonical", slug, canonicalSlug: TRY_HOTEL_CANONICAL_SLUG }
}

export type EnsureTryHotelResult = {
    action: TryHotelEnsureAction
    created: boolean
    skipped: string[]
    profileId: string | null
}

/**
 * Ensure-on-visit for /try-hotel (Haven Hinoo). Discovery aliases redirect in next.config
 * and never reach this path. Idempotent; collision-safe via ensureTryHotelDemo.
 */
export async function ensureTryHotelShowcase(
    prisma: PrismaClient,
    slug: string,
): Promise<EnsureTryHotelResult> {
    const plan = planTryHotelEnsure(slug)
    if (plan.action !== "ensure-canonical") {
        return { action: plan.action, created: false, skipped: [], profileId: null }
    }
    const result = await ensureTryHotelDemo(prisma)
    const skipped = Array.isArray((result as { skipped?: string[] }).skipped)
        ? (result as { skipped: string[] }).skipped
        : []
    return {
        action: plan.action,
        created: Boolean((result as { created?: boolean }).created),
        skipped,
        profileId: null,
    }
}
