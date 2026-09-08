export type LeadActivity = { at: string; kind: string; text: string }

export type LeadTags = {
    note?: string
    followUpAt?: string | null
    activity?: LeadActivity[]
}

export function parseLeadTags(raw?: string | null): LeadTags {
    if (!raw) return {}
    try {
        const v = JSON.parse(raw)
        if (v && typeof v === "object") return v as LeadTags
    } catch {
        return { note: raw }
    }
    return { note: raw }
}

export function pushActivity(tags: LeadTags, text: string, kind = "note"): LeadTags {
    const item: LeadActivity = { at: new Date().toISOString(), kind, text }
    return { ...tags, activity: [item, ...(tags.activity || [])].slice(0, 30) }
}

export function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function followUpState(followUpAt?: string | null): "none" | "overdue" | "today" | "later" {
    if (!followUpAt) return "none"
    const key = followUpAt.slice(0, 10)
    const today = todayKey()
    if (key < today) return "overdue"
    if (key === today) return "today"
    return "later"
}
