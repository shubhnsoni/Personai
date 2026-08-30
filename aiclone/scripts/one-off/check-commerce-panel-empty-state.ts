import { collectElements, countTextOccurrences, hasAttribute, installDom } from "../lib/dom-host"

/**
 * Live component harness for CommercePanel's no-workspace state.
 *
 * THE DEFECT THIS EXISTS FOR, and why it needed a mounted component to see.
 *
 * CommercePanel composed two children that each carried their own `!workspaceId` empty state, so an
 * owner with no workspace selected saw TWO stacked cards both saying "Select a workspace". It was
 * reported from outside a worker's paths and left alone as cosmetic. It stopped being cosmetic when the
 * shell stopped auto-selecting a workspace for owners who have more than one: the state went from a
 * momentary flash to somewhere an owner can sit indefinitely.
 *
 * No existing assertion could have caught it. Asking "is the selection message present?" is TRUE with
 * one message and equally TRUE with two, and `renderToStaticMarkup` never runs the effects that decide
 * what these panels render. So the message is COUNTED here, against a real mount.
 *
 * The dangerous fix is worse than the defect: deleting a child's guard removes a duplicate message and
 * leaves that child able to fetch with a blank workspace id, or hides a whole commerce section when a
 * workspace IS selected. Both are asserted against below.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-commerce-panel-empty-state.ts
 */

const INVERT = process.env.INVERT_ASSERTION === "1"
const failures: string[] = []
let assertionCount = 0

function checkInvertible(name: string, observed: unknown, detail?: string) {
    assertionCount += 1
    const passesNormally = Boolean(observed)
    const passesThisRun = INVERT ? !passesNormally : passesNormally
    if (!passesThisRun) failures.push(detail ? `${name}: ${detail}` : name)
}

const SELECTION_MESSAGE = "Select a workspace"
const VARIANTS_HEADING = "Product variants"
const ORDERS_HEADING = "Shipments and returns"

type Requested = Readonly<{ url: string; workspaceId: string | null }>

/**
 * Records every URL the mounted tree requests, so "did a child fetch with a blank workspace id?" is an
 * observation rather than a source-level argument.
 */
function makeRecordingFetch(requested: Requested[]) {
    return async (input: unknown, _init?: unknown): Promise<unknown> => {
        const url = String(input)
        const workspaceId = new URL(url, "http://commerce.test").searchParams.get("workspaceId")
        requested.push({ url, workspaceId })
        const body = url.includes("/api/platform/products")
            ? { ok: true, data: { products: [] } }
            : url.includes("/api/platform/orders")
              ? { ok: true, data: { orders: [] } }
              : { ok: true, data: {} }
        return {
            ok: true,
            status: 200,
            json: async () => body,
        }
    }
}

async function main() {
    const document = installDom()
    const React = await import("react")
    const { act } = React
    const { createRoot } = await import("react-dom/client")
    const { CommercePanel } = await import("../../src/components/business-os/commerce-panel")

    const requested: Requested[] = []
    const originalFetch = (globalThis as { fetch?: unknown }).fetch
    ;(globalThis as { fetch?: unknown }).fetch = makeRecordingFetch(requested)

    const mount = () => {
        const container = document.createElement("div")
        document.body.appendChild(container)
        return { container, root: createRoot(container as never) }
    }
    const render = async (mounted: ReturnType<typeof mount>, workspaceId: string, locationId = "loc-1") => {
        await act(async () => {
            mounted.root.render(React.createElement(CommercePanel, { workspaceId, locationId }))
            await Promise.resolve()
            await Promise.resolve()
        })
    }

    try {
        // ---- 1. no workspace: exactly ONE message, and nothing fetched ---------
        const mounted = mount()
        await render(mounted, "")

        const zeroCount = countTextOccurrences(mounted.container, SELECTION_MESSAGE)
        checkInvertible(
            "MEASURED: with no workspace the selection message appears exactly ONCE, not twice",
            zeroCount === 1,
            `counted ${zeroCount}`,
        )
        // The specific regression: two of them. Named separately so a future 0 and a future 2 are
        // distinguishable in the output rather than both reading as "not 1".
        checkInvertible("with no workspace the message is not duplicated", zeroCount <= 1, `counted ${zeroCount}`)
        checkInvertible("with no workspace the message is not missing entirely", zeroCount >= 1, `counted ${zeroCount}`)
        checkInvertible(
            "MEASURED: with no workspace NOTHING is requested - no child fetches with a blank id",
            requested.length === 0,
            `${requested.length} request(s): ${requested.map((r) => r.url).join(", ")}`,
        )
        // Hiding the sections is the correct behaviour with no workspace, but only because the message
        // replaces them. Asserted so "renders nothing at all" cannot pass as a fix.
        checkInvertible(
            "with no workspace neither commerce section heading is rendered",
            !mounted.container.textContent.includes(VARIANTS_HEADING) &&
                !mounted.container.textContent.includes(ORDERS_HEADING),
            mounted.container.textContent.slice(0, 120),
        )

        // ---- 2. a workspace IS selected: BOTH sections render ------------------
        // This is the regression that matters most. Removing a duplicate message by hiding one of the
        // two commerce sections would be strictly worse than the duplicate it fixed.
        await render(mounted, "workspace-A")
        checkInvertible(
            "MEASURED: with a workspace selected BOTH commerce sections render",
            mounted.container.textContent.includes(VARIANTS_HEADING) &&
                mounted.container.textContent.includes(ORDERS_HEADING),
            `variants=${mounted.container.textContent.includes(VARIANTS_HEADING)} orders=${mounted.container.textContent.includes(ORDERS_HEADING)}`,
        )
        const selectedCount = countTextOccurrences(mounted.container, SELECTION_MESSAGE)
        checkInvertible(
            "with a workspace selected the selection message is gone entirely",
            selectedCount === 0,
            `counted ${selectedCount}`,
        )
        const idsA = requested.map((r) => r.workspaceId)
        checkInvertible(
            "both children requested their own data for the selected workspace",
            requested.some((r) => r.url.includes("/products") && r.workspaceId === "workspace-A") &&
                requested.some((r) => r.url.includes("/orders") && r.workspaceId === "workspace-A"),
            `ids=${idsA.join(",")}`,
        )
        checkInvertible(
            "MEASURED: no request was ever issued with a blank or missing workspace id",
            requested.every((r) => typeof r.workspaceId === "string" && r.workspaceId.length > 0),
            `${requested.filter((r) => !r.workspaceId).length} blank-id request(s)`,
        )

        // ---- 3. switching workspace refreshes both sections --------------------
        const beforeSwitch = requested.length
        await render(mounted, "workspace-B")
        const afterSwitch = requested.slice(beforeSwitch)
        checkInvertible(
            "MEASURED: switching workspace refetches BOTH sections for the new workspace",
            afterSwitch.some((r) => r.url.includes("/products") && r.workspaceId === "workspace-B") &&
                afterSwitch.some((r) => r.url.includes("/orders") && r.workspaceId === "workspace-B"),
            `new requests=${afterSwitch.map((r) => `${r.url.includes("/products") ? "products" : "orders"}:${r.workspaceId}`).join(",")}`,
        )
        checkInvertible(
            "after switching, both sections are still present",
            mounted.container.textContent.includes(VARIANTS_HEADING) &&
                mounted.container.textContent.includes(ORDERS_HEADING),
        )
        checkInvertible(
            "after switching, no request for the OLD workspace is issued again",
            !afterSwitch.some((r) => r.workspaceId === "workspace-A"),
            afterSwitch.map((r) => String(r.workspaceId)).join(","),
        )

        // ---- 4. back to no workspace: one message again, sections gone ---------
        // Returning to the empty state must not accumulate messages, which a parent that rendered the
        // message alongside the children rather than instead of them would do.
        await render(mounted, "")
        const backCount = countTextOccurrences(mounted.container, SELECTION_MESSAGE)
        checkInvertible(
            "MEASURED: returning to no-workspace shows exactly one message again, not an accumulation",
            backCount === 1,
            `counted ${backCount}`,
        )
        checkInvertible(
            "returning to no-workspace removes both section headings",
            !mounted.container.textContent.includes(VARIANTS_HEADING) &&
                !mounted.container.textContent.includes(ORDERS_HEADING),
        )

        // ---- 5. the empty state is a real, accessible message ------------------
        await render(mounted, "")
        const headings = collectElements(mounted.container, (el) => el.tagName === "H3")
        checkInvertible(
            "the single selection message is a heading, so it is announced rather than being loose text",
            headings.filter((h) => h.textContent.includes(SELECTION_MESSAGE)).length === 1,
            `${headings.length} h3(s)`,
        )
        checkInvertible(
            "the no-workspace state is not presented as a loading state",
            !hasAttribute(mounted.container, "aria-busy", "true"),
        )

        await act(async () => mounted.root.unmount())
    } finally {
        ;(globalThis as { fetch?: unknown }).fetch = originalFetch
    }

    const report = {
        result: failures.length === 0 ? "PASS" : "FAIL",
        assertions: assertionCount,
        inversionEnabled: INVERT,
        requestedUrls: requested.map((r) => `${r.url.includes("/products") ? "products" : "orders"}:${r.workspaceId}`),
        failures,
    }
    console.log(JSON.stringify(report, null, 2))
    if (failures.length > 0) process.exitCode = 1
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
