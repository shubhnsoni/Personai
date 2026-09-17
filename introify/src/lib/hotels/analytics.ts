export const DEFAULT_HOTEL_SLA_MINUTES: Record<string, number> = {
    HOUSEKEEPING: 30,
    MAINTENANCE: 45,
    SPA: 120,
    TRANSPORT: 60,
    EXPERIENCES: 240,
    RECEPTION: 15,
    SECURITY: 5,
}

export type HotelSlaBadge = "ok" | "approaching" | "breached"

export type HotelAnalyticsRequest = {
    type: string
    department: string | null
    status: string
    createdAt: Date
    updatedAt: Date
}

export type HotelAnalyticsQr = {
    code: string
    label: string | null
    kind: string
    scanCount: number
}

export type HotelSlaRow = {
    department: string
    targetMinutes: number
    open: number
    approaching: number
    breached: number
}

export type HotelAnalyticsSummary = {
    volumeByDepartment: Record<string, number>
    avgCompletionMinutes: Record<string, number>
    qrScansByCode: Array<{ code: string; label: string | null; kind: string; scanCount: number }>
    handoffRate: number
    topQuestions: Array<{ text: string; count: number }>
    sla: HotelSlaRow[]
}

function departmentOf(row: HotelAnalyticsRequest) {
    return row.department || row.type || "UNKNOWN"
}

export function slaBadge(
    row: { department?: string | null; status: string; createdAt: Date },
    sla: Record<string, number>,
    now: Date,
): HotelSlaBadge {
    if (row.status === "COMPLETE") return "ok"
    const target = sla[row.department || ""]
    if (!target) return "ok"
    const elapsed = now.getTime() - row.createdAt.getTime()
    const ratio = elapsed / (target * 60_000)
    if (ratio >= 1) return "breached"
    if (ratio >= 0.8) return "approaching"
    return "ok"
}

export function summarizeHotelAnalytics(input: {
    now: Date
    requests: HotelAnalyticsRequest[]
    qrs: HotelAnalyticsQr[]
    questions: string[]
    sla?: Record<string, number>
}): HotelAnalyticsSummary {
    const sla = input.sla || DEFAULT_HOTEL_SLA_MINUTES
    const volumeByDepartment: Record<string, number> = {}
    const completeSum: Record<string, { total: number; minutes: number }> = {}
    for (const row of input.requests) {
        const dept = departmentOf(row)
        volumeByDepartment[dept] = (volumeByDepartment[dept] || 0) + 1
        if (row.status === "COMPLETE") {
            const minutes = Math.max(0, (row.updatedAt.getTime() - row.createdAt.getTime()) / 60_000)
            const bucket = completeSum[dept] || { total: 0, minutes: 0 }
            bucket.total += 1
            bucket.minutes += minutes
            completeSum[dept] = bucket
        }
    }
    const avgCompletionMinutes: Record<string, number> = {}
    for (const [dept, bucket] of Object.entries(completeSum)) {
        avgCompletionMinutes[dept] = bucket.total ? bucket.minutes / bucket.total : 0
    }
    const counts = new Map<string, number>()
    for (const raw of input.questions) {
        const text = raw.trim().toLowerCase()
        if (!text) continue
        counts.set(text, (counts.get(text) || 0) + 1)
    }
    const topQuestions = [...counts.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    const qrScansByCode = [...input.qrs].sort((a, b) => b.scanCount - a.scanCount)
    const handoffs = input.requests.filter((row) => row.type === "HANDOFF").length
    const slaRows: HotelSlaRow[] = Object.entries(sla).map(([department, targetMinutes]) => {
        const openRows = input.requests.filter((row) => departmentOf(row) === department && row.status !== "COMPLETE")
        let approaching = 0
        let breached = 0
        for (const row of openRows) {
            const badge = slaBadge({ department, status: row.status, createdAt: row.createdAt }, sla, input.now)
            if (badge === "approaching") approaching += 1
            if (badge === "breached") breached += 1
        }
        return { department, targetMinutes, open: openRows.length, approaching, breached }
    })
    return {
        volumeByDepartment,
        avgCompletionMinutes,
        qrScansByCode,
        handoffRate: input.requests.length ? handoffs / input.requests.length : 0,
        topQuestions,
        sla: slaRows,
    }
}

export function parseHotelSlaJson(raw: string | null | undefined): Record<string, number> {
    try {
        const value = JSON.parse(raw || "{}")
        if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_HOTEL_SLA_MINUTES }
        const next = { ...DEFAULT_HOTEL_SLA_MINUTES }
        for (const [key, minutes] of Object.entries(value as Record<string, unknown>)) {
            const n = Number(minutes)
            if (Number.isFinite(n) && n > 0) next[key] = n
        }
        return next
    } catch {
        return { ...DEFAULT_HOTEL_SLA_MINUTES }
    }
}
