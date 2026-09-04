import { prisma } from "@/lib/prisma"
import { goldBoardFromConfig, writeGoldBoard } from "@/lib/metal/board"
import { K22_BPS, rupeesPerGramToPaisePer10g, ticketPaise } from "@/lib/metal/math"
import { writeProductMetal } from "@/lib/metal/product"
import { ensureParty, listOpenLots, recordPurchase, recordSale } from "@/lib/metal/ledger"

const SERVICE_SEED: Record<string, { name: string; description: string; durationMinutes: number }> = {
    CONSULTANT: { name: "Fit call", description: "A first conversation to see if we should work together.", durationMinutes: 30 },
    CA: { name: "Tax and books consultation", description: "A first review of the client requirement.", durationMinutes: 30 },
    COACH: { name: "Intro session", description: "A first coaching conversation.", durationMinutes: 30 },
    FIELD_SERVICE: { name: "Site visit", description: "An initial on-site assessment.", durationMinutes: 60 },
    SALON_SPA: { name: "Signature treatment", description: "A bookable treatment with a named team member.", durationMinutes: 60 },
    EVENTS_STUDIO: { name: "Event planning call", description: "Capture the brief, date, and delivery requirements.", durationMinutes: 45 },
    REAL_ESTATE_BROKERAGE: { name: "Property consultation", description: "Discuss a property requirement or mandate.", durationMinutes: 30 },
    RECRUITMENT_AGENCY: { name: "Hiring brief call", description: "Capture the role, timeline, and candidate requirements.", durationMinutes: 30 },
}

const DEFAULT_RATES = {
    k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
    k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
    k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
}

async function writeBoard(profileId: string, fallbackCity: string, fallbackSlug: string) {
    const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { personalityConfig: true } })
    const existing = goldBoardFromConfig(row?.personalityConfig)
    await prisma.profile.update({
        where: { id: profileId },
        data: {
            personalityConfig: writeGoldBoard(row?.personalityConfig, {
                city: existing?.city || fallbackCity,
                citySlug: existing?.citySlug || fallbackSlug,
                asOf: existing?.asOf || new Date().toISOString(),
                source: existing?.source || "city-feed",
                k24PaisePer10g: existing?.k24PaisePer10g || DEFAULT_RATES.k24PaisePer10g,
                k22PaisePer10g: existing?.k22PaisePer10g || DEFAULT_RATES.k22PaisePer10g,
                k18PaisePer10g: existing?.k18PaisePer10g || DEFAULT_RATES.k18PaisePer10g,
                lastCheckedAt: existing?.lastCheckedAt || new Date().toISOString(),
            }),
            timezone: "Asia/Kolkata",
        },
    })
}

/** Sample catalog for a kit. Not a server action — call only from trusted server code. */
export async function seedRole(profileId: string, role: string) {
    if (role === "RESTAURANT") {
        const existing = await prisma.serviceOffering.count({ where: { profileId } })
        if (existing === 0) {
            await prisma.serviceOffering.create({
                data: {
                    profileId,
                    name: "Reserve a table",
                    description: "Dine-in seating",
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: 90,
                    currency: "USD",
                    isActive: true,
                    kind: "TABLE",
                    covers: 20,
                },
            })
        }
        const hours = await prisma.availabilitySchedule.count({ where: { profileId } })
        if (hours === 0) {
            await prisma.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId,
                    dayOfWeek,
                    startTime: "12:00",
                    endTime: "22:00",
                    isEnabled: dayOfWeek !== 1,
                })),
            })
        }
    }

    if (role === "JEWELRY_RETAIL") {
        await writeBoard(profileId, "Mumbai", "mumbai")
        const existing = await prisma.digitalProduct.count({ where: { profileId } })
        if (existing === 0) {
            const rates = DEFAULT_RATES
            const bangle = { grossMg: 10000, purityBps: K22_BPS, makingPaise: 50_000 }
            const chain = { grossMg: 20000, purityBps: K22_BPS, makingPaise: 80_000 }
            await prisma.digitalProduct.createMany({
                data: [
                    {
                        profileId,
                        title: "Light bangle",
                        category: "Bangles",
                        type: "PHYSICAL",
                        fulfillment: "PHYSICAL",
                        currency: "INR",
                        priceCents: ticketPaise(bangle, rates),
                        weightGrams: 10,
                        stock: 4,
                        isActive: true,
                        variantsJson: writeProductMetal(null, bangle),
                    },
                    {
                        profileId,
                        title: "Rope chain",
                        category: "Chains",
                        type: "PHYSICAL",
                        fulfillment: "PHYSICAL",
                        currency: "INR",
                        priceCents: ticketPaise(chain, rates),
                        weightGrams: 20,
                        stock: 2,
                        isActive: true,
                        variantsJson: writeProductMetal(null, chain),
                    },
                ],
            })
        }
    }

    if (role === "JEWELRY_WHOLESALE") {
        await writeBoard(profileId, "Mumbai", "mumbai")
        const rates = DEFAULT_RATES
        const lots = await listOpenLots(profileId)
        if (lots.length === 0) {
            const gujarat = await ensureParty(profileId, { kind: "SUPPLIER", displayName: "Gujarat House", phone: "07912345678" })
            const sharma = await ensureParty(profileId, { kind: "RETAILER", displayName: "Sharma Jewellers", phone: "9876543210", termsDays: 15 })
            const cityGold = await ensureParty(profileId, { kind: "RETAILER", displayName: "City Gold", phone: "9876500000", termsDays: 7 })
            await recordPurchase(profileId, {
                partyId: gujarat.id,
                k24PaisePer10g: rates.k24PaisePer10g,
                lines: [{ title: "Light bangles", grossMg: 120000, touchBps: 7000, qty: 12 }],
                payNowPaise: 0,
                dueOn: new Date(Date.now() + 7 * 86400000),
            })
            const openLots = await listOpenLots(profileId)
            const openLot = openLots[0]
            await recordSale(profileId, {
                partyId: sharma.id,
                k24PaisePer10g: rates.k24PaisePer10g,
                lines: [{ title: "Light bangle", grossMg: 10000, touchBps: 7400, lotId: openLot?.id }],
                payNowPaise: 0,
                dueOn: new Date(Date.now() - 3 * 86400000),
            })
            await recordSale(profileId, {
                partyId: cityGold.id,
                k24PaisePer10g: rates.k24PaisePer10g,
                lines: [{ title: "Light bangle", grossMg: 10000, touchBps: 7400, lotId: openLot?.id }],
                payNowPaise: 20_000_000,
            })
            await prisma.digitalProduct.create({
                data: {
                    profileId,
                    title: "Light bangle",
                    category: "Bangles",
                    type: "PHYSICAL",
                    fulfillment: "PHYSICAL",
                    currency: "INR",
                    priceCents: 0,
                    weightGrams: 10,
                    stock: 10,
                    isActive: true,
                    variantsJson: writeProductMetal(null, { grossMg: 10000, purityBps: 7000, makingPaise: 0 }),
                },
            })
        }
    }

    if (role === "DISTRIBUTOR") {
        const existing = await prisma.digitalProduct.count({ where: { profileId } })
        if (existing === 0) {
            await prisma.digitalProduct.createMany({
                data: [
                    { profileId, title: "ACC Gold 50kg", category: "Cement", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 42000, stock: 180, sku: "CEM-ACC-50", isActive: true },
                    { profileId, title: "TMT 12mm bundle", category: "Steel", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 68500, stock: 40, sku: "STL-TMT-12", isActive: true },
                    { profileId, title: "Emulsion 20L", category: "Paint", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 310000, stock: 24, sku: "PNT-EML-20", isActive: true },
                ],
            })
            const items = await prisma.digitalProduct.findMany({ where: { profileId }, orderBy: { title: "asc" } })
            const acc = items.find((i) => i.sku === "CEM-ACC-50")
            const tmt = items.find((i) => i.sku === "STL-TMT-12")
            if (acc && tmt) {
                const { writeDistroMeta } = await import("@/lib/distribute/meta")
                const meta = {
                    salesman: "SUNNY",
                    location: "Ranchi",
                    dealer: "Sharma Traders",
                    approval: "PENDING" as const,
                    warehouse: "WAITING" as const,
                    accounts: "HOLD" as const,
                    invoice: "",
                }
                const total = 2 * acc.priceCents + 1 * tmt.priceCents
                await prisma.order.create({
                    data: {
                        profileId,
                        publicToken: `dseed${profileId.slice(-8)}`,
                        number: 1,
                        businessDate: new Date(),
                        channel: "TAKEAWAY",
                        status: "PLACED",
                        guestName: "Sharma Traders",
                        tableLabel: "Ranchi",
                        staffNote: writeDistroMeta(meta),
                        subtotalCents: total,
                        totalCents: total,
                        currency: "INR",
                        payStatus: "UNPAID",
                        lines: {
                            create: [
                                { productId: acc.id, titleSnapshot: acc.title, qty: 2, unitPriceCents: acc.priceCents, lineTotalCents: 2 * acc.priceCents },
                                { productId: tmt.id, titleSnapshot: tmt.title, qty: 1, unitPriceCents: tmt.priceCents, lineTotalCents: tmt.priceCents },
                            ],
                        },
                    },
                })
            }
        }
    }

    if (role === "PHARMACY") {
        const existing = await prisma.digitalProduct.count({ where: { profileId } })
        if (existing === 0) {
            const { writeMedicine } = await import("@/lib/pharmacy/batch")
            await prisma.digitalProduct.createMany({
                data: [
                    { profileId, title: "Paracetamol 650", category: "Fever", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 2800, stock: 40, sku: "PCM-650", isActive: true, variantsJson: writeMedicine(null, { batch: "PCM2408", expiry: "2027-08-01", mrpPaise: 3200 }) },
                    { profileId, title: "Amoxicillin 500", category: "Antibiotic", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 8500, stock: 18, sku: "AMX-500", isActive: true, variantsJson: writeMedicine(null, { batch: "AMX2311", expiry: "2026-10-15", mrpPaise: 9200, rxRequired: true }) },
                    { profileId, title: "Cough syrup 100ml", category: "Cold", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 12000, stock: 12, sku: "COU-100", isActive: true, variantsJson: writeMedicine(null, { batch: "COU2201", expiry: "2026-01-20", mrpPaise: 13500 }) },
                ],
            })
        }
    }

    if (role === "AUTO_PARTS") {
        const existing = await prisma.digitalProduct.count({ where: { profileId } })
        if (existing === 0) {
            const { writeFitment } = await import("@/lib/autoparts/fitment")
            await prisma.digitalProduct.createMany({
                data: [
                    { profileId, title: "Front brake pad", category: "Brakes", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 145000, stock: 8, sku: "BP-SWIFT", isActive: true, variantsJson: writeFitment(null, { make: "Maruti", model: "Swift", yearFrom: 2018, yearTo: 2024 }) },
                    { profileId, title: "Oil filter", category: "Filters", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 28000, stock: 20, sku: "OF-I20", isActive: true, variantsJson: writeFitment(null, { make: "Hyundai", model: "i20", yearFrom: 2015, yearTo: 2023 }) },
                    { profileId, title: "Battery 35Ah", category: "Electrical", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: 385000, stock: 4, sku: "BAT-ALTO", isActive: true, variantsJson: writeFitment(null, { make: "Maruti", model: "Alto", yearFrom: 2012, yearTo: 2020 }) },
                ],
            })
        }
    }

    const serviceSeed = SERVICE_SEED[role]
    if (serviceSeed) {
        const existing = await prisma.serviceOffering.count({ where: { profileId } })
        if (existing === 0) {
            await prisma.serviceOffering.create({
                data: {
                    profileId,
                    name: serviceSeed.name,
                    description: serviceSeed.description,
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: serviceSeed.durationMinutes,
                    currency: "USD",
                    isActive: true,
                    kind: "SESSION",
                },
            })
        }
        const hours = await prisma.availabilitySchedule.count({ where: { profileId } })
        if (hours === 0) {
            await prisma.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId,
                    dayOfWeek,
                    startTime: "10:00",
                    endTime: "18:00",
                    isEnabled: dayOfWeek >= 1 && dayOfWeek <= 5,
                })),
            })
        }
    }
}
