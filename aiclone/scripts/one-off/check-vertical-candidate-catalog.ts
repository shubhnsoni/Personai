import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
    VerticalCandidateCatalog,
    engineCompositionFingerprint,
    type VerticalCandidateCatalogState,
} from "../../src/components/business-os/vertical-candidate-catalog"
import { listBusinessBlueprints } from "../../src/lib/business-os"
import { listVerticalPackCandidates } from "../../src/lib/business-os/vertical-packs"
import type { VerticalPackCandidate } from "../../src/lib/business-os/vertical-packs"

/**
 * Verification harness for the READ-ONLY vertical candidate catalog UI.
 *
 * TECHNIQUE. `renderToStaticMarkup` from react-dom/server, which is the technique this repository
 * already uses for view-layer verification - see the sibling `check-business-os-render.ts` and
 * `check-business-os-a11y.ts`, which do exactly this. No DOM, no testing-library and no new
 * dependency: the assertions are made against the real rendered markup string.
 *
 * WHAT IT PROVES, and why each is asserted rather than trusted:
 *
 *   RENDERING - the catalog renders for POPULATED and for EMPTY input, and every field the surface
 *   promises (terminology, engines with capabilities and required/optional, readiness, workflows,
 *   unsupported functions, owner-gated dependencies) actually reaches the markup for every one of
 *   the six candidates.
 *
 *   TRUTHFULNESS - each candidate's own card carries Candidate / not installed / not active, so a
 *   reader who sees one card is told. No candidate id is in `listBusinessBlueprints()`. The markup
 *   contains NO interactive element whatsoever, which is the strongest form of "no install
 *   affordance": there is no button, form, input or link to become one.
 *
 *   INVERTIBILITY - two assertions would otherwise be unfalsifiable, so each is paired with a render
 *   whose expected answer is the OPPOSITE. The alias marker is checked against a home-services
 *   composition deliberately diverged from field-service-v1, where the marker must be ABSENT; the
 *   honest empty-field states are checked against a candidate stripped of its arrays, where they
 *   must be PRESENT. An unconditional marker fails the first; a card that quietly renders nothing
 *   for a missing field fails the second.
 *
 *   ACCESSIBILITY - the rules `check-business-os-a11y.ts` enforces, applied with the same
 *   techniques: no h1 introduced, at least one h2, heading levels that never skip, decorative lucide
 *   icons carrying aria-hidden, and no interactive element without an accessible name. Extended with
 *   a per-candidate heading-shape check, because a global no-skip scan cannot see one h4 becoming an
 *   h5 once another h4 has already been seen.
 *
 *   STATES - loading, empty, unauthorized, forbidden and dependency-error each render their own
 *   honest output, and none of the four non-ready states leaks a candidate id.
 *
 * This harness touches NO database. It renders a server component and reads two in-repo registries.
 */

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * ASSERTION EVIDENCE. Counted inside the real helper, so the number the gate reads is produced by
 * the same call that decides the verdict. These count assertion CALLS - each loop iteration over a
 * candidate, engine, capability, workflow or dependency row that calls check is one - never the
 * rendered byte length, the number of candidates, or the number of markup nodes. Not a literal:
 * neuter the helper and the count collapses; fail one assertion and `assertionsPassed` drops below
 * `assertionsRun` while `failures` sets a non-zero exit.
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

// ---------------------------------------------------------------------------
// Renders. Real candidates, real registry - no fixture stands in for either.
// ---------------------------------------------------------------------------
const candidates = listVerticalPackCandidates()
const registeredBlueprints = listBusinessBlueprints()

function render(state: VerticalCandidateCatalogState): string {
    return renderToStaticMarkup(createElement(VerticalCandidateCatalog, { state }))
}

const populated = render({ kind: "ready", candidates, registeredBlueprints })
const empty = render({ kind: "ready", candidates: [], registeredBlueprints })
const loading = render({ kind: "loading" })
const unauthorized = render({ kind: "unauthorized" })
const forbidden = render({ kind: "forbidden" })
const dependencyError = render({ kind: "dependency-error", detail: "candidate package failed validation at load" })

/** Extracts one candidate's own card, so "per candidate" assertions really are per candidate. */
function articleFor(markup: string, candidateId: string): string | null {
    const match = markup.match(new RegExp(`<article[^>]*data-candidate-id="${candidateId}"[\\s\\S]*?</article>`))
    return match ? match[0] : null
}

/** Strips every HTML tag, so a text assertion cannot be satisfied by an attribute value. */
function textOf(markup: string): string {
    return markup.replace(/<[^>]*>/g, " ")
}

const ALIAS_CANDIDATE_ID = "home-services-v1"
const ALIAS_BASE_ID = "field-service-v1"
const CLINICAL_CANDIDATE_ID = "clinic-practice-v1"
const NON_CLINICAL_CANDIDATE_ID = "salon-spa-v1"

check("the candidate set is the expected six", candidates.length === 6, `found ${candidates.length}`)
check("populated markup is non-trivial", populated.length > 5000, `${populated.length} bytes`)
check("the page title renders", populated.includes("Vertical candidate catalog"))

// ---------------------------------------------------------------------------
// RENDERING - every promised field reaches the markup, per candidate.
// ---------------------------------------------------------------------------
for (const candidate of candidates) {
    const id = candidate.blueprint.id
    const article = articleFor(populated, id)
    check(`renders a card for ${id}`, article !== null)
    if (!article) continue
    const text = textOf(article)

    check(`renders the name of ${id}`, text.includes(candidate.blueprint.name))
    check(`renders the id of ${id}`, text.includes(id))
    check(`renders the vertical of ${id}`, text.includes(candidate.blueprint.vertical))
    check(`renders the summary of ${id}`, text.includes(candidate.blueprint.summary.slice(0, 60)))
    check(`renders the readiness of ${id}`, text.includes(candidate.readiness))
    check(`renders the terminology note of ${id}`, text.includes(candidate.terminologyNote.slice(0, 50)))
    check(
        `renders the execution note of ${id}`,
        text.includes(candidate.ownerWorkflow.executionNote.slice(0, 50)),
    )
    check(
        `renders the proposed onboarding role of ${id}`,
        text.includes(candidate.onboarding.proposedRoleKey),
    )
    check(
        `states that ${id} corresponds to no existing onboarding role`,
        /Corresponds to an existing onboarding role:\s*no/i.test(text),
    )

    // Proposed terminology - every key AND its proposed value.
    const terminology = Object.entries(candidate.proposedTerminology)
    check(`${id} declares terminology to render`, terminology.length > 0)
    for (const [key, value] of terminology) {
        check(`renders terminology ${key} for ${id}`, text.includes(key) && text.includes(value))
    }

    // Engines, with capabilities AND required/optional.
    for (const composition of candidate.blueprint.engines) {
        check(
            `renders engine ${composition.engineId} for ${id}`,
            article.includes(`data-engine="${composition.engineId}"`),
        )
        check(
            `renders required/optional for ${composition.engineId} on ${id}`,
            article.includes(`data-engine-requirement="${composition.required ? "required" : "optional"}"`),
        )
        check(
            `renders the ${composition.required ? "Required" : "Optional"} badge text for ${composition.engineId} on ${id}`,
            text.includes(composition.required ? "Required" : "Optional"),
        )
        for (const capabilityId of composition.capabilities) {
            check(`renders capability ${composition.engineId}:${capabilityId} for ${id}`, text.includes(capabilityId))
        }
        for (const planned of composition.plannedCapabilities ?? []) {
            check(
                `renders planned capability ${planned} as backlog for ${id}`,
                text.includes(planned) && /Backlog, not composed and not claimed/.test(text),
            )
        }
    }

    // Workflows.
    check(`${id} declares workflows to render`, candidate.blueprint.workflows.length > 0)
    for (const workflow of candidate.blueprint.workflows) {
        check(`renders workflow ${workflow.id} for ${id}`, text.includes(workflow.id) && text.includes(workflow.name))
        for (const action of workflow.actions) {
            check(`renders workflow action ${action.id} for ${id}`, text.includes(action.label))
        }
    }
    for (const gate of candidate.ownerWorkflow.approvalGates) {
        check(`renders approval gate for ${id}`, text.includes(gate))
    }

    // Unsupported functions.
    check(`${id} declares unsupported functions to render`, candidate.unsupported.length > 0)
    for (const entry of candidate.unsupported) {
        check(
            `renders unsupported ${entry.id} for ${id}`,
            article.includes(`data-unsupported="${entry.id}"`) && text.includes(entry.label),
        )
    }

    // Owner-gated dependencies, with their boundary named.
    check(`${id} declares owner-gated functions to render`, candidate.ownerGated.length > 0)
    for (const entry of candidate.ownerGated) {
        check(
            `renders owner-gated ${entry.id} for ${id}`,
            article.includes(`data-owner-gated="${entry.id}"`) && text.includes(entry.label),
        )
        check(
            `names the boundary of ${entry.id} on ${id}`,
            entry.boundary === "owner-gated"
                ? text.includes("Owner-gated")
                : text.includes("Inert - nothing leaves the system"),
        )
    }
}

// ---------------------------------------------------------------------------
// TRUTHFULNESS - the labels, the registry, and the absence of any affordance.
// ---------------------------------------------------------------------------
for (const candidate of candidates) {
    const id = candidate.blueprint.id
    const article = articleFor(populated, id)
    if (!article) {
        check(`truth labels for ${id}`, false, "card missing")
        continue
    }
    const text = textOf(article)
    // Asserted inside the truth-label GROUP, not anywhere on the card: the word "candidate" appears
    // in ordinary prose all over these descriptors, so a card-wide match would pass even with every
    // label deleted. This is the assertion that removing a label has to fail.
    const group = article.match(new RegExp(`<div[^>]*data-truth-labels="${id}"[\\s\\S]*?</div>`))
    check(`${id} card carries its truth-label group`, group !== null)
    const groupText = group ? textOf(group[0]) : ""
    check(`${id} is labelled "Candidate"`, /\bCandidate\b/.test(groupText), groupText)
    check(`${id} is labelled "Not installed"`, /\bNot installed\b/i.test(groupText), groupText)
    check(`${id} is labelled "Not active"`, /\bNot active\b/i.test(groupText), groupText)
    check(
        `${id} card states it is absent from the blueprint registry`,
        /In the blueprint registry/.test(text) && !/PRESENT - see conflict above/.test(text),
    )
    check(
        `${id} is genuinely absent from listBusinessBlueprints()`,
        !registeredBlueprints.some((blueprint) => blueprint.id === id),
    )
    check(`${id} card raises no registry conflict`, !/REGISTRY CONFLICT/.test(text))
}

// No install/activate affordance of any kind. Absence of the tags first, because a mutation-shaped
// regression is a real <button>, and absence of the words second, because copy can imply an action
// that no element performs.
for (const tag of ["<button", "<form", "<input", "<select", "<textarea", "<a ", "<a>"]) {
    check(`markup contains no ${tag} element`, !populated.includes(tag))
}
for (const attribute of ['type="submit"', "href=", "onclick", "onsubmit", 'role="button"', "formaction"]) {
    check(`markup contains no ${attribute}`, !populated.toLowerCase().includes(attribute.toLowerCase()))
}
const interactiveTags = [...populated.matchAll(/<(button|a|input|select|textarea|form)\b/g)]
check(
    "the rendered catalog contains zero interactive elements",
    interactiveTags.length === 0,
    `${interactiveTags.length} found: ${interactiveTags.map((m) => m[1]).join(", ")}`,
)
// Activation phrasing: an imperative aimed at a candidate, or an element whose ENTIRE visible text
// is an activation verb - which is what a control label looks like. Anchored so ordinary prose that
// merely contains one of these words cannot satisfy it: an integration note beginning
// "install-types.ts already names ClinicConfig" is a filename, not an affordance, and the page's own
// disclaimers ("Not installed", "no install, activate or enable control") must not match either.
for (const pattern of [
    /\b(install|activate|enable|deploy|provision|switch on|turn on)\s+(this|it|now|candidate|pack|vertical|workspace|blueprint)/i,
    />\s*(install|activate|enable|deploy|get started|turn on|add to workspace)\s*(<|$)/i,
    /\b(one[- ]click|click to (install|activate|enable))\b/i,
]) {
    check(`markup contains no activation affordance matching ${pattern.source.slice(0, 40)}`, !pattern.test(populated))
}

// No fabricated customer or operational data. There is no figure to render for something that was
// never installed, so a number next to an operational noun, or any currency amount, is a fabrication.
const populatedText = textOf(populated)
for (const pattern of [
    /[$£€₹]\s?\d/,
    /\b\d[\d,.]*\s*(clients?|customers?|bookings?|appointments?|orders?|patients?|guests?|visits?|leads?|jobs?|revenue|sales)\b/i,
    /\b(revenue|turnover|MRR|ARR)\b\s*[:=]/i,
]) {
    check(`markup fabricates no operational figure matching ${pattern.source.slice(0, 40)}`, !pattern.test(populatedText))
}
check(
    "the page states plainly that it shows no operational figures",
    /No customer, booking, revenue or usage figure appears anywhere on this page/.test(populatedText),
)

// Messages, deposits, payments and external providers - never available.
const statusMatches = [...populated.matchAll(/data-dependency-status="([^"]+)"/g)].map((m) => m[1])
check(
    "every dependency row carries a status",
    statusMatches.length === candidates.length * 4,
    `expected ${candidates.length * 4}, found ${statusMatches.length}`,
)
const badStatuses = statusMatches.filter((status) => status !== "unavailable" && status !== "owner-gated")
check(
    "no dependency is ever rendered as available",
    badStatuses.length === 0,
    `found: ${[...new Set(badStatuses)].join(", ")}`,
)
for (const candidate of candidates) {
    const article = articleFor(populated, candidate.blueprint.id)
    if (!article) continue
    for (const dependency of ["messages", "deposits", "payments", "providers"]) {
        const row = article.match(new RegExp(`<li[^>]*data-dependency="${dependency}"[\\s\\S]*?</li>`))
        check(`${candidate.blueprint.id} renders a ${dependency} dependency row`, row !== null)
        if (!row) continue
        const rowText = textOf(row[0])
        check(
            `${candidate.blueprint.id} ${dependency} reads as unavailable or owner-gated`,
            /\b(Unavailable|Owner-gated)\b/.test(rowText),
            rowText.slice(0, 120),
        )
        // "Unavailable" contains "available", so the negative is checked with that word removed
        // first - otherwise the assertion would pass on the wrong reason or fail on the right one.
        check(
            `${candidate.blueprint.id} ${dependency} never claims availability`,
            !/\bavailable\b/i.test(rowText.replace(/unavailable/gi, "")),
            rowText.slice(0, 120),
        )
    }
}

// ---------------------------------------------------------------------------
// ALIAS MARKER - present only while the engine fingerprints genuinely match.
// ---------------------------------------------------------------------------
const aliasCandidate = candidates.find((candidate) => candidate.blueprint.id === ALIAS_CANDIDATE_ID) ?? null
const aliasBase = registeredBlueprints.find((blueprint) => blueprint.id === ALIAS_BASE_ID) ?? null
check(`${ALIAS_CANDIDATE_ID} is in the candidate set`, aliasCandidate !== null)
check(`${ALIAS_BASE_ID} is a registered blueprint`, aliasBase !== null)
check(`${ALIAS_BASE_ID} is active`, aliasBase?.status === "active", aliasBase?.status)

if (aliasCandidate && aliasBase) {
    const candidateFingerprint = engineCompositionFingerprint(aliasCandidate.blueprint.engines)
    const baseFingerprint = engineCompositionFingerprint(aliasBase.engines)
    check(
        "the two engine fingerprints genuinely match today, so the marker is expected",
        candidateFingerprint === baseFingerprint,
        `${candidateFingerprint} vs ${baseFingerprint}`,
    )

    const aliasArticle = articleFor(populated, ALIAS_CANDIDATE_ID)
    check(`${ALIAS_CANDIDATE_ID} card is present`, aliasArticle !== null)
    if (aliasArticle) {
        check(
            "the alias marker is rendered while fingerprints match",
            aliasArticle.includes(`data-alias-of="${ALIAS_BASE_ID}"`),
        )
        check(
            "the alias marker names the base blueprint in visible text",
            new RegExp(`Alias / fold candidate for ${ALIAS_BASE_ID}`).test(textOf(aliasArticle)),
        )
        check("the alias marker shows the fingerprint it matched on", aliasArticle.includes(candidateFingerprint))
        check("the matching card carries no divergence note", !aliasArticle.includes("data-alias-diverged"))
    }

    // INVERTIBILITY. Diverge the candidate's composition and the marker must DISAPPEAR. This is what
    // an unconditional marker fails: it would still be present here.
    const divergedCandidate: VerticalPackCandidate = {
        ...aliasCandidate,
        blueprint: {
            ...aliasCandidate.blueprint,
            engines: aliasCandidate.blueprint.engines
                .filter((engine) => engine.engineId === "fieldJobs")
                .map((engine) => ({ ...engine, capabilities: [...engine.capabilities, "assets"] })),
        },
    }
    check(
        "the diverged fixture really does differ from the base",
        engineCompositionFingerprint(divergedCandidate.blueprint.engines) !== baseFingerprint,
    )
    const divergedMarkup = render({
        kind: "ready",
        candidates: [divergedCandidate],
        registeredBlueprints,
    })
    const divergedArticle = articleFor(divergedMarkup, ALIAS_CANDIDATE_ID)
    check("the diverged card renders", divergedArticle !== null)
    if (divergedArticle) {
        check(
            "the alias marker DISAPPEARS once the fingerprints diverge",
            !divergedArticle.includes(`data-alias-of="${ALIAS_BASE_ID}"`),
        )
        check(
            "a divergence note replaces it",
            divergedArticle.includes(`data-alias-diverged="${ALIAS_BASE_ID}"`) &&
                /no longer match/i.test(textOf(divergedArticle)),
        )
    }

    // The claim is also specific: no other candidate is presented as an alias of anything.
    for (const candidate of candidates.filter((entry) => entry.blueprint.id !== ALIAS_CANDIDATE_ID)) {
        const article = articleFor(populated, candidate.blueprint.id)
        check(
            `${candidate.blueprint.id} is not presented as an alias`,
            article !== null && !article.includes("data-alias-of=") && !article.includes("data-alias-diverged="),
        )
    }
}

// ---------------------------------------------------------------------------
// CLINIC PRACTICE - the non-clinical boundary, prominent rather than buried.
// ---------------------------------------------------------------------------
const clinicArticle = articleFor(populated, CLINICAL_CANDIDATE_ID)
const clinicCandidate = candidates.find((candidate) => candidate.blueprint.id === CLINICAL_CANDIDATE_ID) ?? null
check(`${CLINICAL_CANDIDATE_ID} card is present`, clinicArticle !== null)
check(`${CLINICAL_CANDIDATE_ID} is in the candidate set`, clinicCandidate !== null)
if (clinicArticle && clinicCandidate) {
    const clinicText = textOf(clinicArticle)
    check(
        "the non-clinical boundary block is rendered",
        clinicArticle.includes(`data-clinical-boundary="${CLINICAL_CANDIDATE_ID}"`),
    )
    check("the boundary is headed as non-clinical", /Non-clinical boundary: administration only/.test(clinicText))
    check(
        "the boundary states that no health information is held",
        /holds no health information/i.test(clinicText),
    )
    check("the boundary states it has no role in emergency care", /emergency care/i.test(clinicText))
    // PROMINENCE. It must precede the detail sections, not sit under them.
    const boundaryAt = clinicArticle.indexOf("data-clinical-boundary=")
    const enginesAt = clinicArticle.indexOf("Engines and capabilities")
    const unsupportedAt = clinicArticle.indexOf("Functions this candidate does not provide")
    check(
        "the boundary appears before the engine detail, so it is not buried",
        boundaryAt > -1 && enginesAt > -1 && boundaryAt < enginesAt,
        `boundary@${boundaryAt} engines@${enginesAt}`,
    )
    check(
        "the boundary appears before the unsupported list, so it is not only in the fine print",
        boundaryAt > -1 && unsupportedAt > -1 && boundaryAt < unsupportedAt,
        `boundary@${boundaryAt} unsupported@${unsupportedAt}`,
    )
    // Every clinical exclusion the descriptor declares must be on the card.
    for (const entry of clinicCandidate.unsupported.filter((item) =>
        /diagnos|prescri|clinical|medical record|health information|triage|emergency|treatment advice/i.test(
            `${item.label} ${item.reason}`,
        ),
    )) {
        check(`the boundary lists the exclusion ${entry.id}`, clinicText.includes(entry.label))
    }
}
// Non-vacuous: a candidate with no clinical exclusions must NOT get the block.
const nonClinicalArticle = articleFor(populated, NON_CLINICAL_CANDIDATE_ID)
check(`${NON_CLINICAL_CANDIDATE_ID} card is present`, nonClinicalArticle !== null)
check(
    "the boundary block is specific to the candidate that declares it",
    nonClinicalArticle !== null && !nonClinicalArticle.includes("data-clinical-boundary="),
)

// ---------------------------------------------------------------------------
// HONEST EMPTY FIELDS - invertibility for the "never a plausible number" rule.
// A candidate stripped of its arrays must say so, field by field.
// ---------------------------------------------------------------------------
if (candidates.length > 0) {
    const stripped: VerticalPackCandidate = {
        ...candidates[0],
        blueprint: { ...candidates[0].blueprint, workflows: [] },
        proposedTerminology: {},
        intendedSurfaces: [],
        onboarding: { ...candidates[0].onboarding, steps: [], requiredOwnerDecisions: [] },
        ownerWorkflow: { ...candidates[0].ownerWorkflow, approvalGates: [] },
        dailyOpportunities: [],
        unsupported: [],
        ownerGated: [],
        integrationNotes: [],
    }
    const strippedMarkup = render({ kind: "ready", candidates: [stripped], registeredBlueprints })
    const strippedText = textOf(strippedMarkup)
    for (const expected of [
        "No terminology is proposed by this candidate.",
        "No workflow is declared by this candidate.",
        "No approval gate is declared by this candidate.",
        "No owner-gated function is declared by this candidate.",
        "No unsupported function is declared by this candidate.",
        "No onboarding step is declared by this candidate.",
        "No owner decision is recorded as required by this candidate.",
        "No daily question is declared by this candidate.",
        "No surface is intended by this candidate.",
        "No integration note is recorded for this candidate.",
    ]) {
        check(`an empty field renders its honest empty state: "${expected.slice(0, 34)}..."`, strippedText.includes(expected))
    }
    // Even stripped bare, the truth labels and the never-available rule still hold.
    check("a stripped candidate still carries its truth labels", /not installed/i.test(strippedText) && /not active/i.test(strippedText))
    const strippedStatuses = [...strippedMarkup.matchAll(/data-dependency-status="([^"]+)"/g)].map((m) => m[1])
    check(
        "a stripped candidate's dependencies still default to unavailable, never available",
        strippedStatuses.length === 4 && strippedStatuses.every((status) => status === "unavailable"),
        strippedStatuses.join(", "),
    )
}

// ---------------------------------------------------------------------------
// ACCESSIBILITY - the rules check-business-os-a11y.ts enforces, same techniques.
// ---------------------------------------------------------------------------
check("does not introduce its own <h1>", !/<h1[ >]/.test(populated))
check("has at least one <h2> from PageHeader", /<h2[ >]/.test(populated))
check("has section-level <h3> headings", /<h3[ >]/.test(populated))
check("has candidate-section <h4> headings", /<h4[ >]/.test(populated))

const headingSequence = [...populated.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]))
const skippedHeadingLevels: string[] = []
let maxSeen = 0
for (const level of headingSequence) {
    if (level > maxSeen + 1 && maxSeen !== 0) skippedHeadingLevels.push(`h${maxSeen} -> h${level}`)
    maxSeen = Math.max(maxSeen, level)
}
check(
    "heading levels never skip a level",
    headingSequence.length > 0 && skippedHeadingLevels.length === 0,
    headingSequence.length === 0
        ? "no headings were found at all, so heading order proves nothing"
        : `skips: ${skippedHeadingLevels.join(", ") || "none"}`,
)
// A global monotonic scan cannot see ONE h4 becoming an h5 after another h4 has been seen, so each
// card's own heading shape is pinned: the candidate name is h3 and every section inside it is h4.
for (const candidate of candidates) {
    const article = articleFor(populated, candidate.blueprint.id)
    if (!article) continue
    const levels = [...article.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]))
    check(`${candidate.blueprint.id} card has headings to check`, levels.length > 1, `${levels.length} found`)
    check(
        `${candidate.blueprint.id} card starts at h3 and uses only h4 below it`,
        levels[0] === 3 && levels.slice(1).every((level) => level === 4),
        `sequence was ${levels.join(",")}`,
    )
}
const emptyHeadings = [...populated.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].filter(
    ([, , inner]) => !/[A-Za-z0-9]/.test(inner.replace(/<[^>]*>/g, "")),
)
check("every heading has a non-empty accessible name", emptyHeadings.length === 0, `${emptyHeadings.length} empty`)

// Regions named by aria-labelledby must point at an id that exists, or the name is a dangling
// reference that assistive tech announces as nothing.
const labelledBy = [...populated.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1])
check("regions are named with aria-labelledby", labelledBy.length > 0, `${labelledBy.length} found`)
const danglingLabels = labelledBy.filter((id) => !populated.includes(`id="${id}"`))
check(
    "every aria-labelledby target id exists in the markup",
    danglingLabels.length === 0,
    `${danglingLabels.length} dangling: ${danglingLabels.slice(0, 3).join(", ")}`,
)

const iconTags = [...populated.matchAll(/<svg[^>]*class="[^"]*lucide[^"]*"[^>]*>/g)]
check("lucide icons found to check", iconTags.length > 0, `${iconTags.length} found`)
const unlabelledIcons = iconTags.filter((m) => !/aria-hidden="true"/.test(m[0]))
check(
    "all decorative lucide icons carry aria-hidden",
    unlabelledIcons.length === 0,
    `${unlabelledIcons.length} icon(s) missing aria-hidden`,
)
// The a11y rule as check-business-os-a11y.ts states it. Here it is satisfied by there being no
// interactive element at all, which is asserted positively above rather than assumed.
const namedInteractive = [...populated.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)].filter(([, , inner]) => {
    const hasVisibleText = /[A-Za-z0-9]/.test(inner.replace(/<[^>]*>/g, ""))
    return !hasVisibleText && !/aria-label="[^"]+"/.test(inner)
})
check("no interactive control lacks an accessible name", namedInteractive.length === 0)
for (const cls of ["sm:grid-cols-2", "lg:grid-cols-3"]) {
    check(`layout keeps responsive class ${cls}`, populated.includes(cls))
}

// ---------------------------------------------------------------------------
// STATES - each renders its own honest output, and none of the four non-ready
// states leaks a candidate id.
// ---------------------------------------------------------------------------
check("loading marks itself busy for assistive tech", loading.includes('aria-busy="true"'))
check("loading announces itself politely", loading.includes('aria-live="polite"'))
check("loading carries a screen-reader label", /sr-only/.test(loading) && /Loading vertical candidates/.test(loading))
check("loading renders a structural skeleton, not just a spinner", loading.includes('data-slot="skeleton"'))
check("loading claims no candidate", !/data-candidate-id=/.test(loading))

check("empty state says no candidates are declared", empty.includes("No vertical candidates are declared"))
check("empty state states that nothing is shown in their place", /nothing is shown in its place|no example, sample or placeholder/i.test(empty))
check("empty state renders no candidate card", !/data-candidate-id=/.test(empty))
check("empty state is not an error", !/role="alert"/.test(empty))

check("unauthorized state says the reader is not signed in", /not signed in/i.test(textOf(unauthorized)))
check("unauthorized state is announced as an alert", unauthorized.includes('role="alert"'))
check("unauthorized state lists no candidate", !/data-candidate-id=/.test(unauthorized))

check("forbidden state names the missing surface", /does not include the Business OS surface/i.test(textOf(forbidden)))
check("forbidden state is announced as an alert", forbidden.includes('role="alert"'))
check("forbidden state lists no candidate", !/data-candidate-id=/.test(forbidden))
check("forbidden state states nothing was changed", /Nothing was changed/.test(textOf(forbidden)))

check(
    "dependency-error state says the descriptors could not be read",
    /could not be read/i.test(textOf(dependencyError)),
)
check("dependency-error state is announced as an alert", dependencyError.includes('role="alert"'))
check("dependency-error state lists no candidate", !/data-candidate-id=/.test(dependencyError))
check("dependency-error state states nothing was changed", /Nothing was changed/.test(textOf(dependencyError)))
check(
    "dependency-error state surfaces the detail it was given",
    dependencyError.includes("candidate package failed validation at load"),
)
// No state may grow an affordance either.
for (const [name, markup] of Object.entries({ empty, loading, unauthorized, forbidden, dependencyError })) {
    check(`the ${name} state contains no interactive element`, !/<(button|a|input|select|textarea|form)\b/.test(markup))
}

report.rendered = {
    populatedBytes: populated.length,
    emptyBytes: empty.length,
    candidatesRendered: candidates.length,
    registeredBlueprints: registeredBlueprints.length,
    interactiveElements: interactiveTags.length,
    dependencyRows: statusMatches.length,
    dependencyStatuses: [...new Set(statusMatches)],
    headingSequence: headingSequence.join(","),
    lucideIcons: iconTags.length,
    ariaLabelledByTargets: labelledBy.length,
}
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures
report.assertionsRun = assertionsRun
report.assertionsPassed = assertionsPassed

console.log(JSON.stringify(report, null, 2))

// Machine-readable assertion evidence for scripts/gates/run-gates.js. Both numbers come from the
// counters incremented inside check() above, so they cannot claim more than actually ran. The
// GATE-EVIDENCE line must be the WHOLE line and name this file exactly.
console.log(`GATE-EVIDENCE harness=check-vertical-candidate-catalog.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

if (failures.length > 0) process.exitCode = 1
