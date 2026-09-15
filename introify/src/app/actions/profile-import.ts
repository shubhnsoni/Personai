"use server"

import { prisma } from "@/lib/prisma"
import { requireAuthenticatedUser, requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { ensureDefaultBillingAccount, getProfileBilling } from "@/lib/billing/service"
import {
    appliedProfileStillValid,
    applyOwnedProfileImport,
    loadOwnedImportJob,
    runProfileImportGeneration,
    toProfileImportPreview,
    type ProfileImportOwner,
} from "@/lib/profile-import-run"
import type { ProfileBlueprint, ProfileImportActionResult, ProfileImportContext, ProfileImportInput, ProfileImportPreview } from "@/lib/profile-import-contract"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GENERIC_IMPORT_FAILURE = "Generation did not complete. Credits may still be reserved. Use Check saved result before starting a new generation."

function actionError(error: unknown, fallback = GENERIC_IMPORT_FAILURE): { ok: false; error: string } {
    if (error instanceof Error && (error.name === "OwnershipRefusalError" || (error.message && !/prisma|sql|econn|etimedout|digest/i.test(error.message)))) {
        return { ok: false, error: error.message.slice(0, 500) }
    }
    return { ok: false, error: fallback }
}

async function resolveContext(context: ProfileImportContext): Promise<ProfileImportOwner> {
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

export async function generateProfileImport(context: ProfileImportContext, input: ProfileImportInput): Promise<ProfileImportActionResult<{ preview: ProfileImportPreview }>> {
    try {
        return { ok: true, preview: await runProfileImportGeneration(await resolveContext(context), input) }
    } catch (error) {
        return actionError(error)
    }
}

export async function getProfileImport(context: ProfileImportContext, id: string): Promise<ProfileImportActionResult<{ preview: ProfileImportPreview | null }>> {
    try {
        const { userId, accountId, targetProfileId } = await resolveContext(context)
        const job = await loadOwnedImportJob(userId, accountId, id, targetProfileId)
        if (!job) return { ok: true, preview: null }
        if (job.status !== "READY" && job.status !== "APPLIED") return { ok: true, preview: null }
        if (job.status === "APPLIED" && !(await appliedProfileStillValid(job.appliedProfileId, accountId, userId))) return { ok: true, preview: null }
        return { ok: true, preview: toProfileImportPreview(job) }
    } catch (error) {
        return actionError(error, "Could not load that import.")
    }
}

export async function getProfileImportByRequest(context: ProfileImportContext, requestId: string): Promise<ProfileImportActionResult<{ preview: ProfileImportPreview | null }>> {
    try {
        if (typeof requestId !== "string" || !UUID.test(requestId)) throw new Error("Invalid import request.")
        const { userId, accountId, targetProfileId } = await resolveContext(context)
        const job = await prisma.profileImportJob.findUnique({ where: { ownerUserId_requestId: { ownerUserId: userId, requestId } } })
        if (!job || job.billingAccountId !== accountId || job.targetProfileId !== targetProfileId) return { ok: true, preview: null }
        if (job.expiresAt < new Date()) throw new Error("That import expired. Start a new one.")
        if (job.status === "FAILED") throw new Error(job.error || "That import failed.")
        if (job.status !== "READY" && job.status !== "APPLIED") return { ok: true, preview: null }
        if (job.status === "APPLIED" && !(await appliedProfileStillValid(job.appliedProfileId, accountId, userId))) return { ok: true, preview: null }
        return { ok: true, preview: toProfileImportPreview(job) }
    } catch (error) {
        return actionError(error, "No saved result yet.")
    }
}

export async function applyProfileImport(profileId: string, id: string, draft: ProfileBlueprint, options: { overwriteProfile: boolean; applyFeatures: boolean }): Promise<ProfileImportActionResult<{ profileId: string; slug: string }>> {
    try {
        const { actor, profile: claimed } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
        const accountId = claimed.billingAccountId || (await getProfileBilling(claimed.id)).accountId
        return { ok: true, ...(await applyOwnedProfileImport({ userId: actor.userId, accountId, profileId: claimed.id }, id, draft, options)) }
    } catch (error) {
        return actionError(error, "Could not apply the draft.")
    }
}
