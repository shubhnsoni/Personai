import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AI_MODES, getPlan, isPlanId, type AiMode, type LimitKind, type Plan, type PlanId, type UsageUnit } from "./catalog"
import { allowanceWindow, effectivePaidPlan } from "./periods"
import { PROFILE_IMPORT_POLICY } from "@/lib/profile-import-contract"
import { backfillAccountStorage } from "./storage-backfill"

export type BillingTx = Prisma.TransactionClient
export type BillingContext = { accountId: string; planId: PlanId; plan: Plan; features: Plan["features"]; paidThrough: Date | null; subscriptionStatus: string }
type Allocation = { grantId: string; amount: number }
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

export async function billingTransaction<T>(work: (tx: BillingTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try { return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 20_000 }) }
        catch (error) {
            if (attempt < 3 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue
            throw error
        }
    }
}

export async function lockBillingAccount(tx: BillingTx, accountId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "BillingAccount" WHERE id = ${accountId} FOR UPDATE`
    if (!rows.length) throw new Error("Billing account not found.")
}

export async function ensureDefaultBillingAccount(userId: string) {
    return billingTransaction(async tx => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } })
        const account = await tx.billingAccount.upsert({ where: { defaultForUserId: userId }, create: { defaultForUserId: userId, ownerUserId: userId, name: `${user.name || "My"} account`, members: { create: { userId, role: "OWNER" } } }, update: {} })
        await lockBillingAccount(tx, account.id)
        // Existing customer data is retained; caps apply only to future growth.
        await tx.profile.updateMany({ where: { userId, billingAccountId: null }, data: { billingAccountId: account.id } })
        const profiles = await tx.profile.findMany({ where: { billingAccountId: account.id }, select: { id: true } })
        const unlinked = await tx.workspace.findMany({ where: { profileId: { in: profiles.map(p => p.id) }, billingAccountId: null }, select: { id: true } })
        await tx.workspace.updateMany({ where: { id: { in: unlinked.map(w => w.id) } }, data: { billingAccountId: account.id } })
        const legacyMembers = await tx.membership.findMany({ where: { workspaceId: { in: unlinked.map(w => w.id) } }, select: { userId: true } })
        await tx.billingAccountMember.createMany({ data: [...new Set(legacyMembers.map(m => m.userId))].filter(id => id !== userId).map(id => ({ accountId: account.id, userId: id, role: "MEMBER" })), skipDuplicates: true })
        await tx.billingAccountMember.upsert({ where: { accountId_userId: { accountId: account.id, userId } }, create: { accountId: account.id, userId, role: "OWNER" }, update: {} })
        return account
    })
}

export async function accountContext(tx: BillingTx, accountId: string, now = new Date()): Promise<BillingContext> {
    const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: accountId }, include: { subscription: true } })
    const subscription = account.subscription
    const paid = account.status === "ACTIVE" && effectivePaidPlan(subscription, now)
    const planId = paid && isPlanId(subscription?.planId) ? subscription.planId : "free"
    const plan = getPlan(planId)
    return { accountId, planId, plan, features: plan.features, paidThrough: paid ? subscription!.paidThrough : null, subscriptionStatus: account.status !== "ACTIVE" ? account.status : subscription?.status || "FREE" }
}

export async function getAccountBilling(accountId: string) { await backfillAccountStorage(accountId); return accountContext(prisma, accountId) }
export async function getProfileBilling(profileId: string) {
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: profileId }, select: { billingAccountId: true, userId: true } })
    const accountId = profile.billingAccountId || (await ensureDefaultBillingAccount(profile.userId)).id
    return getAccountBilling(accountId)
}

export async function accountUsage(tx: BillingTx, accountId: string): Promise<Record<LimitKind, number>> {
    const ids = (await tx.profile.findMany({ where: { billingAccountId: accountId }, select: { id: true } })).map(p => p.id)
    const published = { profileId: { in: ids }, isActive: true }
    const [products, services, courses, events, communities, magnets, documents, storage, members, invitations] = await Promise.all([
        tx.digitalProduct.count({ where: published }), tx.serviceOffering.count({ where: published }),
        tx.course.count({ where: { ...published, isPublished: true } }), tx.event.count({ where: published }),
        tx.community.count({ where: published }), tx.leadMagnet.count({ where: published }),
        tx.profileDocument.findMany({ where: { profileId: { in: ids } }, select: { rawText: true } }),
        tx.billingStorageObject.aggregate({ where: { accountId }, _sum: { bytes: true } }),
        tx.billingAccountMember.findMany({ where: { accountId, status: "ACTIVE" }, select: { userId: true } }),
        tx.billingInvitation.findMany({ where: { accountId, status: "PENDING", expiresAt: { gt: new Date() } }, select: { emailKey: true } }),
    ])
    const emails = new Set((await tx.user.findMany({ where: { id: { in: members.map(m => m.userId) } }, select: { email: true } })).map(u => u.email.trim().toLowerCase()))
    const invited = new Set(invitations.map(i => i.emailKey).filter(email => !emails.has(email)))
    return { businesses: ids.length, seats: new Set(members.map(m => m.userId)).size + invited.size, offerings: products + services + courses + events + communities + magnets, knowledgeSources: documents.length, knowledgeCharacters: documents.reduce((n, d) => n + (d.rawText?.length || 0), 0), storageBytes: Number(storage._sum.bytes || 0) }
}

export async function assertAccountLimit(tx: BillingTx, accountId: string, kind: LimitKind, delta: number) {
    if (!Number.isSafeInteger(delta)) throw new Error("Invalid usage amount.")
    if (delta <= 0) return
    await lockBillingAccount(tx, accountId)
    const context = await accountContext(tx, accountId)
    if (["SUSPENDED", "DISPUTED"].includes(context.subscriptionStatus)) throw new Error("This billing account is on hold.")
    const usage = await accountUsage(tx, accountId)
    if (usage[kind] + delta > context.plan.limits[kind]) throw new Error(`Your ${context.plan.name} plan allows ${context.plan.limits[kind].toLocaleString()} ${kind.replace(/([A-Z])/g, " $1").toLowerCase()}. Manage your usage or upgrade in Billing.`)
}

export async function withAccountLimit<T>(accountId: string, kind: LimitKind, delta: number | ((tx: BillingTx) => Promise<number>), work: (tx: BillingTx) => Promise<T>) {
    return billingTransaction(async tx => { await lockBillingAccount(tx, accountId); await assertAccountLimit(tx, accountId, kind, typeof delta === "number" ? delta : await delta(tx)); return work(tx) })
}
export async function withBillingLimit<T>(profileId: string, kind: LimitKind, delta: number | ((tx: BillingTx) => Promise<number>), work: (tx: BillingTx) => Promise<T>) {
    return withAccountLimit((await getProfileBilling(profileId)).accountId, kind, delta, work)
}
export async function assertBillingFeature(profileId: string, feature: keyof Plan["features"]) {
    const context = await getProfileBilling(profileId)
    if (!context.features[feature]) throw new Error("This feature needs a higher plan. Compare plans in Billing.")
    return context
}

export async function issueGrant(tx: BillingTx, input: { accountId: string; unit: UsageUnit; kind: string; sourceKey: string; quantity: number; startsAt?: Date; expiresAt?: Date | null }) {
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error("Invalid credit grant.")
    const existing = await tx.billingCreditGrant.findUnique({ where: { sourceKey: input.sourceKey } })
    if (existing) return existing
    // Use the same millisecond clock as reservation eligibility; PostgreSQL's
    // rounded CURRENT_TIMESTAMP can otherwise put a just-issued trial in the future.
    const grant = await tx.billingCreditGrant.create({ data: { ...input, startsAt: input.startsAt || new Date(), remaining: input.quantity } })
    await tx.billingLedgerEntry.create({ data: { accountId: input.accountId, unit: input.unit, kind: "GRANT", amount: input.quantity, grantId: grant.id, operationKey: `grant:${input.sourceKey}` } })
    return grant
}

export async function ensureMonthlyGrants(tx: BillingTx, accountId: string, now = new Date()) {
    const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: accountId }, include: { subscription: true } })
    if (account.status !== "ACTIVE") throw new Error("This billing account is on hold.")
    const context = await accountContext(tx, accountId, now)
    const anchor = context.planId === "free" ? account.createdAt : account.subscription?.allowanceAnchor || account.subscription?.periodStart || account.createdAt
    const window = allowanceWindow(anchor, now, context.paidThrough)
    if (window.start > now || window.end <= now) return context
    // One base grant per account/unit/window; paid upgrades add only the positive difference.
    for (const [unit, quantity] of [["AI", context.plan.aiCredits], ["PHOTOREAL", context.plan.photorealGenerations]] as const) {
        if (!quantity) continue
        const sourceKey = `monthly:${accountId}:${unit}:${window.start.toISOString()}`
        const existing = await tx.billingCreditGrant.findUnique({ where: { sourceKey } })
        if (!existing) await issueGrant(tx, { accountId, unit, quantity, kind: "MONTHLY", sourceKey, startsAt: window.start, expiresAt: window.end })
        else if (quantity > existing.quantity) {
            const difference = quantity - existing.quantity
            await tx.billingCreditGrant.update({ where: { id: existing.id }, data: { quantity, remaining: { increment: difference }, expiresAt: window.end } })
            await tx.billingLedgerEntry.create({ data: { accountId, unit, kind: "UPGRADE", amount: difference, grantId: existing.id, operationKey: `${sourceKey}:upgrade:${quantity}` } })
        }
    }
    return context
}

async function claimTrial(tx: BillingTx, accountId: string) {
    const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: accountId } })
    const owner = await tx.user.findUniqueOrThrow({ where: { id: account.ownerUserId }, select: { id: true, emailVerifiedAt: true } })
    if (!owner.emailVerifiedAt) throw new Error("Verify your email before using the free generation.")
    if (await tx.billingTrialClaim.findUnique({ where: { userId: owner.id } })) return
    // A global daily cap bounds free provider spend without resetting an individual's entitlement.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(721093, 1)`
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    const limit = Number(process.env.INTROIFY_FREE_TRIAL_DAILY_LIMIT || 25)
    if (!Number.isSafeInteger(limit) || limit <= 0 || await tx.billingTrialClaim.count({ where: { status: "CLAIMED", createdAt: { gte: today } } }) >= limit) throw new Error("Today's trial generation capacity is full. Your trial is still available; please try again tomorrow.")
    const grant = await issueGrant(tx, { accountId, unit: "PHOTOREAL", kind: "FREE_TRIAL", quantity: 1, sourceKey: `trial:${owner.id}` })
    await tx.billingTrialClaim.create({ data: { userId: owner.id, accountId, grantId: grant.id } })
}

export async function reserveUsageInTransaction(tx: BillingTx, input: { accountId: string; profileId: string | null; unit: UsageUnit; amount: number; operationKey: string; actorId?: string; metadata?: Record<string, unknown> }) {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.operationKey.length < 8 || input.operationKey.length > 180) throw new Error("Invalid usage request.")
    await lockBillingAccount(tx, input.accountId)
    const existing = await tx.billingReservation.findUnique({ where: { accountId_unit_operationKey: { accountId: input.accountId, unit: input.unit, operationKey: input.operationKey } } })
    if (existing) {
        if (existing.amount !== input.amount || existing.profileId !== input.profileId) throw new Error("This request key is already in use.")
        return { id: existing.id, state: existing.state as "RESERVED" | "CONSUMED" | "RELEASED", created: false }
    }
    const context = await ensureMonthlyGrants(tx, input.accountId)
    if (input.metadata?.operation === "PROFILE_IMPORT") {
        if (input.unit !== "AI" || input.amount !== PROFILE_IMPORT_POLICY.credits || input.metadata?.mode !== undefined) throw new Error("Invalid profile import usage request.")
    } else if (input.unit === "AI" && input.metadata?.mode !== undefined) {
        const mode = input.metadata.mode as AiMode
        if (!Object.hasOwn(AI_MODES, mode) || !context.plan.aiModes.includes(mode) || input.amount !== AI_MODES[mode].credits) throw new Error("This AI mode is not included in the current plan.")
    }
    if (context.planId === "free" && input.unit === "PHOTOREAL") await claimTrial(tx, input.accountId)
    const now = new Date()
    const grants = await tx.billingCreditGrant.findMany({ where: { accountId: input.accountId, unit: input.unit, revokedAt: null, remaining: { gt: 0 }, startsAt: { lte: now }, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, ...(context.planId === "free" ? [{ kind: { not: "PURCHASED" } }] : [])] }, orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] })
    if (grants.reduce((n, g) => n + g.remaining, 0) < input.amount) throw new Error(`Not enough ${input.unit === "AI" ? "AI credits" : "photoreal generations"}. Manage your plan or add a pack in Billing.`)
    let needed = input.amount
    const allocations: Allocation[] = []
    for (const grant of grants) {
        if (!needed) break
        const amount = Math.min(needed, grant.remaining)
        await tx.billingCreditGrant.update({ where: { id: grant.id }, data: { remaining: { decrement: amount } } })
        allocations.push({ grantId: grant.id, amount }); needed -= amount
    }
    const reservation = await tx.billingReservation.create({ data: { accountId: input.accountId, profileId: input.profileId, actorId: input.actorId, unit: input.unit, amount: input.amount, operationKey: input.operationKey, allocations: json(allocations), metadata: input.metadata ? json(input.metadata) : undefined } })
    await tx.billingLedgerEntry.create({ data: { accountId: input.accountId, unit: input.unit, kind: "RESERVE", amount: -input.amount, reservationId: reservation.id, operationKey: `reserve:${reservation.id}` } })
    return { id: reservation.id, state: "RESERVED" as const, created: true }
}

export async function reserveUsage(input: { profileId: string; unit: UsageUnit; amount: number; operationKey: string; actorId?: string; metadata?: Record<string, unknown> }) {
    const context = await getProfileBilling(input.profileId)
    return billingTransaction(tx => reserveUsageInTransaction(tx, { ...input, accountId: context.accountId }))
}

export async function settleUsageInTransaction(tx: BillingTx, id: string, outcome: "CONSUME" | "RELEASE", metadata?: Record<string, unknown>) {
    const initial = await tx.billingReservation.findUniqueOrThrow({ where: { id } })
    await lockBillingAccount(tx, initial.accountId)
    const row = await tx.billingReservation.findUniqueOrThrow({ where: { id } })
    if (row.state !== "RESERVED") return
    if (outcome === "RELEASE") {
        for (const allocation of row.allocations as unknown as Allocation[]) {
            const grant = await tx.billingCreditGrant.findUniqueOrThrow({ where: { id: allocation.grantId } })
            if (grant.revokedAt) continue
            if (!grant.expiresAt || grant.expiresAt > new Date()) await tx.billingCreditGrant.update({ where: { id: grant.id }, data: { remaining: { increment: allocation.amount } } })
            else await issueGrant(tx, { accountId: row.accountId, unit: row.unit as UsageUnit, kind: "FAILURE_REPLACEMENT", quantity: allocation.amount, sourceKey: `release:${row.id}:${grant.id}`, expiresAt: new Date(Date.now() + 7 * 86400_000) })
        }
    }
    await tx.billingReservation.update({ where: { id }, data: { state: outcome === "CONSUME" ? "CONSUMED" : "RELEASED", metadata: metadata ? json({ ...(row.metadata as object || {}), ...metadata }) : undefined } })
    await tx.billingLedgerEntry.create({ data: { accountId: row.accountId, unit: row.unit, kind: outcome, amount: outcome === "RELEASE" ? row.amount : 0, reservationId: id, operationKey: `settle:${id}`, metadata: metadata ? json(metadata) : undefined } })
}
export async function settleUsage(id: string, outcome: "CONSUME" | "RELEASE", metadata?: Record<string, unknown>) { await billingTransaction(tx => settleUsageInTransaction(tx, id, outcome, metadata)) }

export async function getAccountBalances(accountId: string) {
    return billingTransaction(async tx => {
        await lockBillingAccount(tx, accountId)
        const accountState = await tx.billingAccount.findUniqueOrThrow({ where: { id: accountId }, select: { status: true } })
        const context = accountState.status === "ACTIVE" ? await ensureMonthlyGrants(tx, accountId) : await accountContext(tx, accountId)
        const now = new Date()
        const grants = await tx.billingCreditGrant.findMany({ where: { accountId, revokedAt: null, startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } })
        const reservations = await tx.billingReservation.groupBy({ by: ["unit"], where: { accountId, state: "RESERVED" }, _sum: { amount: true } })
        const sum = (unit: UsageUnit, kinds: string[]) => grants.filter(g => g.unit === unit && kinds.includes(g.kind)).reduce((n, g) => n + g.remaining, 0)
        let trial = sum("PHOTOREAL", ["FREE_TRIAL"])
        if (context.planId === "free" && !trial) {
            const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: accountId } })
            const claimed = await tx.billingTrialClaim.findUnique({ where: { userId: account.ownerUserId } })
            if (!claimed) trial = 1
        }
        return { ai: { monthly: sum("AI", ["MONTHLY", "FAILURE_REPLACEMENT"]), purchased: sum("AI", ["PURCHASED"]), reserved: reservations.find(r => r.unit === "AI")?._sum.amount || 0 }, photoreal: { monthly: sum("PHOTOREAL", ["MONTHLY", "FAILURE_REPLACEMENT"]), purchased: sum("PHOTOREAL", ["PURCHASED"]), reserved: reservations.find(r => r.unit === "PHOTOREAL")?._sum.amount || 0, trial } }
    })
}
