import { prisma } from "../../src/lib/prisma"
import { dishGroups } from "../../src/lib/dish-options"
import { createRestaurantOrderRecord } from "../../src/lib/restaurant-order-service"
import { businessDateKey } from "../../src/lib/restaurant-orders"

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error("DATABASE_URL is required")
    const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""))
    if (!/^personalink_phase0_(rehearsal|clean)_/.test(databaseName)) {
        throw new Error(`Refusing to run transactional smoke test against non-Phase-0 database: ${databaseName}`)
    }

    const profile = await prisma.profile.findFirst({
        where: {
            roleTemplate: "RESTAURANT",
            isPublic: true,
            digitalProducts: {
                some: {
                    isActive: true,
                    OR: [{ stock: null }, { stock: { gt: 0 } }],
                },
            },
        },
        include: {
            digitalProducts: {
                where: {
                    isActive: true,
                    OR: [{ stock: null }, { stock: { gt: 0 } }],
                },
                orderBy: { id: "asc" },
                take: 1,
            },
        },
        orderBy: { id: "asc" },
    })
    assert(profile, "No public restaurant with an available product was found")
    const product = profile.digitalProducts[0]
    assert(product, "No available restaurant product was found")

    const groups = dishGroups(product.category, product.title)
    const modifiers = groups
        .map((group) => ({
            groupId: group.id,
            optionIds: group.required && group.options[0] ? [group.options[0].id] : [],
        }))
        .filter((selection) => selection.optionIds.length > 0)

    const stamp = Date.now().toString(36)
    const tableCode = `phase0_table_${stamp}`
    const idempotencyKey = `phase0_order_${stamp}`
    const tableLabel = `Phase 0 smoke ${stamp}`
    const dateKey = businessDateKey(profile.timezone)
    const businessDate = new Date(`${dateKey}T00:00:00.000Z`)
    const previousCounter = await prisma.orderCounter.findUnique({
        where: { profileId_businessDate: { profileId: profile.id, businessDate } },
    })

    let tableId: string | null = null
    try {
        const table = await prisma.restaurantTable.create({
            data: {
                profileId: profile.id,
                label: tableLabel,
                code: tableCode,
            },
        })
        tableId = table.id

        const input = {
            profileSlug: profile.slug,
            idempotencyKey,
            lines: [{ productId: product.id, qty: 2, modifiers }],
            guestName: "Phase Zero Test",
            guestEmail: "phase-zero@example.test",
            payMethod: "COD" as const,
            channel: "DINE_IN" as const,
            tableCode,
        }
        const first = await createRestaurantOrderRecord(input)
        const replay = await createRestaurantOrderRecord(input)
        assert(!first.replayed, "First order creation was incorrectly reported as a replay")
        assert(replay.replayed, "Repeated order creation did not report an idempotent replay")
        assert(first.id === replay.id, "Idempotent replay returned a different order")
        assert(first.number === replay.number, "Idempotent replay returned a different order number")
        assert(first.tableLabel === tableLabel, "Opaque table code did not resolve to the expected label")

        const stored = await prisma.order.findUnique({
            where: { id: first.id },
            include: { lines: true, events: true },
        })
        assert(stored, "Created order was not found")
        assert(stored.lines.length === 1, "Expected exactly one order line")
        assert(stored.events.length === 1 && stored.events[0].kind === "CREATED", "Expected exactly one initial CREATED event")
        assert(stored.lines[0].qty === 2, "Order-line quantity was not stored as an integer")
        assert(stored.totalCents === stored.lines.reduce((sum, line) => sum + line.lineTotalCents, 0), "Order total does not equal the line-total sum")
        assert(stored.subtotalCents === stored.totalCents, "Unexpected tax or client-supplied total affected the order")
        assert(stored.tableId === table.id && stored.tableLabel === tableLabel, "Table relation or label snapshot is incorrect")

        const scannedTable = await prisma.restaurantTable.findUnique({ where: { id: table.id } })
        assert(scannedTable?.scans === 1, "Idempotent replay incremented the table scan count")

        console.log(JSON.stringify({
            database: databaseName,
            orderNumber: first.number,
            lines: stored.lines.length,
            events: stored.events.length,
            totalCents: stored.totalCents,
            replayedOrderIdMatched: first.id === replay.id,
            tableScans: scannedTable.scans,
        }, null, 2))
    } finally {
        await prisma.order.deleteMany({ where: { profileId: profile.id, idempotencyKey } })
        if (tableId) await prisma.restaurantTable.deleteMany({ where: { id: tableId } })
        if (previousCounter) {
            await prisma.orderCounter.update({
                where: { profileId_businessDate: { profileId: profile.id, businessDate } },
                data: { value: previousCounter.value },
            })
        } else {
            await prisma.orderCounter.deleteMany({ where: { profileId: profile.id, businessDate } })
        }
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
