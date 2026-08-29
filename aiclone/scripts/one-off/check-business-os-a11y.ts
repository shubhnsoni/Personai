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

report.rendered = { populatedBytes: populated.length, blueprintsRendered: blueprints.length, enginesRendered: engines.length }
report.headingSequence = headingSequence
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
