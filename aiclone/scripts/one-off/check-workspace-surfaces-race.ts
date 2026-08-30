import type { WorkspaceSurfaceResolution } from "../../src/components/business-os/workspace-surfaces-shared"

/**
 * Live component harness for WorkspaceSurfacesPanel's stale-response contract.
 *
 * package.json has React and ReactDOM, but no react-test-renderer, jsdom, happy-dom,
 * linkedom, or Testing Library. This harness therefore gives the already-declared
 * react-dom/client a deliberately tiny in-memory DOM host. React really mounts the
 * component, runs useEffect/cleanup, and commits host mutations; this is not static
 * rendering and does not scan component source for the behaviour under test.
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

class HostNode {
    readonly childNodes: HostNode[] = []
    parentNode: HostNode | null = null
    directText = ""

    constructor(
        readonly nodeType: number,
        readonly nodeName: string,
        readonly ownerDocument: HostDocument | null,
    ) {}

    get firstChild(): HostNode | null {
        return this.childNodes[0] ?? null
    }

    get lastChild(): HostNode | null {
        return this.childNodes[this.childNodes.length - 1] ?? null
    }

    get textContent(): string {
        if (this.nodeType === 3) return this.directText
        return this.directText + this.childNodes.map((child) => child.textContent).join("")
    }

    set textContent(value: string) {
        for (const child of this.childNodes) child.parentNode = null
        this.childNodes.length = 0
        this.directText = String(value)
        this.changed()
    }

    get nodeValue(): string | null {
        return this.nodeType === 3 ? this.directText : null
    }

    set nodeValue(value: string | null) {
        this.directText = value ?? ""
        this.changed()
    }

    appendChild<T extends HostNode>(child: T): T {
        if (child.parentNode) child.parentNode.removeChild(child)
        this.childNodes.push(child)
        child.parentNode = this
        this.changed()
        return child
    }

    insertBefore<T extends HostNode>(child: T, before: HostNode | null): T {
        if (before === null) return this.appendChild(child)
        const index = this.childNodes.indexOf(before)
        if (index < 0) throw new Error("insertBefore target is not a child")
        if (child.parentNode) child.parentNode.removeChild(child)
        this.childNodes.splice(index, 0, child)
        child.parentNode = this
        this.changed()
        return child
    }

    removeChild<T extends HostNode>(child: T): T {
        const index = this.childNodes.indexOf(child)
        if (index < 0) throw new Error("removeChild target is not a child")
        this.childNodes.splice(index, 1)
        child.parentNode = null
        this.changed()
        return child
    }

    contains(candidate: HostNode | null): boolean {
        if (candidate === this) return true
        return this.childNodes.some((child) => child.contains(candidate))
    }

    addEventListener() {}
    removeEventListener() {}

    protected changed() {
        if (this.ownerDocument) this.ownerDocument.mutations += 1
    }
}

class HostElement extends HostNode {
    readonly attributes = new Map<string, string>()
    readonly style = {
        setProperty: (_name: string, _value: string) => undefined,
        removeProperty: (_name: string) => undefined,
    }
    readonly tagName: string

    constructor(
        tagName: string,
        ownerDocument: HostDocument,
        readonly namespaceURI = "http://www.w3.org/1999/xhtml",
    ) {
        super(1, tagName.toUpperCase(), ownerDocument)
        this.tagName = tagName.toUpperCase()
    }

    setAttribute(name: string, value: unknown) {
        this.attributes.set(name, String(value))
        this.changed()
    }

    setAttributeNS(_namespace: string | null, name: string, value: unknown) {
        this.setAttribute(name, value)
    }

    removeAttribute(name: string) {
        if (this.attributes.delete(name)) this.changed()
    }

    removeAttributeNS(_namespace: string | null, name: string) {
        this.removeAttribute(name)
    }

    getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null
    }

    hasAttribute(name: string): boolean {
        return this.attributes.has(name)
    }

    focus() {
        if (this.ownerDocument) this.ownerDocument.activeElement = this
    }
}

class HostIFrameElement extends HostElement {}
class HostSvgElement extends HostElement {}

class HostText extends HostNode {
    constructor(value: string, ownerDocument: HostDocument) {
        super(3, "#text", ownerDocument)
        this.directText = value
    }
}

class HostDocument extends HostNode {
    readonly documentElement: HostElement
    readonly body: HostElement
    activeElement: HostElement | null = null
    defaultView: Record<string, unknown> = {}
    mutations = 0

    constructor() {
        super(9, "#document", null)
        this.documentElement = new HostElement("html", this)
        this.body = new HostElement("body", this)
        this.documentElement.appendChild(this.body)
        this.activeElement = this.body
        this.mutations = 0
    }

    createElement(tagName: string): HostElement {
        return tagName.toLowerCase() === "iframe"
            ? new HostIFrameElement(tagName, this)
            : new HostElement(tagName, this)
    }

    createElementNS(namespace: string, tagName: string): HostElement {
        return namespace === "http://www.w3.org/2000/svg"
            ? new HostSvgElement(tagName, this, namespace)
            : new HostElement(tagName, this, namespace)
    }

    createTextNode(value: string): HostText {
        return new HostText(value, this)
    }
}

type Deferred<T> = Readonly<{
    promise: Promise<T>
    resolve(value: T): void
    reject(cause: unknown): void
}>

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    let reject!: (cause: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

type ControlledCall = Readonly<{
    workspaceId: string
    signal: AbortSignal | undefined
    deferred: Deferred<WorkspaceSurfaceResolution>
}>

function makeControlledRequest() {
    const calls: ControlledCall[] = []
    const request = <T,>(input: string, init?: RequestInit): Promise<T> => {
        const pending = deferred<WorkspaceSurfaceResolution>()
        const match = input.match(/\/workspaces\/([^/]+)\/surfaces$/)
        if (!match) throw new Error(`Unexpected workspace surfaces URL: ${input}`)
        calls.push({
            workspaceId: decodeURIComponent(match[1]),
            signal: init?.signal ?? undefined,
            deferred: pending,
        })
        // Intentionally ignore AbortSignal: the panel's independent superseded/key defenses
        // must still hold when transport cancellation cannot stop an already-running response.
        return pending.promise as Promise<T>
    }
    return { calls, request }
}

function activeResolution(workspaceId: string, blueprintId: string, surface: "calendar" | "leads" | "shop"): WorkspaceSurfaceResolution {
    return {
        workspaceId,
        installationId: `installation-${workspaceId}`,
        blueprintId,
        source: "active-blueprint-installation",
        surfaces: [surface],
        unknownSurfaces: [],
        notInstallableSurfaces: [],
    }
}

function emptyResolution(workspaceId: string): WorkspaceSurfaceResolution {
    return {
        workspaceId,
        installationId: null,
        blueprintId: null,
        source: "no-active-blueprint-installation",
        surfaces: [],
        unknownSurfaces: [],
        notInstallableSurfaces: [],
    }
}

function hasAttribute(root: HostNode, name: string, value: string): boolean {
    if (root instanceof HostElement && root.getAttribute(name) === value) return true
    return root.childNodes.some((child) => hasAttribute(child, name, value))
}

function installDom() {
    const document = new HostDocument()
    const window = {
        document,
        Node: HostNode,
        Element: HostElement,
        HTMLElement: HostElement,
        HTMLIFrameElement: HostIFrameElement,
        SVGElement: HostSvgElement,
        Event: class Event {},
        getSelection: () => null,
    }
    document.defaultView = window
    Object.assign(globalThis, {
        document,
        window,
        Node: HostNode,
        Element: HostElement,
        HTMLElement: HostElement,
        HTMLIFrameElement: HostIFrameElement,
        SVGElement: HostSvgElement,
        IS_REACT_ACT_ENVIRONMENT: true,
    })
    return document
}

async function main() {
    const document = installDom()
    const React = await import("react")
    const { act } = React
    const { createRoot } = await import("react-dom/client")
    const { WorkspaceSurfacesPanel } = await import("../../src/components/business-os/workspace-surfaces-panel")

    const mount = () => {
        const container = document.createElement("div")
        document.body.appendChild(container)
        return { container, root: createRoot(container as never) }
    }
    const render = async (
        mounted: ReturnType<typeof mount>,
        workspaceId: string,
        request?: <T>(input: string, init?: RequestInit) => Promise<T>,
    ) => {
        await act(async () => {
            mounted.root.render(React.createElement(WorkspaceSurfacesPanel, { workspaceId, request }))
            await Promise.resolve()
        })
    }
    const settle = async (action: () => void) => {
        await act(async () => {
            action()
            await Promise.resolve()
            await Promise.resolve()
        })
    }
    const unmount = async (mounted: ReturnType<typeof mount>) => {
        await act(async () => mounted.root.unmount())
    }

    // Main race: A starts, B supersedes it, B resolves first, then the ignored-abort A resolves.
    const race = makeControlledRequest()
    const mountedRace = mount()
    await render(mountedRace, "workspace-A", race.request)
    checkInvertible("workspace A request starts", race.calls.length === 1 && race.calls[0].workspaceId === "workspace-A")
    checkInvertible("workspace A initially renders loading", hasAttribute(mountedRace.container, "aria-busy", "true"))

    await render(mountedRace, "workspace-B", race.request)
    checkInvertible("prop change starts workspace B request", race.calls.length === 2 && race.calls[1].workspaceId === "workspace-B")
    checkInvertible("workspace change aborts A transport", race.calls[0].signal?.aborted === true)
    checkInvertible("B is loading before either response lands", hasAttribute(mountedRace.container, "aria-busy", "true"))

    await settle(() => race.calls[1].deferred.resolve(activeResolution("workspace-B", "blueprint-B", "leads")))
    checkInvertible("B resolves first and renders its blueprint", mountedRace.container.textContent.includes("blueprint-B"))
    checkInvertible("B resolves first and renders its surface", mountedRace.container.textContent.includes("Leads"))
    checkInvertible("B success removes loading", !hasAttribute(mountedRace.container, "aria-busy", "true"))
    checkInvertible("B success has no error", !hasAttribute(mountedRace.container, "role", "alert"))

    await settle(() => race.calls[0].deferred.resolve(activeResolution("workspace-A", "blueprint-A-stale", "calendar")))
    checkInvertible("late A cannot replace B data", mountedRace.container.textContent.includes("blueprint-B") && !mountedRace.container.textContent.includes("blueprint-A-stale"))
    checkInvertible("late A cannot replace B with loading", !hasAttribute(mountedRace.container, "aria-busy", "true"))
    checkInvertible("late A cannot introduce an error state", !hasAttribute(mountedRace.container, "role", "alert"))

    // The code documents refetch-on-switch (the effect reruns for workspaceId); it does not cache A.
    await render(mountedRace, "workspace-A", race.request)
    checkInvertible("switching back to A performs a new request", race.calls.length === 3 && race.calls[2].workspaceId === "workspace-A")
    checkInvertible("switching back to A renders loading until the refetch resolves", hasAttribute(mountedRace.container, "aria-busy", "true"))
    checkInvertible("switching back does not expose the ignored stale A response", !mountedRace.container.textContent.includes("blueprint-A-stale"))
    await settle(() => race.calls[2].deferred.resolve(emptyResolution("workspace-A")))
    checkInvertible("the A refetch result renders", mountedRace.container.textContent.includes("No blueprint installed"))
    await unmount(mountedRace)

    // Read gate, success direction: an already-rendered A value must disappear while B is pending.
    const storedSuccess = makeControlledRequest()
    const mountedStoredSuccess = mount()
    await render(mountedStoredSuccess, "stored-A", storedSuccess.request)
    await settle(() => storedSuccess.calls[0].deferred.resolve(activeResolution("stored-A", "stored-A-blueprint", "shop")))
    await render(mountedStoredSuccess, "stored-B", storedSuccess.request)
    checkInvertible("loaded key gate hides stored A data from B", !mountedStoredSuccess.container.textContent.includes("stored-A-blueprint"))
    checkInvertible("loaded key gate gives pending B its loading state", hasAttribute(mountedStoredSuccess.container, "aria-busy", "true"))
    await settle(() => storedSuccess.calls[1].deferred.resolve(emptyResolution("stored-B")))
    await unmount(mountedStoredSuccess)

    // Read gate, error direction: an already-rendered A error must disappear while B is pending.
    const storedError = makeControlledRequest()
    const mountedStoredError = mount()
    await render(mountedStoredError, "error-A", storedError.request)
    await settle(() => storedError.calls[0].deferred.reject(new Error("stored A failure")))
    checkInvertible("A error fixture really renders an error", hasAttribute(mountedStoredError.container, "role", "alert"))
    await render(mountedStoredError, "error-B", storedError.request)
    checkInvertible("failed key gate hides stored A error from B", !hasAttribute(mountedStoredError.container, "role", "alert"))
    checkInvertible("failed key gate gives pending B its loading state", hasAttribute(mountedStoredError.container, "aria-busy", "true"))
    await settle(() => storedError.calls[1].deferred.resolve(emptyResolution("error-B")))
    await unmount(mountedStoredError)

    // Error race: B's current error survives a later success from superseded A.
    const errorRace = makeControlledRequest()
    const mountedErrorRace = mount()
    await render(mountedErrorRace, "late-A", errorRace.request)
    await render(mountedErrorRace, "current-B", errorRace.request)
    await settle(() => errorRace.calls[1].deferred.reject(new Error("current B failure")))
    checkInvertible("B error resolves first and renders", hasAttribute(mountedErrorRace.container, "role", "alert"))
    await settle(() => errorRace.calls[0].deferred.resolve(activeResolution("late-A", "late-A-blueprint", "calendar")))
    checkInvertible("late A cannot replace B error state", hasAttribute(mountedErrorRace.container, "role", "alert") && !mountedErrorRace.container.textContent.includes("late-A-blueprint"))
    checkInvertible("late A cannot replace B error with loading", !hasAttribute(mountedErrorRace.container, "aria-busy", "true"))
    await unmount(mountedErrorRace)

    // Unmount cleanup: abort is observed and settling an abort-ignoring request commits nothing.
    const unmountedRequest = makeControlledRequest()
    const mountedUnmount = mount()
    await render(mountedUnmount, "unmount-A", unmountedRequest.request)
    await unmount(mountedUnmount)
    const mutationsAfterUnmount = document.mutations
    checkInvertible("unmount aborts the in-flight request", unmountedRequest.calls[0].signal?.aborted === true)
    await settle(() => unmountedRequest.calls[0].deferred.resolve(activeResolution("unmount-A", "too-late", "calendar")))
    checkInvertible("late unmounted response causes no host update", document.mutations === mutationsAfterUnmount)
    checkInvertible("unmounted container remains empty", mountedUnmount.container.childNodes.length === 0)

    // Production default path: omit the seam and prove the unchanged wrapper reaches global fetch.
    const originalFetch = globalThis.fetch
    const defaultFetchCalls: Array<{ input: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        defaultFetchCalls.push({ input: String(input), init })
        return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, data: emptyResolution("default-workspace") }),
        } as Response
    }) as typeof fetch
    try {
        const mountedDefault = mount()
        await act(async () => {
            mountedDefault.root.render(React.createElement(WorkspaceSurfacesPanel, { workspaceId: "default-workspace" }))
            await Promise.resolve()
            await Promise.resolve()
        })
        checkInvertible("production-style mount passes no request seam and calls global fetch", defaultFetchCalls.length === 1)
        checkInvertible("production default requests the workspace-scoped endpoint", defaultFetchCalls[0]?.input.endsWith("/workspaces/default-workspace/surfaces"))
        checkInvertible("production default preserves no-store fetch semantics", defaultFetchCalls[0]?.init?.cache === "no-store")
        checkInvertible("production default result renders", mountedDefault.container.textContent.includes("No blueprint installed"))
        await unmount(mountedDefault)
    } finally {
        globalThis.fetch = originalFetch
    }

    const report = {
        result: failures.length === 0 ? "PASS" : "FAIL",
        assertions: assertionCount,
        inversionEnabled: INVERT,
        inversionFlips: INVERT ? failures.length : 0,
        observedRequests: {
            primaryRace: race.calls.map((call) => call.workspaceId),
            switchBackBehavior: "refetch",
            ignoredAbortWasExercised: race.calls[0].signal?.aborted === true,
        },
        failures,
    }
    console.log(JSON.stringify(report, null, 2))
    if (failures.length > 0) process.exitCode = 1
}

void main().catch((cause) => {
    console.error(cause)
    process.exitCode = 1
})
