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

/**
 * ASSERTION EVIDENCE. Counted inside the real helper, so the number the gate reads is
 * produced by the same call that decides the verdict. These count assertion CALLS - each
 * loop iteration over a blueprint or engine that calls check is one - never the rendered
 * byte length (populatedBytes) nor the number of blueprints/engines rendered. Not a literal:
 * neuter the helper and the count collapses; fail one assertion and `assertionsPassed` drops
 * below `assertionsRun` while `failures` sets a non-zero exit.
 */
let assertionsRun = 0
let assertionsPassed = 0

function check(name: string, condition: unknown, detail?: string) {
    assertionsRun += 1
    if (!condition) {
        failures.push(detail ? `${name}: ${detail}` : name)
        return
    }
    assertionsPassed += 1
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

/*
 * "marks unused engines honestly" used to be `populated.includes("unused")` against the real
 * registry. That passed only while SOME engine had no blueprint, so Wave H1 broke it by closing the
 * gap: `field-service-v1` was the first blueprint to compose `fieldJobs`, and once every engine had
 * at least one blueprint the word "unused" correctly stopped appearing - the check went red on an
 * improvement, which means it was measuring the gap rather than the badge.
 *
 * Rewritten to prove the badge itself, by rendering the real engine list against a blueprint list
 * with the composing blueprints REMOVED. No cast and no synthetic type is needed: `BusinessEngineId`
 * is a closed union, so inventing an engine id would require one. The real registry is then asserted
 * POSITIVELY - every engine is composed, so nothing is marked unused - and that assertion names any
 * engine that regresses.
 */
const uncomposedEngineIds = engines
    .filter((engine) => !blueprints.some((b) => b.engines.some((e) => e.engineId === engine.id)))
    .map((engine) => engine.id)
check(
    "every engine is composed by at least one blueprint, so nothing is marked unused",
    uncomposedEngineIds.length === 0 && !populated.includes("unused"),
    uncomposedEngineIds.join(", "),
)

// Drop every blueprint that composes fieldJobs, and the badge must say so. This is exactly the
// pre-Wave-H1 situation, reproduced deliberately rather than relied upon.
const withoutFieldJobs = blueprints.filter((blueprint) => !blueprint.engines.some((e) => e.engineId === "fieldJobs"))
const unusedRender = renderToStaticMarkup(
    createElement(BusinessOsShell, { blueprints: withoutFieldJobs, engines }),
)
check(
    "an engine no blueprint composes is marked unused",
    unusedRender.includes("unused"),
    `dropped ${blueprints.length - withoutFieldJobs.length} blueprint(s) that compose fieldJobs`,
)
check(
    "the unused-badge check is not vacuous: at least one blueprint really was dropped",
    withoutFieldJobs.length < blueprints.length,
)

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
report.assertionsRun = assertionsRun
report.assertionsPassed = assertionsPassed

console.log(JSON.stringify(report, null, 2))

// Machine-readable assertion evidence for scripts/gates/run-gates.js. Both numbers come
// from the counters incremented inside check() above, so they cannot claim more than
// actually ran. The GATE-EVIDENCE line must be the WHOLE line and name this file exactly,
// or the driver reports EVIDENCE_IDENTITY_MISMATCH.
console.log(`GATE-EVIDENCE harness=check-business-os-render.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

if (failures.length > 0) process.exitCode = 1
