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

report.rendered = { populatedBytes: populated.length, blueprintsRendered: blueprints.length, enginesRendered: engines.length }
report.headingSequence = headingSequence
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
