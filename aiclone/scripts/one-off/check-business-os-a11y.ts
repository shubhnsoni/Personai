import { readFileSync } from "node:fs"
import { join } from "node:path"

import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

import { BusinessOsShell } from "../../src/components/business-os/business-os-shell"
import { listBusinessBlueprints, listBusinessEngines } from "../../src/lib/business-os"

/**
 * Deterministic a11y regression harness for the Business OS UI (slot 4 owned
 * paths only). No DOM/testing-library dependency is installed in this shared
 * worktree, so this asserts against the static-rendered markup string with
 * targeted regexes — enough to catch the specific reviewer findings this
 * package fixes and to guard against regressing them later.
 *
 * Deliberately does NOT touch src/lib/business-os/** or the sibling
 * check-business-os-surface.ts / check-business-os-render.ts harnesses.
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

// ---------------------------------------------------------------------------
// Finding 1 — false affordance: owner-copilot prompts must not be styled as
// buttons while being non-interactive. There must be no <span> carrying a
// pill/button-shaped class (rounded-full border ...) in that block, and the
// prompts must render as plain list text with an explicit "not interactive"
// label.
// ---------------------------------------------------------------------------
check(
    "copilot prompts block is labelled non-interactive",
    populated.includes("not interactive"),
)
check(
    "copilot prompt text has no clickable role/tag",
    !/<button[^>]*>[^<]*(?:onclick|Owner copilot)/i.test(populated),
)
// The old bug: a <span> styled like a pill button inside the prompts block.
const promptsBlockMatch = populated.match(
    /Owner copilot prompts[\s\S]*?(?=<\/div><\/article>|$)/,
)
if (promptsBlockMatch) {
    const block = promptsBlockMatch[0]
    check(
        "no button-styled span in copilot prompts block",
        !/<span[^>]*rounded-full[^>]*border[^>]*>/.test(block),
        "found a pill-shaped <span> that would read as a fake button",
    )
    check(
        "copilot prompts render as list items, not spans",
        /<li/.test(block),
    )
} else {
    check("copilot prompts block is present in markup", blueprints.some((b) => b.ownerCopilotPrompts.length > 0) === false, "expected block missing while fixtures have prompts")
}

// ---------------------------------------------------------------------------
// Finding 3 — overstated stat cards: must not claim live/measured data, and
// must carry honest provenance language for declared-but-unexecuted config.
// ---------------------------------------------------------------------------
for (const bannedClaim of ["live data", "measured", "real-time", "currently running"]) {
    check(
        `stat cards do not claim "${bannedClaim}"`,
        !populated.toLowerCase().includes(bannedClaim),
    )
}
check(
    "workflow/approval stat cards disclose config-only provenance",
    populated.includes("configuration only, not yet run"),
)
check(
    "top-level banner still discloses declared-not-executed status",
    populated.includes("not executed yet"),
)

// ---------------------------------------------------------------------------
// Finding 5 — heading order and decorative icon labelling.
// Page-level h2 is rendered by PageHeader (not owned by this component); this
// component's own section/card titles must be h3, and blueprint names must be
// h4, giving a single consistent h2 > h3 > h4 chain with no skipped level and
// no h1 introduced by this component (h1 belongs to the app shell/layout).
// ---------------------------------------------------------------------------
check("does not introduce its own <h1>", !/<h1[ >]/.test(populated))
check("has at least one <h2> from PageHeader", /<h2[ >]/.test(populated))
check("has section-level <h3> headings (stat cards + card titles)", /<h3[ >]/.test(populated))
check("has blueprint-level <h4> headings", /<h4[ >]/.test(populated))

const headingSequence = [...populated.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]))
let orderOk = true
let maxSeen = 0
for (const level of headingSequence) {
    if (level > maxSeen + 1 && maxSeen !== 0) orderOk = false
    maxSeen = Math.max(maxSeen, level)
}
check(
    "heading levels never skip a level (e.g. h2 straight to h4)",
    orderOk,
    `sequence was ${headingSequence.join(",")}`,
)

// Decorative icons next to card titles must be aria-hidden so screen readers
// don't announce a meaningless icon name/glyph.
const iconTags = [...populated.matchAll(/<svg[^>]*class="[^"]*lucide[^"]*"[^>]*>/g)]
check("lucide icons found to check", iconTags.length > 0)
const unlabelledDecorativeIcons = iconTags.filter((m) => !/aria-hidden="true"/.test(m[0]))
check(
    "all decorative lucide icons carry aria-hidden",
    unlabelledDecorativeIcons.length === 0,
    `${unlabelledDecorativeIcons.length} icon(s) missing aria-hidden`,
)

// ---------------------------------------------------------------------------
// Finding 5 (cont'd) — no icon-only interactive control without an accessible
// name. This component currently renders no <button>/<a> at all (informational
// only), so this guards against a future regression introducing one silently.
// ---------------------------------------------------------------------------
const interactiveTags = [...populated.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)]
const unnamedInteractive = interactiveTags.filter(([, , inner]) => {
    const hasVisibleText = /[A-Za-z0-9]/.test(inner.replace(/<[^>]*>/g, ""))
    const hasAriaLabel = /aria-label="[^"]+"/.test(inner)
    return !hasVisibleText && !hasAriaLabel
})
check(
    "no icon-only interactive control lacks an accessible name",
    unnamedInteractive.length === 0,
    `${unnamedInteractive.length} unnamed interactive element(s)`,
)

// ---------------------------------------------------------------------------
// Finding 2 / 4 — companion route files exist. This harness only renders the
// shell component (loading.tsx/error.tsx are client components tied to the
// Next.js error/suspense boundary contract and aren't meaningfully
// server-render-checkable here), so just assert their source carries the
// required honesty/skeleton markers rather than duplicating a full render.
// ---------------------------------------------------------------------------
const errorSrc = readFileSync(
    join(__dirname, "../../src/app/dashboard/business-os/error.tsx"),
    "utf8",
)
check(
    "error boundary does not assert a permissions cause",
    !/permission denied|you (do not|don't) have access|forbidden/i.test(errorSrc),
)
check(
    "error boundary explicitly disclaims inventing a cause",
    errorSrc.includes("not necessarily a permissions issue"),
)

const loadingSrc = readFileSync(
    join(__dirname, "../../src/app/dashboard/business-os/loading.tsx"),
    "utf8",
)
check(
    "loading.tsx renders a structural skeleton, not just a spinner",
    loadingSrc.includes("Skeleton"),
)
check(
    "loading.tsx marks itself busy for assistive tech",
    loadingSrc.includes('aria-busy="true"'),
)

// ---------------------------------------------------------------------------
// Wave A — the reservations panel is mounted inside the shell, so it is rendered
// incidentally above. These assertions make its coverage EXPLICIT, so "a11y 0"
// actually says something about the reservations UI rather than only the parts
// that existed before it.
// ---------------------------------------------------------------------------
const reservationsSrc = readFileSync(
    join(__dirname, "../../src/components/business-os/reservations-panel.tsx"),
    "utf8",
)
check(
    "reservations panel is mounted in the shell",
    readFileSync(join(__dirname, "../../src/components/business-os/business-os-shell.tsx"), "utf8").includes(
        "<ReservationsPanel",
    ),
)
check(
    "reservations decorative icons are hidden from assistive tech",
    /aria-hidden="true"/.test(reservationsSrc),
)
check(
    "reservations loading state announces itself politely and as busy",
    reservationsSrc.includes('aria-live="polite"') && reservationsSrc.includes('aria-busy="true"'),
)
check(
    "reservations loading state carries a screen-reader label",
    reservationsSrc.includes("sr-only") && /Loading reservations/.test(reservationsSrc),
)
check(
    "reservations panel uses a structural skeleton while loading",
    reservationsSrc.includes("Skeleton"),
)
check(
    "reservations panel distinguishes 401, 403 and 409 for the owner",
    /error\.status === 401/.test(reservationsSrc) &&
        /error\.status === 403/.test(reservationsSrc) &&
        /error\.status === 409/.test(reservationsSrc),
)
check(
    "reservations panel does not leak internals on a dependency failure",
    /error\.status === 503/.test(reservationsSrc) && /Nothing was changed/.test(reservationsSrc),
)
check(
    "reservations empty state states that no sample data is shown",
    /No sample reservations are shown/.test(reservationsSrc),
)
check(
    "reservations panel contains no hardcoded sample booking",
    !/guestName:\s*"[A-Z]/.test(reservationsSrc) && !/sampleReservation/i.test(reservationsSrc),
)
check(
    "reservations panel explains why a terminal booking has no actions",
    /cannot change/.test(reservationsSrc),
)

// ---------------------------------------------------------------------------
// Wave B — same explicit coverage for the appointments panel, so "a11y 0" says
// something about it rather than only about the panels that came before.
// ---------------------------------------------------------------------------
const appointmentsSrc = readFileSync(
    join(__dirname, "../../src/components/business-os/appointments-panel.tsx"),
    "utf8",
)
check(
    "appointments panel is mounted in the shell",
    readFileSync(join(__dirname, "../../src/components/business-os/business-os-shell.tsx"), "utf8").includes(
        "<AppointmentsPanel",
    ),
)
check(
    "appointments decorative icons are hidden from assistive tech",
    /aria-hidden="true"/.test(appointmentsSrc),
)
check(
    "appointments loading state announces itself politely and as busy",
    appointmentsSrc.includes('aria-live="polite"') && appointmentsSrc.includes('aria-busy="true"'),
)
check(
    "appointments loading state carries a screen-reader label",
    appointmentsSrc.includes("sr-only") && /Loading appointments/.test(appointmentsSrc),
)
check(
    "appointments panel distinguishes 401, 403, 409 and 400 for the owner",
    /error\.status === 401/.test(appointmentsSrc) &&
        /error\.status === 403/.test(appointmentsSrc) &&
        /error\.status === 409/.test(appointmentsSrc) &&
        /error\.status === 400/.test(appointmentsSrc),
)
check(
    "appointments panel does not leak internals on a dependency failure",
    /error\.status === 503/.test(appointmentsSrc) && /Nothing was changed/.test(appointmentsSrc),
)
check(
    "appointments empty state states that no sample data is shown",
    /No sample appointments are shown/.test(appointmentsSrc),
)
check(
    "appointments panel contains no hardcoded sample booking",
    !/visitorName:\s*"[A-Z]/.test(appointmentsSrc) && !/sampleAppointment/i.test(appointmentsSrc),
)
check(
    "appointments panel explains why a terminal appointment has no actions",
    /cannot change/.test(appointmentsSrc),
)
// The honesty requirement that matters most for money and messaging: the UI must not
// imply a payment was taken or a message was sent when no provider is wired up.
check(
    "deposit copy states plainly that no payment has been taken while pending",
    /no payment has been taken/i.test(appointmentsSrc),
)
check(
    "reminder copy states plainly that a queued reminder is not yet sent",
    /not yet sent/i.test(appointmentsSrc),
)
check(
    "appointments panel surfaces waitlist status to the owner",
    /Waitlist/.test(appointmentsSrc) && /Waitlisted for/.test(appointmentsSrc),
)

// ---------------------------------------------------------------------------
// Wave C — explicit coverage for the cases/projects panel and its detail view,
// so "a11y 0" says something about the cases surface rather than only about the
// panels that came before it.
// ---------------------------------------------------------------------------
const shellSrc = readFileSync(join(__dirname, "../../src/components/business-os/business-os-shell.tsx"), "utf8")
const casesSrc = readFileSync(join(__dirname, "../../src/components/business-os/cases-panel.tsx"), "utf8")
const caseDetailSrc = readFileSync(
    join(__dirname, "../../src/components/business-os/case-detail-panel.tsx"),
    "utf8",
)
const casesSharedSrc = readFileSync(join(__dirname, "../../src/components/business-os/cases-shared.ts"), "utf8")
const casesAll = `${casesSrc}\n${caseDetailSrc}\n${casesSharedSrc}`

check("cases panel is mounted in the shell", shellSrc.includes("<CasesPanel"))
check("cases decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(casesSrc))
check(
    "cases loading state announces itself politely and as busy",
    casesSrc.includes('aria-live="polite"') && casesSrc.includes('aria-busy="true"'),
)
check(
    "cases loading state carries a screen-reader label",
    casesSrc.includes("sr-only") && /Loading cases and intakes/.test(casesSrc),
)
check(
    "case detail loading state announces itself politely and as busy",
    caseDetailSrc.includes('aria-live="polite"') &&
        caseDetailSrc.includes('aria-busy="true"') &&
        /Loading case detail/.test(caseDetailSrc),
)
check("cases panel uses a structural skeleton while loading", /Skeleton/.test(casesSrc))
check(
    "cases panel distinguishes 401, 403, 400 and 409 for the owner",
    /error\.status === 401/.test(casesSharedSrc) &&
        /error\.status === 403/.test(casesSharedSrc) &&
        /error\.status === 400/.test(casesSharedSrc) &&
        /error\.status === 409/.test(casesSharedSrc),
)
check(
    "cases panel does not leak internals on a dependency failure",
    /error\.status === 503/.test(casesSharedSrc) && /Nothing was changed/.test(casesSharedSrc),
)
check(
    "cases 403 copy is identical for a foreign and a missing case",
    /does not grant you access to that case/.test(casesSharedSrc),
)
check(
    "cases empty state states that no sample data is shown",
    /No sample cases are shown/.test(casesSrc),
)
check(
    "cases panel contains no hardcoded sample case or intake",
    !/reference:\s*"[A-Z]{2,}-/.test(casesAll) && !/sampleCase/i.test(casesAll) && !/summary:\s*"[A-Z]/.test(casesAll),
)
check(
    "every case text input has an associated label",
    (casesAll.match(/<Input\b/g) ?? []).length === (casesAll.match(/htmlFor=/g) ?? []).length,
    `inputs=${(casesAll.match(/<Input\b/g) ?? []).length} labels=${(casesAll.match(/htmlFor=/g) ?? []).length}`,
)
check(
    "the case detail disclosure exposes its expanded state",
    /aria-expanded=/.test(casesSrc),
)
check(
    "case sections are headed rather than only visually grouped",
    /<h4/.test(casesSrc) && /<h5/.test(caseDetailSrc),
)
check(
    "case status buttons come from server-computed allowedTransitions",
    /record\.allowedTransitions\.map/.test(casesSrc),
)
check(
    "the deliverable UI states plainly that delivery needs an approval",
    /requires an approved approval/i.test(caseDetailSrc),
)
check(
    "the document-request UI states plainly that receipt needs a real document",
    /needs an uploaded document/i.test(caseDetailSrc),
)
check(
    "the billing UI states plainly that no money is moved from this screen",
    /No money is moved from this screen/.test(caseDetailSrc),
)
check(
    "empty case sub-lists say so rather than rendering a placeholder row",
    /No milestones recorded/.test(caseDetailSrc) &&
        /No deliverables recorded/.test(caseDetailSrc) &&
        /No approvals have been requested/.test(caseDetailSrc) &&
        /No events recorded yet/.test(caseDetailSrc),
)

// ---------------------------------------------------------------------------
// Wave D — explicit coverage for the cohort console. The honesty requirement that
// matters most here is that a progress percentage is the server's DERIVED figure,
// never estimated in the browser, and that an unissued certificate is never shown
// as a credential.
// ---------------------------------------------------------------------------
const cohortsSrc = readFileSync(join(__dirname, "../../src/components/business-os/cohorts-panel.tsx"), "utf8")
const cohortDetailSrc = readFileSync(
    join(__dirname, "../../src/components/business-os/cohort-detail-panel.tsx"),
    "utf8",
)
const cohortsSharedSrc = readFileSync(join(__dirname, "../../src/components/business-os/cohorts-shared.ts"), "utf8")
const cohortsAll = `${cohortsSrc}\n${cohortDetailSrc}\n${cohortsSharedSrc}`

check("cohort console is mounted in the shell", shellSrc.includes("<CohortsPanel"))
check("cohort decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(cohortsSrc))
check(
    "cohort loading state announces itself politely and as busy",
    cohortsSrc.includes('aria-live="polite"') && cohortsSrc.includes('aria-busy="true"'),
)
check(
    "cohort loading state carries a screen-reader label",
    cohortsSrc.includes("sr-only") && /Loading cohorts/.test(cohortsSrc),
)
check(
    "cohort detail and learner-progress loading states are both announced",
    /Loading cohort detail/.test(cohortDetailSrc) && /Loading learner progress/.test(cohortDetailSrc),
)
check("cohort console uses a structural skeleton while loading", /Skeleton/.test(cohortsSrc))
check(
    "cohort console distinguishes 401, 403, 400 and 409 for the owner",
    /error\.status === 401/.test(cohortsSharedSrc) &&
        /error\.status === 403/.test(cohortsSharedSrc) &&
        /error\.status === 400/.test(cohortsSharedSrc) &&
        /error\.status === 409/.test(cohortsSharedSrc),
)
check(
    "cohort console does not leak internals on a dependency failure",
    /error\.status === 503/.test(cohortsSharedSrc) && /Nothing was changed/.test(cohortsSharedSrc),
)
check(
    "cohort 403 copy is identical for a foreign and a missing cohort",
    /does not grant you access to that cohort/.test(cohortsSharedSrc),
)
check("cohort empty state states that no sample data is shown", /no sample cohorts are shown/i.test(cohortsSrc))
check(
    "cohort console contains no hardcoded sample cohort, learner or session",
    // A fabricated record needs an id, a learner address, or an invented percentage.
    // Error-envelope codes and UI copy strings are not records, so they are not matched.
    !/\bid:\s*"/.test(cohortsAll) &&
        !/visitorEmail:\s*"/.test(cohortsAll) &&
        !/percent:\s*\d/.test(cohortsAll) &&
        !/sampleCohort/i.test(cohortsAll),
)
check("the cohort detail disclosures expose their expanded state", /aria-expanded=/.test(cohortDetailSrc))
check(
    "cohort sections are headed rather than only visually grouped",
    /<h3/.test(cohortsSrc) && /<h5/.test(cohortDetailSrc),
)
check(
    "cohort and membership buttons come from server-computed allowedTransitions",
    /record\.allowedTransitions\.map/.test(cohortsSrc) &&
        /member\.allowedTransitions\.map/.test(cohortDetailSrc) &&
        /session\.allowedTransitions\.map/.test(cohortDetailSrc),
)
check(
    "progress figures are stated to be computed from records, not estimated",
    /computed from recorded lesson completions/.test(cohortDetailSrc) && /Nothing is estimated/.test(cohortDetailSrc),
)
check(
    "the UI never recomputes a percentage in the browser",
    !/Math\.round\(/.test(cohortsAll) && !/Math\.floor\(/.test(cohortsAll),
)
check(
    "an ineligible learner is shown the exact unmet requirements",
    /Not eligible: \$\{progress\.reasons\.join/.test(cohortDetailSrc),
)
check(
    "the UI states plainly that only an accepted submission counts",
    /Only an accepted submission counts towards completion/.test(cohortDetailSrc),
)
check(
    "the UI explains why a scheduled session has no attendance controls",
    /a session that has not happened\s*\n?\s*cannot have attendance/.test(cohortDetailSrc) ||
        /cannot have attendance/.test(cohortDetailSrc),
)
check(
    "renewal copy distinguishes a queued reminder from none",
    /reminder queued/.test(cohortDetailSrc) && /no reminder queued/.test(cohortDetailSrc),
)
check(
    "empty cohort sub-lists say so rather than rendering a placeholder row",
    /Nobody has joined this cohort yet/.test(cohortDetailSrc) &&
        /No sessions scheduled/.test(cohortDetailSrc) &&
        /No assignments set/.test(cohortDetailSrc) &&
        /No events recorded yet/.test(cohortDetailSrc),
)
check(
    "a terminal cohort explains why it has no actions",
    /cannot change/.test(cohortsSrc),
)

// ---------------------------------------------------------------------------
// Wave F — explicit coverage for the stock panel. The honesty requirements here are
// that a balance is the recorded figure rather than a recalculation, that promised
// stock is visibly distinct from stock you can sell, and that an oversell refusal
// reaches the owner with its numbers intact.
// ---------------------------------------------------------------------------
const inventorySrc = readFileSync(join(__dirname, "../../src/components/business-os/inventory-panel.tsx"), "utf8")

check("stock panel is mounted in the shell", shellSrc.includes("<InventoryPanel"))
check("stock decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(inventorySrc))
check(
    "stock loading state announces itself politely and as busy",
    inventorySrc.includes('aria-live="polite"') && inventorySrc.includes('aria-busy="true"'),
)
check(
    "stock list and ledger loading states both carry screen-reader labels",
    /Loading stock records/.test(inventorySrc) && /Loading stock ledger/.test(inventorySrc),
)
check("stock panel uses a structural skeleton while loading", /Skeleton/.test(inventorySrc))
check(
    "stock panel distinguishes 401, 403, 400 and 409 for the owner",
    /error\.status === 401/.test(inventorySrc) &&
        /error\.status === 403/.test(inventorySrc) &&
        /error\.status === 400/.test(inventorySrc) &&
        /error\.status === 409/.test(inventorySrc),
)
check(
    "stock panel does not leak internals on a dependency failure",
    /error\.status === 503/.test(inventorySrc) && /Nothing was changed/.test(inventorySrc),
)
check(
    "stock 403 copy is identical for a foreign and a missing record",
    /does not grant you access to that stock record/.test(inventorySrc),
)
check("stock empty state states that no sample data is shown", /no sample stock is shown/i.test(inventorySrc))
check(
    "stock panel contains no fabricated balance",
    !/onHand:\s*\d/.test(inventorySrc) && !/available:\s*\d/.test(inventorySrc) && !/sampleStock/i.test(inventorySrc),
)
check("the stock ledger disclosure exposes its expanded state", /aria-expanded=/.test(inventorySrc))
check("stock sections are headed rather than only visually grouped", /<h3/.test(inventorySrc) && /<h5/.test(inventorySrc))
check(
    "the oversell and strand refusals are surfaced verbatim, because they carry the numbers",
    /That stock change is not allowed/.test(inventorySrc) && /description: error\.message/.test(inventorySrc),
)
check(
    "promised stock is shown as distinct from sellable stock",
    /promised to orders/.test(inventorySrc) && /available/.test(inventorySrc),
)
check(
    "the UI states that a write-off below the promised quantity will be refused",
    /will be refused/.test(inventorySrc),
)
check(
    "the UI states that the ledger is append-only and its balances are recorded, not recalculated",
    /append-only/.test(inventorySrc) && /not a recalculation/.test(inventorySrc),
)
check(
    "an untracked record says plainly that nothing can be reserved against it",
    /units are not tracked, so nothing can be reserved/.test(inventorySrc),
)
check(
    "hold buttons come from server-computed allowedTransitions",
    /reservation\.allowedTransitions\.map/.test(inventorySrc),
)
check(
    "a settled hold explains why it has no actions",
    /settled, cannot change/.test(inventorySrc),
)
check(
    "empty stock sub-lists say so rather than rendering a placeholder row",
    /No units are held for orders/.test(inventorySrc) && /No movements recorded/.test(inventorySrc),
)

// ---------------------------------------------------------------------------
// Wave G — the commerce surface: what you sell (variants) and what happens after it is
// bought (shipments and returns). The honesty requirements specific to this package are
// that stock is stated to leave at shipped rather than at packed, that carrier and tracking
// are disclosed as owner-entered rather than fetched, that a restock without a location says
// so instead of failing at the write boundary, and that a default variant is described as
// inheriting the product price rather than copying it.
// ---------------------------------------------------------------------------
const variantsSrc = readFileSync(join(__dirname, "../../src/components/business-os/commerce-variants-panel.tsx"), "utf8")
const ordersSrc = readFileSync(join(__dirname, "../../src/components/business-os/commerce-orders-panel.tsx"), "utf8")
const commerceSharedSrc = readFileSync(join(__dirname, "../../src/components/business-os/commerce-shared.ts"), "utf8")
const commerceAll = `${variantsSrc}\n${ordersSrc}\n${commerceSharedSrc}`

check("commerce panel is mounted in the shell", shellSrc.includes("<CommercePanel"))
check(
    "commerce decorative icons are hidden from assistive tech",
    /aria-hidden="true"/.test(variantsSrc) && /aria-hidden="true"/.test(ordersSrc),
)
check(
    "commerce loading states announce themselves politely and as busy",
    variantsSrc.includes('aria-live="polite"') &&
        variantsSrc.includes('aria-busy="true"') &&
        ordersSrc.includes('aria-live="polite"') &&
        ordersSrc.includes('aria-busy="true"'),
)
check(
    "every commerce loading state carries a screen-reader label",
    /Loading products/.test(variantsSrc) &&
        /Loading variants/.test(variantsSrc) &&
        /Loading orders/.test(ordersSrc) &&
        /Loading shipments and returns/.test(ordersSrc) &&
        /Loading shipment history/.test(ordersSrc),
)
check(
    "commerce panels use a structural skeleton while loading",
    /Skeleton/.test(variantsSrc) && /Skeleton/.test(ordersSrc),
)
check(
    "commerce distinguishes 401, 403, 400 and 409 for the owner",
    /error\.status === 401/.test(commerceSharedSrc) &&
        /error\.status === 403/.test(commerceSharedSrc) &&
        /error\.status === 400/.test(commerceSharedSrc) &&
        /error\.status === 409/.test(commerceSharedSrc),
)
check(
    "commerce does not leak internals on a dependency failure",
    /error\.status === 503/.test(commerceSharedSrc) && /Nothing was changed/.test(commerceSharedSrc),
)
check(
    "commerce 403 copy is identical for a foreign and a missing record",
    /does not grant you access to that record/.test(commerceSharedSrc),
)
check(
    "the 409 refusal is surfaced verbatim, because it carries the remaining quantity",
    /That change is not allowed/.test(commerceSharedSrc) &&
        /description: error\.message/.test(commerceSharedSrc),
)
check(
    "commerce empty states state that no sample data is shown",
    /no sample products are shown/i.test(variantsSrc) && /no sample orders are shown/i.test(ordersSrc),
)
check(
    "commerce panels contain no fabricated product, variant, order or shipment",
    !/\bid:\s*"/.test(commerceAll) &&
        !/sku:\s*"/.test(commerceAll) &&
        !/trackingNumber:\s*"/.test(commerceAll) &&
        !/sample(Product|Variant|Order|Return)/i.test(commerceAll),
)
check(
    "the UI never derives a shippable or returnable quantity in the browser",
    !/Math\.(round|floor|max|min)\(/.test(variantsSrc) && !/Math\.(round|floor|max|min)\(/.test(ordersSrc),
)
check(
    "commerce disclosures expose their expanded state",
    /aria-expanded=/.test(variantsSrc) && /aria-expanded=/.test(ordersSrc),
)
check(
    "commerce sections are headed rather than only visually grouped",
    /<h3/.test(variantsSrc) && /<h5/.test(variantsSrc) && /<h3/.test(ordersSrc) && /<h5/.test(ordersSrc),
)
check(
    "shipment, return and restock buttons come from server-computed allowedTransitions",
    /f\.allowedTransitions\.map/.test(ordersSrc) &&
        /r\.allowedTransitions\.map/.test(ordersSrc) &&
        /item\.allowedRestockTransitions\.map/.test(ordersSrc),
)
check(
    "a terminal shipment explains why it has no actions",
    /cannot change/.test(ordersSrc),
)
check(
    "the UI states that stock leaves when a shipment is shipped, not when it is packed",
    /Stock leaves when a\s*\n?\s*shipment is marked shipped, not when it is packed/.test(ordersSrc),
)
check(
    "the UI discloses that carrier and tracking are owner-entered and no carrier is contacted",
    /no carrier is contacted/.test(ordersSrc) && /entered by hand/.test(ordersSrc),
)
check(
    "a shipment without tracking says so rather than showing a blank field",
    /no tracking entered/.test(ordersSrc),
)
check(
    "a restock without a workspace location says why it is disabled instead of failing at the write",
    /Restocking needs a location/.test(ordersSrc),
)
check(
    "the UI states that a default variant inherits the product price rather than copying it",
    /inherits the product price rather than copying it/.test(variantsSrc) &&
        /It is never created as the default/.test(variantsSrc),
)
check(
    "a product with no options is explained rather than shown as broken",
    /A product without options still sells/.test(variantsSrc) && /through its default variant/.test(variantsSrc),
)
check(
    "empty commerce sub-lists say so rather than rendering a placeholder row",
    /Nothing has been shipped for this order/.test(ordersSrc) &&
        /No returns requested for this order/.test(ordersSrc) &&
        /No history recorded/.test(ordersSrc) &&
        /either it has not shipped, or a live return already claims it/.test(ordersSrc),
)
check(
    "a stock promise is described as blocking a conflicting variant change",
    /promised to orders, so a live promise cannot/.test(variantsSrc),
)

// ---------------------------------------------------------------------------
// Wave G5 — the retainer panel. A retainer looks like a payment and is not one, so the honesty
// requirements here are mostly about money: that billing state is stated to be a record rather
// than a charge, that overage is shown rather than hidden, and that no balance is worked out in
// the browser.
// ---------------------------------------------------------------------------
const retainersSrc = readFileSync(join(__dirname, "../../src/components/business-os/retainers-panel.tsx"), "utf8")

check("retainer panel is mounted in the shell", shellSrc.includes("<RetainersPanel"))
check("retainer decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(retainersSrc))
check(
    "retainer loading states announce themselves politely and as busy",
    retainersSrc.includes('aria-live="polite"') && retainersSrc.includes('aria-busy="true"'),
)
check(
    "every retainer loading state carries a screen-reader label",
    /Loading retainers/.test(retainersSrc) &&
        /Loading periods, cases and draws/.test(retainersSrc) &&
        /Loading retainer history/.test(retainersSrc),
)
check("retainer panel uses a structural skeleton while loading", /Skeleton/.test(retainersSrc))
check(
    "retainer refusals are split by status through the shared cases error copy",
    /error\.status === 401/.test(casesSharedSrc) &&
        /error\.status === 403/.test(casesSharedSrc) &&
        /error\.status === 400/.test(casesSharedSrc) &&
        /error\.status === 409/.test(casesSharedSrc) &&
        /error\.status === 503/.test(casesSharedSrc),
)
check("retainer empty state states that no sample data is shown", /no sample retainers are shown/i.test(retainersSrc))
check(
    "the retainer panel contains no fabricated retainer, period or draw",
    !/\bid:\s*"/.test(retainersSrc) && !/usedUnits:\s*\d/.test(retainersSrc) && !/sampleRetainer/i.test(retainersSrc),
)
check(
    "MEASURED: the retainer panel performs no arithmetic on any balance - the ledger is the only place those numbers are worked out",
    !/Math\.(round|floor|max|min|abs)\(/.test(retainersSrc) &&
        !/remaining\s*[-+]/.test(retainersSrc) &&
        !/usedUnits\s*[-+]/.test(retainersSrc) &&
        !/includedUnits\s*-/.test(retainersSrc),
)
check("retainer disclosures expose their expanded state", /aria-expanded=/.test(retainersSrc))
check(
    "retainer sections are headed rather than only visually grouped",
    /<h3/.test(retainersSrc) && /<h5/.test(retainersSrc),
)
check(
    "retainer, period and billing buttons all come from server-computed allowedTransitions",
    /retainer\.allowedTransitions\.map/.test(retainersSrc) &&
        /period\.allowedTransitions\.map/.test(retainersSrc) &&
        /period\.allowedBillingTransitions\.map/.test(retainersSrc),
)
check(
    "a terminal retainer and a terminal period each explain why they have no actions",
    /and cannot change/.test(retainersSrc) &&
        /retainer\.allowedTransitions\.length === 0/.test(retainersSrc) &&
        /period\.allowedTransitions\.length === 0/.test(retainersSrc),
)
check(
    "the panel states that billing state is a record and not a charge, where an owner will read it",
    /Billing state is a record, not a charge/.test(retainersSrc) && /nothing here\s*\n?\s*charges anybody/.test(retainersSrc),
)
check(
    "overage is stated to be shown rather than blocked, and given a reason",
    /Overage is shown rather than blocked/.test(retainersSrc) &&
        /Overage is recorded rather than refused, so it can be billed/.test(retainersSrc),
)
check(
    "the panel says the balance figures are recomputed from the ledger rather than stored",
    /recomputed from the ledger on every\s*\n?\s*read, not stored/.test(retainersSrc),
)
check(
    "the ledger is described as append-only and its balances as recorded at the time",
    /The ledger is append-only/.test(retainersSrc) && /not a\s*\n?\s*recalculation/.test(retainersSrc),
)
check(
    "auto-renew is disclosed as intent only, so the word does not imply a timer",
    /records intent only/.test(retainersSrc) && /nothing renews this agreement on a\s*\n?\s*timer/.test(retainersSrc),
)
check(
    "the draw form states the two rules a caller would otherwise discover by being refused",
    /must name one this retainer covers/.test(retainersSrc) &&
        /accepted and shown as overage rather than\s*\n?\s*refused/.test(retainersSrc),
)
check(
    "an allowance is formatted by basis, so units are never printed as money or the reverse",
    /export function allowance/.test(casesSharedSrc) && /basis === "UNITS"/.test(casesSharedSrc),
)
check(
    "empty retainer sub-lists say so rather than rendering a placeholder row",
    /No periods opened yet/.test(retainersSrc) &&
        /No cases linked yet/.test(retainersSrc) &&
        /Nothing drawn yet/.test(retainersSrc) &&
        /No history recorded/.test(retainersSrc),
)
check(
    "a retainer with no open period says so rather than showing a draw form that would be refused",
    /No period is open, so nothing can be drawn right now/.test(retainersSrc),
)

// ---------------------------------------------------------------------------
// The field-jobs panel. Its honesty requirements are all about what "dispatch" does not do:
// nobody is notified, no route is planned, no travel time is estimated, and inspection is not
// built. A field-service panel that stays quiet about those four things is read as having them.
// ---------------------------------------------------------------------------
const fieldJobsSrc = readFileSync(join(__dirname, "../../src/components/business-os/fieldjobs-panel.tsx"), "utf8")
const fieldJobsSharedSrc = readFileSync(join(__dirname, "../../src/components/business-os/fieldjobs-shared.ts"), "utf8")

check("field-jobs panel is mounted in the shell", shellSrc.includes("<FieldJobsPanel"))
check("field-job decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(fieldJobsSrc))
check(
    "field-job loading states announce themselves politely and as busy",
    fieldJobsSrc.includes('aria-live="polite"') && fieldJobsSrc.includes('aria-busy="true"'),
)
check(
    "every field-job loading state carries a screen-reader label",
    /Loading requests and jobs/.test(fieldJobsSrc) &&
        /Loading job cards/.test(fieldJobsSrc) &&
        /Loading job history/.test(fieldJobsSrc),
)
check("field-jobs panel uses a structural skeleton while loading", /Skeleton/.test(fieldJobsSrc))
check(
    "field-job refusals are split by status, with 503 leaking nothing",
    /error\.status === 401/.test(fieldJobsSharedSrc) &&
        /error\.status === 403/.test(fieldJobsSharedSrc) &&
        /error\.status === 400/.test(fieldJobsSharedSrc) &&
        /error\.status === 409/.test(fieldJobsSharedSrc) &&
        /Nothing was changed/.test(fieldJobsSharedSrc),
)
check(
    "the field-job 403 copy is identical for a foreign record and a missing one",
    /does not grant you access to that record/.test(fieldJobsSharedSrc),
)
check(
    "field-job empty states state that no sample data is shown",
    /no sample requests are shown/i.test(fieldJobsSrc) && /no sample jobs are shown/i.test(fieldJobsSrc),
)
check(
    "the field-jobs panel contains no fabricated request, job or technician",
    !/\bid:\s*"/.test(fieldJobsSrc) && !/resourceName:\s*"/.test(fieldJobsSrc) && !/sampleJob/i.test(fieldJobsSrc),
)
check("field-job disclosures expose their expanded state", /aria-expanded=/.test(fieldJobsSrc))
check(
    "field-job sections are headed rather than only visually grouped",
    /<h3/.test(fieldJobsSrc) && /<h5/.test(fieldJobsSrc),
)
check(
    "job, request and job-card buttons all come from server-computed allowedTransitions",
    /request\.allowedTransitions/.test(fieldJobsSrc) &&
        /job\.allowedTransitions\.map/.test(fieldJobsSrc) &&
        /assignment\.allowedTransitions\.map/.test(fieldJobsSrc),
)
check(
    "a terminal request, job and job card each explain why they have no actions",
    /request\.allowedTransitions\.length === 0/.test(fieldJobsSrc) &&
        /job\.allowedTransitions\.length === 0/.test(fieldJobsSrc) &&
        /assignment\.allowedTransitions\.length === 0/.test(fieldJobsSrc),
)
check(
    "MEASURED: the panel states that assigning a technician notifies nobody, twice - in the description and beside the control",
    /records the assignment and tells nobody/.test(fieldJobsSrc) &&
        /Assigning records the job card and notifies nobody/.test(fieldJobsSrc),
)
check(
    "the panel states that no route is planned and no travel time is estimated",
    /No route is planned and no travel time is estimated/.test(fieldJobsSrc),
)
check(
    "the panel says the visit window is what the owner typed, not a slot the system found",
    /the visit window is\s*\n?\s*what you type here/.test(fieldJobsSrc),
)
check(
    "MEASURED: the panel says outright that inspection, parts and completion notes are not built, rather than leaving an owner hunting",
    /Inspection, parts and completion notes are not built yet/.test(fieldJobsSrc),
)
check(
    "the panel wires no map library and no route or ETA field - every mention of either is in copy saying there isn't one",
    !/mapbox|googlemaps|google-maps|leaflet|@react-google-maps/i.test(fieldJobsSrc) &&
        !/\betaMinutes\b|\beta:\s|\betaAt\b/i.test(fieldJobsSrc) &&
        !/routeOrder|optimi[sz]eRoute|travelMinutes|distanceMeters/i.test(fieldJobsSrc) &&
        fieldJobsSrc
            .split("\n")
            .filter((line) => /route/i.test(line))
            .every((line) => /no route is planned/i.test(line)),
    fieldJobsSrc
        .split("\n")
        .filter((line) => /route/i.test(line))
        .map((line) => line.trim().slice(0, 40))
        .join(" | "),
)
check(
    "the panel explains why an undated job cannot be dispatched instead of just disabling the button",
    /dispatching an undated job tells nobody when to turn up/.test(fieldJobsSrc),
)
check(
    "a request with no site address says why it cannot be converted",
    /a job with no address cannot be visited/.test(fieldJobsSrc),
)
check(
    "the panel states that a technician is an existing resource, so nobody is created here",
    /A technician is an existing staff resource, so nobody is created/.test(fieldJobsSrc),
)
check(
    "the one-lead rule is explained rather than only enforced",
    /two leads means nobody is accountable/.test(fieldJobsSrc),
)
check(
    "the panel states that a declined request stays a record",
    /A request is not a job/.test(fieldJobsSrc) && /does not erase that somebody asked/.test(fieldJobsSrc),
)
check(
    "CONVERTED is filtered out of the request transition buttons, because conversion creates a job",
    /filter\(\(next\) => next !== "CONVERTED"\)/.test(fieldJobsSrc),
)
check(
    "empty field-job sub-lists say so rather than rendering a placeholder row",
    /Nobody is assigned to this job yet/.test(fieldJobsSrc) && /No history recorded/.test(fieldJobsSrc),
)

// ---------------------------------------------------------------------------
// Wave G6 — the course access-level panel. This screen decides what a learner who has paid
// can see, so its honesty requirements are about the three things it would be easiest to
// let an owner assume: that the price charges somebody, that visibility is stored, and that
// approving an upgrade applies it. All three are false and all three are stated on screen.
// ---------------------------------------------------------------------------
const accessSrc = readFileSync(join(__dirname, "../../src/components/business-os/access-levels-panel.tsx"), "utf8")

check("access-level panel is mounted in the shell", shellSrc.includes("<AccessLevelsPanel"))
check("access-level decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(accessSrc))
check(
    "access-level loading states announce themselves politely and as busy",
    accessSrc.includes('aria-live="polite"') && accessSrc.includes('aria-busy="true"'),
)
check(
    "every access-level loading state carries a screen-reader label",
    /Loading courses/.test(accessSrc) &&
        /Loading tiers, lessons and entitlements/.test(accessSrc) &&
        /Loading tier changes/.test(accessSrc) &&
        /Loading access history/.test(accessSrc),
)
check("access-level panel uses a structural skeleton while loading", /Skeleton/.test(accessSrc))
check(
    "access-level refusals are split by status through the shared cohort error copy",
    /error\.status === 401/.test(cohortsSharedSrc) &&
        /error\.status === 403/.test(cohortsSharedSrc) &&
        /error\.status === 400/.test(cohortsSharedSrc) &&
        /error\.status === 409/.test(cohortsSharedSrc) &&
        /error\.status === 503/.test(cohortsSharedSrc),
)
check(
    "access-level empty states state that no sample data is shown",
    /no sample courses are shown/i.test(accessSrc) &&
        /no sample tiers are shown/i.test(accessSrc) &&
        /no sample learners are shown/i.test(accessSrc) &&
        /No sample lessons are\s*\n?\s*shown/i.test(accessSrc),
)
check(
    "the access-level panel contains no fabricated tier, learner or lesson",
    !/\bid:\s*"/.test(accessSrc) && !/sampleTier/i.test(accessSrc) && !/rank:\s*\d/.test(accessSrc),
)
check("access-level disclosures expose their expanded state", /aria-expanded=/.test(accessSrc))
check(
    "access-level sections are headed rather than only visually grouped",
    /<h3/.test(accessSrc) && /<h5/.test(accessSrc),
)
check(
    "entitlement buttons come from server-computed allowedTransitions",
    /grant\.allowedTransitions\.map/.test(accessSrc),
)
check(
    "a terminal entitlement explains why it has no actions",
    /grant\.allowedTransitions\.length === 0/.test(accessSrc) && /and cannot\s*\n?\s*change/.test(accessSrc),
)
check(
    "MEASURED: the panel performs no arithmetic at all - a tier price is formatted in the shared module, so the browser never works out money",
    !/Math\.(round|floor|max|min|abs)\(/.test(accessSrc) &&
        !/priceCents\s*\/\s*100/.test(accessSrc) &&
        /tierPrice\(/.test(accessSrc) &&
        /export function tierPrice/.test(cohortsSharedSrc),
)
check(
    "MEASURED: the panel states that a tier price charges nobody, where an owner reads the price",
    /nothing here\s*\n?\s*charges anybody/.test(accessSrc),
)
check(
    "the panel states that visibility is computed on every read rather than stored",
    /Visibility is computed on every read, not stored/.test(accessSrc),
)
check(
    "MEASURED: the panel states that approving is not applying, next to the approve control",
    /Approving is not\s*\n?\s*applying/.test(accessSrc) &&
        /records an invoice reference rather\s*\n?\s*than taking a payment/.test(accessSrc),
)
check(
    "the panel states that a lesson with no tier is visible to everyone, which is the default",
    /A lesson with no tier is visible to everyone/.test(accessSrc) && /Visible to everyone/.test(accessSrc),
)
check(
    "the panel states that granting notifies nobody",
    /Granting records the entitlement and notifies nobody/.test(accessSrc),
)
check(
    "the panel explains why retiring a held tier is refused instead of only failing",
    /Retiring a tier is refused while a learner still holds it/.test(accessSrc),
)
check(
    "the panel explains the rank rule rather than letting an owner discover it by being refused",
    /Rank is what makes an upgrade and a downgrade derivable/.test(accessSrc),
)
check(
    "the panel says the upgrade direction is worked out by the server, not chosen in the browser",
    /worked out from the\s*\n?\s*tier ranks by the server, not chosen here/.test(accessSrc),
)
check(
    "the panel states the history is append-only and database-enforced",
    /append-only and enforced by the database/.test(accessSrc),
)
check(
    "an enrolment that cannot hold a tier says why, rather than showing a control that would be refused",
    /so a tier\s*\n?\s*cannot be granted against it yet/.test(accessSrc),
)
check(
    "empty access-level sub-lists say so rather than rendering a placeholder row",
    /No tiers defined for this course/.test(accessSrc) &&
        /No tier changes requested yet/.test(accessSrc) &&
        /No access history recorded yet/.test(accessSrc) &&
        /No lessons in this module/.test(accessSrc),
)
check(
    "MEASURED: the panel never constructs the learner service and never sends a learner cookie - it is the owner surface only",
    !/LearnerAccessService/.test(accessSrc) && !/pl_member/.test(accessSrc),
)

// ---------------------------------------------------------------------------
// Wave H1 (W4) — explicit coverage for the inspection owner panel. Root is wiring the
// runtime, routes and shell mount in parallel, so this panel is not mounted in
// BusinessOsShell yet and is checked directly against its own source rather than through a
// render of the shell. The honesty requirements specific to this package: a foreign and a
// nonexistent inspection are indistinguishable (no 404, never "not found"), a null
// isWithinExpectedRange is stated to mean "not applicable" rather than "out of range", a
// part's stock is shown to have moved only when movementId is set, and invoice handoff is
// stated to be a flag rather than an invoice.
// ---------------------------------------------------------------------------
const inspectionSrc = readFileSync(
    join(__dirname, "../../src/components/business-os/inspection-panel.tsx"),
    "utf8",
)
const inspectionSharedSrc = readFileSync(
    join(__dirname, "../../src/components/business-os/inspection-shared.ts"),
    "utf8",
)
const inspectionAll = `${inspectionSrc}\n${inspectionSharedSrc}`

check("inspection decorative icons are hidden from assistive tech", /aria-hidden="true"/.test(inspectionSrc))
check(
    "inspection loading states announce themselves politely and as busy",
    inspectionSrc.includes('aria-live="polite"') && inspectionSrc.includes('aria-busy="true"'),
)
check(
    "every inspection loading state carries a screen-reader label",
    /Loading inspections/.test(inspectionSrc) && /Loading inspection detail/.test(inspectionSrc) && /Loading inspection history/.test(inspectionSrc),
)
check("inspection panel uses a structural skeleton while loading", /Skeleton/.test(inspectionSrc))
check(
    "inspection refusals are split by status, with 503 leaking nothing",
    /error\.status === 401/.test(inspectionSharedSrc) &&
        /error\.status === 403/.test(inspectionSharedSrc) &&
        /error\.status === 400/.test(inspectionSharedSrc) &&
        /error\.status === 409/.test(inspectionSharedSrc) &&
        /error\.status === 503/.test(inspectionSharedSrc) &&
        /Nothing was changed/.test(inspectionSharedSrc),
)
check(
    "the inspection 403 copy never says not found, for a foreign or a nonexistent inspection alike",
    /you do not have access to this inspection/i.test(inspectionSharedSrc) && !/not found/i.test(inspectionSharedSrc),
)
check("inspection empty state states that no sample data is shown", /no sample inspections are shown/i.test(inspectionSrc))
check(
    "the inspection panel contains no fabricated inspection, item or part",
    !/\bid:\s*"/.test(inspectionAll) && !/sampleInspection/i.test(inspectionAll) && !/reference:\s*"[A-Z]/.test(inspectionSrc),
)
check("inspection disclosures expose their expanded state", /aria-expanded=/.test(inspectionSrc))
check(
    "inspection sections are headed rather than only visually grouped",
    /<h3/.test(inspectionSrc) && /<h5/.test(inspectionSrc),
)
check(
    "inspection status, item and handoff buttons all come from server-computed allowedTransitions",
    /inspection\.allowedTransitions/.test(inspectionSrc) &&
        /inspection\.allowedTransitions\.includes\("COMPLETED"\)/.test(inspectionSrc) &&
        /inspection\.allowedTransitions\.includes\("CANCELLED"\)/.test(inspectionSrc),
)
check(
    "a terminal inspection explains why it has no actions",
    /inspection\.allowedTransitions\.length === 0/.test(inspectionSrc) && /cannot change/.test(inspectionSrc),
)
check(
    "MEASURED: a null isWithinExpectedRange is shown as not applicable, never as out of range",
    /isWithinExpectedRange === null/.test(inspectionSrc) && /Range not applicable/.test(inspectionSrc),
)
check(
    "measured values are parsed for display only, never assumed to be number",
    /formatDecimal/.test(inspectionAll) && /serialised as \*\*strings\*\*|serialised as STRINGS/i.test(inspectionSharedSrc),
)
check(
    "a part is shown to have moved stock only when movementId is set",
    /part\.movementId/.test(inspectionSrc) && /stock did not move/.test(inspectionSrc) && /stock moved \(movement/.test(inspectionSrc),
)
check(
    "recording a part is stated to never move stock by itself",
    /Recording a part never moves stock by itself/.test(inspectionSrc),
)
check(
    "invoice handoff is rendered as a flag and the word invoiced never appears",
    /HANDOFF FLAG, not an invoice/.test(inspectionSrc) && !/\binvoiced\b/i.test(inspectionAll),
)
check(
    "the handoff section never renders a currency total as if a bill exists",
    !/handoff[\s\S]{0,400}\$\{[^}]*Cents/i.test(inspectionSrc),
)
check(
    "no upload control or thumbnail is rendered for evidenceManifest",
    !/type="file"/.test(inspectionSrc) && !/<img\b/i.test(inspectionSrc) && !/evidenceManifest[\s\S]{0,120}<input/i.test(inspectionSrc),
)
check(
    "asset items disclose there is no asset registry or per-asset service history",
    /no asset registry behind this field/.test(inspectionSrc),
)
check(
    "a required item's fail path requires notes before it can be marked",
    /disabled=\{busy \|\| \(next === "FAIL" && !\(itemNotes\[item\.id\] \?\? item\.notes \?\? ""\)\.trim\(\)\)\}/.test(inspectionSrc),
)
check(
    "completion is described as refused while required items are pending, with the count shown",
    /pendingRequired/.test(inspectionSrc) && /still pending/.test(inspectionSrc),
)
check(
    "empty inspection sub-lists say so rather than rendering a placeholder row",
    /No asset checks on this inspection/.test(inspectionSrc) &&
        /No measurements on this inspection/.test(inspectionSrc) &&
        /No parts recorded against this inspection/.test(inspectionSrc) &&
        /No completion notes recorded yet/.test(inspectionSrc) &&
        /No history recorded yet/.test(inspectionSrc),
)

report.rendered = { populatedBytes: populated.length, blueprintsRendered: blueprints.length, enginesRendered: engines.length }
report.headingSequence = headingSequence
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
