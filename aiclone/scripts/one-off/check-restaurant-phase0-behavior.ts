import { randomUUID } from "node:crypto"
import { OrderEventKind } from "@prisma/client"
import { dishGroups } from "../../src/lib/dish-options"
import { createRestaurantOrderRecord } from "../../src/lib/restaurant-order-service"
import {
    assertOrderLineTransition,
    assertOrderTransition,
    businessDateKey,
    type ModifierSelectionInput,
} from "../../src/lib/restaurant-orders"
import { prisma } from "../../src/lib/prisma"

const CONCURRENT_ORDER_COUNT = 6
const SCRATCH_DATABASE_PATTERN = /^personalink_phase0_rehearsal_\d{8}_\d{6}$/u

type ProductCandidate = {
    id: string
    profileId: string
    title: string
    category: string | null
    priceCents: number
    currency: string
    stock: number | null
}

type CounterSnapshot = {
    profileId: string
    businessDate: Date
    value: number
    updatedAt: Date
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

function databaseName() {
    const raw = process.env.DATABASE_URL
    if (!raw) throw new Error("DATABASE_URL is required.")
    const parsed = new URL(raw)
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        throw new Error("This check only supports PostgreSQL.")
    }
    const name = decodeURIComponent(parsed.pathname.replace(/^\//u, "").split("/")[0] ?? "")
    if (!SCRATCH_DATABASE_PATTERN.test(name)) {
        throw new Error(`Refusing to run against non-rehearsal database: ${name || "<empty>"}.`)
    }
    return name
}

function requiredModifiers(product: ProductCandidate): ModifierSelectionInput[] {
    return dishGroups(product.category, product.title)
        .filter((group) => group.required)
        .map((group) => {
            const first = group.options[0]
            if (!first) throw new Error("A required modifier group has no options.")
            return { groupId: group.id, optionIds: [first.id] }
        })
}

function exactlyTwoModifiers(product: ProductCandidate): ModifierSelectionInput[] | null {
    const groups = dishGroups(product.category, product.title)
    const selected = new Map<string, string[]>()

    for (const group of groups) {
        if (!group.required) continue
        const first = group.options[0]
        if (!first) return null
        selected.set(group.id, [first.id])
    }

    let count = [...selected.values()].reduce((sum, optionIds) => sum + optionIds.length, 0)
    if (count > 2) return null
    for (const group of groups) {
        if (count === 2) break
        const current = selected.get(group.id) ?? []
        for (const option of group.options) {
            if (count === 2 || current.length >= group.max) break
            if (current.includes(option.id)) continue
            current.push(option.id)
            count += 1
        }
        if (current.length > 0) selected.set(group.id, current)
    }
    if (count !== 2) return null

    for (const group of groups) {
        const chosen = selected.get(group.id) ?? []
        if (group.required && chosen.length === 0) return null
        if (chosen.length > group.max) return null
    }
    return groups
        .filter((group) => (selected.get(group.id)?.length ?? 0) > 0)
        .map((group) => ({ groupId: group.id, optionIds: selected.get(group.id)! }))
}

function modifierTotal(product: ProductCandidate, selections: ModifierSelectionInput[]) {
    const groups = dishGroups(product.category, product.title)
    return selections.reduce((sum, selection) => {
        const group = groups.find((candidate) => candidate.id === selection.groupId)
        assert(group, "Selected modifier group is missing from the current catalog.")
        return sum + selection.optionIds.reduce((optionSum, optionId) => {
            const option = group.options.find((candidate) => candidate.id === optionId)
            assert(option, "Selected modifier option is missing from the current catalog.")
            return optionSum + option.priceCents
        }, 0)
    }, 0)
}

function expectThrow(callback: () => void, label: string) {
    let threw = false
    try {
        callback()
    } catch {
        threw = true
    }
    assert(threw, `${label} did not reject an illegal transition.`)
}

async function restoreCounters(profileId: string, snapshots: CounterSnapshot[]) {
    await prisma.$transaction(async (tx) => {
        const current = await tx.orderCounter.findMany({ where: { profileId } })
        const snapshotKeys = new Set(snapshots.map((row) => row.businessDate.toISOString()))
        for (const row of current) {
            if (!snapshotKeys.has(row.businessDate.toISOString())) {
                await tx.orderCounter.delete({
                    where: {
                        profileId_businessDate: {
                            profileId,
                            businessDate: row.businessDate,
                        },
                    },
                })
            }
        }
        for (const row of snapshots) {
            await tx.orderCounter.upsert({
                where: {
                    profileId_businessDate: {
                        profileId: row.profileId,
                        businessDate: row.businessDate,
                    },
                },
                create: row,
                update: { value: row.value, updatedAt: row.updatedAt },
            })
        }
    })
}

async function main() {
    const targetDatabase = databaseName()
    const profiles = await prisma.profile.findMany({
        where: { roleTemplate: "RESTAURANT", isPublic: true },
        select: { id: true, slug: true, timezone: true },
        orderBy: { id: "asc" },
    })

    let selectedProfile: (typeof profiles)[number] | null = null
    let selectedProducts: ProductCandidate[] = []
    let firstSelections: ModifierSelectionInput[] | null = null
    for (const profile of profiles) {
        const products = await prisma.digitalProduct.findMany({
            where: {
                profileId: profile.id,
                isActive: true,
                OR: [{ stock: null }, { stock: { gt: 0 } }],
            },
            select: {
                id: true,
                profileId: true,
                title: true,
                category: true,
                priceCents: true,
                currency: true,
                stock: true,
            },
            orderBy: { id: "asc" },
        })
        for (const product of products) {
            if (product.stock !== null && product.stock < 2) continue
            const two = exactlyTwoModifiers(product)
            if (!two) continue
            const sameCurrency = products.filter((candidate) =>
                candidate.id !== product.id &&
                candidate.currency === product.currency &&
                (candidate.stock === null || candidate.stock >= 1))
            if (sameCurrency.length < 2) continue
            selectedProfile = profile
            selectedProducts = [product, sameCurrency[0], sameCurrency[1]]
            firstSelections = two
            break
        }
        if (selectedProfile) break
    }

    assert(selectedProfile, "No public restaurant has three suitable products for the behavior check.")
    assert(firstSelections, "No restaurant product supports exactly two valid modifiers.")

    const foreignProduct = await prisma.digitalProduct.findFirst({
        where: {
            profileId: { not: selectedProfile.id },
            isActive: true,
            OR: [{ stock: null }, { stock: { gt: 0 } }],
        },
        select: { id: true },
        orderBy: { id: "asc" },
    })
    assert(foreignProduct, "No active foreign-profile product is available for mixed-profile rejection.")

    const testKeys = Array.from({ length: CONCURRENT_ORDER_COUNT + 2 }, () => randomUUID())
    const concurrencyKeys = testKeys.slice(0, CONCURRENT_ORDER_COUNT)
    const threeLineKey = testKeys[CONCURRENT_ORDER_COUNT]
    const mixedProfileKey = testKeys[CONCURRENT_ORDER_COUNT + 1]
    const tableCode = randomUUID().replaceAll("-", "")
    const counterSnapshots = await prisma.orderCounter.findMany({
        where: { profileId: selectedProfile.id },
        select: { profileId: true, businessDate: true, value: true, updatedAt: true },
    })
    let tableId: string | null = null
    let report: Record<string, unknown> | null = null

    try {
        expectThrow(() => assertOrderTransition("PLACED", "READY"), "Order transition")
        expectThrow(() => assertOrderLineTransition("QUEUED", "READY"), "Order-line transition")
        assertOrderTransition("PLACED", "ACCEPTED")
        assertOrderLineTransition("QUEUED", "PREPARING")

        const currentDateKey = businessDateKey(selectedProfile.timezone, new Date())
        const currentBusinessDate = new Date(`${currentDateKey}T00:00:00.000Z`)
        const [counterBefore, maxBefore] = await Promise.all([
            prisma.orderCounter.findUnique({
                where: {
                    profileId_businessDate: {
                        profileId: selectedProfile.id,
                        businessDate: currentBusinessDate,
                    },
                },
                select: { value: true },
            }),
            prisma.order.aggregate({
                where: { profileId: selectedProfile.id, businessDate: currentBusinessDate },
                _max: { number: true },
            }),
        ])
        const allocationBase = counterBefore?.value ?? 0
        assert(
            (maxBefore._max.number ?? 0) <= allocationBase,
            "Pre-existing daily counter is behind the maximum order number.",
        )

        const simpleProduct = selectedProducts[2]
        const simpleModifiers = requiredModifiers(simpleProduct)
        const concurrentSettled = await Promise.allSettled(concurrencyKeys.map((idempotencyKey, index) =>
            createRestaurantOrderRecord({
                profileSlug: selectedProfile!.slug,
                idempotencyKey,
                lines: [{ productId: simpleProduct.id, qty: 1, modifiers: simpleModifiers }],
                guestName: `Phase 0 concurrency ${index + 1}`,
                guestEmail: "phase0-validation@example.invalid",
                channel: "TAKEAWAY",
                payMethod: "COD",
            })))
        const concurrentFailures = concurrentSettled.filter((result) => result.status === "rejected")
        assert(
            concurrentFailures.length === 0,
            `${concurrentFailures.length} concurrent order request(s) failed after bounded retries.`,
        )
        const concurrentResults = concurrentSettled.map((result) => {
            assert(result.status === "fulfilled", "Concurrent result was unexpectedly rejected.")
            return result.value
        })
        const allocatedNumbers = concurrentResults.map((result) => result.number).sort((a, b) => a - b)
        const expectedNumbers = Array.from(
            { length: CONCURRENT_ORDER_COUNT },
            (_, index) => allocationBase + index + 1,
        )
        assert(
            allocatedNumbers.every((number, index) => number === expectedNumbers[index]),
            `Concurrent numbers were not contiguous: ${allocatedNumbers.join(", ")}.`,
        )
        assert(new Set(concurrentResults.map((result) => result.id)).size === CONCURRENT_ORDER_COUNT,
            "Concurrent requests did not create distinct orders.")
        assert(concurrentResults.every((result) => !result.replayed),
            "A fresh concurrent request was unexpectedly treated as a replay.")

        const table = await prisma.restaurantTable.create({
            data: {
                profileId: selectedProfile.id,
                label: "Phase 0 validation table",
                code: tableCode,
                seats: 4,
                isActive: true,
            },
            select: { id: true },
        })
        tableId = table.id

        const lineInputs = [
            { productId: selectedProducts[0].id, qty: 2, modifiers: firstSelections },
            { productId: selectedProducts[1].id, qty: 1, modifiers: requiredModifiers(selectedProducts[1]) },
            { productId: selectedProducts[2].id, qty: 1, modifiers: requiredModifiers(selectedProducts[2]) },
        ]
        const expectedLines = lineInputs.map((line, index) => {
            const product = selectedProducts[index]
            const modifierCents = modifierTotal(product, line.modifiers)
            return {
                productId: product.id,
                qty: line.qty,
                modifierCents,
                totalCents: (product.priceCents + modifierCents) * line.qty,
            }
        })
        const expectedTotal = expectedLines.reduce((sum, line) => sum + line.totalCents, 0)
        const threeLineResult = await createRestaurantOrderRecord({
            profileSlug: selectedProfile.slug,
            idempotencyKey: threeLineKey,
            lines: lineInputs,
            guestName: "Phase 0 totals validation",
            guestEmail: "phase0-validation@example.invalid",
            channel: "DINE_IN",
            tableCode,
            payMethod: "COD",
        })
        const replayResult = await createRestaurantOrderRecord({
            profileSlug: selectedProfile.slug,
            idempotencyKey: threeLineKey,
            lines: lineInputs,
            guestName: "Phase 0 totals validation",
            guestEmail: "phase0-validation@example.invalid",
            channel: "DINE_IN",
            tableCode,
            payMethod: "COD",
        })
        assert(replayResult.replayed && replayResult.id === threeLineResult.id,
            "Restaurant order idempotency replay did not return the original order.")

        const storedOrder = await prisma.order.findUnique({
            where: { id: threeLineResult.id },
            include: {
                lines: true,
                events: true,
                table: { select: { scans: true } },
            },
        })
        assert(storedOrder, "Three-line order was not stored.")
        assert(storedOrder.lines.length === 3, "Three-line order did not contain three lines.")
        assert(storedOrder.subtotalCents === expectedTotal && storedOrder.totalCents === expectedTotal,
            "Stored order total does not match authoritative product/modifier pricing.")
        assert(storedOrder.taxCents === 0, "Phase 0 order unexpectedly contains tax.")
        const firstStoredLine = storedOrder.lines.find((line) => line.productId === selectedProducts[0].id)
        assert(firstStoredLine, "Quantity-two line was not stored.")
        assert(firstStoredLine.qty === 2, "Quantity-two line lost its quantity.")
        assert(firstStoredLine.unitModifierCents === expectedLines[0].modifierCents,
            "Quantity-two line modifier total is incorrect.")
        assert(Array.isArray(firstStoredLine.modifiers) && firstStoredLine.modifiers.length === 2,
            "Quantity-two line does not contain two modifier snapshots.")
        assert(firstStoredLine.lineTotalCents === expectedLines[0].totalCents,
            "Quantity-two line arithmetic is incorrect.")
        assert(storedOrder.events.length === 1 && storedOrder.events[0].kind === OrderEventKind.CREATED,
            "Three-line order does not have exactly one CREATED event.")
        assert(storedOrder.table?.scans === 1,
            "Idempotent replay incremented the table scan count or the initial scan was not recorded.")

        let mixedProfileRejected = false
        try {
            await createRestaurantOrderRecord({
                profileSlug: selectedProfile.slug,
                idempotencyKey: mixedProfileKey,
                lines: [
                    { productId: selectedProducts[0].id, qty: 1, modifiers: firstSelections },
                    { productId: foreignProduct.id, qty: 1 },
                ],
                guestName: "Phase 0 mixed-profile validation",
                guestEmail: "phase0-validation@example.invalid",
                channel: "TAKEAWAY",
                payMethod: "COD",
            })
        } catch {
            mixedProfileRejected = true
        }
        assert(mixedProfileRejected, "Mixed-profile restaurant cart was accepted.")
        const mixedOrderCount = await prisma.order.count({
            where: { profileId: selectedProfile.id, idempotencyKey: mixedProfileKey },
        })
        assert(mixedOrderCount === 0, "Mixed-profile rejection left a partial order.")

        report = {
            database: targetDatabase,
            concurrentAllocation: {
                requests: CONCURRENT_ORDER_COUNT,
                numbers: allocatedNumbers,
                unique: new Set(allocatedNumbers).size === CONCURRENT_ORDER_COUNT,
                contiguous: true,
            },
            authoritativeThreeLineOrder: {
                lines: storedOrder.lines.length,
                quantitySum: storedOrder.lines.reduce((sum, line) => sum + line.qty, 0),
                quantityTwoLineModifiers: Array.isArray(firstStoredLine.modifiers)
                    ? firstStoredLine.modifiers.length
                    : 0,
                subtotalCents: storedOrder.subtotalCents,
                totalCents: storedOrder.totalCents,
                arithmeticValid: storedOrder.lines.every((line) =>
                    line.lineTotalCents === (line.unitPriceCents + line.unitModifierCents) * line.qty),
                replayReturnedSameOrder: true,
                tableScansAfterReplay: storedOrder.table?.scans ?? null,
            },
            rejectionChecks: {
                mixedProfile: true,
                illegalOrderTransition: true,
                illegalLineTransition: true,
                legalSingleStepTransitions: true,
            },
        }
    } finally {
        await prisma.order.deleteMany({
            where: {
                profileId: selectedProfile.id,
                idempotencyKey: { in: testKeys },
            },
        })
        if (tableId) await prisma.restaurantTable.deleteMany({ where: { id: tableId } })
        await restoreCounters(selectedProfile.id, counterSnapshots)
        await prisma.$disconnect()
    }

    console.log(JSON.stringify({ ...report, cleanup: { ordersRemoved: true, tableRemoved: true, countersRestored: true } }, null, 2))
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
