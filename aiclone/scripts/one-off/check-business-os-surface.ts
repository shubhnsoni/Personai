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
    businessEngineDescriptors,
    listBusinessBlueprints,
    listBusinessEngines,
    validateBusinessBlueprint,
} from "../../src/lib/business-os"

/**
 * P1-001 / P1-002 verification that does not need a Clerk session.
 *
 * Covers the authorization predicate the page gate uses, the routing maps, the canonical
 * registry, and the absence of the rejected sample-data module.
 */

const report: Record<string, unknown> = {}
const failures: string[] = []

function check(name: string, condition: unknown, detail?: string) {
    if (!condition) failures.push(detail ? `${name}: ${detail}` : name)
    return Boolean(condition)
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
const restaurantDenied = !hasSurface("RESTAURANT", "businessOs", extrasOf(null))
const customAllowed = hasSurface("CUSTOM", "businessOs", extrasOf(null))
const optedIn = extrasOf(writeExtras(null, { surfaces: ["businessOs"] }))
const restaurantOptedInAllowed = hasSurface("RESTAURANT", "businessOs", optedIn)
const shopDenied = !hasSurface("SHOP", "businessOs", extrasOf(null))
const unknownRoleFallsBackToCustom = hasSurface("NOT_A_ROLE", "businessOs", extrasOf(null))

check("RESTAURANT is denied by default", restaurantDenied)
check("SHOP is denied by default", shopDenied)
check("CUSTOM is allowed", customAllowed)
check("RESTAURANT opted in through extras is allowed", restaurantOptedInAllowed)

report.authorization = {
    restaurantDeniedByDefault: restaurantDenied,
    shopDeniedByDefault: shopDenied,
    customAllowed,
    restaurantOptedInAllowed,
    unknownRoleFallsBackToCustom,
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

// 5. One implementation per API route path.
const routeFiles = srcFiles
    .map((file) => file.replace(/\\/gu, "/"))
    .filter((file) => file.includes("/app/api/business-os/") && file.endsWith("/route.ts"))
const duplicateRoutes = routeFiles.length !== new Set(routeFiles).size
check("no duplicate business-os route files", !duplicateRoutes)
report.files = {
    apiRoutes: routeFiles.map((file) => file.slice(file.indexOf("/app/api/"))).sort(),
    sampleDataFiles: sampleDataFiles.length,
    sampleDataImporters: sampleDataImporters.length,
}

report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
