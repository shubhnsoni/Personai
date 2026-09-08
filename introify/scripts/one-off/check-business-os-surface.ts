import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
    hasSurface,
    navHrefToSurface,
    surfaceForPath,
    surfacesFor,
    writeExtras,
    extrasOf,
} from "../../src/lib/surfaces"
import {
    assertValidBusinessBlueprint,
    businessEngineDescriptors,
    listBusinessBlueprints,
    listBusinessEngines,
    validateBusinessBlueprint,
} from "../../src/lib/business-os"
import type { BusinessBlueprint } from "../../src/lib/business-os/types"
import { MAX_BLUEPRINT_LIMIT, parseBlueprintId, parseLimit } from "../../src/lib/business-os/api/params"

/**
 * P1-001 / P1-002 verification that does not need a Clerk session.
 *
 * Covers the authorization predicate the page gate uses, the routing maps, the canonical
 * registry, and the absence of the rejected sample-data module.
 */

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * ASSERTION EVIDENCE. Counted inside the real helper, so the number the gate reads
 * is produced by the same call that decides the verdict - there is no separate tally
 * that could drift from the checks. Deliberately not a literal: a hard-coded total
 * would keep printing a healthy count after someone deleted half the assertions.
 * Every call increments `assertionsRun`; only a call whose condition held increments
 * `assertionsPassed`, so a failing assertion necessarily LOWERS the passed count and,
 * through `failures`, sets a non-zero exit. The boolean return is preserved unchanged.
 */
let assertionsRun = 0
let assertionsPassed = 0

function check(name: string, condition: unknown, detail?: string) {
    assertionsRun += 1
    if (!condition) {
        failures.push(detail ? `${name}: ${detail}` : name)
        return false
    }
    assertionsPassed += 1
    return true
}

function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (entry === "node_modules" || entry === ".next" || entry === ".git") continue
        if (statSync(full).isDirectory()) out.push(...walk(full))
        else out.push(full)
    }
    return out
}

// 1. Authorization predicate, which is exactly what requireSurface consults.
// `businessOs` must be off for every role by default, including CUSTOM (the schema
// default for Profile.roleTemplate) and any unrecognised role, which kit() maps to
// CUSTOM. Only an explicit per-profile extras opt-in grants it.
const restaurantDenied = !hasSurface("RESTAURANT", "businessOs", extrasOf(null))
const customDenied = !hasSurface("CUSTOM", "businessOs", extrasOf(null))
const optedIn = extrasOf(writeExtras(null, { surfaces: ["businessOs"] }))
const restaurantOptedInAllowed = hasSurface("RESTAURANT", "businessOs", optedIn)
const shopDenied = !hasSurface("SHOP", "businessOs", extrasOf(null))
const unknownRoleDenied = !hasSurface("NOT_A_ROLE", "businessOs", extrasOf(null))
const nullRoleDenied = !hasSurface(null, "businessOs", extrasOf(null))
const emptyRoleDenied = !hasSurface("", "businessOs", extrasOf(null))
// Opting in must not widen anything else.
const optInDoesNotGrantCourses = !hasSurface("RESTAURANT", "courses", optedIn)

check("RESTAURANT is denied by default", restaurantDenied)
check("SHOP is denied by default", shopDenied)
check("CUSTOM is denied by default", customDenied)
check("an unrecognised role is denied", unknownRoleDenied)
check("a null role is denied", nullRoleDenied)
check("an empty role is denied", emptyRoleDenied)
check("RESTAURANT opted in through extras is allowed", restaurantOptedInAllowed)
check("opting in does not grant unrelated surfaces", optInDoesNotGrantCourses)

report.authorization = {
    restaurantDeniedByDefault: restaurantDenied,
    shopDeniedByDefault: shopDenied,
    customDeniedByDefault: customDenied,
    unknownRoleDenied,
    nullRoleDenied,
    emptyRoleDenied,
    restaurantOptedInAllowed,
    optInDoesNotGrantUnrelatedSurfaces: optInDoesNotGrantCourses,
    restaurantSurfaceCount: surfacesFor("RESTAURANT", extrasOf(null)).length,
}

// 2. Routing maps, used by nav filtering and by surface-for-path checks.
check("navHrefToSurface maps the dashboard href", navHrefToSurface("/dashboard/business-os") === "businessOs")
check("surfaceForPath maps the route", surfaceForPath("/dashboard/business-os") === "businessOs")
check("surfaceForPath maps a nested route", surfaceForPath("/dashboard/business-os/anything") === "businessOs")
check("sales route is unaffected", surfaceForPath("/dashboard/money") === "sales")
report.routing = {
    navHref: navHrefToSurface("/dashboard/business-os"),
    routePath: surfaceForPath("/dashboard/business-os"),
    nestedPath: surfaceForPath("/dashboard/business-os/anything"),
    salesStillSales: surfaceForPath("/dashboard/money"),
}

// 3. Canonical registry.
const blueprints = listBusinessBlueprints()
const engines = listBusinessEngines()
const invalid = blueprints.filter((blueprint) => !validateBusinessBlueprint(blueprint).ok)
const unknownCapabilities = blueprints.flatMap((blueprint) =>
    blueprint.engines.flatMap((composition) => {
        const engine = businessEngineDescriptors[composition.engineId]
        const available = new Set(engine.capabilities.map((capability) => capability.id))
        return composition.capabilities
            .filter((capability) => !available.has(capability))
            .map((capability) => `${blueprint.id}:${composition.engineId}:${capability}`)
    }),
)
check("every blueprint validates", invalid.length === 0, invalid.map((b) => b.id).join(", "))
check("no unknown capability references", unknownCapabilities.length === 0, unknownCapabilities.join(", "))
check("all six engines are declared", engines.length === 6)
check("registry is not empty", blueprints.length > 0)
report.registry = {
    engines: engines.length,
    blueprints: blueprints.length,
    byStatus: blueprints.reduce<Record<string, number>>((acc, blueprint) => {
        acc[blueprint.status] = (acc[blueprint.status] ?? 0) + 1
        return acc
    }, {}),
    enginesComposedAtLeastOnce: new Set(blueprints.flatMap((b) => b.engines.map((e) => e.engineId))).size,
    invalidBlueprints: invalid.length,
    unknownCapabilityReferences: unknownCapabilities.length,
}

// 4. The rejected sample-data module must not exist or be referenced anywhere.
const srcFiles = walk(join(process.cwd(), "src"))
const sampleDataFiles = srcFiles.filter((file) => file.replace(/\\/gu, "/").includes("business-os/ui/sample-data"))
const sampleDataImporters = srcFiles.filter((file) => {
    if (!/\.tsx?$/u.test(file)) return false
    return readFileSync(file, "utf8").includes("business-os/ui/sample-data")
})
check("sample-data module is absent", sampleDataFiles.length === 0, sampleDataFiles.join(", "))
check("nothing imports sample-data", sampleDataImporters.length === 0, sampleDataImporters.join(", "))

// 5. Exactly one handler file per API route path, and every handler enforces access.
// Comparing a filesystem walk against its own Set can never fail, so instead assert the
// exact expected set and that no sibling handler extension shadows it.
const apiDir = join(process.cwd(), "src", "app", "api", "business-os")
const apiFiles = walk(apiDir).map((file) => file.replace(/\\/gu, "/"))
const handlerFiles = apiFiles.filter((file) => /\/route\.(ts|tsx|js|jsx|mjs)$/u.test(file))
const routePaths = handlerFiles.map((file) => file.slice(file.indexOf("/api/business-os")))
const expectedRoutes = [
    "/api/business-os/blueprints/[blueprintId]/route.ts",
    "/api/business-os/blueprints/route.ts",
    // T3-A: the read-only Vertical Candidate Catalog API. GET-only, guarded by
    // requireBusinessOsAccess like its siblings, and it registers nothing - the six
    // candidates it serialises stay unregistered and uninstallable.
    "/api/business-os/vertical-candidates/route.ts",
].sort()
check(
    "exactly the expected route handlers exist",
    JSON.stringify([...routePaths].sort()) === JSON.stringify(expectedRoutes),
    routePaths.join(", "),
)
const byDirectory = new Map<string, number>()
for (const file of handlerFiles) {
    const dir = file.slice(0, file.lastIndexOf("/"))
    byDirectory.set(dir, (byDirectory.get(dir) ?? 0) + 1)
}
const shadowed = [...byDirectory.entries()].filter(([, count]) => count > 1)
check("no directory holds two handler files", shadowed.length === 0, shadowed.map(([dir]) => dir).join(", "))

const unguarded = handlerFiles.filter((file) => {
    const source = readFileSync(file, "utf8")
    return !source.includes("requireBusinessOsAccess")
})
const notDynamic = handlerFiles.filter((file) => !readFileSync(file, "utf8").includes('dynamic = "force-dynamic"'))
check("every handler enforces access", unguarded.length === 0, unguarded.join(", "))
check("every handler is dynamic", notDynamic.length === 0, notDynamic.join(", "))

report.files = {
    apiRoutes: [...routePaths].sort(),
    handlersEnforcingAccess: handlerFiles.length - unguarded.length,
    handlerCount: handlerFiles.length,
    sampleDataFiles: sampleDataFiles.length,
    sampleDataImporters: sampleDataImporters.length,
}

report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures


// 6. Request parameter parsing. The routes authenticate before parsing, so these
// branches are unreachable over HTTP without a Clerk session; assert them directly.
check("limit defaults when absent", parseLimit(null) === MAX_BLUEPRINT_LIMIT)
check("limit accepts a valid value", parseLimit("5") === 5)
check("limit accepts the ceiling", parseLimit(String(MAX_BLUEPRINT_LIMIT)) === MAX_BLUEPRINT_LIMIT)
check("limit rejects zero", parseLimit("0") === null)
check("limit rejects above the ceiling", parseLimit(String(MAX_BLUEPRINT_LIMIT + 1)) === null)
check("limit rejects non-numeric", parseLimit("abc") === null)
check("limit rejects exponent notation", parseLimit("1e1") === null)
check("limit rejects padded input", parseLimit(" 3 ") === null)
check("limit rejects decimals", parseLimit("1.5") === null)
check("limit rejects negatives", parseLimit("-1") === null)

check("blueprint id accepts a real id", parseBlueprintId("coaching-studio-v1") === "coaching-studio-v1")
check("blueprint id rejects malformed percent-encoding", parseBlueprintId("%E0%A4%A") === null)
check("blueprint id rejects uppercase", parseBlueprintId("Coaching") === null)
check("blueprint id rejects too short", parseBlueprintId("ab") === null)
check("blueprint id rejects a leading hyphen", parseBlueprintId("-abc") === null)
check("blueprint id rejects path traversal", parseBlueprintId("../../etc/passwd") === null)
check("blueprint id rejects over-length", parseBlueprintId("a".repeat(81)) === null)

report.paramParsing = {
    limitDefault: parseLimit(null),
    limitRejections: ["0", "51", "abc", "1e1", " 3 ", "1.5", "-1"].filter((v) => parseLimit(v) === null).length,
    blueprintIdRejections: ["%E0%A4%A", "Coaching", "ab", "-abc", "../../etc/passwd"].filter(
        (v) => parseBlueprintId(v) === null,
    ).length,
}

// 7. Negative validation. Every other assertion proves valid input passes; this proves
// invalid input is actually rejected, which is what the load-time throw relies on.
const invalidCases: Array<{ name: string; blueprint: BusinessBlueprint }> = [
    {
        name: "unknown capability",
        blueprint: {
            id: "bad-capability", version: "1.0.0", status: "draft", name: "Bad", vertical: "v",
            summary: "s", engines: [{ engineId: "commerce", capabilities: ["not-a-capability"], required: true }],
            workflows: [], ownerCopilotPrompts: [],
        },
    },
    {
        name: "no engines",
        blueprint: {
            id: "no-engines", version: "1.0.0", status: "draft", name: "Bad", vertical: "v",
            summary: "s", engines: [], workflows: [], ownerCopilotPrompts: [],
        },
    },
    {
        name: "event trigger without an event name",
        blueprint: {
            id: "bad-trigger", version: "1.0.0", status: "draft", name: "Bad", vertical: "v",
            summary: "s", engines: [{ engineId: "commerce", capabilities: ["catalog"], required: true }],
            workflows: [{ id: "w", name: "W", trigger: { kind: "event" }, actions: [{ id: "a", kind: "createTask", label: "A" }] }],
            ownerCopilotPrompts: [],
        },
    },
    {
        name: "required approval without a reason",
        blueprint: {
            id: "bad-approval", version: "1.0.0", status: "draft", name: "Bad", vertical: "v",
            summary: "s", engines: [{ engineId: "commerce", capabilities: ["catalog"], required: true }],
            workflows: [{
                id: "w", name: "W", trigger: { kind: "manual" },
                actions: [{
                    id: "a", kind: "requestApproval", label: "A",
                    approval: { required: true, approverRole: "owner", reason: "   " },
                }],
            }],
            ownerCopilotPrompts: [],
        },
    },
    {
        name: "duplicate workflow ids",
        blueprint: {
            id: "dupe-workflows", version: "1.0.0", status: "draft", name: "Bad", vertical: "v",
            summary: "s", engines: [{ engineId: "commerce", capabilities: ["catalog"], required: true }],
            workflows: [
                { id: "w", name: "W", trigger: { kind: "manual" }, actions: [{ id: "a", kind: "createTask", label: "A" }] },
                { id: "w", name: "W2", trigger: { kind: "manual" }, actions: [{ id: "b", kind: "createTask", label: "B" }] },
            ],
            ownerCopilotPrompts: [],
        },
    },
]

const wronglyAccepted = invalidCases.filter((testCase) => validateBusinessBlueprint(testCase.blueprint).ok)
check("invalid blueprints are rejected", wronglyAccepted.length === 0, wronglyAccepted.map((c) => c.name).join(", "))

let assertThrew = false
try {
    assertValidBusinessBlueprint(invalidCases[0].blueprint)
} catch {
    assertThrew = true
}
check("assertValidBusinessBlueprint throws on invalid input", assertThrew)

report.negativeValidation = {
    cases: invalidCases.length,
    allRejected: wronglyAccepted.length === 0,
    assertThrows: assertThrew,
}

report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures
report.assertionsRun = assertionsRun
report.assertionsPassed = assertionsPassed

console.log(JSON.stringify(report, null, 2))

// Machine-readable assertion evidence for scripts/gates/run-gates.js. Both numbers
// come from the counters incremented inside check() above, so they cannot claim more
// than actually ran. The GATE-EVIDENCE line must be the WHOLE line and name this file
// exactly, or the driver reports EVIDENCE_IDENTITY_MISMATCH.
console.log(`GATE-EVIDENCE harness=check-business-os-surface.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

if (failures.length > 0) process.exitCode = 1
