import { existsSync } from "node:fs"
import { prisma } from "@/lib/prisma"
import { env } from "@/lib/env"
import { uploadsDirectory } from "@/lib/uploads-storage"
import { loadPlatformAiSettings, providerConfigured } from "@/lib/admin/ai-settings"

export type LoadBand = "ok" | "warm" | "hot"

export type CapacitySnapshot = {
    at: Date
    liveVisitors: number
    heartbeatQps: number
    liveChatPollQps: number
    orderPollQps: number
    llmCalls5m: number
    llmErrors5m: number
    llmP95Ms: number | null
    dbMs: number
    pollQps: number
    band: LoadBand
}

export function loadBand(input: {
    liveVisitors: number
    llmP95Ms: number | null
    dbMs: number
    pollQps: number
}): LoadBand {
    if (input.liveVisitors > 200 || input.dbMs > 200 || (input.llmP95Ms != null && input.llmP95Ms > 8000)) return "hot"
    if (input.liveVisitors >= 50 || input.pollQps > 20 || input.dbMs > 80 || (input.llmP95Ms != null && input.llmP95Ms > 4000)) return "warm"
    return "ok"
}

export function suggestedTier(band: LoadBand): "laptop" | "launch" | "warm" | "hot" {
    if (band === "hot") return "hot"
    if (band === "warm") return "warm"
    if (process.env.NODE_ENV === "production") return "launch"
    return "laptop"
}

export const TIER_COPY: Record<ReturnType<typeof suggestedTier>, { title: string; items: string[] }> = {
    laptop: {
        title: "Tier 0 — this laptop",
        items: [
            "Fine for you and a few test shops.",
            "Keep Codex login or an xAI/OpenAI key locally.",
            "Do not put real jewellers on `next dev`.",
        ],
    },
    launch: {
        title: "Tier 1 — launch (≤ ~20 shops, < 50 live visitors)",
        items: [
            "Vercel Pro or one Node box (Fly/Railway) plus Neon/Supabase Postgres with the pooler URL.",
            "Move `public/uploads` to S3/R2/Vercel Blob before serverless. Local disk will lose files.",
            "Postgres ~1 vCPU / 2 GB with pooling is enough.",
            "Region close to India if shops are IN.",
            "Stripe webhook, ADMIN_EMAILS, and Codex or xAI must be green on the checklist.",
        ],
    },
    warm: {
        title: "Tier 2 — warm (festival weekend, 50–200 live)",
        items: [
            "Add Redis: rate limits, live-chat presence, who-is-here. The in-memory Map resets per instance.",
            "Replace 4s live-chat and order polling with SSE (order SSE already exists) or a websocket.",
            "Use the pooled Postgres URL everywhere. Set Prisma connection_limit.",
            "Queue LLM, AR/Meshy, and mail (Inngest or similar).",
            "Stop `Cache-Control: no-store` on media so the CDN can help.",
            "Roll up /admin aggregates so the console does not scan production tables on every refresh.",
        ],
    },
    hot: {
        title: "Tier 3 — hot (> 200 live or chat p95 dying)",
        items: [
            "Dedicated Postgres (primary IN/SG) plus a replica for admin reads.",
            "Redis required. 2+ app instances. Chat on a long-lived Node process, not serverless timeouts.",
            "Starting size: app 2× 2 vCPU / 2 GB, Redis 1 GB, Postgres 4 GB RAM / 50 GB SSD, blob CDN.",
            "Kill the expensive AI provider on /admin/ai. Cap concurrent completions.",
            "Rate-limit chat POST and heartbeats in Redis.",
            "Flip a maintenance / delayed-orders banner from platform flags if you need to shed load.",
        ],
    },
}

function percentile(values: number[], p: number) {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
    return sorted[idx]
}

export async function pingDatabase() {
    const started = Date.now()
    try {
        await prisma.$queryRaw`SELECT 1`
        return { ok: true, ms: Date.now() - started }
    } catch {
        return { ok: false, ms: Date.now() - started }
    }
}

export async function measureCapacity(): Promise<CapacitySnapshot> {
    const liveSince = new Date(Date.now() - 2 * 60 * 1000)
    const fiveMin = new Date(Date.now() - 5 * 60 * 1000)
    const hour = new Date(Date.now() - 60 * 60 * 1000)
    const db = await pingDatabase()
    const [liveVisitors, liveChatShops, openOrders, llm] = await Promise.all([
        prisma.visitorSession.count({ where: { lastSeenAt: { gte: liveSince }, endedAt: null } }).catch(() => 0),
        prisma.conversation.groupBy({
            by: ["profileId"],
            where: { mode: { in: ["LIVE_REQUESTED", "LIVE"] } },
        }).then((rows) => rows.length).catch(() => 0),
        prisma.order.count({
            where: { placedAt: { gte: hour }, status: { notIn: ["PAID", "CANCELLED", "SERVED"] } },
        }).catch(() => 0),
        prisma.aiCallLog.findMany({
            where: { createdAt: { gte: fiveMin } },
            select: { ok: true, ms: true },
            take: 400,
        }).catch(() => []),
    ])
    const heartbeatQps = liveVisitors / 15
    const liveChatPollQps = liveChatShops / 4
    const orderPollQps = openOrders / 4
    const pollQps = liveChatPollQps + orderPollQps + heartbeatQps
    const llmCalls5m = llm.length
    const llmErrors5m = llm.filter((row) => !row.ok).length
    const llmP95Ms = percentile(llm.map((row) => row.ms), 95)
    const band = loadBand({ liveVisitors, llmP95Ms, dbMs: db.ms, pollQps })
    return {
        at: new Date(),
        liveVisitors,
        heartbeatQps,
        liveChatPollQps,
        orderPollQps,
        llmCalls5m,
        llmErrors5m,
        llmP95Ms,
        dbMs: db.ok ? db.ms : Math.max(db.ms, 999),
        pollQps,
        band,
    }
}

export async function recordCapacitySample(snapshot: CapacitySnapshot) {
    const last = await prisma.capacitySample.findFirst({ orderBy: { at: "desc" } }).catch(() => null)
    if (last && Date.now() - last.at.getTime() < 60_000) return last
    return prisma.capacitySample.create({
        data: {
            liveVisitors: snapshot.liveVisitors,
            heartbeatQps: snapshot.heartbeatQps,
            liveChatPollQps: snapshot.liveChatPollQps,
            llmCalls5m: snapshot.llmCalls5m,
            llmErrors5m: snapshot.llmErrors5m,
            dbMs: snapshot.dbMs,
            band: snapshot.band,
        },
    }).catch(() => null)
}

export type SetupCheck = { id: string; label: string; ok: boolean; hint?: string }

export async function platformSetupChecks(): Promise<SetupCheck[]> {
    const ai = await loadPlatformAiSettings()
    const dbUrl = process.env.DATABASE_URL || ""
    const appUrl = env.appUrl
    const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET)
    const uploads = blob || existsSync(uploadsDirectory())
    const pooled = /pooler|pgbouncer|connection_limit/i.test(dbUrl)
    const lastWebhook = await readOps().then((ops) => ops.lastStripeWebhookAt).catch(() => null)
    const heartbeat = await prisma.visitorSession.count({
        where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    }).catch(() => 0)

    return [
        { id: "db", label: "Postgres DATABASE_URL", ok: /postgres(ql)?:\/\//i.test(dbUrl), hint: dbUrl ? "set" : "missing" },
        { id: "clerk", label: "Clerk keys", ok: env.hasClerk },
        { id: "admins", label: "ADMIN_EMAILS", ok: Boolean(process.env.ADMIN_EMAILS?.trim()) },
        { id: "stripe", label: "Stripe keys", ok: env.hasStripe, hint: lastWebhook ? `last webhook ${lastWebhook}` : "no webhook seen yet" },
        { id: "appurl", label: "NEXT_PUBLIC_APP_URL is a real host", ok: Boolean(appUrl) && !/localhost|127\.0\.0\.1/i.test(appUrl), hint: appUrl },
        { id: "uploads", label: "Upload storage", ok: uploads, hint: blob ? "object storage" : process.env.UPLOADS_DIR?.trim() ? "configured UPLOADS_DIR" : "local public/uploads" },
        { id: "ai", label: "An AI backend is configured and not killed", ok: (["codex", "xai", "openai"] as const).some((k) => providerConfigured(k) && !ai.kill[k]) },
        { id: "health", label: "HEALTH_DIAGNOSTICS_TOKEN", ok: Boolean(process.env.HEALTH_DIAGNOSTICS_TOKEN?.trim()) },
        { id: "pool", label: "Postgres pooler in the URL", ok: pooled || process.env.NODE_ENV !== "production", hint: pooled ? "pooled" : "add Neon/Supabase pooler before many shops" },
        { id: "ingest", label: "Session heartbeats last 5 min", ok: heartbeat > 0 || process.env.NODE_ENV !== "production", hint: `${heartbeat} sessions` },
        { id: "resend", label: "Resend (optional until you email owners)", ok: env.hasResend, hint: env.hasResend ? "configured" : "console fallback" },
    ]
}

type OpsJson = { lastStripeWebhookAt?: string; maintenance?: boolean }

export async function readOps(): Promise<OpsJson> {
    const row = await prisma.platformConfig.findUnique({ where: { id: "platform" } }).catch(() => null)
    try {
        return JSON.parse(row?.opsJson || "{}") as OpsJson
    } catch {
        return {}
    }
}

export async function stampStripeWebhook() {
    const ops = await readOps()
    ops.lastStripeWebhookAt = new Date().toISOString()
    const opsJson = JSON.stringify(ops)
    await prisma.platformConfig.upsert({
        where: { id: "platform" },
        create: { id: "platform", opsJson },
        update: { opsJson },
    }).catch(() => {})
}

export async function dependencyHealth() {
    const ai = await loadPlatformAiSettings()
    const db = await pingDatabase()
    const lastAi = await prisma.aiCallLog.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null)
    const ops = await readOps()
    return {
        database: db,
        clerk: env.hasClerk,
        stripe: env.hasStripe,
        resend: env.hasResend,
        codex: providerConfigured("codex") && !ai.kill.codex,
        xai: providerConfigured("xai") && !ai.kill.xai,
        openai: providerConfigured("openai") && !ai.kill.openai,
        lastAi,
        lastStripeWebhookAt: ops.lastStripeWebhookAt || null,
    }
}
