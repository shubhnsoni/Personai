/**
 * A deliberately tiny in-memory DOM host, so `react-dom/client` can really mount a component in a
 * harness with NO new dependency.
 *
 * package.json declares React and ReactDOM but no react-test-renderer, jsdom, happy-dom, linkedom or
 * Testing Library, and installing one was explicitly out of scope. `renderToStaticMarkup` is not an
 * option either: it never runs effects, so every property that lives in a `useEffect` - loading states,
 * aborts, stale-response defences, cleanup on unmount - is invisible to it. That is why several
 * component properties in this repository were historically asserted by scanning component SOURCE,
 * which is an argument about code rather than an observation of behaviour.
 *
 * This host closes that gap. React mounts, runs effects and cleanup, and commits host mutations, so a
 * harness can observe what actually rendered.
 *
 * Extracted from check-workspace-surfaces-race.ts, which introduced it and was its only user, when a
 * second harness needed the same host. Duplicating ~230 lines of host would have been the alternative,
 * and two copies of a test host drift exactly like two copies of an envelope helper.
 *
 * It is NOT a browser and does not pretend to be. No layout, no CSS, no real events, no selection. It
 * implements the surface React's DOM renderer actually touches. If React starts touching more, this
 * file gains the method rather than the harness gaining a dependency.
 */

export class HostNode {
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

export class HostElement extends HostNode {
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

export class HostIFrameElement extends HostElement {}
export class HostSvgElement extends HostElement {}

export class HostText extends HostNode {
    constructor(value: string, ownerDocument: HostDocument) {
        super(3, "#text", ownerDocument)
        this.directText = value
    }
}

export class HostDocument extends HostNode {
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

/** True when any node in the tree carries this attribute with this value. */
export function hasAttribute(root: HostNode, name: string, value: string): boolean {
    if (root instanceof HostElement && root.getAttribute(name) === value) return true
    return root.childNodes.some((child) => hasAttribute(child, name, value))
}

/** Every element in the tree satisfying the predicate, in document order. */
export function collectElements(root: HostNode, predicate: (element: HostElement) => boolean): HostElement[] {
    const found: HostElement[] = []
    const walk = (node: HostNode) => {
        if (node instanceof HostElement && predicate(node)) found.push(node)
        for (const child of node.childNodes) walk(child)
    }
    walk(root)
    return found
}

/**
 * How many times a phrase appears in the rendered text.
 *
 * Exists so "is this message duplicated?" can be COUNTED rather than eyeballed. A duplicate-message
 * defect is invisible to any assertion that only asks whether the message is present at all, which is
 * how the commerce double empty state survived review.
 */
export function countTextOccurrences(root: HostNode, phrase: string): number {
    const text = root.textContent
    if (phrase.length === 0) return 0
    let count = 0
    let index = text.indexOf(phrase)
    while (index !== -1) {
        count += 1
        index = text.indexOf(phrase, index + phrase.length)
    }
    return count
}

/**
 * Installs the host on `globalThis` and returns the document.
 *
 * `IS_REACT_ACT_ENVIRONMENT` is set so `act()` behaves as it does under a real test runner. Note that
 * `navigator` is deliberately NOT assigned: it is read-only on modern Node and assigning it throws
 * before the first mount.
 */
export function installDom(): HostDocument {
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
