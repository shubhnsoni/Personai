import { prisma } from "@/lib/prisma"
import { formatInr, jobCheckoutOpen, splitJobPrice } from "@/lib/workspace-economy"
import { matchesOutcome, publicSignals, rankingScore } from "@/lib/workspace-discover"
import { assistantConnectionItem, connectionCatalog, connectionHealth, defaultManifest } from "@/lib/workspace-connections"
import { attachSkillInput, remixPresets, scheduleJobInput, teamTemplates } from "@/lib/workspace-teams"

export async function offerCreationJob(profileId: string, creationId: string, input: {
    name: string
    description?: string
    inputHint?: string
    outputHint?: string
    priceCents?: number | null
    offered?: boolean
}) {
    const owned = await prisma.creation.findFirst({ where: { id: creationId, profileId }, select: { id: true } })
    if (!owned) return null
    const name = input.name.trim().slice(0, 120)
    if (name.length < 3) throw new Error("Name the job in a short sentence.")
    const offered = Boolean(input.offered && input.priceCents && input.priceCents > 0)
    return prisma.creationJob.create({
        data: {
            creationId,
            name,
            description: input.description?.trim().slice(0, 500) || null,
            inputHint: input.inputHint?.trim().slice(0, 500) || null,
            outputHint: input.outputHint?.trim().slice(0, 500) || null,
            offered,
            priceCents: offered ? input.priceCents : null,
            currency: "INR",
        },
    })
}

export async function requestJobOrder(input: {
    creationId: string
    jobId: string
    prompt: string
    buyerProfileId?: string | null
    buyerEmail?: string | null
}) {
    const job = await prisma.creationJob.findFirst({
        where: { id: input.jobId, creationId: input.creationId, offered: true },
        include: { creation: { select: { id: true, profileId: true, name: true } } },
    })
    if (!job || !job.priceCents) throw new Error("That job is not offered.")
    const prompt = input.prompt.trim()
    if (prompt.length < 3) throw new Error("Describe the input for this job.")
    if (!jobCheckoutOpen()) {
        throw new Error("Paid jobs are not open yet. Checkout stays closed until billing and legal are confirmed.")
    }
    const split = splitJobPrice(job.priceCents)
    return prisma.creationOrder.create({
        data: {
            creationId: job.creationId,
            jobId: job.id,
            creatorProfileId: job.creation.profileId,
            buyerProfileId: input.buyerProfileId || null,
            buyerEmail: input.buyerEmail || null,
            ...split,
            currency: job.currency,
            status: "awaiting_checkout",
            input: prompt,
        },
    })
}

export async function earningsFor(profileId: string) {
    const orders = await prisma.creationOrder.findMany({
        where: { creatorProfileId: profileId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { creation: { select: { name: true } }, job: { select: { name: true } } },
    })
    const completed = orders.filter((row) => row.status === "completed")
    const refunded = orders.filter((row) => row.status === "refunded")
    return {
        checkoutOpen: jobCheckoutOpen(),
        jobsSold: completed.length,
        grossCents: completed.reduce((n, row) => n + row.priceCents, 0),
        feeCents: completed.reduce((n, row) => n + row.feeCents, 0),
        refundCents: refunded.reduce((n, row) => n + row.priceCents, 0),
        netCents: completed.reduce((n, row) => n + row.creatorCents, 0) - refunded.reduce((n, row) => n + row.creatorCents, 0),
        payoutStatus: jobCheckoutOpen() ? "Payouts follow completed jobs." : "Paid jobs are not open yet.",
        orders: orders.map((row) => ({
            id: row.id,
            creation: row.creation.name,
            job: row.job.name,
            status: row.status,
            amount: formatInr(row.priceCents),
            createdAt: row.createdAt.toISOString(),
        })),
    }
}

export async function hiredCreations(buyerProfileId: string) {
    return prisma.creationAccess.findMany({
        where: { buyerProfileId },
        orderBy: { lastUsedAt: "desc" },
        include: { creation: { select: { id: true, name: true, purpose: true, slug: true, profile: { select: { slug: true, displayName: true } } } } },
    })
}

export async function exploreCreations(query: string) {
    const rows = await prisma.creation.findMany({
        where: { visibility: "SHOWCASE" },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
            profile: { select: { slug: true, displayName: true } },
            jobs: { select: { name: true, offered: true } },
            _count: { select: { runs: true, reviews: true } },
            reviews: { select: { rating: true } },
        },
    })
    const mapped = rows.map((row) => {
        const rating = row.reviews.length ? row.reviews.reduce((n, r) => n + r.rating, 0) / row.reviews.length : null
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            purpose: row.purpose,
            description: row.description,
            creator: row.profile.displayName,
            href: `/${row.profile.slug}/ai/${row.slug}`,
            jobs: row.jobs.map((job) => job.name),
            offered: row.jobs.some((job) => job.offered),
            completed: row._count.runs,
            rating,
            score: rankingScore({ completed: row._count.runs, rating, repeats: 0, refunds: 0 }),
            signals: publicSignals({ createdAt: row.createdAt, completed: row._count.runs, rating }),
        }
    }).filter((row) => matchesOutcome(query, row))
    mapped.sort((a, b) => b.score - a.score)
    return mapped
}

export async function ensureProfileConnections(profileId: string) {
    const existing = await prisma.workspaceConnection.findMany({ where: { profileId } })
    if (existing.length) return existing
    await prisma.workspaceConnection.createMany({
        data: connectionCatalog().map((item) => ({
            profileId,
            kind: item.kind,
            label: item.title,
            status: item.kind === "FILES" || item.kind === "SHOP" ? "connected" : "unavailable",
            scopes: item.kind === "FILES" ? ["read"] : [],
        })),
    })
    return prisma.workspaceConnection.findMany({ where: { profileId } })
}

export async function assistantItems(profileId: string) {
    const connections = await ensureProfileConnections(profileId)
    const pending = await prisma.creationApproval.findMany({
        where: { status: "PENDING", creation: { profileId } },
        include: { creation: { select: { name: true } } },
        take: 12,
    })
    const items = [
        ...connections.flatMap((row) => {
            const item = assistantConnectionItem(row)
            return item ? [item] : []
        }),
        ...pending.map((row) => ({
            title: `${row.creation.name} is waiting for approval.`,
            detail: `${row.action}: ${row.payload}`,
        })),
    ]
    if (!items.length) {
        items.push({ title: "Nothing needs you right now.", detail: "Scheduled jobs and visitor chats will appear here when they need a decision." })
    }
    return items
}

export function creationManifest(purpose: string | null) {
    return defaultManifest(purpose || "Complete concrete work")
}

export async function attachCreationSkill(profileId: string, hostId: string, usesId: string) {
    const ids = attachSkillInput(hostId, usesId)
    const owned = await prisma.creation.findMany({
        where: { profileId, id: { in: [ids.hostId, ids.usesId] } },
        select: { id: true },
    })
    if (owned.length !== 2) return null
    return prisma.creationSkillDep.upsert({
        where: { hostId_usesId: { hostId: ids.hostId, usesId: ids.usesId } },
        update: {},
        create: ids,
    })
}

export async function scheduleCreationJob(profileId: string, input: { creationId: string; jobId: string; cadence: string }) {
    const data = scheduleJobInput(input)
    const job = await prisma.creationJob.findFirst({
        where: { id: data.jobId, creationId: data.creationId, creation: { profileId } },
        select: { id: true, creationId: true },
    })
    if (!job) return null
    return prisma.creationSchedule.create({
        data: {
            creationId: job.creationId,
            jobId: job.id,
            cadence: data.cadence,
        },
    })
}

export { remixPresets, teamTemplates, connectionCatalog, connectionHealth }
