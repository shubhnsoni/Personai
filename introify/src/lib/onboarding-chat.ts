import type { AddonId, NeedId } from "@/lib/onboarding-needs"
import { NEEDS, needById, suggestedAddons } from "@/lib/onboarding-needs"
import { rupeesPerGramToPaisePer10g } from "@/lib/metal/math"

export type OnboardBeat = "name" | "username" | "who" | "type" | "features" | "extras" | "look" | "ready"

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
        s: "This is the name customers see.",
        placeholder: "Business name",
    },
    username: {
        h: "Pick a username",
        s: "This is your public link. You can switch path vs subdomain later in Profile.",
        placeholder: "username",
        taken: "That username is taken",
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
        confirm: "Looks good",
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
        cityLabel: "City for rates",
        cityHint: "Ranchi and nearby boards",
        cityEnter: "Enter city",
        desksJustMe: "Just me",
        desksInvite: "Invite desk",
        continue: "Continue",
        waWarn: "Orders work better with a phone number. You can add it later in Profile.",
        gstinPlaceholder: "GSTIN (optional)",
        phoneLabel: "Phone",
        emailLabel: "Email",
        waPlaceholder: "WhatsApp for orders",
        upiPlaceholder: "UPI (optional)",
    },
    look: {
        h: "Give it a face",
        s: "Circle, centred eyes, one colour. Mood and aura are yours.",
        continue: "Looks right",
        premium: "This is a premium bot",
    },
    ready: {
        h: "Save this look?",
        s: "This is how it will appear on your live page.",
        trySample: "Try sample shop",
        empty: "Start empty",
        helper: "Chat home stays as-is — this only sets up your shop.",
        save: "Save and go to dashboard",
        modify: "Keep modifying",
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
