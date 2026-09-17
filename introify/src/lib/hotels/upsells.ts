import type { HotelStayPhase } from "./stay"

export type HotelUpsell = {
    id: string
    kind: "late_checkout" | "spa" | "transport"
    prompt: string
    audience: "during" | "checkout" | "pre_arrival" | "after" | "any"
    frequency: "once" | "daily"
}

export const DEFAULT_HOTEL_UPSELLS: HotelUpsell[] = [
    {
        id: "late_checkout",
        kind: "late_checkout",
        prompt: "Need a later checkout? I can file a request — this chat does not charge.",
        audience: "checkout",
        frequency: "once",
    },
    {
        id: "spa",
        kind: "spa",
        prompt: "Spa treatments are a request from this chat, not a billed booking.",
        audience: "during",
        frequency: "daily",
    },
    {
        id: "transfer",
        kind: "transport",
        prompt: "Airport transfer is a request, not a billed ride.",
        audience: "checkout",
        frequency: "once",
    },
]

export function shouldOfferUpsell(
    upsell: HotelUpsell,
    ctx: { phase?: HotelStayPhase | null; alreadyOffered?: boolean },
) {
    if (ctx.alreadyOffered && upsell.frequency === "once") return false
    if (ctx.alreadyOffered && upsell.frequency === "daily") return false
    if (upsell.audience === "any") return true
    return upsell.audience === (ctx.phase || "during")
}

export function upsellCopy(upsell: HotelUpsell, policiesApproved: boolean) {
    if (policiesApproved) return `${upsell.prompt} Still a request, never a charge from this page.`
    return upsell.prompt
}

export function parseHotelUpsells(raw: string | null | undefined): HotelUpsell[] {
    try {
        const value = JSON.parse(raw || "[]")
        if (!Array.isArray(value) || !value.length) return DEFAULT_HOTEL_UPSELLS.map((row) => ({ ...row }))
        return value.filter((row) => row && typeof row.id === "string" && typeof row.prompt === "string") as HotelUpsell[]
    } catch {
        return DEFAULT_HOTEL_UPSELLS.map((row) => ({ ...row }))
    }
}

export function firstUpsellLine(
    upsells: HotelUpsell[] | undefined,
    phase: HotelStayPhase | null | undefined,
    policiesApproved?: boolean,
) {
    const list = upsells?.length ? upsells : DEFAULT_HOTEL_UPSELLS
    const hit = list.find((row) => shouldOfferUpsell(row, { phase: phase || "during", alreadyOffered: false }))
    return hit ? upsellCopy(hit, Boolean(policiesApproved)) : ""
}
