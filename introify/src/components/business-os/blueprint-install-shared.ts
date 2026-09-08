/**
 * View re-exports and fetch helper for the blueprint INSTALLATION UI.
 *
 * A per-domain shared module, matching the convention `blueprint-preview-shared.ts`,
 * `operations-shared.ts` and `inspection-shared.ts` already establish: the fetch envelope handling is
 * similar to theirs by design and NOT imported from them, because the error copy is the load-bearing
 * part of each and a shared helper parameterised by a noun would let a caller produce copy describing
 * the wrong object.
 *
 * Every view type is re-exported from the contract (`src/lib/business-os/install-types.ts`) rather
 * than redeclared, per that file's own instruction that both the UI and the runtime must import the
 * same types so the UI cannot drift from what the runtime actually returns.
 *
 * UNLIKE the blueprint preview module, this module's 403-vs-404 split is narrower than "workspace vs
 * public key": the contract states 403 covers BOTH a foreign workspace AND a nonexistent workspace,
 * byte-identically, and 404 is reserved for an unknown BLUEPRINT id only. So this module's error copy
 * never writes "not found" for a workspace, and its 403 copy makes no claim about which of the two
 * happened - that is the whole point of the identical response.
 */
import type {
    BlueprintInstallationEventKind,
    BlueprintInstallationState,
    InstallPlanView,
    InstallResult,
    InstalledBlueprintView,
    InstalledConfig,
    InstallationEventView,
    WorkspaceInstallationView,
} from "@/lib/business-os/install-types"

export type {
    BlueprintInstallationEventKind,
    BlueprintInstallationState,
    InstallPlanView,
    InstallResult,
    InstalledBlueprintView,
    InstalledConfig,
    InstallationEventView,
    WorkspaceInstallationView,
}

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

export class BlueprintInstallRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "BlueprintInstallRequestError"
    }
}

export async function blueprintInstallRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new BlueprintInstallRequestError(
            response.status,
            "INVALID_RESPONSE",
            "The server returned an unreadable response.",
        )
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new BlueprintInstallRequestError(
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
 * 409 copy. Per the contract there are exactly two causes, and this function tells the two apart from
 * `error.details` when the server includes it, rather than ever collapsing to "already installed" -
 * because a genuine replay is NOT an error at all; it returns `outcome: "replayed"` from the 2xx path
 * and must never reach this function.
 */
export function conflictCopy(error: BlueprintInstallRequestError): { title: string; description: string } {
    const reason = error.details?.["reason"]
    if (reason === "idempotency-key-reused") {
        return {
            title: "This action was already attempted differently",
            description:
                "The retry key from this attempt was already used with different arguments. Generate a new attempt instead of retrying this exact request.",
        }
    }
    if (reason === "active-installation-exists") {
        return {
            title: "An active installation is already in the way",
            description:
                "This workspace already has an active installation of this blueprint version and this was not a retry of the same attempt. Upgrading to a different version supersedes it automatically; installing the same version again will not.",
        }
    }
    return {
        title: "This action conflicts with the current state",
        description:
            error.message ||
            "Either the retry key from this attempt was reused with different arguments, or an active installation of this blueprint version already exists and this was not a retry of the same attempt.",
    }
}

/**
 * 403 is a workspace that is not the caller's own AND a workspace that does not exist, byte
 * identically - so this copy never says "not found" for a workspace, and never claims to know which
 * of the two happened. 404 is reserved for an unknown BLUEPRINT id, a public static registry key, so
 * that copy is a distinct, ordinary "not in the registry" - never "you do not have access".
 */
export function blueprintInstallErrorCopy(error: unknown): { title: string; description: string; details?: Record<string, unknown> } {
    if (error instanceof BlueprintInstallRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Workspace access required",
                description: "This workspace is not yours, so its installation cannot be shown here.",
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
        if (error.status === 409) {
            return conflictCopy(error)
        }
        if (error.status === 503) {
            return {
                title: "Installation is unavailable",
                description: "The installation service is not responding right now. Nothing was changed.",
            }
        }
        return { title: "Installation could not load", description: error.message }
    }
    return {
        title: "Installation could not load",
        description: "An unexpected problem occurred. Nothing was changed.",
    }
}

const EVENT_KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
    INSTALLED: "Installed",
    UPGRADED: "Upgraded",
    SUPERSEDED: "Superseded",
    REMOVED: "Removed",
})

export function eventKindLabel(kind: string): string {
    return EVENT_KIND_LABELS[kind] ?? kind
}

const STATE_LABELS: Readonly<Record<string, string>> = Object.freeze({
    ACTIVE: "Active",
    SUPERSEDED: "Superseded",
    REMOVED: "Removed",
})

export function installationStateLabel(state: string): string {
    return STATE_LABELS[state] ?? state
}

/** Turns a camelCase key (e.g. from `fieldPacks`) into something readable, without inventing words. */
export function readableKey(key: string): string {
    const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2")
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/** ISO 8601 -> a plain, locale-formatted string. Never re-derives elapsed time or "ago" phrasing. */
export function formatOccurredAt(iso: string): string {
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) return iso
    return parsed.toLocaleString()
}

/**
 * Generates one idempotency key per user intent. The caller is responsible for the "reuse on retry"
 * half of the contract - this only supplies a fresh key when a caller decides a NEW intent has begun.
 * Kept as a named seam rather than an inline `crypto.randomUUID()` call so the panel's retry logic
 * (reuse the key already stored in state) is visibly distinct from the one place a new key is minted.
 */
export function newIdempotencyKey(): string {
    return crypto.randomUUID()
}
