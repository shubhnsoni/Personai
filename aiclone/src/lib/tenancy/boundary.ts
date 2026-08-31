/**
 * The authorization boundary's OBSERVED permission closure, and the pin that makes it falsifiable.
 *
 * WHY THIS FILE EXISTS. Two harnesses used to "prove" that resolving workspace surfaces does not
 * mutate or leak the permission catalogue like this:
 *
 *     const permissionsBefore = JSON.stringify(PERMISSION_KEYS)
 *     ... exercise the boundary ...
 *     const permissionsAfter = JSON.stringify(PERMISSION_KEYS)
 *     check("... keeps PERMISSION_KEYS byte-identical ...", permissionsBefore === permissionsAfter)
 *
 * `PERMISSION_KEYS` is a frozen module constant. Both names are the same immutable import read twice
 * in one process, so the comparison is `x === x` and cannot take the value false on any run that
 * reaches it. It never tested the thing it claimed to test, because it never looked at the boundary
 * at all: nothing between the two reads could have changed either side.
 *
 * WHAT REPLACES IT. The catalogue is never SERIALISED across the workspace-surface boundary - that is
 * itself an invariant, asserted separately against the real response payload. What DOES cross the
 * authorization boundary is the DECISION the boundary derives from the catalogue: for an actor holding
 * a given role, `PersistedTenancy.requireAccess` either admits or refuses each permission. That
 * decision is observable, it is the thing a caller is actually exposed to, and it is what this module
 * lets a harness capture, canonicalise and pin.
 *
 * HOW THIS AVOIDS BEING A SECOND TAUTOLOGY. Three separate rules:
 *
 *   1. This file MUST NOT import `permissions.ts`. The grant table (`ROLE_PERMISSION_MATRIX`) is the
 *      thing under test; if the expectation were computed from it, widening a role would move the
 *      expectation with the observation and the assertion would go green in lockstep - the same defect
 *      wearing a different hat. `BOUNDARY_CLOSURE_DIGEST` below was derived from the grant table ONCE,
 *      reviewed, and then FROZEN as a literal in a DIFFERENT FILE, so drift now needs two deliberate
 *      edits instead of one.
 *   2. The digest is one-way. A 64-hex-character hash cannot be read back into a permission list, so
 *      it cannot serve as the "actual" side of any comparison. It is only ever an expectation, and the
 *      actual side is always a set of decisions a boundary was observed to make at runtime.
 *   3. A digest alone is opaque and invites the lazy repair - re-pin the hash until the run is green.
 *      `leastPrivilegeViolations` therefore states, in policy terms and over the OBSERVED closure
 *      rather than over any table, what the ordering of roles is allowed to look like. Re-pinning a
 *      hash does not satisfy it: widening a role still has to survive "a lower rung may not hold what
 *      a higher rung lacks", "the least privileged role is read-only", and "destruction lives at the
 *      top of the ladder".
 *
 * NOT AN AUTHORIZATION PATH. Nothing here grants, denies or is consulted by a request. It describes
 * and fingerprints observations. `PersistedTenancy.requireAccess` remains the only enforcement point.
 */
import { createHash } from "node:crypto"

import { PERMISSION_KEYS, type KnownRole, type PermissionKey } from "./types"

/** Versioned so a deliberate change to the canonical FORM is distinguishable from a drifted closure. */
export const BOUNDARY_CLOSURE_CONTRACT = "personai.tenancy.boundary-closure/1"

/**
 * One decision the boundary was OBSERVED to make.
 *
 * `role` and `permission` are plain strings on purpose. An observation must be able to carry a value
 * the boundary was probed with even when that value is not in the catalogue at all - probing a
 * nonexistent permission key is how the non-enumeration property is tested - and a branded type would
 * make that unrepresentable. Well-formedness is checked, not assumed: see `leastPrivilegeViolations`,
 * which rejects any observation straying outside the ladder or the catalogue.
 */
export type ObservedDecision = Readonly<{
    role: string
    permission: string
    allowed: boolean
}>

/**
 * Least privileged first.
 *
 * This is a statement about the ORDERING of roles, which no other file makes. It is deliberately not
 * derived from the grant table: the ordering is the policy, the grant table is one implementation of
 * it, and the point of stating the policy separately is to be able to catch the table disagreeing.
 *
 * Declared as a total `Record<KnownRole, number>` so that adding a role to `KNOWN_ROLES` without
 * placing it on the ladder fails `tsc` rather than silently escaping every invariant below.
 */
const PRIVILEGE_RANK: Readonly<Record<KnownRole, number>> = Object.freeze({
    VIEWER: 0,
    STAFF: 1,
    MANAGER: 2,
    ADMIN: 3,
    OWNER: 4,
})

export const ROLE_PRIVILEGE_LADDER: readonly KnownRole[] = Object.freeze(
    (Object.keys(PRIVILEGE_RANK) as KnownRole[]).sort((left, right) => PRIVILEGE_RANK[left] - PRIVILEGE_RANK[right]),
)

/** Classified by NAME, so the classification is independent of any grant table. */
const READ_ONLY_SUFFIX = /\.read$/u
const DESTRUCTIVE_SUFFIX = /\.(?:delete|remove)$/u

/** How many rungs at the TOP of the ladder may hold a destructive permission. */
const DESTRUCTIVE_LADDER_DEPTH = 2

/** Named so a rename of the key in `PERMISSION_KEYS` breaks this file at compile time. */
const WORKSPACE_DELETE: PermissionKey = "workspace.delete"

function sortedUnique(values: Iterable<string>): readonly string[] {
    return Object.freeze([...new Set(values)].sort())
}

/** The catalogue, derived from the production constant. The expectation side of a coverage check. */
export function catalogueUniverse(): readonly string[] {
    return sortedUnique(PERMISSION_KEYS)
}

/** Every permission the boundary was observed to ADMIT to at least one role. Purely observational. */
export function observedUniverse(observed: readonly ObservedDecision[]): readonly string[] {
    return sortedUnique(observed.filter((decision) => decision.allowed).map((decision) => decision.permission))
}

/** Per role, the permissions the boundary was observed to admit. Purely observational. */
export function observedAllowances(observed: readonly ObservedDecision[]): ReadonlyMap<string, readonly string[]> {
    const byRole = new Map<string, string[]>()
    for (const decision of observed) {
        const admitted = byRole.get(decision.role) ?? []
        if (decision.allowed) admitted.push(decision.permission)
        byRole.set(decision.role, admitted)
    }
    return new Map([...byRole].map(([role, admitted]) => [role, sortedUnique(admitted)]))
}

/**
 * Deterministic text for an observed closure: contract line, then one line per role, roles and
 * permissions sorted, with the REFUSALS listed as well as the admissions.
 *
 * Refusals are included so that changing WHICH pairs were probed changes the text. A closure recorded
 * over a shrunken probe set would otherwise be indistinguishable from one recorded over the full
 * catalogue, and "we stopped asking" would fingerprint the same as "the answer is unchanged".
 */
export function canonicalBoundaryClosure(observed: readonly ObservedDecision[]): string {
    const admitted = new Map<string, Set<string>>()
    const refused = new Map<string, Set<string>>()
    for (const decision of observed) {
        const into = decision.allowed ? admitted : refused
        const opposite = decision.allowed ? refused : admitted
        if (opposite.get(decision.role)?.has(decision.permission)) {
            throw new TypeError(
                `the boundary answered both ways for ${decision.role}/${decision.permission}: `
                + "an observation that contradicts itself cannot be fingerprinted",
            )
        }
        const bucket = into.get(decision.role) ?? new Set<string>()
        bucket.add(decision.permission)
        into.set(decision.role, bucket)
    }

    const roles = sortedUnique([...admitted.keys(), ...refused.keys()])
    const lines = roles.map((role) => {
        const allow = sortedUnique(admitted.get(role) ?? []).join(",")
        const deny = sortedUnique(refused.get(role) ?? []).join(",")
        return `${role}|allow:${allow}|deny:${deny}`
    })
    return [BOUNDARY_CLOSURE_CONTRACT, ...lines].join("\n")
}

export function boundaryClosureDigest(observed: readonly ObservedDecision[]): string {
    return `sha256:${createHash("sha256").update(canonicalBoundaryClosure(observed), "utf8").digest("hex")}`
}

/**
 * The reviewed fingerprint of the closure the authorization boundary is permitted to expose.
 *
 * DERIVED ONCE from `ROLE_PERMISSION_MATRIX` over `PERMISSION_KEYS`, then frozen here. It is NOT
 * recomputed from that table at runtime, which is the whole point: a widening edit to the table now
 * makes an observing harness go RED instead of quietly carrying the expectation along with it.
 *
 * IF THIS GOES RED, the closure the boundary enforces has changed. Re-pinning is the LAST step of a
 * deliberate policy change, not the fix for a surprise - and re-pinning alone will not turn the run
 * green, because `leastPrivilegeViolations` is asserted beside it.
 *
 * Preimage at the time of pinning - 5 roles x 18 permissions = 90 decisions, and every harness that
 * asserts against this digest also PRINTS the canonical text it observed, so the preimage is never
 * something a reader has to take on trust:
 *
 *   personai.tenancy.boundary-closure/1
 *   ADMIN   allow 17 of 18, deny workspace.delete
 *   MANAGER allow 13 of 18, deny location.create, location.delete, membership.remove,
 *                                workspace.delete, workspace.update
 *   OWNER   allow 18 of 18, deny nothing
 *   STAFF   allow  8 of 18
 *   VIEWER  allow  5 of 18 - booking.read, location.read, order.read, profile.read, workspace.read
 */
export const BOUNDARY_CLOSURE_DIGEST = "sha256:bd75a38220b7e834520e028e6059d3e844c983740563fe2e79afe1459be6a31a"

/**
 * Answers ONE question the way the boundary answered it: did an actor holding `role` get through for
 * `permission`? A harness supplies this; nothing in this module knows how the answer is obtained.
 */
export type BoundaryProbe = (role: KnownRole, permission: PermissionKey) => Promise<boolean>

/**
 * Ask the boundary about EVERY rung of the ladder against EVERY permission in the catalogue.
 *
 * Enumerating the pairs here rather than in each harness is deliberate: the digest below is a
 * fingerprint of a specific set of questions, so two harnesses that pin the same digest must have
 * asked the same questions. Written twice, they could drift apart and one of them would be pinning a
 * fingerprint of a smaller interrogation.
 */
export async function observeBoundaryClosure(probe: BoundaryProbe): Promise<readonly ObservedDecision[]> {
    const decisions: ObservedDecision[] = []
    for (const role of ROLE_PRIVILEGE_LADDER) {
        for (const permission of PERMISSION_KEYS) {
            decisions.push(Object.freeze({ role, permission, allowed: await probe(role, permission) }))
        }
    }
    return Object.freeze(decisions)
}

/**
 * Policy violations in an OBSERVED closure, in plain language. Empty means the observation is both
 * well-formed and consistent with the boundary's least-privilege policy.
 *
 * Every rule below reads the OBSERVATION, never the grant table, and every rule is a statement a
 * reviewer can agree or disagree with on its own terms. That is what survives someone re-pinning the
 * digest to silence a red run.
 */
export function leastPrivilegeViolations(observed: readonly ObservedDecision[]): readonly string[] {
    const violations: string[] = []
    const ladder = ROLE_PRIVILEGE_LADDER
    const ladderNames = ladder as readonly string[]
    const catalogue = catalogueUniverse()
    const allowances = observedAllowances(observed)

    // ---- well-formedness: an observation that does not cover the boundary proves nothing ---------
    const missingRoles = ladder.filter((role) => !allowances.has(role))
    if (missingRoles.length > 0) {
        violations.push(
            `no decision was observed for ${missingRoles.join(",")}, so nothing below was tested for `
            + "those roles",
        )
    }
    const strayRoles = [...allowances.keys()].filter((role) => !ladderNames.includes(role))
    if (strayRoles.length > 0) {
        violations.push(`observed role(s) ${strayRoles.join(",")} are not on the privilege ladder`)
    }
    const strayPermissions = sortedUnique(observed.map((decision) => decision.permission))
        .filter((permission) => !catalogue.includes(permission))
    if (strayPermissions.length > 0) {
        violations.push(`observed permission(s) ${strayPermissions.join(",")} are not in the catalogue`)
    }
    const requiredPairs = ladder.length * catalogue.length
    const observedPairs = new Set(observed.map((decision) => `${decision.role}\u0000${decision.permission}`)).size
    if (observedPairs !== requiredPairs) {
        violations.push(
            `the observation decides ${observedPairs} role-permission pairs, but the boundary must `
            + `decide all ${requiredPairs}`,
        )
    }
    if (violations.length > 0) return Object.freeze(violations)

    const admitted = (role: KnownRole): readonly string[] => allowances.get(role) ?? []

    // ---- 1. the ladder is a strictly increasing chain --------------------------------------------
    // A lower rung holding something a higher rung lacks is a widening, whichever end it was edited
    // from, and two rungs with the same closure means one of them is not a privilege level.
    for (let rung = 1; rung < ladder.length; rung += 1) {
        const lower = ladder[rung - 1]
        const higher = ladder[rung]
        const onlyLower = admitted(lower).filter((permission) => !admitted(higher).includes(permission))
        const onlyHigher = admitted(higher).filter((permission) => !admitted(lower).includes(permission))
        if (onlyLower.length > 0) {
            violations.push(
                `${lower} holds ${onlyLower.join(",")}, which the more privileged ${higher} does not`,
            )
        }
        if (onlyHigher.length === 0) {
            violations.push(`${higher} holds nothing beyond ${lower}, so they are not distinct privilege levels`)
        }
    }

    // ---- 2. the least privileged role cannot write ------------------------------------------------
    const bottom = ladder[0]
    const bottomWrites = admitted(bottom).filter((permission) => !READ_ONLY_SUFFIX.test(permission))
    if (bottomWrites.length > 0) {
        violations.push(`the least privileged role ${bottom} holds non-read permission(s) ${bottomWrites.join(",")}`)
    }

    // ---- 3. destruction lives at the top of the ladder --------------------------------------------
    const topRungs = ladder.slice(-DESTRUCTIVE_LADDER_DEPTH) as readonly string[]
    for (const role of ladder) {
        if (topRungs.includes(role)) continue
        const destructive = admitted(role).filter((permission) => DESTRUCTIVE_SUFFIX.test(permission))
        if (destructive.length > 0) {
            violations.push(
                `${role} sits below the top ${DESTRUCTIVE_LADDER_DEPTH} rungs yet holds destructive `
                + `permission(s) ${destructive.join(",")}`,
            )
        }
    }

    // ---- 4. deleting the workspace is the most privileged act there is ----------------------------
    const top = ladder[ladder.length - 1]
    const deleters = ladder.filter((role) => admitted(role).includes(WORKSPACE_DELETE))
    if (deleters.length !== 1 || deleters[0] !== top) {
        violations.push(
            `${WORKSPACE_DELETE} must be held by exactly one role, the most privileged (${top}); `
            + `observed holder(s): ${deleters.join(",") || "none"}`,
        )
    }

    return Object.freeze(violations)
}
