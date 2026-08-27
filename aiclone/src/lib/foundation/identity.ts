/**
 * Contact identity resolution.
 *
 * Deterministic merge over ContactSourceRecord[] from disparate existing
 * sources (Profile/User, Booking guest, Order guest, Conversation visitor,
 * CourseEnrollment, Member). No source row is mutated — this module only
 * reads and produces a derived, in-memory ResolvedContact view.
 *
 * MERGE KEY (in priority order — first that both records have and that match wins):
 *   1. Normalized email (lowercased, trimmed). Two records with the same normalized
 *      email are ALWAYS merged into one contact, even if their names differ
 *      ("same email different name" — see AMBIGUOUS_NAME below).
 *   2. Normalized phone (digits only — separators/parens/dashes/leading `+` are stripped;
 *      no country-code inference is attempted beyond that). A record with a phone but no
 *      email merges with another same-phone record.
 *   3. Neither present ("missing email", anonymous guest): no merge key exists, so the
 *      record becomes its own singleton contact with confidence ANONYMOUS. Two anonymous
 *      guest rows are NEVER merged with each other, even if names match — a name alone
 *      is not a reliable identity signal (common names collide across unrelated people).
 *
 * CONTACT ID: deterministic hash of the merge key (`email:<normalized>` or
 * `phone:<normalized>`), or `anon:<sourceKind>:<sourceId>` for anonymous singletons.
 * Same inputs always produce the same contactId — no random ids, no ordering dependency.
 *
 * CONFIDENCE:
 *   - CONFIRMED: all merged sources agree on name (case-insensitively) wherever a name is present.
 *   - PROBABLE: merged by email/phone, sources disagree on name, but the disagreement is
 *     explainable (one source has no name at all — e.g. an Order guest row with only email).
 *   - AMBIGUOUS: merged by email/phone AND two or more sources supply DIFFERENT non-empty
 *     names ("same email different name"). Resolution still merges (email is the stronger
 *     signal) but flags it for human review via `ambiguityReason`.
 *   - ANONYMOUS: no email and no phone on any source in the group (guest with neither).
 *
 * PROFILE SCOPING: profileId is carried through when every merged source agrees on the
 * same profileId. If sources disagree (e.g. the same email booked with two different
 * creators), profileId on the resolved contact is null and the disagreement is recorded
 * in ambiguityReason — cross-profile identity merging is intentionally visible, not silently
 * collapsed into one tenant.
 */

import type { ContactSourceRecord, IdentityConfidence, ResolvedContact } from "./types"

function normalizeEmail(email: string | null): string | null {
    const trimmed = email?.trim().toLowerCase()
    return trimmed ? trimmed : null
}

function normalizePhone(phone: string | null): string | null {
    if (!phone) return null
    const digits = phone.replace(/[\s\-().+]/gu, "")
    return digits ? digits : null
}

function normalizeName(name: string | null): string | null {
    const trimmed = name?.trim()
    return trimmed ? trimmed : null
}

/** FNV-1a — deterministic, dependency-free, stable across Node versions. Not cryptographic; not needed to be. */
function stableHash(input: string): string {
    let hash = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(16).padStart(8, "0")
}

function mergeKeyFor(record: ContactSourceRecord): { key: string; kind: "email" | "phone" } | null {
    const email = normalizeEmail(record.email)
    if (email) return { key: `email:${email}`, kind: "email" }
    const phone = normalizePhone(record.phone)
    if (phone) return { key: `phone:${phone}`, kind: "phone" }
    return null
}

/**
 * Resolves a flat list of source records (already read from adapters, across
 * any mix of sources/profiles) into deduplicated contacts.
 *
 * Total function: every input record ends up attached to exactly one output
 * contact (either merged with others sharing a key, or a singleton).
 */
export function resolveContacts(records: readonly ContactSourceRecord[]): ResolvedContact[] {
    const groups = new Map<string, ContactSourceRecord[]>()
    const anonSingles: ContactSourceRecord[] = []

    for (const record of records) {
        const merge = mergeKeyFor(record)
        if (!merge) {
            anonSingles.push(record)
            continue
        }
        const bucket = groups.get(merge.key)
        if (bucket) bucket.push(record)
        else groups.set(merge.key, [record])
    }

    const resolved: ResolvedContact[] = []

    for (const [key, sources] of groups) {
        // Stable per-group order: earliest observed first, ties broken by sourceId
        // so output is deterministic regardless of input array order.
        const ordered = [...sources].sort((a, b) => {
            const byTime = a.observedAt.getTime() - b.observedAt.getTime()
            if (byTime !== 0) return byTime
            return a.sourceId.localeCompare(b.sourceId)
        })
        resolved.push(buildResolvedContact(key, ordered))
    }

    for (const record of anonSingles) {
        resolved.push({
            contactId: `anon:${record.sourceKind}:${record.sourceId}`,
            profileId: record.profileId,
            displayName: normalizeName(record.name),
            email: null,
            phone: null,
            confidence: "ANONYMOUS",
            sources: [record],
            ambiguityReason: null,
        })
    }

    return resolved
}

function buildResolvedContact(mergeKey: string, ordered: ContactSourceRecord[]): ResolvedContact {
    const names = new Set(ordered.map((r) => normalizeName(r.name)).filter((n): n is string => n !== null))
    const namesLower = new Set([...names].map((n) => n.toLowerCase()))
    const profileIds = new Set(ordered.map((r) => r.profileId))

    let confidence: IdentityConfidence
    let ambiguityReason: string | null = null

    if (namesLower.size <= 1) {
        confidence = "CONFIRMED"
    } else if (names.size >= 2) {
        confidence = "AMBIGUOUS"
        ambiguityReason = `Sources sharing ${mergeKey} disagree on name: ${[...names].join(" / ")}`
    } else {
        confidence = "PROBABLE"
    }

    let profileId: string | null = null
    if (profileIds.size === 1) {
        profileId = [...profileIds][0]
    } else if (profileIds.size > 1) {
        const distinct = [...profileIds].filter((p): p is string => p !== null)
        if (distinct.length > 0) {
            ambiguityReason = ambiguityReason
                ? `${ambiguityReason}; also spans profiles ${distinct.join(", ")}`
                : `Contact spans multiple profiles: ${distinct.join(", ")}`
            if (confidence === "CONFIRMED") confidence = "PROBABLE"
        }
    }

    // Prefer the earliest source's name/email/phone as the canonical display value
    // (ordered[0] is earliest by observedAt after the sort above).
    const displayName = normalizeName(ordered.find((r) => normalizeName(r.name))?.name ?? null)
    const email = normalizeEmail(ordered.find((r) => normalizeEmail(r.email))?.email ?? null)
    const phone = normalizePhone(ordered.find((r) => normalizePhone(r.phone))?.phone ?? null)

    return {
        contactId: `id:${stableHash(mergeKey)}`,
        profileId,
        displayName,
        email,
        phone,
        confidence,
        sources: ordered,
        ambiguityReason,
    }
}
