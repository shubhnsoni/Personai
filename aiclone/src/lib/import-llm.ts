import type { ImportItem, ImportKind } from "@/lib/import-extract"
import { item } from "@/lib/import-extract"

const KINDS: ImportKind[] = [
    "profile", "experience", "project", "service", "product",
    "course", "event", "community", "leadMagnet", "knowledge",
]

export async function extractWithModel(text: string): Promise<ImportItem[]> {
    const key = process.env.OPENAI_API_KEY
    if (!key || !text.trim()) return []

    const OpenAI = (await import("openai")).default
    const openai = new OpenAI({ apiKey: key })
    const clipped = text.replace(/\s+/g, " ").trim().slice(0, 12000)

    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: `Extract structured creator-profile content. Return JSON {"items":[...]}.
Each item: kind, title, confidence (0-1), fields (object).
Kinds: ${KINDS.join(", ")}.
Rules:
- Do not invent prices or dates. Omit if not in the source.
- Profile: displayName, headline, bio.
- Experience: role, company, startDate, endDate, description.
- Project: description, year, client, link.
- Service: description, price (dollars), durationMinutes.
- Product: description, price, productType PDF|VIDEO|AUDIO|OTHER, fileUrl, category, diet VEG|NONVEG|EGG|VEGAN. For restaurant menus set fulfillment PHYSICAL.
- Course: description, price, modules[{title,lessons[{title,durationMinutes,isFree,contentType}]}].
- Event: startTime ISO, endTime ISO, location, meetingUrl, eventType WEBINAR|WORKSHOP|MEETUP, price.
- Community: platform TELEGRAM|DISCORD, inviteLink, price, billingCycle.
- Lead magnet: magnetType DOWNLOAD|FORM|GIVEAWAY, fileUrl, description.
- Knowledge: leftover useful prose as body. Only if it is not already another item.
- Skip navigation chrome, cookie banners, FAQ, testimonials, counters (10+, 250+), Color Switcher, Terms, Privacy.
- Do not emit section titles (About, Services, Portfolio, Resume, Contact) as items.
- Do not invent extra copies of the same job, service, or project.
- Max 40 items.`,
            },
            { role: "user", content: clipped },
        ],
    })

    const raw = res.choices[0]?.message?.content
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as { items?: Array<Record<string, unknown>> }
        return (parsed.items || []).map(coerce).filter(Boolean) as ImportItem[]
    } catch {
        return []
    }
}

function coerce(raw: Record<string, unknown>): ImportItem | null {
    const kind = String(raw.kind || "") as ImportKind
    if (!KINDS.includes(kind)) return null
    const title = String(raw.title || "").trim()
    if (!title) return null
    const confidence = clamp(Number(raw.confidence) || 0.6)
    const fields = (raw.fields && typeof raw.fields === "object") ? raw.fields as ImportItem["fields"] : {}
    return item(kind, title, confidence, sanitizeFields(fields))
}

function sanitizeFields(fields: ImportItem["fields"]): ImportItem["fields"] {
    const next = { ...fields }
    if (next.price != null) {
        const n = Number(next.price)
        next.price = Number.isFinite(n) ? n : undefined
    }
    if (next.durationMinutes != null) {
        const n = Number(next.durationMinutes)
        next.durationMinutes = Number.isFinite(n) ? n : 30
    }
    return next
}

function clamp(n: number) {
    if (!Number.isFinite(n)) return 0.6
    return Math.min(1, Math.max(0, n))
}
