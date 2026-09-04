import type { AddonId, NeedId } from "@/lib/onboarding-needs"
import { NEEDS, needById, suggestedAddons } from "@/lib/onboarding-needs"
import { rupeesPerGramToPaisePer10g } from "@/lib/metal/math"

export type OnboardBeat = "name" | "who" | "type" | "features" | "extras" | "ready"

export const KIT_CHIPS: { id: NeedId; chip: string; line: string }[] = [
    { id: "pharmacy", chip: "Pharmacy", line: "Medicines & pharmacy" },
    { id: "autoParts", chip: "Auto parts", line: "Auto parts & spares" },
    { id: "distribute", chip: "Distributor", line: "Wholesale / dealers" },
    { id: "goldWholesale", chip: "Gold wholesale", line: "Gold & jewellery wholesale" },
]

export const ELSE_CHIPS: { id: NeedId; chip: string }[] = [
    { id: "sell", chip: "Optics" },
    { id: "time", chip: "Clinic" },
    { id: "salon", chip: "Salon" },
]

export const BRANCH_NEEDS: NeedId[] = ["pharmacy", "autoParts", "distribute", "goldWholesale"]

export const GOLD_CITIES = ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh"] as const

export const COPY = {
    name: {
        h: "What's your business called?",
        s: "This shows on your shop link.",
        placeholder: "Business name",
    },
    who: {
        h: "Who should the clone speak as?",
        s: "Optional. Skip if you're not ready.",
        placeholder: "Your name · Role (e.g. Owner)",
        skip: "Skip for now",
    },
    type: {
        h: "What do you sell?",
        s: "We'll turn on the right shop kit.",
        else: "Something else",
        elseHint: "Type what you do — we'll suggest a kit.",
        elsePlaceholder: "Optics, clinic, salon…",
        suggested: (kit: string) => `Suggested: ${kit}`,
    },
    features: {
        h: "What do you need on day one?",
        s: "You can change these later.",
    },
    extras: {
        pharmacy: {
            h: "Pharmacy extras",
            s: "Keep expired stock off the shop. Rx only when a medicine needs it.",
        },
        autoParts: {
            h: "Auto parts extras",
            s: "Shoppers filter by make, model, and year.",
        },
        distribute: {
            h: "Distributor extras",
            s: "Real desks for sales, warehouse, and accounts — not a preview.",
        },
        goldWholesale: {
            h: "Gold wholesale extras",
            s: "City rates and try kits for dealers.",
        },
        cityLabel: "City rates",
        cityHint: "Ranchi and nearby boards",
        desksJustMe: "Just me",
        desksInvite: "Invite desk",
        gstinSkip: "Skip",
        waLater: "Add later",
        emailSkip: "Skip",
        continue: "Continue",
        waWarn: "Orders work better with WhatsApp. You can add it later in Profile.",
        gstinPlaceholder: "GSTIN (optional)",
        waPlaceholder: "WhatsApp for orders",
        upiPlaceholder: "UPI (optional)",
    },
    ready: {
        h: "You're ready",
        s: "Open a sample shop or start empty.",
        trySample: "Try sample shop",
        empty: "Start empty",
        helper: "Chat home stays as-is — this only sets up your shop.",
    },
} as const

export function hasExtrasBeat(need: NeedId | null): boolean {
    return !!need && BRANCH_NEEDS.includes(need)
}

export function extrasCopy(need: NeedId | null) {
    if (need === "pharmacy") return COPY.extras.pharmacy
    if (need === "autoParts") return COPY.extras.autoParts
    if (need === "distribute") return COPY.extras.distribute
    if (need === "goldWholesale") return COPY.extras.goldWholesale
    return COPY.extras.pharmacy
}

export function filterKitChips(query: string) {
    const q = query.trim().toLowerCase()
    if (!q) return KIT_CHIPS
    return KIT_CHIPS.filter((k) => `${k.chip} ${k.line}`.toLowerCase().includes(q))
}

export function matchElseChip(query: string) {
    const q = query.trim().toLowerCase()
    if (!q) return ELSE_CHIPS
    return ELSE_CHIPS.filter((k) => k.chip.toLowerCase().includes(q) || needById(k.id).title.toLowerCase().includes(q) || needById(k.id).blurb.toLowerCase().includes(q))
}

export function matchNeedFromQuery(query: string): NeedId | null {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const kit = KIT_CHIPS.find((k) => k.chip.toLowerCase() === q || k.line.toLowerCase().includes(q))
    if (kit) return kit.id
    const elseHit = ELSE_CHIPS.find((k) => k.chip.toLowerCase() === q)
    if (elseHit) return elseHit.id
    const need = NEEDS.find((n) => n.title.toLowerCase() === q || n.id.toLowerCase() === q)
    return need?.id || null
}

export function splitSpeaker(raw: string): { name: string; role: string } {
    const t = raw.trim()
    const parts = t.split(/\s*[·|,]\s*/)
    if (parts.length >= 2) return { name: parts[0], role: parts.slice(1).join(" · ") }
    return { name: t, role: "" }
}

export function normalizeWhatsapp(raw: string): string | null {
    const d = raw.replace(/\D/g, "")
    if (d.length === 10) return d
    if (d.length === 12 && d.startsWith("91")) return d.slice(2)
    if (d.length === 11 && d.startsWith("0")) return d.slice(1)
    return null
}

export function defaultAddons(need: NeedId): AddonId[] {
    return suggestedAddons(needById(need).role)
}

export const DEFAULT_GOLD_RATES = {
    k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
    k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
    k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
}
