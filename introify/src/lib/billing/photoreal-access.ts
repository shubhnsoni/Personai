import { photorealAvailable } from "./config"

export const PHOTOREAL_UNAVAILABLE_MESSAGE = "Photoreal generation is currently unavailable. Your allowance stays in your account."
export type PhotorealAccess = { available: boolean; message: string; plansHref: string }
export function getPhotorealAccess(): PhotorealAccess {
    const available = photorealAvailable()
    return { available, message: available ? "Use an included generation, an eligible Free trial or a purchased pack." : PHOTOREAL_UNAVAILABLE_MESSAGE, plansHref: "/dashboard/billing" }
}
export class PhotorealAccessError extends Error {
    readonly code = "PHOTOREAL_UNAVAILABLE"
    constructor() { super(PHOTOREAL_UNAVAILABLE_MESSAGE); this.name = "PhotorealAccessError" }
}
/** Provider readiness is checked before any reservation; the ledger checks the account entitlement. */
export function requirePhotorealGenerationAccess() {
    if (!photorealAvailable()) throw new PhotorealAccessError()
}
