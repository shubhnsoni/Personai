"use server"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { extrasFromAddons, needById, type AddonId, type NeedId } from "@/lib/onboarding-needs"
import { writeExtras } from "@/lib/surfaces"
import { writeGoldBoard } from "@/lib/metal/board"
import { citySlug, displayCity } from "@/lib/metal/city"
import { DEFAULT_GOLD_RATES } from "@/lib/onboarding-chat"
import { ensureDefaultBillingAccount, withAccountLimit, assertAccountLimit } from "@/lib/billing/service"
import { ACTIVE_PROFILE_COOKIE } from "@/lib/try-kits"
import { requireAuthenticatedUser, unwrapOwnershipResult } from "@/lib/security"
import { normalizeUsername, usernameError } from "@/lib/username"
import { profileBlueprintSchema, type ProfileBlueprint } from "@/lib/profile-import-contract"
import { applyProfileBlueprintTx } from "@/lib/profile-import-apply"

export interface CreateProfileData {
    billingAccountId?: string
    importDraft?: { id: string; draft: ProfileBlueprint }
    displayName: string
    headline?: string
    bio?: string
    roleTemplate: string
    primaryGoal: string
    language?: string
    timezone?: string
    animationStyleId?: string
    needId?: NeedId
    addons?: AddonId[]
    activate?: boolean
    imageUrl?: string
    chatAvatarMode?: string
    personalityConfig?: string
    speakerName?: string
    speakerRole?: string
    whatsapp?: string
    email?: string
    gstin?: string
    upiId?: string
    goldCity?: string
    distroInviteDesks?: boolean
    seedSample?: boolean
    username?: string
}

export interface CreateProfileResult {
    slug: string
    next: string
}

const DEFAULT_SERVICE_BY_ROLE: Readonly<Record<string, { name: string; description: string }>> = {
    CONSULTANT: { name: "Fit call", description: "A first conversation to see if we should work together." },
    CA: { name: "Fit call", description: "A first conversation to see if we should work together." },
    COACH: { name: "Intro session", description: "A first conversation to see if we should work together." },
    SALON_SPA: { name: "Consultation", description: "A first appointment before choosing a treatment." },
    EVENTS_STUDIO: { name: "Event discovery call", description: "A first conversation about the event brief." },
    REAL_ESTATE_BROKERAGE: { name: "Property consultation", description: "A first conversation about a mandate or viewing." },
    RECRUITMENT_AGENCY: { name: "Hiring brief", description: "A first conversation about the role to fill." },
}

async function slugTaken(candidate: string, exceptProfileId?: string) {
    const [profile, workspace] = await Promise.all([
        prisma.profile.findUnique({ where: { slug: candidate }, select: { id: true } }),
        prisma.workspace.findUnique({ where: { slug: candidate }, select: { profileId: true } }),
    ])
    if (profile && profile.id !== exceptProfileId) return true
    if (workspace && workspace.profileId !== exceptProfileId) return true
    return false
}

async function availableBusinessSlug(displayName: string): Promise<string> {
    const base = normalizeUsername(displayName) || "page"
    let candidate = base
    let suffix = 2
    while (await slugTaken(candidate) || usernameError(candidate)) {
        candidate = `${base}-${suffix++}`
    }
    return candidate
}

export async function checkUsername(raw: string) {
    unwrapOwnershipResult(await requireAuthenticatedUser())
    const slug = normalizeUsername(raw)
    const error = usernameError(slug)
    if (error) return { ok: false as const, slug, error }
    if (await slugTaken(slug)) return { ok: false as const, slug, error: "That username is taken" }
    return { ok: true as const, slug }
}

export async function createProfile(data: CreateProfileData): Promise<CreateProfileResult> {
    const actor = unwrapOwnershipResult(await requireAuthenticatedUser())
    if (data.seedSample) throw new Error("Sample businesses are available through the admin kit preview.")
    const account = data.billingAccountId
        ? await prisma.billingAccount.findUnique({ where: { id: data.billingAccountId } })
        : await ensureDefaultBillingAccount(actor.userId)
    if (!account || account.ownerUserId !== actor.userId) throw new Error("Only the billing account owner can add a business.")

    let importJob: { id: string; status: string; appliedSlug: string | null; appliedProfileId: string | null } | null = null
    let importBlueprint: ProfileBlueprint | null = null
    if (data.importDraft) {
        importBlueprint = profileBlueprintSchema.parse(data.importDraft.draft)
        const job = await prisma.profileImportJob.findUnique({ where: { id: data.importDraft.id } })
        if (!job || job.ownerUserId !== actor.userId || job.billingAccountId !== account.id || job.targetProfileId !== null) throw new Error("Import not found.")
        if (job.expiresAt < new Date()) throw new Error("That import expired. Generate a new one.")
        if (job.status === "APPLIED" && job.appliedSlug && job.appliedProfileId) {
            const applied = await prisma.profile.findFirst({ where: { id: job.appliedProfileId, userId: actor.userId }, select: { id: true, slug: true } })
            if (!applied) throw new Error("The previously imported profile is no longer available.")
            if (data.activate) {
                const jar = await cookies()
                jar.set(ACTIVE_PROFILE_COOKIE, applied.id, { path: "/", sameSite: "lax", httpOnly: true })
            }
            const need = needById(importBlueprint.needId)
            return { slug: applied.slug, next: need.next }
        }
        if (job.status !== "READY") throw new Error("That import is not ready to apply.")
        importJob = job
    }
    const displayName = (importBlueprint?.profile.displayName || data.displayName).trim()
    if (!displayName) throw new TypeError("Profile display name is required")

    const wanted = data.username ? normalizeUsername(data.username) : ""
    const slug = wanted
        ? await (async () => {
            const error = usernameError(wanted)
            if (error) throw new TypeError(error)
            if (await slugTaken(wanted)) throw new TypeError("That username is taken")
            return wanted
        })()
        : await availableBusinessSlug(displayName)

    const effectiveNeed = importBlueprint ? needById(importBlueprint.needId) : needById(data.needId)
    const roleTemplate = importBlueprint ? effectiveNeed.role : data.roleTemplate
    const primaryGoal = importBlueprint ? effectiveNeed.goal : data.primaryGoal
    const addons = importBlueprint ? importBlueprint.addons : (data.addons || [])
    const extras = extrasFromAddons(roleTemplate, addons as AddonId[])
    const defaultService = importJob ? undefined : DEFAULT_SERVICE_BY_ROLE[roleTemplate]
    let personality = writeExtras(data.personalityConfig || null, extras)
    try {
        const bag = JSON.parse(personality) as Record<string, unknown>
        if (data.speakerName?.trim() || data.speakerRole?.trim()) {
            bag.speaker = {
                name: (data.speakerName || "").trim() || undefined,
                role: (data.speakerRole || "").trim() || undefined,
            }
        }
        if (data.distroInviteDesks) bag.distroDesk = "invite"
        if (data.email?.trim()) bag.contactEmail = data.email.trim()
        personality = JSON.stringify(bag)
    } catch { /* keep extras-only bag */ }
    if (data.goldCity?.trim() && roleTemplate === "JEWELRY_WHOLESALE") {
        const city = displayCity(data.goldCity)
        personality = writeGoldBoard(personality, {
            city,
            citySlug: citySlug(city),
            asOf: new Date().toISOString(),
            source: "city-feed",
            ...DEFAULT_GOLD_RATES,
            lastCheckedAt: new Date().toISOString(),
        })
    }
    const profile = await withAccountLimit(account.id, "businesses", async tx => {
        if (!importJob) return 1
        const current = await tx.profileImportJob.findUnique({ where: { id: importJob.id }, select: { status: true } })
        return current?.status === "APPLIED" ? 0 : 1
    }, async (tx) => {
        if (importJob) {
            const claim = await tx.profileImportJob.updateMany({ where: { id: importJob.id, status: "READY", expiresAt: { gt: new Date() } }, data: { status: "APPLIED" } })
            if (!claim.count) {
                const current = await tx.profileImportJob.findUniqueOrThrow({ where: { id: importJob.id } })
                if (current.status === "APPLIED" && current.appliedProfileId && current.appliedSlug) return { id: current.appliedProfileId, slug: current.appliedSlug }
                if (current.expiresAt < new Date()) throw new Error("That import expired. Generate a new one.")
                throw new Error("That import is already being applied.")
            }
        }

        const hasDefaultOffering = !importJob && Boolean(defaultService || roleTemplate === "RESTAURANT" || addons.includes("services"))
        if (hasDefaultOffering) await assertAccountLimit(tx, account.id, "offerings", 1)
        if (wanted && (await tx.profile.findUnique({ where: { slug }, select: { id: true } }))) {
            if (importJob) {
                const current = await tx.profileImportJob.findUniqueOrThrow({ where: { id: importJob.id } })
                if (current.status === "APPLIED" && current.appliedProfileId && current.appliedSlug) return { id: current.appliedProfileId, slug: current.appliedSlug }
            }
            throw new TypeError("That username is taken")
        }
        const created = await tx.profile.create({
            data: {
                userId: actor.userId,
                billingAccountId: account.id,
                slug,
                displayName,
                headline: importBlueprint ? importBlueprint.profile.headline : data.headline,
                bio: importBlueprint ? importBlueprint.profile.bio : data.bio,
                roleTemplate,
                primaryGoal,
                language: data.language || "en",
                timezone: data.timezone || "UTC",
                animationStyleId: data.animationStyleId || null,
                isPublic: true,
                imageUrl: data.imageUrl || null,
                chatAvatarMode: data.chatAvatarMode === "IMAGE" && data.imageUrl ? "IMAGE" : "ORB",
                personalityConfig: personality,
                whatsapp: data.whatsapp?.trim() || null,
                gstin: data.gstin?.trim() || null,
                upiId: data.upiId?.trim() || null,
            },
        })
        const workspace = await tx.workspace.create({
            data: {
                profileId: created.id,
                billingAccountId: account.id,
                name: created.displayName,
                slug: created.slug,
            },
        })
        await tx.membership.create({
            data: {
                workspaceId: workspace.id,
                userId: actor.userId,
                role: "OWNER",
            },
        })

        if (!importJob && roleTemplate === "RESTAURANT") {
            await tx.serviceOffering.create({
                data: {
                    profileId: created.id,
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
            await tx.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId: created.id,
                    dayOfWeek,
                    startTime: "12:00",
                    endTime: "22:00",
                    isEnabled: dayOfWeek !== 1,
                })),
            })
        }

        if (!importJob && defaultService) {
            await tx.serviceOffering.create({
                data: {
                    profileId: created.id,
                    name: defaultService.name,
                    description: defaultService.description,
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: 30,
                    currency: "USD",
                    isActive: true,
                    kind: "SESSION",
                },
            })
            await tx.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId: created.id,
                    dayOfWeek,
                    startTime: "10:00",
                    endTime: "18:00",
                    isEnabled: dayOfWeek >= 1 && dayOfWeek <= 5,
                })),
            })
        }

        if (!importJob && addons.includes("services") && !defaultService && roleTemplate !== "RESTAURANT") {
            await tx.serviceOffering.create({
                data: {
                    profileId: created.id,
                    name: "Fit call",
                    description: "A first conversation to see if we should work together.",
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: 30,
                    currency: "USD",
                    isActive: true,
                    kind: "SESSION",
                },
            })
        }

        if (importJob && importBlueprint) {
            await applyProfileBlueprintTx(tx, { ...created, billingAccountId: account.id }, importBlueprint, { overwriteProfile: false, applyFeatures: true })
            await tx.profileImportJob.update({ where: { id: importJob.id }, data: { draft: importBlueprint as unknown as Prisma.InputJsonValue, appliedProfileId: created.id, appliedSlug: created.slug } })
        }

        return created
    })

    if (data.activate) {
        const jar = await cookies()
        jar.set(ACTIVE_PROFILE_COOKIE, profile.id, { path: "/", sameSite: "lax", httpOnly: true })
    }
    revalidatePath("/dashboard")
    const next = data.needId || importBlueprint ? effectiveNeed.next : (
        roleTemplate === "DISTRIBUTOR" ? "/dashboard/orders" : roleTemplate === "RESTAURANT" || roleTemplate === "SHOP" || roleTemplate === "JEWELRY_RETAIL" || roleTemplate === "JEWELRY_WHOLESALE" || roleTemplate === "PHARMACY" || roleTemplate === "AUTO_PARTS" ? "/dashboard/products"
        : roleTemplate === "CONSULTANT" || roleTemplate === "CA" ? "/dashboard/services"
        : roleTemplate === "COACH" ? "/dashboard/courses"
        : "/dashboard"
    )
    return { slug: profile.slug, next }
}
