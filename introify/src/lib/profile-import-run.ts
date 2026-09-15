import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { billingTransaction, lockBillingAccount, reserveUsageInTransaction, settleUsageInTransaction } from "@/lib/billing/service"
import { providerRejectedWithoutSpend } from "@/lib/ai-usage"
import { listApiRecipes, providerFailoverError, resolveProfileImportRecipe, type ApiRecipe } from "@/lib/ai-runtime"
import { collectProfileSources } from "@/lib/profile-import-sources"
import { ProfileImportInvalidError, profileImportRecipe, runProfileImportModel } from "@/lib/profile-import-model"
import { applyProfileBlueprintTx, unsupportedSocialWarnings } from "@/lib/profile-import-apply"
import { PROFILE_IMPORT_POLICY, profileBlueprintSchema, type ProfileBlueprint, type ProfileImportInput, type ProfileImportPreview } from "@/lib/profile-import-contract"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

export type ProfileImportOwner = { userId: string; accountId: string; targetProfileId: string | null }

export function inputHash(input: ProfileImportInput): string {
    const canonical = {
        links: (input.links || []).map(link => link.trim()).filter(Boolean),
        text: input.text || "",
        discover: Boolean(input.discover),
    }
    return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function validateProfileImportInput(input: ProfileImportInput) {
    if (!input || typeof input !== "object") throw new Error("Invalid import request.")
    if (!UUID.test(input.requestId || "")) throw new Error("Invalid import request.")
    if (!Array.isArray(input.links) || input.links.length > PROFILE_IMPORT_POLICY.maxLinks || input.links.some(link => typeof link !== "string" || link.length > 2048)) throw new Error(`Add at most ${PROFILE_IMPORT_POLICY.maxLinks} links.`)
    if (typeof input.text !== "string" || input.text.length > PROFILE_IMPORT_POLICY.maxTextCharacters) throw new Error(`Paste at most ${PROFILE_IMPORT_POLICY.maxTextCharacters.toLocaleString()} characters.`)
    if (typeof input.discover !== "boolean") throw new Error("Invalid import request.")
    if (!input.links.some(link => link.trim()) && !input.text.trim()) throw new Error("Add at least one link or some pasted text.")
}

export function toProfileImportPreview(job: { id: string; status: string; draft: unknown; sources: unknown; warnings: unknown; appliedProfileId: string | null; appliedSlug: string | null }): ProfileImportPreview {
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

function replayOrThrow(existing: { inputHash: string; status: string; error: string | null; draft: unknown; sources: unknown; warnings: unknown; appliedProfileId: string | null; appliedSlug: string | null; id: string; expiresAt: Date }, hash: string): ProfileImportPreview {
    if (existing.expiresAt < new Date()) throw new Error("That import expired. Start a new one.")
    if (existing.inputHash !== hash) throw new Error("That request already ran with different input. Start a new import.")
    if (existing.status === "READY" || existing.status === "APPLIED") return toProfileImportPreview(existing)
    if (existing.status === "FAILED") throw new Error(existing.error || "That import failed.")
    throw new Error("That import is already generating.")
}

async function failJob(id: string, message: string) {
    await prisma.profileImportJob.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } }).catch(() => {})
}

function importRecipes(): ApiRecipe[] {
    const recipes: ApiRecipe[] = []
    const seen = new Set<string>()
    for (const candidate of [...listApiRecipes("fast"), resolveProfileImportRecipe()]) {
        if (!candidate) continue
        const key = `${candidate.provider}:${candidate.model}`
        if (seen.has(key)) continue
        seen.add(key)
        recipes.push(candidate)
    }
    return recipes
}

function canRetryFailedJob(existing: { status: string; error: string | null; reservationId: string | null; inputHash: string }, hash: string) {
    if (existing.status !== "FAILED") return false
    if (existing.inputHash !== hash) return false
    if (/pending reconciliation/i.test(existing.error || "")) return false
    return true
}

export async function runProfileImportGeneration(owner: ProfileImportOwner, input: ProfileImportInput): Promise<ProfileImportPreview> {
    const { userId, accountId, targetProfileId } = owner
    validateProfileImportInput(input)
    const hash = inputHash(input)

    let existing = await prisma.profileImportJob.findUnique({ where: { ownerUserId_requestId: { ownerUserId: userId, requestId: input.requestId } } })
    if (existing) {
        if (existing.billingAccountId !== accountId || existing.targetProfileId !== targetProfileId) {
            throw new Error("That request id was already used elsewhere. Start a new import.")
        }
        if (canRetryFailedJob(existing, hash)) {
            await prisma.profileImportJob.delete({ where: { id: existing.id } })
            existing = null
        } else {
            return replayOrThrow(existing, hash)
        }
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
            if (canRetryFailedJob(winner, hash)) {
                await prisma.profileImportJob.delete({ where: { id: winner.id } })
            } else {
                return replayOrThrow(winner, hash)
            }
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
        } else {
            throw error
        }
    }

    let collected
    try {
        collected = await collectProfileSources(input)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not read those sources."
        await failJob(job.id, message)
        throw new Error(message)
    }
    const recipes = importRecipes()
    if (!recipes.length) {
        await failJob(job.id, "Profile import is not connected yet.")
        throw new Error("Profile import is not connected yet.")
    }

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
            metadata: { operation: "PROFILE_IMPORT", version: PROFILE_IMPORT_POLICY.version, provider: recipes[0].provider, model: recipes[0].model },
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
        let lastError: unknown
        let result: Awaited<ReturnType<typeof runProfileImportModel>> | null = null
        let used = recipes[0]
        for (const recipe of recipes) {
            try {
                result = await runProfileImportModel(profileImportRecipe(recipe), collected.evidence)
                used = recipe
                break
            } catch (error) {
                lastError = error
                if (error instanceof ProfileImportInvalidError) throw error
                if (!providerFailoverError(error)) throw error
            }
        }
        if (!result) throw lastError || new Error("Profile import is not connected yet.")
        const { blueprint, receipt } = result
        const warnings = [...collected.warnings, ...unsupportedSocialWarnings(blueprint)]
        const ready = await billingTransaction(async tx => {
            await settleUsageInTransaction(tx, reservationId, "CONSUME", { ...receipt, model: receipt.returnedModel || used.model })
            return tx.profileImportJob.update({ where: { id: job.id }, data: { status: "READY", draft: json(blueprint), sources: json(collected.sources), warnings: json(warnings) } })
        })
        return toProfileImportPreview(ready)
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

export async function loadOwnedImportJob(userId: string, accountId: string, id: string, targetProfileId: string | null) {
    if (typeof id !== "string" || id.length > 191) return null
    const job = await prisma.profileImportJob.findUnique({ where: { id } })
    if (!job || job.ownerUserId !== userId || job.billingAccountId !== accountId) return null
    if (job.targetProfileId !== targetProfileId) return null
    if (job.expiresAt < new Date()) return null
    return job
}

export async function appliedProfileStillValid(appliedProfileId: string | null, accountId: string, userId: string): Promise<boolean> {
    if (!appliedProfileId) return false
    const profile = await prisma.profile.findFirst({
        where: { id: appliedProfileId, userId, OR: [{ billingAccountId: accountId }, { billingAccountId: null }] },
        select: { id: true },
    })
    return Boolean(profile)
}

export async function applyOwnedProfileImport(
    owner: { userId: string; accountId: string; profileId: string },
    id: string,
    draft: ProfileBlueprint,
    options: { overwriteProfile: boolean; applyFeatures: boolean },
): Promise<{ profileId: string; slug: string }> {
    const parsed = profileBlueprintSchema.parse(draft)
    const job = await loadOwnedImportJob(owner.userId, owner.accountId, id, owner.profileId)
    if (!job) throw new Error("Import not found.")
    if (job.status === "APPLIED" && job.appliedProfileId === owner.profileId && job.appliedSlug) {
        if (!(await appliedProfileStillValid(job.appliedProfileId, owner.accountId, owner.userId))) throw new Error("The previously imported profile is no longer available.")
        return { profileId: job.appliedProfileId, slug: job.appliedSlug }
    }
    if (job.status !== "READY") throw new Error("That import is not ready to apply.")

    const result = await billingTransaction(async tx => {
        await lockBillingAccount(tx, owner.accountId)

        const claim = await tx.profileImportJob.updateMany({ where: { id: job.id, status: "READY", expiresAt: { gt: new Date() } }, data: { status: "APPLIED" } })
        if (!claim.count) {
            const current = await tx.profileImportJob.findUniqueOrThrow({ where: { id: job.id } })
            if (current.status === "APPLIED" && current.appliedProfileId === owner.profileId && current.appliedSlug) {
                const applied = await tx.profile.findUnique({ where: { id: owner.profileId }, select: { billingAccountId: true } })
                if (applied?.billingAccountId === owner.accountId) return { profileId: current.appliedProfileId, slug: current.appliedSlug }
                throw new Error("The previously imported profile is no longer available.")
            }
            if (current.expiresAt < new Date()) throw new Error("That import expired. Generate a new one.")
            throw new Error("That import is already being applied.")
        }
        const profile = await tx.profile.findUniqueOrThrow({ where: { id: owner.profileId } })
        if (profile.billingAccountId !== owner.accountId) throw new Error("Profile is no longer on this billing account.")
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
