import { PrismaClient } from "@prisma/client"
import { writeGoldBoard } from "../../src/lib/metal/board.ts"
import { K22_BPS, rupeesPerGramToPaisePer10g, ticketPaise } from "../../src/lib/metal/math.ts"
import { writeProductMetal } from "../../src/lib/metal/product.ts"
import { ensureParty, listOpenLots, recordPurchase, recordSale } from "../../src/lib/metal/ledger.ts"

const prisma = new PrismaClient()
const rates = {
    k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
    k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
    k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
}

const user = await prisma.user.findFirst({ select: { id: true } })
if (!user) throw new Error("no user")

async function upsert(slug, name, role, goal, blurb) {
    let profile = await prisma.profile.findUnique({ where: { slug } })
    if (!profile) {
        profile = await prisma.profile.create({
            data: {
                userId: user.id,
                slug,
                displayName: name,
                headline: blurb,
                roleTemplate: role,
                primaryGoal: goal,
                language: "en",
                timezone: "Asia/Kolkata",
                isPublic: true,
                welcomeMessageOverride: blurb,
            },
        })
    } else if (!profile.isPublic) {
        profile = await prisma.profile.update({ where: { id: profile.id }, data: { isPublic: true } })
    }
    const row = await prisma.profile.findUnique({ where: { id: profile.id }, select: { personalityConfig: true } })
    await prisma.profile.update({
        where: { id: profile.id },
        data: {
            personalityConfig: writeGoldBoard(row?.personalityConfig, {
                city: "Mumbai",
                citySlug: "mumbai",
                asOf: new Date().toISOString(),
                source: "city-feed",
                ...rates,
                lastCheckedAt: new Date().toISOString(),
            }),
            timezone: "Asia/Kolkata",
        },
    })
    return profile
}

const retail = await upsert("try-jewelry-retail", "Jewellery store", "JEWELRY_RETAIL", "SELL_PRODUCTS", "City gold board, weight × purity, making charges.")
if ((await prisma.digitalProduct.count({ where: { profileId: retail.id } })) === 0) {
    const bangle = { grossMg: 10000, purityBps: K22_BPS, makingPaise: 50_000 }
    const chain = { grossMg: 20000, purityBps: K22_BPS, makingPaise: 80_000 }
    await prisma.digitalProduct.createMany({
        data: [
            { profileId: retail.id, title: "Light bangle", category: "Bangles", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: ticketPaise(bangle, rates), weightGrams: 10, stock: 4, isActive: true, variantsJson: writeProductMetal(null, bangle) },
            { profileId: retail.id, title: "Rope chain", category: "Chains", type: "PHYSICAL", fulfillment: "PHYSICAL", currency: "INR", priceCents: ticketPaise(chain, rates), weightGrams: 20, stock: 2, isActive: true, variantsJson: writeProductMetal(null, chain) },
        ],
    })
}

const wholesale = await upsert("try-gold-wholesale", "Gold wholesale", "JEWELRY_WHOLESALE", "COLLECT_LEADS", "70 touch in, 74 out, cash or udhar.")
const lots = await listOpenLots(wholesale.id)
if (lots.length === 0) {
    const gujarat = await ensureParty(wholesale.id, { kind: "SUPPLIER", displayName: "Gujarat House", phone: "07912345678" })
    const sharma = await ensureParty(wholesale.id, { kind: "RETAILER", displayName: "Sharma Jewellers", phone: "9876543210", termsDays: 15 })
    const cityGold = await ensureParty(wholesale.id, { kind: "RETAILER", displayName: "City Gold", phone: "9876500000", termsDays: 7 })
    await recordPurchase(wholesale.id, {
        partyId: gujarat.id,
        k24PaisePer10g: rates.k24PaisePer10g,
        lines: [{ title: "Light bangles", grossMg: 120000, touchBps: 7000, qty: 12 }],
        payNowPaise: 0,
        dueOn: new Date(Date.now() + 7 * 86400000),
    })
    const openLots = await listOpenLots(wholesale.id)
    const openLot = openLots[0]
    await recordSale(wholesale.id, {
        partyId: sharma.id,
        k24PaisePer10g: rates.k24PaisePer10g,
        lines: [{ title: "Light bangle", grossMg: 10000, touchBps: 7400, lotId: openLot?.id }],
        payNowPaise: 0,
        dueOn: new Date(Date.now() - 3 * 86400000),
    })
    await recordSale(wholesale.id, {
        partyId: cityGold.id,
        k24PaisePer10g: rates.k24PaisePer10g,
        lines: [{ title: "Light bangle", grossMg: 10000, touchBps: 7400, lotId: openLot?.id }],
        payNowPaise: 20_000_000,
    })
    await prisma.digitalProduct.create({
        data: {
            profileId: wholesale.id,
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

const sale = await prisma.$queryRaw`
    SELECT "publicToken", kind, "payStatus" FROM "MetalBill"
    WHERE "profileId" = ${wholesale.id} AND kind = 'SALE' AND "liftedAt" IS NULL
    ORDER BY "createdAt" DESC LIMIT 1`
console.log(JSON.stringify({
    retail: retail.slug,
    wholesale: wholesale.slug,
    liftToken: sale[0]?.publicToken || null,
    saleStatus: sale[0]?.payStatus || null,
}))
await prisma.$disconnect()
