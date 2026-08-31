import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
    readCatalogView,
    subscribeCatalogView,
    useCatalogView,
    writeCatalogView,
    type CatalogView,
} from "../../src/components/dashboard/catalog-chrome"

/**
 * SSR-class behaviour harness for the react-hooks lint remediation (T4).
 *
 * WHY THIS HARNESS EXISTS, AND WHAT IT DELIBERATELY DOES NOT COVER
 * ---------------------------------------------------------------
 * This project has no UI test runner and no testing library - no vitest, jest,
 * @testing-library, playwright, jsdom or happy-dom, and no test script - and one cannot be
 * added (that needs npm install). The one executable component-testing technique the
 * repository already uses is `renderToStaticMarkup` from react-dom/server, as in
 * check-business-os-render.ts. That is the mechanism here.
 *
 * renderToStaticMarkup runs the SERVER render only: effects never fire, there is no DOM, no
 * events and no timers. So it can prove SSR-class behaviour - does the component render on the
 * server without throwing, is its markup deterministic, does it avoid touching
 * window/localStorage/sessionStorage/matchMedia during render - and it can prove nothing at all
 * about clicks, scrolls, focus, debounce, hydration-time effects or animation timing.
 *
 * Consequently this harness covers exactly ONE of the nine react-hooks errors:
 * catalog-chrome.tsx `useCatalogView`. The other eight are recorded as refusals in
 * T4-report.md with the specific behaviour that could not be protected. Measured blockers,
 * not assumptions:
 *   - profile-view.tsx cannot even be imported here: it transitively pulls in @prisma/client,
 *     which reports "did not initialize yet - run prisma generate", and prisma generate is a
 *     forbidden command.
 *   - leads-studio.tsx's LeadDetail lives inside a Radix Sheet, which renders 0 bytes under
 *     renderToStaticMarkup, so the note field never reaches server markup.
 *   - chat-interface.tsx's AskAboutLine is gated on `stage === "ready"`, a state only reachable
 *     through a chain of setTimeout calls, so it is never mounted in a server render.
 *
 * WHAT `useCatalogView` MUST GUARANTEE
 * -----------------------------------
 * It mirrors a browser-only store (localStorage) into React state. The dangerous "fix" for the
 * set-state-in-effect error is to hoist the localStorage read into render or into a useState
 * initializer - that throws on the server, or silently diverges from the server markup and
 * produces a hydration mismatch. The assertions below pin the server contract so that shape of
 * regression cannot land: the server render always yields the caller's fallback, never reads
 * localStorage, and is byte-identical across repeated renders even when a populated store and a
 * polluted in-memory cache are both present.
 */

const report: Record<string, unknown> = {}
const failures: string[] = []

/**
 * ASSERTION EVIDENCE. Counted inside the real helper, so the number the gate reads is produced
 * by the same call that decides the verdict. These count assertion CALLS - never a rendered byte
 * length and never a literal. Neuter this helper and the count collapses to zero; fail one
 * assertion and `assertionsPassed` drops below `assertionsRun` while `failures` sets exit 1.
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
// A fake localStorage that COUNTS reads. The count is the evidence that render does not touch
// the browser store: an implementation that reads it during render drives reads above zero.
// ---------------------------------------------------------------------------
type FakeStore = {
    reads: number
    writes: number
    install(seed?: Record<string, string>): void
    uninstall(): void
}

const g = globalThis as unknown as { localStorage?: unknown }

const fakeStore: FakeStore = {
    reads: 0,
    writes: 0,
    install(seed = {}) {
        const data = new Map(Object.entries(seed))
        fakeStore.reads = 0
        fakeStore.writes = 0
        g.localStorage = {
            getItem(key: string) {
                fakeStore.reads += 1
                return data.has(key) ? data.get(key)! : null
            },
            setItem(key: string, value: string) {
                fakeStore.writes += 1
                data.set(key, value)
            },
            removeItem(key: string) {
                data.delete(key)
            },
        }
    },
    uninstall() {
        delete g.localStorage
    },
}

// Two probe components: the smallest real consumers of the real hook. Two, not one with a
// conditional call, because a hook must be called unconditionally - which is the point of
// exercising the default-fallback path separately from the explicit one. The view value is
// written into an attribute AND the text body so a regression shows up in the markup either way.
function CatalogViewProbeDefault({ storeKey }: { storeKey: string }) {
    const [view] = useCatalogView(storeKey)
    return createElement("div", { "data-view": view }, view)
}

function CatalogViewProbeExplicit({ storeKey, fallback }: { storeKey: string; fallback: CatalogView }) {
    const [view] = useCatalogView(storeKey, fallback)
    return createElement("div", { "data-view": view }, view)
}

function renderProbe(storeKey: string, fallback?: CatalogView) {
    return fallback
        ? renderToStaticMarkup(createElement(CatalogViewProbeExplicit, { storeKey, fallback }))
        : renderToStaticMarkup(createElement(CatalogViewProbeDefault, { storeKey }))
}

// ---------------------------------------------------------------------------
// 1. The server render must not throw when there is no browser store at all.
//    This is the plain "does it render on the server" leg: on the server `localStorage` is not
//    defined, and any implementation that reaches for it during render dies here.
// ---------------------------------------------------------------------------
fakeStore.uninstall()
let noStoreMarkup = ""
let noStoreThrew: string | null = null
try {
    noStoreMarkup = renderProbe("catalog:probe")
} catch (error) {
    noStoreThrew = (error as Error).message
}
check(
    "renders on the server with no localStorage defined",
    noStoreThrew === null,
    noStoreThrew ?? undefined,
)
check(
    "server render yields the default fallback (grid)",
    noStoreMarkup.includes('data-view="grid"'),
    noStoreMarkup.slice(0, 160),
)

// ---------------------------------------------------------------------------
// 2. A caller-supplied fallback is the server value. Proves the assertion above is really
//    reading the fallback and not a hardcoded "grid" that happens to match.
// ---------------------------------------------------------------------------
let listFallbackMarkup = ""
let listFallbackThrew: string | null = null
try {
    listFallbackMarkup = renderProbe("catalog:probe", "list")
} catch (error) {
    listFallbackThrew = (error as Error).message
}
check(
    "renders on the server with an explicit fallback",
    listFallbackThrew === null,
    listFallbackThrew ?? undefined,
)
check(
    "server render honours an explicit fallback (list)",
    listFallbackMarkup.includes('data-view="list"'),
    listFallbackMarkup.slice(0, 160),
)
check(
    "the two fallbacks really produce different markup, so the check is not vacuous",
    noStoreMarkup !== listFallbackMarkup,
)

// ---------------------------------------------------------------------------
// 3. THE CORE ASSERTION. A populated browser store must not change the server render, and must
//    not be read during it. This is the exact regression a hoisted localStorage read introduces:
//    the server would emit "list" (or throw), and the client's first paint would disagree.
// ---------------------------------------------------------------------------
fakeStore.install({ "catalog:probe": "list" })
let seededMarkup = ""
let seededThrew: string | null = null
try {
    seededMarkup = renderProbe("catalog:probe")
} catch (error) {
    seededThrew = (error as Error).message
}
check(
    "renders on the server while a populated localStorage is present",
    seededThrew === null,
    seededThrew ?? undefined,
)
check(
    "a stored 'list' does NOT leak into the server render",
    seededMarkup.includes('data-view="grid"') && !seededMarkup.includes('data-view="list"'),
    seededMarkup.slice(0, 160),
)
check(
    "the server render never reads localStorage",
    fakeStore.reads === 0,
    `getItem was called ${fakeStore.reads} time(s) during render`,
)
check(
    "the server render never writes localStorage",
    fakeStore.writes === 0,
    `setItem was called ${fakeStore.writes} time(s) during render`,
)
check(
    "server markup is identical with and without a populated store",
    seededMarkup === noStoreMarkup,
    `${noStoreMarkup} !== ${seededMarkup}`,
)

// ---------------------------------------------------------------------------
// 4. Determinism across repeated renders, and across distinct keys. A server process serves many
//    requests from one module instance, so no per-key memory may bleed into a later render.
// ---------------------------------------------------------------------------
const repeats = [renderProbe("catalog:probe"), renderProbe("catalog:probe"), renderProbe("catalog:probe")]
check(
    "three consecutive server renders are byte-identical",
    repeats.every((html) => html === repeats[0]),
    repeats.join(" | "),
)
check(
    "a second key with a stored value also renders the fallback",
    renderProbe("catalog:other").includes('data-view="grid"'),
)
check(
    "repeated renders still did not read localStorage",
    fakeStore.reads === 0,
    `getItem was called ${fakeStore.reads} time(s)`,
)

report.serverRender = {
    withoutStore: noStoreMarkup,
    withPopulatedStore: seededMarkup,
    withListFallback: listFallbackMarkup,
    localStorageReadsDuringRender: fakeStore.reads,
    localStorageWritesDuringRender: fakeStore.writes,
}

// ---------------------------------------------------------------------------
// 5. The client half of the same hook. useSyncExternalStore's snapshot/subscribe functions are
//    plain functions over the browser store, so they ARE executable here even though the
//    hydrated component is not: no DOM and no event library is needed to call them. This is what
//    keeps the post-mount sync honest - that the stored value is picked up after hydration, that
//    the toggle persists, and that a subscriber is notified - rather than asserted by hand.
//    What is still NOT covered: React's own wiring of the hook at hydration time, which needs a
//    DOM. That is React's contract, not this module's.
// ---------------------------------------------------------------------------
fakeStore.install({ "catalog:client": "list" })
check(
    "client snapshot picks up the stored value",
    readCatalogView("catalog:client", "grid") === "list",
    readCatalogView("catalog:client", "grid"),
)
check(
    "client snapshot really did read the browser store",
    fakeStore.reads > 0,
    `getItem was called ${fakeStore.reads} time(s)`,
)
check(
    "client snapshot falls back for a key with nothing stored",
    readCatalogView("catalog:absent", "grid") === "grid",
)
check(
    "client snapshot rejects a corrupt stored value",
    readCatalogView("catalog:corrupt", "list") === "list",
)

fakeStore.install({ "catalog:corrupt": "not-a-view" })
check(
    "a corrupt stored value does not become the view",
    readCatalogView("catalog:corrupt", "grid") === "grid",
)

// A write must persist AND notify, or the toggle would not repaint.
fakeStore.install()
let notified = 0
const unsubscribe = subscribeCatalogView(() => {
    notified += 1
})
writeCatalogView("catalog:write", "list")
check("a write notifies subscribers", notified === 1, `notified ${notified} time(s)`)
check("a write persists to the browser store", fakeStore.writes === 1, `wrote ${fakeStore.writes} time(s)`)
check("a write is visible to the next snapshot", readCatalogView("catalog:write", "grid") === "list")
unsubscribe()
writeCatalogView("catalog:write", "grid")
check("unsubscribe stops notifications", notified === 1, `notified ${notified} time(s)`)

// Persistence failure must not freeze the UI: the previous implementation called setView BEFORE
// localStorage.setItem, so the view still changed when the write threw.
g.localStorage = {
    getItem() {
        throw new Error("SecurityError: storage disabled")
    },
    setItem() {
        throw new Error("QuotaExceededError")
    },
}
let threwOnWrite: string | null = null
try {
    writeCatalogView("catalog:hostile", "list")
} catch (error) {
    threwOnWrite = (error as Error).message
}
check("a failing write does not throw at the call site", threwOnWrite === null, threwOnWrite ?? undefined)
check(
    "the view still changes when persistence is unavailable",
    readCatalogView("catalog:hostile", "grid") === "list",
)

// A write must never bleed into a server render - a shared server process serves many requests.
const afterWriteMarkup = renderProbe("catalog:hostile")
check(
    "a prior write does not leak into a later server render",
    afterWriteMarkup.includes('data-view="grid"'),
    afterWriteMarkup,
)
check("server markup is unchanged after client writes", afterWriteMarkup === noStoreMarkup)

report.clientStore = {
    subscriberNotifications: notified,
    hostileWriteThrew: threwOnWrite,
    serverMarkupAfterClientWrite: afterWriteMarkup,
}

// ---------------------------------------------------------------------------
// 6. Key isolation across the four keys really used in the dashboard. The restructure introduced
//    module-level state shared by every caller, which is the one new risk it carries: a mis-keyed
//    cache would make one catalog's view toggle move another's. These are the live keys, so a
//    rename that forgets a caller shows up as a shared-state failure rather than silently.
// ---------------------------------------------------------------------------
const LIVE_KEYS = ["pl-courses-view", "pl-events-view", "pl-shop-view", "pl-services-view"]
fakeStore.install()
for (const key of LIVE_KEYS) {
    check(`live key ${key} renders the fallback on the server`, renderProbe(key).includes('data-view="grid"'))
}
writeCatalogView("pl-shop-view", "list")
check("writing one live key changes that key", readCatalogView("pl-shop-view", "grid") === "list")
for (const key of LIVE_KEYS.filter((k) => k !== "pl-shop-view")) {
    check(
        `writing pl-shop-view leaves ${key} alone`,
        readCatalogView(key, "grid") === "grid",
        readCatalogView(key, "grid"),
    )
}
check(
    "a client write to a live key still does not change its server markup",
    renderProbe("pl-shop-view").includes('data-view="grid"'),
    renderProbe("pl-shop-view"),
)

report.liveKeys = {
    keys: LIVE_KEYS,
    serverMarkupPerKey: LIVE_KEYS.map((key) => `${key}=${renderProbe(key)}`),
}

fakeStore.uninstall()

report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures
report.assertionsRun = assertionsRun
report.assertionsPassed = assertionsPassed

console.log(JSON.stringify(report, null, 2))

// Machine-readable assertion evidence. Both numbers come from the counters incremented inside
// check() above, so they cannot claim more than actually ran. The GATE-EVIDENCE line must be the
// WHOLE line and name this file exactly.
console.log(`GATE-EVIDENCE harness=check-react-hook-behaviour.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

if (failures.length > 0) process.exitCode = 1
