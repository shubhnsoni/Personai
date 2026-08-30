/**
 * View re-exports and fetch helper for the workspace-aware SURFACES panel.
 *
 * A per-domain shared module, matching the convention `blueprint-install-shared.ts`,
 * `blueprint-preview-shared.ts` and `operations-shared.ts` already establish: the fetch envelope
 * handling is similar to theirs by design and NOT imported from them, because the error copy is the
 * load-bearing part of each and a shared helper parameterised by a noun would let a caller produce
 * copy describing the wrong object.
 *
 * `WorkspaceSurfaceResolution` is imported from the contract (`src/lib/business-os/workspace-surface-
 * types.ts`) rather than redeclared, per that file's own instruction that the UI must import the same
 * types the runtime returns so the two cannot drift apart.
 *
 * THE TWO FACTS THAT DRIVE THIS MODULE'S COPY
 *
 * `forWorkspace` never falls back to profile surfaces: a workspace with no active installation
 * resolves to an EXPLICITLY EMPTY set with `source: "no-active-blueprint-installation"`. Today that
 * is every workspace in the product, because onboarding creates workspaces and installs nothing. So
 * this module's copy for that source treats it as the ordinary, common answer - never as an error,
 * and never phrased so it could be misread as the workspace being broken or misconfigured.
 *
 * 403 covers a foreign workspace AND a nonexistent workspace, byte-identically, per the tenancy
 * bridge's fail-closed design (see `docs/orchestration/WORKSPACE_SURFACES_DECISION.md`, "Refusals").
 * So the 403 copy below never says "not found" - that would claim to know which of the two happened,
 * which the response deliberately does not reveal.
 */
import type { WorkspaceSurfaceResolution } from "@/lib/business-os/workspace-surface-types"

export type { WorkspaceSurfaceResolution }

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

export class WorkspaceSurfacesRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "WorkspaceSurfacesRequestError"
    }
}

export async function workspaceSurfacesRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new WorkspaceSurfacesRequestError(
            response.status,
            "INVALID_RESPONSE",
            "The server returned an unreadable response.",
        )
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new WorkspaceSurfacesRequestError(
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
 * 403 is a workspace that is not the caller's own AND a workspace that does not exist, byte
 * identically - so this copy never says "not found" for a workspace, and never claims to know which
 * of the two happened. This mirrors `blueprintInstallErrorCopy`'s 403 split for the same reason.
 */
export function workspaceSurfacesErrorCopy(error: unknown): { title: string; description: string; details?: Record<string, unknown> } {
    if (error instanceof WorkspaceSurfacesRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message || "Sign in to see this workspace's surfaces." }
        if (error.status === 403) {
            return {
                title: "Workspace access required",
                description: "This workspace is not yours, so its surfaces cannot be shown here.",
            }
        }
        if (error.status === 400) {
            return {
                title: "Check the details",
                description: error.message || "This request could not be understood.",
                details: error.details,
            }
        }
        if (error.status === 503) {
            return {
                title: "Surfaces are unavailable",
                description: "The surfaces service is not responding right now. Nothing was changed.",
            }
        }
        return { title: "Surfaces could not load", description: error.message }
    }
    return {
        title: "Surfaces could not load",
        description: "An unexpected problem occurred. Nothing was changed.",
    }
}

const SOURCE_LABELS: Readonly<Record<WorkspaceSurfaceResolution["source"], string>> = Object.freeze({
    "active-blueprint-installation": "From this workspace's active blueprint installation",
    "no-active-blueprint-installation": "No blueprint installed",
})

export function sourceLabel(source: WorkspaceSurfaceResolution["source"]): string {
    return SOURCE_LABELS[source]
}

const SURFACE_LABELS: Readonly<Record<string, string>> = Object.freeze({
    home: "Home",
    profile: "Profile",
    inbox: "Inbox",
    leads: "Leads",
    shop: "Shop",
    services: "Services",
    calendar: "Calendar",
    courses: "Courses",
    events: "Events",
    sales: "Sales",
})

/** Turns a surface id into its display label, without inventing a label for one this build never declared. */
export function surfaceLabel(surface: string): string {
    return SURFACE_LABELS[surface] ?? surface
}
