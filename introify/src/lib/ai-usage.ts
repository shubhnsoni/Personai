import { aiModeUnits, allowedAiModes, resolveAiMode } from "@/lib/billing/catalog"
import { getProfileBilling, reserveUsage, settleUsage } from "@/lib/billing/service"
import { resolveApiRecipe, type ApiRecipe } from "@/lib/ai-runtime"

export class AiAccessError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

export type AiReservation = {
    id: string
    recipe: ApiRecipe
    customInstructions: boolean
    autoMemory: boolean
}

export async function prepareAiUsage(input: {
    profileId: string
    storedModel?: string | null
    operationKey: string
    actorId?: string
    metadata?: Record<string, unknown>
}): Promise<AiReservation> {
    const billing = await getProfileBilling(input.profileId)
    let mode
    try { mode = resolveAiMode(input.storedModel) }
    catch { throw new AiAccessError(403, "ai_mode_unavailable", "The selected AI mode is unavailable. The business owner can update it in settings.") }
    if (!allowedAiModes(billing.planId).includes(mode)) throw new AiAccessError(403, "ai_mode_not_entitled", "This AI mode is not included in the current plan.")
    const recipe = resolveApiRecipe(mode)
    if (!recipe) throw new AiAccessError(503, "ai_not_configured", "This AI mode is not connected yet. Please contact the business directly.")
    let reservation
    try {
        reservation = await reserveUsage({
            profileId: input.profileId, unit: "AI", amount: aiModeUnits(mode), operationKey: input.operationKey,
            actorId: input.actorId, metadata: { ...input.metadata, mode, provider: recipe.provider, model: recipe.model, recipeVersion: "2026-09-09-v1" },
        })
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("Not enough AI credits.")) throw new AiAccessError(402, "ai_allowance_exhausted", "This business has used its AI allowance. Please use its contact details or booking links; the owner can manage credits in Billing.")
        throw error
    }
    if (!reservation.created || reservation.state !== "RESERVED") throw new AiAccessError(409, "ai_request_already_received", "This request has already been received. Check the conversation before sending it again.")
    return { id: reservation.id, recipe, customInstructions: billing.features.customInstructions, autoMemory: billing.features.autoMemory }
}

export const finishAiUsage = settleUsage

/** Rejections prove no generation was accepted; timeouts and stream failures do not. */
export function providerRejectedWithoutSpend(error: unknown): boolean {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : NaN
    return [400, 401, 403, 404, 413, 422, 429].includes(status)
}
