/**
 * U2/U3: executable proof for the four vertical packs promoted from review-only candidates.
 *
 * This is static and side-effect free. It proves registration, onboarding reachability, role-derived
 * surfaces, capability truth and provider boundaries against the real registries. Set
 * INVERT_ASSERTION=1 to demonstrate that every load-bearing assertion can fail.
 */
import { getBusinessBlueprint, listBusinessBlueprints } from "../../src/lib/business-os/blueprints"
import { businessEngineDescriptors } from "../../src/lib/business-os/engines"
import { validateBusinessBlueprint } from "../../src/lib/business-os/validation"
import {
    getRegisteredVerticalPack,
    getVerticalPackCandidate,
    listRegisteredVerticalPacks,
    listVerticalPackCandidates,
} from "../../src/lib/business-os/vertical-packs"
import {
    CORRESPONDING_BLUEPRINT,
    NEEDS,
    ROLES_WITHOUT_BLUEPRINT,
    correspondingBlueprintId,
    suggestedAddons,
    type NeedId,
    type RoleTemplate,
} from "../../src/lib/onboarding-needs"
import { surfacesFor } from "../../src/lib/surfaces"

const INVERT = process.env.INVERT_ASSERTION === "1"
const failures: string[] = []
let assertionsRun = 0
let assertionsPassed = 0

function check(name: string, condition: unknown, detail = ""): void {
    assertionsRun += 1
    if (condition) {
        assertionsPassed += 1
        return
    }
    failures.push(detail ? `${name}: ${detail}` : name)
}

function checkInvertible(name: string, condition: unknown, detail = ""): void {
    check(name, INVERT ? !condition : condition, detail)
}

const expected = [
    { id: "salon-spa-v1", role: "SALON_SPA", need: "salon" },
    { id: "events-studio-v1", role: "EVENTS_STUDIO", need: "eventStudio" },
    { id: "real-estate-brokerage-v1", role: "REAL_ESTATE_BROKERAGE", need: "estate" },
    { id: "recruitment-agency-v1", role: "RECRUITMENT_AGENCY", need: "recruit" },
] as const satisfies readonly { id: string; role: RoleTemplate; need: NeedId }[]

const packs = listRegisteredVerticalPacks()
const registry = listBusinessBlueprints()
const candidates = listVerticalPackCandidates()
const expectedIds = expected.map((entry) => entry.id)
const packIds = packs.map((pack) => pack.blueprint.id)

checkInvertible("exactly four vertical packs are registered", packs.length === 4, packIds.join(","))
checkInvertible(
    "the registered vertical pack ids are exactly the reviewed four",
    expectedIds.length === 4 && packIds.length === 4 && expectedIds.every((id) => packIds.includes(id)),
    packIds.join(","),
)
checkInvertible("the full blueprint registry is nine established plus four promoted", registry.length === 13, `${registry.length}`)
checkInvertible("exactly two packs remain candidates", candidates.length === 2, `${candidates.length}`)
checkInvertible(
    "the remaining candidate set is home-services plus non-clinical clinic administration",
    candidates.map((candidate) => candidate.blueprint.id).join(",") === "home-services-v1,clinic-practice-v1",
)

const observed: Array<Record<string, unknown>> = []
for (const entry of expected) {
    const pack = getRegisteredVerticalPack(entry.id)
    const blueprint = getBusinessBlueprint(entry.id)
    const need = NEEDS.find((candidate) => candidate.id === entry.need)
    const roleSurfaces = surfacesFor(entry.role)

    checkInvertible(`${entry.id} resolves through the registered pack inventory`, pack !== null)
    checkInvertible(`${entry.id} resolves through the real blueprint registry`, blueprint !== null)
    checkInvertible(`${entry.id} is no longer exposed as an unregistered candidate`, getVerticalPackCandidate(entry.id) === null)
    checkInvertible(`${entry.id} is active`, pack?.blueprint.status === "active" && blueprint?.status === "active")
    checkInvertible(`${entry.id} declares registered true`, pack?.registered === true)
    checkInvertible(`${entry.id} declares active-registered readiness`, pack?.readiness === "active-registered")
    checkInvertible(`${entry.id} validates against the real blueprint contract`, blueprint !== null && validateBusinessBlueprint(blueprint).ok)
    checkInvertible(`${entry.id} maps from ${entry.role}`, CORRESPONDING_BLUEPRINT[entry.role] === entry.id)
    checkInvertible(`${entry.id} resolves through correspondingBlueprintId`, correspondingBlueprintId(entry.role) === entry.id)
    checkInvertible(`${entry.role} is not in the deliberately-unmapped role set`, !ROLES_WITHOUT_BLUEPRINT.includes(entry.role))
    checkInvertible(`${entry.role} has the expected onboarding card`, need?.role === entry.role)
    checkInvertible(`${entry.role} has a non-empty onboarding addon suggestion`, suggestedAddons(entry.role).length > 0)
    checkInvertible(`${entry.role} exposes no businessOs surface implicitly`, !roleSurfaces.includes("businessOs"))
    checkInvertible(
        `${entry.role} resolves exactly the pack's intended public surfaces`,
        pack !== null &&
            [...roleSurfaces].sort().join(",") === [...pack.intendedSurfaces].sort().join(","),
        `role=[${roleSurfaces.join(",")}] pack=[${pack?.intendedSurfaces.join(",") ?? "missing"}]`,
    )

    const unmetRequired: string[] = []
    const falseBacklog: string[] = []
    for (const composition of blueprint?.engines ?? []) {
        const engine = businessEngineDescriptors[composition.engineId]
        if (!engine) {
            unmetRequired.push(`${composition.engineId}:missing`)
            continue
        }
        if (composition.required) {
            for (const id of composition.capabilities) {
                const capability = engine.capabilities.find((candidate) => candidate.id === id)
                if (capability?.maturity !== "available") {
                    unmetRequired.push(`${composition.engineId}:${id}:${capability?.maturity ?? "missing"}`)
                }
            }
        }
        for (const id of composition.plannedCapabilities ?? []) {
            const capability = engine.capabilities.find((candidate) => candidate.id === id)
            if (capability?.maturity === "available") falseBacklog.push(`${composition.engineId}:${id}`)
        }
    }
    checkInvertible(`${entry.id} requires only available capabilities`, unmetRequired.length === 0, unmetRequired.join(","))
    checkInvertible(`${entry.id} does not backlog an already-available capability`, falseBacklog.length === 0, falseBacklog.join(","))

    const workflows = blueprint?.workflows ?? []
    const workflowActions = workflows.flatMap((workflow) => workflow.actions)
    checkInvertible(`${entry.id} declares at least one workflow`, workflows.length > 0)
    checkInvertible(
        `${entry.id} has no notification action`,
        workflowActions.length > 0 && workflowActions.every((action) => action.kind !== "sendNotification"),
    )
    checkInvertible(
        `${entry.id} has no scheduled workflow`,
        workflows.length > 0 && workflows.every((workflow) => workflow.trigger.kind !== "schedule"),
    )
    checkInvertible(`${entry.id} keeps owner-gated provider functions explicit`, (pack?.ownerGated.length ?? 0) > 0)
    checkInvertible(`${entry.id} keeps unsupported functions explicit`, (pack?.unsupported.length ?? 0) > 0)

    observed.push({
        id: entry.id,
        role: entry.role,
        need: need?.id ?? null,
        surfaces: roleSurfaces,
        requiredCapabilityFailures: unmetRequired,
        falseBacklog,
    })
}

const activeBlueprints = registry.filter((blueprint) => blueprint.status === "active")
checkInvertible(
    "every active blueprint is reachable from exactly one onboarding role",
    activeBlueprints.length === 10 && activeBlueprints.every((blueprint) =>
        Object.values(CORRESPONDING_BLUEPRINT).filter((id) => id === blueprint.id).length === 1,
    ),
)

console.log(JSON.stringify({ mode: INVERT ? "INVERTED" : "NORMAL", observed, failures }, null, 2))
console.log(`GATE-EVIDENCE harness=check-activated-vertical-packs.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} activated vertical assertions passed`)
if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the expected proof.")
if (failures.length > 0) process.exit(1)
