/**
 * Every ACTIVE blueprint must be reachable from the product's own front door.
 *
 * THE DEFECT THIS EXISTS TO PREVENT, found by measurement rather than imagined: `field-service-v1`
 * shipped ACTIVE, composing a fully built engine with 13 routes and two owner panels, and had no
 * onboarding role at all. An owner who sends people out to jobs could not say so when signing up, so
 * the engine was unreachable from the sign-up flow that is supposed to lead people to it. Nothing
 * failed, because nothing checked.
 *
 * So this harness asserts the correspondence in BOTH directions:
 *
 *   every active blueprint has exactly one onboarding role pointing at it - adding a blueprint
 *   without an onboarding route for it now fails loudly instead of shipping unreachable;
 *
 *   every id in the map names a blueprint that actually exists and is ACTIVE - a typo or a
 *   superseded version fails rather than producing a dead correspondence.
 *
 * It also asserts what the map does NOT claim. There is no installation runtime in this repository,
 * and a reader who assumed choosing a role configures a workspace would be wrong, so the absence is
 * asserted rather than trusted: no route installs a blueprint, and the map's own name and comment say
 * it records a correspondence.
 *
 * No database. Static analysis of the registry and the onboarding tables only.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-onboarding-blueprint-coverage.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { listBusinessBlueprints } from "../../src/lib/business-os/blueprints"
import { businessEngineDescriptors } from "../../src/lib/business-os/engines"
import {
    CORRESPONDING_BLUEPRINT,
    NEEDS,
    ROLES_WITHOUT_BLUEPRINT,
    correspondingBlueprintId,
    suggestedAddons,
} from "../../src/lib/onboarding-needs"

const INVERT = process.env.INVERT_ASSERTION === "1"
const APP_ROOT = join(__dirname, "../..")

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

const blueprints = listBusinessBlueprints()
const active = blueprints.filter((b) => b.status === "active")
const activeIds = new Set(active.map((b) => b.id))
const allIds = new Set(blueprints.map((b) => b.id))

// ---- 1. the registry is what we think it is ------------------------------
check("at least one blueprint is active", active.length > 0, `${active.length} active of ${blueprints.length}`)

// ---- 2. every ACTIVE blueprint is reachable from onboarding ---------------
const mappedIds = new Set(Object.values(CORRESPONDING_BLUEPRINT))
const unreachable = active.filter((b) => !mappedIds.has(b.id)).map((b) => b.id)
checkInvertible(
    "every ACTIVE blueprint has an onboarding role that corresponds to it",
    unreachable.length === 0,
    unreachable.length > 0 ? `unreachable from onboarding: ${unreachable.join(", ")}` : `${active.length}/${active.length} reachable`,
)

// The specific one that was missing. Named explicitly so a future refactor that drops it is loud.
checkInvertible(
    "MEASURED: field-service-v1 is reachable from onboarding, which it was not before this check existed",
    CORRESPONDING_BLUEPRINT.FIELD_SERVICE === "field-service-v1" && activeIds.has("field-service-v1"),
    `FIELD_SERVICE -> ${String(CORRESPONDING_BLUEPRINT.FIELD_SERVICE)}`,
)

// ---- 3. every mapped id is real, active, and not superseded ---------------
const danglingIds = Object.entries(CORRESPONDING_BLUEPRINT).filter(([, id]) => !allIds.has(id as string))
checkInvertible(
    "every blueprint id in the onboarding map names a blueprint that exists",
    danglingIds.length === 0,
    danglingIds.map(([role, id]) => `${role} -> ${String(id)}`).join(", ") || `${mappedIds.size} ids verified`,
)
const inactiveIds = Object.entries(CORRESPONDING_BLUEPRINT).filter(([, id]) => allIds.has(id as string) && !activeIds.has(id as string))
checkInvertible(
    "no onboarding role points at a deprecated or draft blueprint",
    inactiveIds.length === 0,
    inactiveIds.map(([role, id]) => `${role} -> ${String(id)}`).join(", ") || "none",
)

// A superseded version is the trap here: restaurant-venue-v1 and v2 are deprecated and v3 is active,
// so a map pointing at an older one would read as correct and be wrong.
const supersededTargets = Object.entries(CORRESPONDING_BLUEPRINT).filter(([, id]) =>
    blueprints.some((b) => b.supersedes === id),
)
checkInvertible(
    "no onboarding role points at a blueprint that a newer version supersedes",
    supersededTargets.length === 0,
    supersededTargets.map(([role, id]) => `${role} -> ${String(id)} is superseded`).join(", ") || "none",
)

// ---- 4. one role per blueprint, so the correspondence is unambiguous ------
const idCounts = new Map<string, string[]>()
for (const [role, id] of Object.entries(CORRESPONDING_BLUEPRINT)) {
    const list = idCounts.get(id as string) ?? []
    list.push(role)
    idCounts.set(id as string, list)
}
const ambiguous = [...idCounts.entries()].filter(([, roles]) => roles.length > 1)
check(
    "no blueprint is claimed by two onboarding roles",
    ambiguous.length === 0,
    ambiguous.map(([id, roles]) => `${id} <- ${roles.join(" + ")}`).join(", ") || "unambiguous",
)

// ---- 5. every role is accounted for, mapped or explicitly not ------------
const rolesInNeeds = [...new Set(NEEDS.map((n) => n.role))]
const unaccounted = rolesInNeeds.filter(
    (role) => CORRESPONDING_BLUEPRINT[role] === undefined && !ROLES_WITHOUT_BLUEPRINT.includes(role),
)
checkInvertible(
    "every onboarding role is either mapped to a blueprint or listed as deliberately unmapped",
    unaccounted.length === 0,
    unaccounted.join(", ") || `${rolesInNeeds.length} roles accounted for`,
)
// The escape hatch must stay unmapped, or "I'll pick later" would silently mean something.
check("CUSTOM is deliberately unmapped", CORRESPONDING_BLUEPRINT.CUSTOM === undefined && ROLES_WITHOUT_BLUEPRINT.includes("CUSTOM"))

// ---- 6. the new role is wired end to end, not just declared --------------
const fieldNeed = NEEDS.find((n) => n.role === "FIELD_SERVICE")
check("the field-service role has an onboarding need entry", fieldNeed !== undefined, fieldNeed?.id ?? "MISSING")
check(
    "the field-service need reuses an existing Goal rather than inventing an unhandled one",
    fieldNeed?.goal === "TAKE_APPOINTMENTS",
    fieldNeed?.goal ?? "MISSING",
)
check(
    "the field-service role suggests addons, so step 2 of the wizard is not empty for it",
    suggestedAddons("FIELD_SERVICE").length > 0,
    suggestedAddons("FIELD_SERVICE").join(",") || "NONE",
)
check("correspondingBlueprintId resolves the new role", correspondingBlueprintId("FIELD_SERVICE") === "field-service-v1")
check("correspondingBlueprintId returns null rather than guessing for an unknown role", correspondingBlueprintId("NOPE") === null)
check("correspondingBlueprintId returns null for CUSTOM", correspondingBlueprintId("CUSTOM") === null)

// The wizard renders NEEDS by id and looks an icon up per id; a missing icon is a runtime crash, not
// a type error, because Record<NeedId, ...> is satisfied only if the id is in the union.
const wizardSrc = readFileSync(join(APP_ROOT, "src/components/onboarding/onboarding-wizard.tsx"), "utf8")
checkInvertible(
    "the wizard has an icon for the field-service need, so rendering it cannot crash",
    /\bfield:\s*\w+,/.test(wizardSrc),
    /\bfield:\s*(\w+),/.exec(wizardSrc)?.[1] ?? "MISSING",
)

// ---- 7. the map does not claim something that does not exist -------------
// There is no installation runtime. Asserted, not assumed: if one is ever added, this check should be
// the thing that makes somebody revisit the wording here. Route paths identify the blueprint domain;
// a write-method export is the behaviour that makes such a route an installation candidate.
function routeFiles(dir: string): string[] {
    if (!existsSync(dir)) return []
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...routeFiles(full))
        else if (entry === "route.ts") out.push(full)
    }
    return out
}
function exportsBlueprintWriteRoute(filePath: string, source: string): boolean {
    const concernsBlueprints = /(?:^|[\\/])blueprints?(?:[\\/]|$)/i.test(filePath) || /\bblueprint\b/i.test(source)
    const exportsWriteMethod = /\bexport\s+(?:(?:async\s+)?function|const|let|var)\s+(?:POST|PUT|PATCH|DELETE)\b/.test(source)
    return concernsBlueprints && exportsWriteMethod
}

const syntheticInstallRoute = "export async function POST() { return Response.json({ installed: true }) }"
checkInvertible(
    "detector self-test: a synthetic blueprint POST route is identified as an installation candidate",
    exportsBlueprintWriteRoute("/synthetic/blueprints/install/route.ts", syntheticInstallRoute),
)
checkInvertible(
    "detector self-test: a synthetic GET-only blueprint preview route is not an installation candidate",
    !exportsBlueprintWriteRoute("/synthetic/blueprints/preview/route.ts", "export async function GET() { return Response.json({}) }"),
)

// Scanning only src/app/api/platform would leave the likelier hole open: src/app/api/business-os
// ALREADY serves blueprints (a GET list and a GET by id, both behind the businessOs surface), so that
// tree - not platform - is where somebody would most naturally add an install POST. The scan therefore
// covers every API route, and the assertion names the count so a shrinking scan is visible.
const platformRoutes = routeFiles(join(APP_ROOT, "src/app/api"))
checkInvertible(
    "the write-route scan reaches the business-os blueprint tree, not just the platform one",
    platformRoutes.some((f) => /[\\/]api[\\/]business-os[\\/]blueprints[\\/]/.test(f))
        && platformRoutes.some((f) => /[\\/]api[\\/]platform[\\/]blueprints[\\/]/.test(f)),
    `${platformRoutes.length} api routes scanned`,
)
const blueprintWriteRoutes = platformRoutes.filter((filePath) =>
    exportsBlueprintWriteRoute(filePath, readFileSync(filePath, "utf8")),
)
const schemaSrc = readFileSync(join(APP_ROOT, "prisma/schema.prisma"), "utf8")
const installedBlueprintModels = [...schemaSrc.matchAll(/^\s*model\s+(\w*(?:Install|Blueprint)\w*)\b/gim)].map((match) => match[1])

// ---- INSTALLATION NOW EXISTS, so this invariant changed shape ------------
// It used to assert that nothing could install a blueprint, and it was written to go red the moment
// that stopped being true - which it now has: there is a BlueprintInstallation model and a POST route.
// Leaving the old assertion would have meant either deleting it or weakening it, and both would have
// thrown away the reason it existed. So it is REPLACED by the claim that actually matters once
// installation is real, and which is strictly harder to satisfy:
//
//   ONBOARDING MUST HAVE NO PATH TO THE INSTALL RUNTIME.
//
// The old risk was "the map overclaims what it does". The new risk is far worse and entirely concrete:
// "signing up quietly reconfigures a workspace". A single import in onboarding-needs.ts would do it.
checkInvertible(
    "MEASURED: installation now genuinely exists - there is a durable model and a blueprint write route",
    installedBlueprintModels.length > 0 && blueprintWriteRoutes.length > 0,
    `${installedBlueprintModels.join(", ")}; ${blueprintWriteRoutes.map((f) => f.replace(APP_ROOT, "")).join(", ")}`,
)
const needsSrc = readFileSync(join(APP_ROOT, "src/lib/onboarding-needs.ts"), "utf8")
checkInvertible(
    "MEASURED: the onboarding module has NO import of and no reference to the install runtime, so choosing a role cannot install anything",
    !/business-os\/install/.test(needsSrc) &&
        !/BlueprintInstallService|blueprintInstallApi|\.install\s*\(/.test(needsSrc),
    "no install import, no install call",
)
// The whole onboarding tree, not just the map: an install call one file away would be just as bad.
const onboardingFiles = [
    "src/lib/onboarding-needs.ts",
    "src/lib/surfaces.ts",
    "src/app/onboarding/page.tsx",
]
    .map((rel) => join(APP_ROOT, rel))
    .filter((abs) => existsSync(abs))
const onboardingInstallers = onboardingFiles.filter((abs) => {
    const src = readFileSync(abs, "utf8")
    return /business-os\/install|blueprintInstallApi|BlueprintInstallService/.test(src)
})
checkInvertible(
    "MEASURED: nothing on the onboarding path reaches the install runtime",
    onboardingInstallers.length === 0,
    onboardingInstallers.map((f) => f.replace(APP_ROOT, "")).join(", ") ||
        `${onboardingFiles.length} onboarding files checked, none installs`,
)
// And installing must require the STRONGER permission. profile.update is held by MANAGER; installing
// re-terms a whole workspace, so it asks for workspace.update, which only OWNER and ADMIN hold.
const installSharedSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/install-shared.ts"), "utf8")
checkInvertible(
    "MEASURED: the install write path asks for workspace.update, not the profile.update a MANAGER already holds",
    /requireWritableWorkspace[\s\S]*?"workspace\.update"/.test(installSharedSrc),
    "workspace.update on the write path",
)
check(
    "the map still states in the source that it is not an installer",
    /WHAT THIS IS NOT: an installer/.test(needsSrc) && /CORRESPONDING_BLUEPRINT/.test(needsSrc),
)
check(
    "the map's own comment acknowledges that installation now exists, rather than still claiming nothing can install",
    /no longer true/.test(needsSrc) && /workspace\.update/.test(needsSrc),
)
check(
    "the map is not named as though it installs",
    !/INSTALLS_BLUEPRINT|installBlueprint\s*=/.test(needsSrc),
)

const previewTypesSrc = readFileSync(join(APP_ROOT, "src/lib/business-os/preview-types.ts"), "utf8")
const previewView = /export type BlueprintPreviewView = Readonly<\{([\s\S]*?)\n\}>/.exec(previewTypesSrc)?.[1] ?? ""
check(
    "BlueprintPreviewView makes installed an explicit null rather than an optional installed-state object",
    /(?:^|\n)\s*installed\s*:\s*null\s*(?:\n|$)/m.test(previewView),
)
check(
    "BlueprintPreviewView carries a limitations list so callers cannot render a caveat-free preview",
    /(?:^|\n)\s*limitations\s*:\s*readonly\s+string\[\]\s*(?:\n|$)/m.test(previewView),
)

// ---- 8. the blueprint the new role points at is genuinely satisfiable ----
// An active blueprint whose required capabilities are not all available would already fail
// check-capability-contract; asserting it here too ties the onboarding claim to the engine reality,
// because this is the claim an owner acts on when they pick the role.
const fieldBlueprint = active.find((b) => b.id === "field-service-v1")
const unmetRequired: string[] = []
for (const composition of fieldBlueprint?.engines ?? []) {
    const engine = businessEngineDescriptors[composition.engineId]
    if (!engine) {
        unmetRequired.push(`${composition.engineId}: unknown engine`)
        continue
    }
    if (!composition.required) continue
    for (const capabilityId of composition.capabilities) {
        const capability = engine.capabilities.find((c) => c.id === capabilityId)
        if (!capability) unmetRequired.push(`${engine.id}:${capabilityId} undeclared`)
        else if (capability.maturity !== "available") unmetRequired.push(`${engine.id}:${capabilityId} is ${capability.maturity}`)
    }
}
checkInvertible(
    "every capability field-service-v1 REQUIRES is available, so the onboarding choice leads somewhere real",
    fieldBlueprint !== undefined && unmetRequired.length === 0,
    unmetRequired.join(", ") || "all required capabilities available",
)

// ---- report --------------------------------------------------------------
const failed = results.filter((r) => !r.pass)
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
console.log("")
console.log(`${results.length - failed.length}/${results.length} onboarding coverage assertions passed`)
if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
if (failed.length > 0) {
    console.error(`${failed.length} onboarding blueprint coverage assertion(s) FAILED`)
    process.exit(1)
}
console.log("Every active blueprint is reachable from onboarding.")
