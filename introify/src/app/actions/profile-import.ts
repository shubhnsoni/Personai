"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAuthenticatedUser, requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { checkRateLimit } from "@/lib/rate-limit"
import { billingTransaction, ensureDefaultBillingAccount, getProfileBilling, lockBillingAccount, reserveUsageInTransaction, settleUsageInTransaction } from "@/lib/billing/service"
import { providerRejectedWithoutSpend } from "@/lib/ai-usage"
import { resolveApiRecipe } from "@/lib/ai-runtime"
import { collectProfileSources } from "@/lib/profile-import-sources"
import { ProfileImportInvalidError, profileImportRecipe, runProfileImportModel } from "@/lib/profile-import-model"
import { applyProfileBlueprintTx, unsupportedSocialWarnings } from "@/lib/profile-import-apply"
import { PROFILE_IMPORT_POLICY, profileBlueprintSchema, type ProfileBlueprint, type ProfileImportContext, type ProfileImportInput, type ProfileImportPreview } from "@/lib/profile-import-contract"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

function inputHash(input: ProfileImportInput): string {
    const canonical = {
        links: (input.links || []).map(link => link.trim()).filter(Boolean),
        text: input.text || "",
        discover: Boolean(input.discover),
    }
    return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

function toPreview(job: { id: string; status: string; draft: unknown; sources: unknown; warnings: unknown; appliedProfileId: string | null; appliedSlug: string | null }): ProfileImportPreview {
    return {
        id: job.id,
        status: job.status === "APPLIED" ? "APPLIED" : "READY",
        draft: job.draft as ProfileBlueprint,
        sources: (job.sources as ProfileImportPreview["sources"]) || [],
        warnings: (job.warnings as string[]) || [],
        appliedProfileId: job.appliedProfileId,
        slug: job.appliedSlug,
    }
}

function validateInput(input: ProfileImportInput) {
    if (!input || typeof input !== "object") throw new Error("Invalid import request.")
    if (!UUID.test(input.requestId || "")) throw new Error("Invalid import request.")
    if (!Array.isArray(input.links) || input.links.length > PROFILE_IMPORT_POLICY.maxLinks || input.links.some(link => typeof link !== "string" || link.length > 2048)) throw new Error(`Add at most ${PROFILE_IMPORT_POLICY.maxLinks} links.`)
    if (typeof input.text !== "string" || input.text.length > PROFILE_IMPORT_POLICY.maxTextCharacters) throw new Error(`Paste at most ${PROFILE_IMPORT_POLICY.maxTextCharacters.toLocaleString()} characters.`)
    if (typeof input.discover !== "boolean") throw new Error("Invalid import request.")
    if (!input.links.some(link => link.trim()) && !input.text.trim()) throw new Error("Add at least one link or some pasted text.")
}

async function resolveContext(context: ProfileImportContext) {
    if (!context || typeof context !== "object" || Array.isArray(context)) throw new Error("Invalid import context.")
    const claimedProfileId = "profileId" in context ? context.profileId : undefined
    if (claimedProfileId !== undefined) {
        if (typeof claimedProfileId !== "string" || claimedProfileId.length > 191) throw new Error("Invalid import context.")
        const { actor, profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId }))
        const accountId = profile.billingAccountId || (await getProfileBilling(profile.id)).accountId
        return { userId: actor.userId, accountId, targetProfileId: profile.id as string }
    }
    const claimedAccountId = "billingAccountId" in context ? context.billingAccountId : undefined
    if (claimedAccountId !== undefined && (typeof claimedAccountId !== "string" || claimedAccountId.length > 191)) throw new Error("Invalid import context.")
    const actor = unwrapOwnershipResult(await requireAuthenticatedUser())
    const account = claimedAccountId
        ? await prisma.billingAccount.findUnique({ where: { id: claimedAccountId } })
        : await ensureDefaultBillingAccount(actor.userId)
    if (!account || account.ownerUserId !== actor.userId) throw new Error("Only the billing account owner can import a profile.")
    return { userId: actor.userId, accountId: account.id, targetProfileId: null }
}

async function loadOwnedJob(userId: string, accountId: string, id: string, targetProfileId: string | null) {
    if (typeof id !== "string" || id.length > 191) return null
    const job = await prisma.profileImportJob.findUnique({ where: { id } })
    if (!job || job.ownerUserId !== userId || job.billingAccountId !== accountId) return null
    if (job.targetProfileId !== targetProfileId) return null
    if (job.expiresAt < new Date()) return null
    return job
}

function replayOrThrow(existing: { inputHash: string; status: string; error: string | null; draft: unknown; sources: unknown; warnings: unknown; appliedProfileId: string | null; appliedSlug: string | null; id: string; expiresAt: Date }, hash: string): ProfileImportPreview {
    if (existing.expiresAt < new Date()) throw new Error("That import expired. Start a new one.")
    if (existing.inputHash !== hash) throw new Error("That request already ran with different input. Start a new import.")
    if (existing.status === "READY" || existing.status === "APPLIED") return toPreview(existing)
    if (existing.status === "FAILED") throw new Error(existing.error || "That import failed.")
    throw new Error("That import is already generating.")
}

async function failJob(id: string, message: string) {
    await prisma.profileImportJob.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } }).catch(() => {})
}

export async function generateProfileImport(context: ProfileImportContext, input: ProfileImportInput): Promise<ProfileImportPreview> {
    const { userId, accountId, targetProfileId } = await resolveContext(context)
    validateInput(input)
    const hash = inputHash(input)

    const existing = await prisma.profileImportJob.findUnique({ where: { ownerUserId_requestId: { ownerUserId: userId, requestId: input.requestId } } })
    if (existing) {
        if (existing.billingAccountId !== accountId || existing.targetProfileId !== targetProfileId) {
            throw new Error("That request id was already used elsewhere. Start a new import.")
        }
        return replayOrThrow(existing, hash)
    }

    const limit = checkRateLimit(`profile-import:${userId}`, 3)
    if (!limit.allowed) throw new Error("Too many imports. Try again in a minute.")

    let job
    try {
        job = await prisma.profileImportJob.create({
            data: {
                ownerUserId: userId,
                billingAccountId: accountId,
                targetProfileId,
                requestId: input.requestId,
                inputHash: hash,
                expiresAt: new Date(Date.now() + PROFILE_IMPORT_POLICY.draftLifetimeMs),
            },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const winner = await prisma.profileImportJob.findUnique({ where: { ownerUserId_requestId: { ownerUserId: userId, requestId: input.requestId } } })
            if (!winner || winner.billingAccountId !== accountId || winner.targetProfileId !== targetProfileId) throw new Error("That request id was already used elsewhere. Start a new import.")
            return replayOrThrow(winner, hash)
        }
        throw error
    }

    let collected
    try {
        collected = await collectProfileSources(input)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not read those sources."
        await failJob(job.id, message)
        throw new Error(message)
    }
    const recipe = resolveApiRecipe("fast")
    if (!recipe) {
        await failJob(job.id, "Profile import is not connected yet.")
        throw new Error("Profile import is not connected yet.")
    }
    const bounded = profileImportRecipe(recipe)

    const claimed = await prisma.profileImportJob.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "GENERATING" } })
    if (!claimed.count) throw new Error("That import is already generating.")

    let reservationId: string
    try {
        const reservation = await billingTransaction(tx => reserveUsageInTransaction(tx, {
            accountId,
            profileId: targetProfileId ?? null,
            unit: "AI",
            amount: PROFILE_IMPORT_POLICY.credits,
            operationKey: `profile-import:${job.id}`,
            actorId: userId,
            metadata: { operation: "PROFILE_IMPORT", version: PROFILE_IMPORT_POLICY.version, provider: bounded.provider, model: bounded.model },
        }))
        if (!reservation.created || reservation.state !== "RESERVED") throw new Error("That import was already received.")
        reservationId = reservation.id
    } catch (error) {
        const message = error instanceof Error ? error.message : "Not enough AI credits."
        await failJob(job.id, message)
        throw new Error(message)
    }

    try {
        await prisma.profileImportJob.update({ where: { id: job.id }, data: { reservationId } })
    } catch {
        const released = await billingTransaction(tx => settleUsageInTransaction(tx, reservationId, "RELEASE", { reason: "reservation_unpersisted" })).then(() => true).catch(() => false)
        const message = released
            ? "Could not track the import. You were not charged."
            : "Could not track the import. The reservation is pending reconciliation."
        await failJob(job.id, message)
        throw new Error(message)
    }

    try {
        const { blueprint, receipt } = await runProfileImportModel(bounded, collected.evidence)
        const warnings = [...collected.warnings, ...unsupportedSocialWarnings(blueprint)]
        const ready = await billingTransaction(async tx => {
            await settleUsageInTransaction(tx, reservationId, "CONSUME", { ...receipt, model: receipt.returnedModel || bounded.model })
            return tx.profileImportJob.update({ where: { id: job.id }, data: { status: "READY", draft: json(blueprint), sources: json(collected.sources), warnings: json(warnings) } })
        })
        return toPreview(ready)
    } catch (error) {
        if (error instanceof ProfileImportInvalidError) {
            const released = await billingTransaction(async tx => {
                await settleUsageInTransaction(tx, reservationId, "RELEASE", { reason: "invalid_structured_output", ...error.receipt })
                await tx.profileImportJob.update({ where: { id: job.id }, data: { status: "FAILED", error: "The generated draft could not be used. You were not charged.", sources: json(collected.sources), warnings: json(collected.warnings) } })
            }).then(() => true).catch(() => false)
            if (released) throw new Error("The generated draft could not be used. You were not charged.")
            await failJob(job.id, "Generation did not complete. Credits are reserved pending reconciliation; starting a new generation may reserve another 10 credits.")
            throw new Error("Generation did not complete. Credits are reserved pending reconciliation; starting a new generation may reserve another 10 credits.")
        }
        if (providerRejectedWithoutSpend(error)) {
            await billingTransaction(async tx => {
                await settleUsageInTransaction(tx, reservationId, "RELEASE", { reason: "provider_rejected" })
                await tx.profileImportJob.update({ where: { id: job.id }, data: { status: "FAILED", error: "The generator rejected the request. You were not charged." } })
            })
            throw new Error("The generator rejected the request. You were not charged.")
        }

        await failJob(job.id, "Generation did not complete. Credits are reserved pending reconciliation; starting a new generation may reserve another 10 credits.")
        throw new Error("Generation did not complete. Credits are reserved pending reconciliation; starting a new generation may reserve another 10 credits.")
    }
}

async function appliedProfileStillValid(appliedProfileId: string | null, accountId: string, userId: string): Promise<boolean> {
    if (!appliedProfileId) return false
    const profile = await prisma.profile.findFirst({
        where: { id: appliedProfileId, userId, OR: [{ billingAccountId: accountId }, { billingAccountId: null }] },
        select: { id: true },
    })
    return Boolean(profile)
}

export async function getProfileImport(context: ProfileImportContext, id: string): Promise<ProfileImportPreview | null> {
    const { userId, accountId, targetProfileId } = await resolveContext(context)
    const job = await loadOwnedJob(userId, accountId, id, targetProfileId)
    if (!job) return null
    if (job.status !== "READY" && job.status !== "APPLIED") return null
    if (job.status === "APPLIED" && !(await appliedProfileStillValid(job.appliedProfileId, accountId, userId))) return null
    return toPreview(job)
}

export async function getProfileImportByRequest(context: ProfileImportContext, requestId: string): Promise<ProfileImportPreview | null> {
    if (typeof requestId !== "string" || !UUID.test(requestId)) throw new Error("Invalid import request.")
    const { userId, accountId, targetProfileId } = await resolveContext(context)
    const job = await prisma.profileImportJob.findUnique({ where: { ownerUserId_requestId: { ownerUserId: userId, requestId } } })
    if (!job || job.billingAccountId !== accountId || job.targetProfileId !== targetProfileId) return null
    if (job.expiresAt < new Date()) throw new Error("That import expired. Start a new one.")
    if (job.status === "FAILED") throw new Error(job.error || "That import failed.")
    if (job.status !== "READY" && job.status !== "APPLIED") return null
    if (job.status === "APPLIED" && !(await appliedProfileStillValid(job.appliedProfileId, accountId, userId))) return null
    return toPreview(job)
}

export async function applyProfileImport(profileId: string, id: string, draft: ProfileBlueprint, options: { overwriteProfile: boolean; applyFeatures: boolean }): Promise<{ profileId: string; slug: string }> {
    const parsed = profileBlueprintSchema.parse(draft)
    const { actor, profile: claimed } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const accountId = claimed.billingAccountId || (await getProfileBilling(claimed.id)).accountId
    const job = await loadOwnedJob(actor.userId, accountId, id, claimed.id)
    if (!job) throw new Error("Import not found.")
    if (job.status === "APPLIED" && job.appliedProfileId === claimed.id && job.appliedSlug) {
        if (!(await appliedProfileStillValid(job.appliedProfileId, accountId, actor.userId))) throw new Error("The previously imported profile is no longer available.")
        return { profileId: job.appliedProfileId, slug: job.appliedSlug }
    }
    if (job.status !== "READY") throw new Error("That import is not ready to apply.")

    const result = await billingTransaction(async tx => {
        await lockBillingAccount(tx, accountId)

        const claim = await tx.profileImportJob.updateMany({ where: { id: job.id, status: "READY", expiresAt: { gt: new Date() } }, data: { status: "APPLIED" } })
        if (!claim.count) {
            const current = await tx.profileImportJob.findUniqueOrThrow({ where: { id: job.id } })
            if (current.status === "APPLIED" && current.appliedProfileId === claimed.id && current.appliedSlug) {
                const applied = await tx.profile.findUnique({ where: { id: claimed.id }, select: { billingAccountId: true } })
                if (applied?.billingAccountId === accountId) return { profileId: current.appliedProfileId, slug: current.appliedSlug }
                throw new Error("The previously imported profile is no longer available.")
            }
            if (current.expiresAt < new Date()) throw new Error("That import expired. Generate a new one.")
            throw new Error("That import is already being applied.")
        }
        const profile = await tx.profile.findUniqueOrThrow({ where: { id: claimed.id } })
        if (profile.billingAccountId !== accountId) throw new Error("Profile is no longer on this billing account.")
        await applyProfileBlueprintTx(tx, { ...profile, billingAccountId: profile.billingAccountId }, parsed, { overwriteProfile: Boolean(options?.overwriteProfile), applyFeatures: options?.applyFeatures !== false })
        const warnings = [...((job.warnings as string[]) || []), ...unsupportedSocialWarnings(parsed)]

        await tx.profileImportJob.update({ where: { id: job.id }, data: { draft: json(parsed), appliedProfileId: profile.id, appliedSlug: profile.slug, warnings: json([...new Set(warnings)]) } })
        return { profileId: profile.id, slug: profile.slug }
    })

    for (const path of ["/dashboard", "/dashboard/profile", "/dashboard/content", "/dashboard/services", "/dashboard/products", `/${result.slug}`, `/${result.slug}/story`, `/${result.slug}/book`, `/${result.slug}/shop`]) {
        revalidatePath(path)
    }
    return result
}
