// @vitest-environment node
import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { accountUsage, billingTransaction, ensureDefaultBillingAccount, ensureMonthlyGrants, getAccountBalances, issueGrant, lockBillingAccount, reserveUsage, settleUsage, withAccountLimit } from "@/lib/billing/service"
import { withKnowledgeLimit, withOfferingLimit } from "@/lib/billing/resource-limits"

// Never run against the normal application connection. Explicit opt-in and an
// isolated loopback database name are both required; the runner sets DATABASE_URL.
const target = process.env.INTROIFY_BILLING_TEST_DATABASE_URL
const isolated = target && target === process.env.DATABASE_URL && /^postgresql:\/\/introify_test@127\.0\.0\.1:\d+\/introify_billing_integration(?:_migrated)?\?schema=public$/.test(target)
const suite = isolated ? describe : describe.skip
const unique = () => randomUUID().replaceAll("-", "")

async function accountFixture(withProfile = true) {
    const key = unique()
    const user = await prisma.user.create({ data: { clerkId: `test-${key}`, email: `${key}@example.test`, emailVerifiedAt: new Date() } })
    const account = await ensureDefaultBillingAccount(user.id)
    const profile = withProfile ? await prisma.profile.create({ data: { userId: user.id, billingAccountId: account.id, slug: key, displayName: "Test business" } }) : null
    return { user, account, profile }
}

suite("billing isolation and concurrency on disposable PostgreSQL", () => {
    afterAll(async () => { await prisma.$disconnect() })

    it("serializes simultaneous Free business creation at one business", async () => {
        const { account, user } = await accountFixture(false)
        const results = await Promise.allSettled([1, 2].map(() => withAccountLimit(account.id, "businesses", 1, tx => tx.profile.create({ data: { userId: user.id, billingAccountId: account.id, slug: unique(), displayName: "Business" } }))))
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
        expect((await accountUsage(prisma, account.id)).businesses).toBe(1)
    })

    it("permits only one of two simultaneous publications into the final pooled slot", async () => {
        const { account, user, profile } = await accountFixture()
        const other = await prisma.profile.create({ data: { userId: user.id, billingAccountId: account.id, slug: unique(), displayName: "Existing business" } })
        await prisma.digitalProduct.createMany({ data: Array.from({ length: 9 }, (_, index) => ({ profileId: profile!.id, title: `Existing ${index}`, type: "PHYSICAL", priceCents: 0, isActive: true })) })
        const results = await Promise.allSettled([profile!.id, other.id].map(profileId => withOfferingLimit(profileId, "product", null, true, tx => tx.digitalProduct.create({ data: { profileId, title: "Final slot", type: "PHYSICAL", priceCents: 0, isActive: true } }))))
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
        expect((await accountUsage(prisma, account.id)).offerings).toBe(10)
    })

    it("does not spend a slot editing a published item or saving a draft at the limit", async () => {
        const { account, profile } = await accountFixture()
        const rows = await Promise.all(Array.from({ length: 10 }, (_, index) => prisma.digitalProduct.create({ data: { profileId: profile!.id, title: `Product ${index}`, type: "PHYSICAL", priceCents: 0, isActive: true } })))
        await withOfferingLimit(profile!.id, "product", rows[0].id, true, tx => tx.digitalProduct.update({ where: { id: rows[0].id }, data: { title: "Edited" } }))
        const draft = await withOfferingLimit(profile!.id, "product", null, false, tx => tx.digitalProduct.create({ data: { profileId: profile!.id, title: "Draft", type: "PHYSICAL", priceCents: 0, isActive: false } }))
        await expect(withOfferingLimit(profile!.id, "product", draft.id, true, tx => tx.digitalProduct.update({ where: { id: draft.id }, data: { isActive: true } }))).rejects.toThrow("allows 10")
        expect((await accountUsage(prisma, account.id)).offerings).toBe(10)
    })

    it("rolls back knowledge text growth past the shared character budget", async () => {
        const { profile } = await accountFixture()
        const doc = await withKnowledgeLimit(profile!.id, null, "a".repeat(49_999), tx => tx.profileDocument.create({ data: { profileId: profile!.id, type: "TEXT", sourceType: "TEXT", title: "Knowledge", rawText: "a".repeat(49_999) } }))
        await expect(withKnowledgeLimit(profile!.id, doc.id, "b".repeat(50_001), tx => tx.profileDocument.update({ where: { id: doc.id }, data: { rawText: "b".repeat(50_001) } }))).rejects.toThrow("allows 50,000")
        expect((await prisma.profileDocument.findUniqueOrThrow({ where: { id: doc.id } })).rawText).toHaveLength(49_999)
        await withKnowledgeLimit(profile!.id, doc.id, "short", tx => tx.profileDocument.update({ where: { id: doc.id }, data: { rawText: "short" } }))
    })

    it("deduplicates one person across account seats and multiple invitations", async () => {
        const { account, user } = await accountFixture()
        await prisma.billingInvitation.createMany({ data: [user.email, "pending@example.test", "pending@example.test"].map(email => ({ accountId: account.id, email, emailKey: email, tokenHash: unique(), workspaceIds: [], invitedBy: user.id, expiresAt: new Date(Date.now() + 60000) })) })
        expect((await accountUsage(prisma, account.id)).seats).toBe(2)
    })

    it("reserves the last credit exactly once across concurrent requests and releases once", async () => {
        const { account, profile } = await accountFixture()
        // A negative test balance cannot borrow the monthly allowance: reserve its
        // full 50-credit grant first, leaving only the explicit final unit.
        await reserveUsage({ profileId: profile!.id, unit: "AI", amount: 50, operationKey: `drain-${unique()}` })
        await billingTransaction(tx => issueGrant(tx, { accountId: account.id, unit: "AI", kind: "MONTHLY", sourceKey: `test:${unique()}`, quantity: 1 }))
        const results = await Promise.allSettled([1, 2].map(() => reserveUsage({ profileId: profile!.id, unit: "AI", amount: 1, operationKey: `race-${unique()}` })))
        const successes = results.filter(result => result.status === "fulfilled")
        expect(successes, results.filter(result => result.status === "rejected").map(result => result.status === "rejected" ? String(result.reason?.message || result.reason).slice(-350) : "").join("; ")).toHaveLength(1)
        const reservation = successes[0].status === "fulfilled" ? successes[0].value : null
        await Promise.all([settleUsage(reservation!.id, "RELEASE"), settleUsage(reservation!.id, "RELEASE")])
        const grants = await prisma.billingCreditGrant.aggregate({ where: { accountId: account.id }, _sum: { remaining: true } })
        expect(grants._sum.remaining).toBe(1)
        expect(await prisma.billingLedgerEntry.count({ where: { reservationId: reservation!.id, kind: "RELEASE" } })).toBe(1)
    })

    it("the same request key returns one reservation rather than spending twice", async () => {
        const { profile } = await accountFixture()
        const request = { profileId: profile!.id, unit: "AI" as const, amount: 1, operationKey: `replay-${unique()}` }
        const results = await Promise.all([reserveUsage(request), reserveUsage(request)])
        expect(new Set(results.map(result => result.id)).size).toBe(1)
        expect(results.filter(result => result.created)).toHaveLength(1)
    })

    it("one owner gets one Free trial across simultaneous requests in two accounts", async () => {
        const { user, profile } = await accountFixture()
        const second = await prisma.billingAccount.create({ data: { ownerUserId: user.id, name: "Second account", members: { create: { userId: user.id, role: "OWNER" } } } })
        const otherProfile = await prisma.profile.create({ data: { userId: user.id, billingAccountId: second.id, slug: unique(), displayName: "Second business" } })
        const results = await Promise.allSettled([profile!.id, otherProfile.id].map(async profileId => ({ ...await reserveUsage({ profileId, unit: "PHOTOREAL", amount: 1, operationKey: `trial-${unique()}` }), profileId })))
        const successes = results.filter(result => result.status === "fulfilled")
        expect(successes, results.filter(result => result.status === "rejected").map(result => result.status === "rejected" ? String(result.reason?.message || result.reason).slice(-350) : "").join("; ")).toHaveLength(1)
        expect(await prisma.billingTrialClaim.count({ where: { userId: user.id } })).toBe(1)
        const first = successes[0].status === "fulfilled" ? successes[0].value : null
        await settleUsage(first!.id, "RELEASE")
        const retry = await reserveUsage({ profileId: first!.profileId, unit: "PHOTOREAL", amount: 1, operationKey: `retry-${unique()}` })
        await settleUsage(retry.id, "CONSUME")
        await expect(reserveUsage({ profileId: first!.profileId, unit: "PHOTOREAL", amount: 1, operationKey: `again-${unique()}` })).rejects.toThrow("Not enough")
        expect(await prisma.billingTrialClaim.count({ where: { userId: user.id } })).toBe(1)
    })

    it("can immediately reserve a new Free trial when the application clock is behind PostgreSQL", async () => {
        const { account, profile, user } = await accountFixture()
        const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        // Freeze only Date, leaving Prisma/network timers real. A DB-default
        // startsAt would be in the future relative to this eligibility check.
        vi.useFakeTimers({ toFake: ["Date"] })
        vi.setSystemTime(new Date(now.getTime() - 1_000))
        try {
            const reservation = await reserveUsage({ profileId: profile!.id, unit: "PHOTOREAL", amount: 1, operationKey: `clock-skew-${unique()}` })
            expect(reservation.created).toBe(true)
            expect(reservation.state).toBe("RESERVED")
            expect(await prisma.billingTrialClaim.count({ where: { userId: user.id } })).toBe(1)
            expect(await prisma.billingReservation.count({ where: { accountId: account.id, unit: "PHOTOREAL", state: "RESERVED" } })).toBe(1)
        } finally { vi.useRealTimers() }
    })

    it("annual billing grants each clamped monthly anniversary once rather than a year upfront", async () => {
        const { account } = await accountFixture()
        const anchor = new Date("2026-01-31T09:00:00Z")
        await prisma.platformSubscription.create({ data: { accountId: account.id, planId: "pro", cadence: "yearly", status: "ACTIVE", paidThrough: new Date("2027-01-31T09:00:00Z"), allowanceAnchor: anchor, periodStart: anchor } })
        const grantAt = (now: string) => billingTransaction(async tx => { await lockBillingAccount(tx, account.id); return ensureMonthlyGrants(tx, account.id, new Date(now)) })
        await grantAt("2026-01-31T09:00:00Z")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: account.id, unit: "PHOTOREAL" } })).toBe(1)
        await grantAt("2026-02-28T09:00:00Z")
        await grantAt("2026-03-30T09:00:00Z")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: account.id, unit: "PHOTOREAL" } })).toBe(2)
        await grantAt("2026-03-31T09:00:00Z")
        const generations = await prisma.billingCreditGrant.aggregate({ where: { accountId: account.id, unit: "PHOTOREAL" }, _sum: { quantity: true } })
        expect(generations._sum.quantity).toBe(30)
    })

    it("preserves purchased credits while pausing their use on Free", async () => {
        const { account, profile } = await accountFixture()
        await reserveUsage({ profileId: profile!.id, unit: "AI", amount: 50, operationKey: `drain-${unique()}` })
        const grant = await billingTransaction(tx => issueGrant(tx, { accountId: account.id, unit: "AI", kind: "PURCHASED", quantity: 12, sourceKey: `pack:${unique()}` }))
        await expect(reserveUsage({ profileId: profile!.id, unit: "AI", amount: 1, operationKey: `free-${unique()}` })).rejects.toThrow("Not enough")
        expect((await prisma.billingCreditGrant.findUniqueOrThrow({ where: { id: grant.id } })).remaining).toBe(12)
        await prisma.platformSubscription.create({ data: { accountId: account.id, planId: "starter", status: "ACTIVE", paidThrough: new Date(Date.now() + 30 * 86400000), allowanceAnchor: account.createdAt } })
        await reserveUsage({ profileId: profile!.id, unit: "AI", amount: 451, operationKey: `paid-${unique()}` })
        expect((await prisma.billingCreditGrant.findUniqueOrThrow({ where: { id: grant.id } })).remaining).toBe(11)
    })

    it("replaces an expired reserved unit once when technical failure releases it", async () => {
        const { account, profile } = await accountFixture()
        const reservation = await reserveUsage({ profileId: profile!.id, unit: "AI", amount: 1, operationKey: `expire-${unique()}` })
        await prisma.billingCreditGrant.updateMany({ where: { accountId: account.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
        await Promise.all([settleUsage(reservation.id, "RELEASE"), settleUsage(reservation.id, "RELEASE")])
        const replacements = await prisma.billingCreditGrant.findMany({ where: { accountId: account.id, kind: "FAILURE_REPLACEMENT" } })
        expect(replacements).toHaveLength(1)
        expect(replacements[0].remaining).toBe(1)
        expect(replacements[0].expiresAt!.getTime()).toBeGreaterThan(Date.now())
    })

    it("allows a suspended account to read balances without minting credits or spending", async () => {
        const { account, profile } = await accountFixture()
        await prisma.billingAccount.update({ where: { id: account.id }, data: { status: "SUSPENDED" } })
        const balances = await getAccountBalances(account.id)
        expect(balances.ai.monthly).toBe(0)
        expect(await prisma.billingCreditGrant.count({ where: { accountId: account.id } })).toBe(0)
        await expect(reserveUsage({ profileId: profile!.id, unit: "AI", amount: 1, operationKey: `held-${unique()}` })).rejects.toThrow("on hold")
    })

    it("migration preserves existing businesses and their independently logged-in staff", async () => {
        if (!target?.includes("_migrated")) return
        const profile = await prisma.profile.findUniqueOrThrow({ where: { id: "legacy-profile" } })
        const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: "legacy-workspace" } })
        expect(profile.billingAccountId).toBeTruthy()
        expect(workspace.billingAccountId).toBe(profile.billingAccountId)
        const members = await prisma.billingAccountMember.findMany({ where: { accountId: profile.billingAccountId! } })
        expect(members.map(member => [member.userId, member.role, member.status]).sort()).toEqual([["legacy-owner", "OWNER", "ACTIVE"], ["legacy-staff", "MEMBER", "ACTIVE"]])
        expect((await prisma.membership.findUniqueOrThrow({ where: { id: "legacy-staff-member" } })).role).toBe("STAFF")
        expect((await accountUsage(prisma, profile.billingAccountId!)).seats).toBe(2)
    })
})
