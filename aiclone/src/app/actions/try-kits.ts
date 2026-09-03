"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { ACTIVE_PROFILE_COOKIE, TRY_KITS, TRY_NOW_COOKIE } from "@/lib/try-kits"
import { writeGoldBoard } from "@/lib/metal/board"
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

async function seedRole(profileId: string, role: string) {
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
        const rates = {
            k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
            k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
            k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
        }
        const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { personalityConfig: true } })
        await prisma.profile.update({
            where: { id: profileId },
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
        const existing = await prisma.digitalProduct.count({ where: { profileId } })
        if (existing === 0) {
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
        const rates = {
            k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
            k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
            k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
        }
        const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { personalityConfig: true } })
        await prisma.profile.update({
            where: { id: profileId },
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

export async function openTryKit(formData: FormData) {
    const role = String(formData.get("role") || "")
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const kit = TRY_KITS.find((k) => k.role === role)
    if (!kit) redirect("/qa")

    let profile = await prisma.profile.findFirst({
        where: { userId: user.id, slug: kit.slug },
    })

    if (!profile) {
        const clash = await prisma.profile.findUnique({ where: { slug: kit.slug } })
        const slug = clash ? `${kit.slug}-${user.id.slice(-6).toLowerCase()}` : kit.slug
        profile = await prisma.profile.create({
            data: {
                userId: user.id,
                slug,
                displayName: kit.name,
                headline: kit.blurb,
                roleTemplate: kit.role,
                primaryGoal: kit.goal,
                language: "en",
                timezone: "Asia/Kolkata",
                isPublic: true,
                welcomeMessageOverride: kit.blurb,
            },
        })
        await seedRole(profile.id, kit.role)
    }

    const jar = await cookies()
    jar.set(ACTIVE_PROFILE_COOKIE, profile.id, { path: "/", sameSite: "lax", httpOnly: true })
    jar.set(TRY_NOW_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 })
    revalidatePath("/dashboard")
    redirect(kit.next)
}

export async function exitTryKit() {
    const jar = await cookies()
    jar.delete(ACTIVE_PROFILE_COOKIE)
    jar.delete(TRY_NOW_COOKIE)
    revalidatePath("/dashboard")
    redirect("/qa")
}
