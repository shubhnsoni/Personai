/**
 * View types and fetch helper for the blueprint preview / onboarding UI.
 *
 * A per-domain shared module, matching the convention `operations-shared.ts` and
 * `inspection-shared.ts` already establish: the fetch envelope handling is similar to theirs by
 * design and NOT imported from them, because the error copy is the load-bearing part of each and a
 * shared helper parameterised by a noun would let a caller produce copy describing the wrong object.
 *
 * `BlueprintSummaryView` and `BlueprintPreviewView` are re-exported from the contract
 * (`src/lib/business-os/preview-types.ts`) rather than redeclared, per that file's own instruction
 * that both the UI and the resolver must import the same types so the UI cannot drift from what the
 * resolver actually returns.
 *
 * UNLIKE inspections, a blueprint id IS meaningfully 404-able: it is a public, static registry key -
 * the same six ids for every tenant - not a tenant-scoped record. Revealing that an id does not exist
 * leaks nothing, so this module's error copy treats 404 as a distinct, ordinary case ("this blueprint
 * does not exist") and never reuses the "you do not have access" copy for it. A 403 still means the
 * workspace is not the caller's own.
 */
import type { BlueprintPreviewView, BlueprintSummaryView } from "@/lib/business-os/preview-types"

export type { BlueprintSummaryView, BlueprintPreviewView }

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

export class BlueprintPreviewRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "BlueprintPreviewRequestError"
    }
}

export async function blueprintPreviewRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new BlueprintPreviewRequestError(
            response.status,
            "INVALID_RESPONSE",
            "The server returned an unreadable response.",
        )
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new BlueprintPreviewRequestError(
            response.status,
            error.code,
            error.message,
            "details" in error ? error.details : undefined,
        )
    }
    return envelope.data
}

export function isAbortError(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A blueprint id is a public static registry key - the same six ids for every tenant - so a missing
 * blueprint is genuinely a 404 and revealing that an id does not exist leaks nothing. This copy must
 * NEVER read as "you do not have access" for a 404; that phrasing is reserved for 403, which still
 * means the workspace is not the caller's own. A 400's `details` are surfaced verbatim because they
 * are the only place a validation failure's specifics live. A 503 states nothing was changed, which a
 * read-only preview can say truthfully.
 */
export function blueprintPreviewErrorCopy(error: unknown): { title: string; description: string; details?: Record<string, unknown> } {
    if (error instanceof BlueprintPreviewRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Workspace access required",
                description: "This workspace is not yours, so its blueprints cannot be previewed here.",
            }
        }
        if (error.status === 404) {
            return {
                title: "Blueprint not found",
                description: "This blueprint id does not exist in the registry. It was not hidden from you - it is not there.",
            }
        }
        if (error.status === 400) {
            return { title: "Check the details", description: error.message, details: error.details }
        }
        if (error.status === 503) {
            return {
                title: "Blueprints are unavailable",
                description: "The blueprint registry is not responding right now. Nothing was changed - this view only reads.",
            }
        }
        return { title: "Blueprint preview could not load", description: error.message }
    }
    return {
        title: "Blueprint preview could not load",
        description: "An unexpected problem occurred. Nothing was changed - this view only reads.",
    }
}

const MATURITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
    planned: "Planned",
    partial: "Partial",
    available: "Available",
})

export function maturityLabel(maturity: string): string {
    return MATURITY_LABELS[maturity] ?? maturity
}

const STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
    draft: "Draft",
    proposed: "Proposed",
    active: "Active",
    deprecated: "Deprecated",
})

export function statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status
}

/** Turns a camelCase key (e.g. from `fieldPacks`) into something readable, without inventing words. */
export function readableKey(key: string): string {
    const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2")
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
