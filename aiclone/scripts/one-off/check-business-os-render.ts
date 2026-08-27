import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { BusinessOsShell } from "../../src/components/business-os/business-os-shell"
import { listBusinessBlueprints, listBusinessEngines } from "../../src/lib/business-os"

/**
 * Renders the Business OS view layer without a Clerk session, to prove it presents the
 * canonical registry rather than mock data, and that the empty state is reachable.
 */

const report: Record<string, unknown> = {}
const failures: string[] = []

function check(name: string, condition: unknown, detail?: string) {
    if (!condition) failures.push(detail ? `${name}: ${detail}` : name)
}

const blueprints = listBusinessBlueprints()
const engines = listBusinessEngines()

const populated = renderToStaticMarkup(
    createElement(BusinessOsShell, { blueprints, engines }),
)
const empty = renderToStaticMarkup(
    createElement(BusinessOsShell, { blueprints: [], engines }),
)

// Real data is on the page.
for (const blueprint of blueprints) {
    check(`renders blueprint ${blueprint.id}`, populated.includes(blueprint.name))
    check(`renders vertical for ${blueprint.id}`, populated.includes(blueprint.vertical))
}
for (const engine of engines) {
    check(`renders engine ${engine.id}`, populated.includes(engine.label))
}
check("renders an approval indicator", populated.includes("needs approval"))
check("renders copilot prompts", populated.includes("Owner copilot prompts"))
check("marks unused engines honestly", populated.includes("unused"))

// Rejected mock strings must not appear.
for (const banned of ["Launch Readiness", "bp-launch", "Client Intake Operating System", "estimatedMinutes"]) {
    check(`does not render rejected mock string ${banned}`, !populated.includes(banned))
}

// Empty state.
check("empty state renders", empty.includes("No blueprints yet"))
check("empty state does not claim blueprints", !empty.includes("Coaching Studio"))

// Responsive layout hooks.
const responsive = ["sm:grid-cols-2", "lg:grid-cols-4", "md:grid-cols-2", "lg:grid-cols-3"]
for (const cls of responsive) {
    check(`layout keeps responsive class ${cls}`, populated.includes(cls))
}

report.rendered = {
    populatedBytes: populated.length,
    emptyBytes: empty.length,
    blueprintsRendered: blueprints.length,
    enginesRendered: engines.length,
    responsiveClassesPresent: responsive.filter((cls) => populated.includes(cls)),
}
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
