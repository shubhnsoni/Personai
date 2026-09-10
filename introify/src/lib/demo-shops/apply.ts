import { randomBytes } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { extrasFromAddons, suggestedAddons } from "@/lib/onboarding-needs"
import { writeExtras } from "@/lib/surfaces"
import { writeSocials } from "@/lib/socials"
import { writeVenue } from "@/lib/venue"
import { writeOrbBag } from "@/lib/bloub/catalog"
import { writeGoldBoard } from "@/lib/metal/board"
import { rupeesPerGramToPaisePer10g } from "@/lib/metal/math"
import { resolveKitRole } from "@/lib/role-alias"
import { AR_DISHES } from "./ar"
import { rupees, type DemoShop } from "./types"

function tableCode() {
    return randomBytes(18).toString("base64url")
}

export async function applyDemoShop(
    db: PrismaClient,
    profileId: string,
    shop: DemoShop,
    opts: { replaceCatalog?: boolean } = {},
) {
    const replace = opts.replaceCatalog !== false
    const suggested = suggestedAddons(shop.flavor)
    let personality = "{}"
    const row = await db.profile.findUnique({ where: { id: profileId }, select: { personalityConfig: true } })
    personality = row?.personalityConfig || "{}"
    personality = writeVenue(personality, shop.venue)
    if (shop.socials) personality = writeSocials(personality, shop.socials)
    personality = writeExtras(personality, extrasFromAddons(shop.flavor, suggested))
    personality = writeOrbBag(personality, { shape: "cercle", expression: "centre", color: "blanc", aura: "pulse" }, false)

    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(personality) as Record<string, unknown> } catch { bag = {} }
    bag.tone = shop.tone || "warm"
    bag.language = "en"
    bag.responseLength = "medium"
    bag.customInstructions = shop.customInstructions
    if (shop.googlePlaceId) bag.googlePlaceId = shop.googlePlaceId
    if (shop.speakerName) bag.speakerName = shop.speakerName
    if (shop.speakerRole) bag.speakerRole = shop.speakerRole
    personality = JSON.stringify(bag)

    await db.profile.update({
        where: { id: profileId },
        data: {
            displayName: shop.name,
            headline: shop.headline,
            bio: shop.bio,
            roleTemplate: shop.flavor,
            primaryGoal: shop.goal,
            language: "en",
            timezone: "Asia/Kolkata",
            whatsapp: shop.whatsapp || null,
            upiId: shop.upiId || null,
            gstin: shop.gstin || null,
            deliveryNote: shop.deliveryNote || null,
            imageUrl: shop.imageUrl || undefined,
            shopLogoUrl: shop.shopLogoUrl || undefined,
            isPublic: true,
            liveChatEnabled: true,
            welcomeMessageOverride: shop.welcome,
            personalityConfig: personality,
        },
    })

    if (!replace) {
        const products = await db.digitalProduct.count({ where: { profileId } })
        const services = await db.serviceOffering.count({ where: { profileId } })
        if (products > 0 || services > 0) return
    }

    await db.booking.deleteMany({ where: { profileId } }).catch(() => {})
    await db.availabilitySchedule.deleteMany({ where: { profileId } })
    await db.serviceOffering.deleteMany({ where: { profileId } }).catch(() => {})
    await db.digitalProduct.deleteMany({ where: { profileId } }).catch(() => {})
    await db.profileDocument.deleteMany({ where: { profileId } })
    await db.workExperience.deleteMany({ where: { profileId } })
    await db.project.deleteMany({ where: { profileId } })
    await db.leadMagnet.deleteMany({ where: { profileId } })
    await db.event.deleteMany({ where: { profileId } })
    await db.course.deleteMany({ where: { profileId } })
    await db.appointmentResource.deleteMany({ where: { profileId } })
    await db.profileImage.deleteMany({ where: { profileId } })

    await db.availabilitySchedule.createMany({
        data: shop.hours.map((hour) => ({ profileId, ...hour })),
    })

    if (shop.services?.length) {
        await db.serviceOffering.createMany({
            data: shop.services.map((service) => ({
                profileId,
                name: service.name,
                description: service.description,
                priceCents: rupees(service.priceRupees),
                currency: "INR",
                isFree: service.priceRupees <= 0,
                durationMinutes: service.durationMinutes,
                isActive: true,
                kind: service.kind || "SESSION",
                covers: service.covers,
                isRecurring: Boolean(service.isRecurring),
            })),
        })
    }

    if (shop.products?.length) {
        await db.digitalProduct.createMany({
            data: shop.products.map((product) => {
                const ar = product.arKey ? AR_DISHES[product.arKey] : undefined
                return {
                    profileId,
                    title: product.title,
                    description: product.description,
                    body: product.body || product.description,
                    category: product.category,
                    sku: product.sku,
                    stock: product.stock,
                    thumbnailUrl: product.thumbnailUrl,
                    diet: product.diet,
                    spiceLevel: product.spiceLevel,
                    serveWindow: product.serveWindow,
                    prepMinutes: product.prepMinutes,
                    type: product.type || "PHYSICAL",
                    fulfillment: product.fulfillment || "PHYSICAL",
                    allowCod: Boolean(product.allowCod),
                    shipMode: product.shipMode || (product.fulfillment === "DIGITAL" ? "NONE" : "PICKUP"),
                    priceCents: rupees(product.priceRupees),
                    compareAtCents: product.compareAtRupees ? rupees(product.compareAtRupees) : undefined,
                    currency: "INR",
                    isActive: true,
                    weightGrams: product.weightGrams,
                    variantsJson: product.variantsJson,
                    highlights: product.highlights ? JSON.stringify(product.highlights) : undefined,
                    arModelUrl: ar?.glb,
                    arUsdzUrl: ar?.usdz,
                }
            }),
        })
    }

    if (shop.documents.length) {
        await db.profileDocument.createMany({
            data: shop.documents.map((doc) => ({
                profileId,
                type: doc.type,
                sourceType: "TEXT",
                title: doc.title,
                rawText: doc.rawText,
            })),
        })
    }

    if (shop.experiences?.length) {
        await db.workExperience.createMany({
            data: shop.experiences.map((item) => ({
                profileId,
                company: item.company,
                role: item.role,
                startDate: item.startDate,
                endDate: item.endDate ?? null,
                description: item.description,
            })),
        })
    }

    if (shop.projects?.length) {
        await db.project.createMany({
            data: shop.projects.map((item) => ({
                profileId,
                title: item.title,
                description: item.description,
                year: item.year,
                imageUrl: item.imageUrl,
                client: item.client,
            })),
        })
    }

    if (shop.leadMagnets?.length) {
        await db.leadMagnet.createMany({
            data: shop.leadMagnets.map((item) => ({
                profileId,
                title: item.title,
                description: item.description,
                type: "DOWNLOAD",
                isActive: true,
            })),
        })
    }

    if (shop.staff?.length) {
        await db.appointmentResource.createMany({
            data: shop.staff.map((person) => ({
                profileId,
                name: person.name,
                kind: person.kind || "STAFF",
                capacity: person.capacity ?? 1,
                isActive: true,
            })),
        })
    }

    if (shop.story?.length) {
        await db.profileImage.createMany({
            data: shop.story.map((frame, index) => ({
                profileId,
                url: frame.url,
                title: frame.title,
                body: frame.body,
                category: frame.category,
                sortOrder: index + 1,
                isPublished: true,
            })),
        })
    }

    if (shop.tables?.length) {
        await db.restaurantTable.updateMany({ where: { profileId }, data: { isActive: false } })
        const existing = await db.restaurantTable.findMany({ where: { profileId }, orderBy: { sortOrder: "asc" } })
        const wanted = shop.tables.flatMap((floor, fi) =>
            Array.from({ length: floor.count }, (_, i) => ({
                label: `${floor.prefix} ${i + 1}`,
                seats: floor.seats,
                zone: floor.zone,
                sortOrder: fi * 50 + i + 1,
            })),
        )
        for (let i = 0; i < wanted.length; i++) {
            const spec = wanted[i]
            const row = existing[i]
            if (row) {
                await db.restaurantTable.update({
                    where: { id: row.id },
                    data: { ...spec, isActive: true },
                })
            } else {
                await db.restaurantTable.create({
                    data: { profileId, ...spec, isActive: true, code: tableCode() },
                })
            }
        }
    }

    if (shop.events?.length) {
        const now = Date.now()
        await db.event.createMany({
            data: shop.events.map((item) => {
                const start = new Date(now + item.daysFromNow * 86400000)
                const end = new Date(start.getTime() + item.durationHours * 3600000)
                return {
                    profileId,
                    title: item.title,
                    description: item.description,
                    eventType: "WORKSHOP",
                    thumbnailUrl: item.thumbnailUrl,
                    startTime: start,
                    endTime: end,
                    timezone: "Asia/Kolkata",
                    location: item.location,
                    priceCents: rupees(item.priceRupees),
                    currency: "INR",
                    isFree: item.priceRupees <= 0,
                    isActive: true,
                }
            }),
        })
    }

    if (shop.courses?.length) {
        for (const course of shop.courses) {
            const created = await db.course.create({
                data: {
                    profileId,
                    title: course.title,
                    description: course.description,
                    thumbnailUrl: course.thumbnailUrl,
                    priceCents: rupees(course.priceRupees),
                    currency: "INR",
                    isActive: true,
                    isPublished: true,
                    totalModules: course.modules.length,
                    totalLessons: course.modules.reduce((sum, mod) => sum + mod.lessons.length, 0),
                },
            })
            for (let mi = 0; mi < course.modules.length; mi++) {
                const mod = course.modules[mi]
                const moduleRow = await db.courseModule.create({
                    data: { courseId: created.id, title: mod.title, orderIndex: mi + 1 },
                })
                await db.courseLesson.createMany({
                    data: mod.lessons.map((title, li) => ({
                        moduleId: moduleRow.id,
                        title,
                        orderIndex: li + 1,
                        contentType: "TEXT",
                    })),
                })
            }
        }
    }

    const engine = resolveKitRole(shop.flavor) || shop.engine
    if (engine === "JEWELRY_RETAIL" || engine === "JEWELRY_WHOLESALE") {
        const latest = await db.profile.findUnique({ where: { id: profileId }, select: { personalityConfig: true } })
        await db.profile.update({
            where: { id: profileId },
            data: {
                timezone: "Asia/Kolkata",
                personalityConfig: writeGoldBoard(latest?.personalityConfig, {
                    city: "Ranchi",
                    citySlug: "ranchi",
                    asOf: new Date().toISOString(),
                    source: "city-feed",
                    k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
                    k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
                    k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
                    lastCheckedAt: new Date().toISOString(),
                }),
            },
        })
    }
}
